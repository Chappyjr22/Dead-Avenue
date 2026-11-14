// Small position-based ragdoll. World-space particles, fixed steps and distance
// constraints avoid a physics dependency and keep the mobile cost bounded.
import * as THREE from 'three';
const STEP = 1 / 60;
const delta = new THREE.Vector3(), direction = new THREE.Vector3();
const basis = new THREE.Matrix4(), lateral = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3();
const rotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion();
export class ZombieRagdoll {
  constructor(body, impulse = new THREE.Vector3(0, 0, -1), hitHeight = 1.2) {
    body.updateWorldMatrix(true, true);
    this.body = body; this.points = []; this.links = []; this.time = 0;
    this.accumulator = 0; this.sleeping = false; this.quiet = 0;
    const map = new Map();
    body.traverse(bone => {
      if (!bone.isBone || /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(bone.name)) return;
      const name = bone.name.replace('CityDeadOutfit', '');
      const p = bone.getWorldPosition(new THREE.Vector3());
      const radius = /Head/.test(name) ? .14 : /Hips|Spine/.test(name) ? .13 : /Hand/.test(name) ? .10 : .075;
      const point = { bone, name, p, previous: p.clone(), radius,
        mass: /Hips|Spine/.test(name) ? 3 : /Head|UpLeg/.test(name) ? 1.5 : 1,
        worldQ: bone.getWorldQuaternion(new THREE.Quaternion()), child: null };
      this.points.push(point); map.set(bone, point);
    });
    const baseY = Math.min(...this.points.map(p => p.p.y));
    const push = impulse.clone(); push.y = 0;
    if (push.lengthSq() < .001) push.set(0, 0, -1); push.normalize();
    for (const p of this.points) {
      const parent = map.get(p.bone.parent);
      if (parent) {
        this.link(parent, p);
        if (!parent.child) parent.child = p;
      }
      const leverage = THREE.MathUtils.clamp((p.p.y - baseY) / 1.7, .1, 1);
      const hit = Math.exp(-Math.abs(p.p.y - baseY - hitHeight) * 3);
      p.previous.addScaledVector(push, -STEP * (.25 + leverage * .65 + hit * .45));
    }
    // Brace the trunk and pelvis as volumes rather than a floppy chain.
    const names = Object.fromEntries(this.points.map(p => [p.name, p]));
    this.names = names; this.joints = [];
    // Keep chest and hips oriented by both axes, including roll about the spine.
    for (const [name,left,right,top] of [['Hips','LeftUpLeg','RightUpLeg','Spine'],['Spine2','LeftArm','RightArm','Neck']]) {
      const p=names[name];p.frame={left:names[left],right:names[right],top:names[top]};
      p.frameOffset=this.frameQuaternion(p).invert().multiply(p.worldQ);
    }
    for (const group of [
      ['Hips', 'LeftUpLeg', 'RightUpLeg', 'Spine', 'Spine1', 'Spine2'],
      ['Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm']
    ]) for (let i=0;i<group.length;i++) for (let j=i+1;j<group.length;j++) this.link(names[group[i]], names[group[j]]);
    // One braced torso prevents the chest and pelvis winding in opposite directions.
    for(const a of ['Hips','LeftUpLeg','RightUpLeg'])
      for(const b of ['Neck','LeftArm','RightArm']) this.link(names[a],names[b]);
    this.link(names.Neck, names.Head);
    // Limit folding and overextension at elbows and knees.
    for (const side of ['Left', 'Right']) for (const chain of [['Arm','ForeArm','Hand'],['UpLeg','Leg','Foot']]) {
      const [a,b,c] = chain.map(n => names[side+n]);
      const length = a.p.distanceTo(b.p) + b.p.distanceTo(c.p);
      this.joints.push({a,b,c,leg:chain[0]==='UpLeg',side:side==='Left'?1:-1,
        upper:a.p.distanceTo(b.p),lower:b.p.distanceTo(c.p)});
      this.links.push({a,b:c,min:length*(chain[0]==='UpLeg' ? .78 : .38),max:length*.995});
    }
    this.initialFrame = this.frameQuaternion(names.Hips);
    for (const p of this.points) if (p.child) p.axis = p.child.p.clone().sub(p.p).normalize();
  }
  frameQuaternion(p) {
    up.subVectors(p.frame.top.p,p.p).normalize();
    lateral.subVectors(p.frame.left.p,p.frame.right.p);
    lateral.addScaledVector(up,-lateral.dot(up)).normalize();
    forward.crossVectors(lateral,up).normalize();
    basis.makeBasis(lateral,up,forward);
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }
  solveJoints() {
    const frame=this.frameQuaternion(this.names.Hips);
    const front=new THREE.Vector3(0,0,1).applyQuaternion(frame);
    const down=new THREE.Vector3(0,-1,0).applyQuaternion(frame);
    const side=new THREE.Vector3(1,0,0).applyQuaternion(frame);
    for(const j of this.joints) {
      const {a,b,c,upper,lower,leg}=j;
      // Hip/shoulder cone relative to the torso, not world-space.
      const axis=down.clone().addScaledVector(side,j.side*(leg?.12:.35)).normalize();
      const limb=b.p.clone().sub(a.p).normalize(), cos=Math.cos((leg?75:105)*Math.PI/180);
      if(limb.dot(axis)<cos) {
        const tangent=limb.clone().addScaledVector(axis,-limb.dot(axis)).normalize();
        const target=a.p.clone().addScaledVector(axis,upper*cos).addScaledVector(tangent,upper*Math.sqrt(1-cos*cos));
        const shift=target.sub(b.p).multiplyScalar(.5);b.p.add(shift);c.p.add(shift);
      }
      // Two-bone hinge: knees bend forward, elbows backward. This also
      // eliminates sideways bends and the unrestricted corkscrew degree of freedom.
      const line=c.p.clone().sub(a.p), distance=line.length();
      if(distance<.001)continue;
      line.multiplyScalar(1/distance);
      const pole=front.clone().multiplyScalar(leg?1:-1);
      pole.addScaledVector(line,-pole.dot(line));
      if(pole.lengthSq()<.001) pole.copy(side).multiplyScalar(j.side).addScaledVector(line,-side.dot(line)*j.side);
      pole.normalize();
      const along=THREE.MathUtils.clamp((upper*upper-lower*lower+distance*distance)/(2*distance),0,upper);
      const height=Math.sqrt(Math.max(0,upper*upper-along*along));
      const target=a.p.clone().addScaledVector(line,along).addScaledVector(pole,height);
      b.p.lerp(target,.6);
    }
  }
  separateTorso() {
    const a=this.names.Hips.p,b=this.names.Neck.p;
    const axis=b.clone().sub(a), length=axis.lengthSq();
    for(const j of this.joints) for(const p of [j.b,j.c]) {
      const closest=p.p.clone().sub(a);
      const t=THREE.MathUtils.clamp(closest.dot(axis)/length,0,1);
      closest.copy(a).addScaledVector(axis,t);
      const offset=p.p.clone().sub(closest), distance=offset.length(), radius=.17+p.radius;
      if(distance<radius && distance>.00001)p.p.addScaledVector(offset,(radius-distance)/distance);
    }
  }
  link(a,b) {
    if (!a || !b || this.links.some(l => (l.a===a && l.b===b)||(l.a===b && l.b===a))) return;
    const length=a.p.distanceTo(b.p);this.links.push({a,b,min:length,max:length});
  }
  update(dt, ground = () => 0, collide = () => {}) {
    if (this.sleeping) return;
    this.accumulator += Math.min(Math.max(dt,0), .1);
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP; this.time += STEP;
      for (const p of this.points) {
        delta.subVectors(p.p,p.previous).multiplyScalar(.985);
        p.previous.copy(p.p);p.p.add(delta);p.p.y -= 9.81*STEP*STEP;
      }
      for (let pass=0;pass<8;pass++) {
        for (const {a,b,min,max} of this.links) {
          delta.subVectors(b.p,a.p);const length=delta.length();
          if (length<1e-6) continue;
          const target=THREE.MathUtils.clamp(length,min,max);
          delta.multiplyScalar((length-target)/length);
          const wa=1/a.mass, wb=1/b.mass;
          a.p.addScaledVector(delta,wa/(wa+wb));b.p.addScaledVector(delta,-wb/(wa+wb));
        }
        this.solveJoints();
        this.separateTorso();
        for (const p of this.points) {
          collide(p.p,p.radius);
          const floor=ground(p.p.x,p.p.z)+p.radius;
          if (p.p.y<floor) {
            p.p.y=floor;

          }
        }
      }
      // Friction belongs once per timestep, not once per solver iteration.
      // Applying it eight times pinned the hands/feet and left bodies kneeling.
      for (const p of this.points) if(p.p.y<=ground(p.p.x,p.p.z)+p.radius+.002) {
        p.previous.x += (p.p.x-p.previous.x)*.14;
        p.previous.z += (p.p.z-p.previous.z)*.14;
        p.previous.y=p.p.y;
      }
      const movement = Math.max(...this.points.map(p=>p.p.distanceToSquared(p.previous)));
      this.quiet = movement < .000004 ? this.quiet+STEP : 0;
      if ((this.time>1 && this.quiet>.4) || this.time>=5) { this.sleeping=true;break; }
    }
    this.apply();
  }
  apply() {
    // Parent-first traversal preserves the bone hierarchy. Fingers inherit the hand.
    const transport=this.frameQuaternion(this.names.Hips).multiply(this.initialFrame.clone().invert());
    for (const p of this.points) {
      const parent=p.bone.parent;
      parent.updateWorldMatrix(true,false);
      p.bone.position.copy(p.p);parent.worldToLocal(p.bone.position);
      if (p.child) {
        direction.subVectors(p.child.p,p.p).normalize();
        if(p.frame) rotation.copy(this.frameQuaternion(p)).multiply(p.frameOffset);
        else {
          const carriedAxis=p.axis.clone().applyQuaternion(transport);
          rotation.setFromUnitVectors(carriedAxis,direction).multiply(transport).multiply(p.worldQ);
        }
        parent.getWorldQuaternion(parentRotation).invert();
        p.bone.quaternion.copy(parentRotation.multiply(rotation));
      }
      p.bone.updateWorldMatrix(false,false);
    }
    this.body.updateWorldMatrix(true,true);
  }
}
