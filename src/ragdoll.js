// Small position-based ragdoll. World-space particles, fixed steps and distance
// constraints avoid a physics dependency and keep the mobile cost bounded.
import * as THREE from 'three';
const STEP = 1 / 60;
const delta = new THREE.Vector3(), direction = new THREE.Vector3();
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
    for (const group of [
      ['Hips', 'LeftUpLeg', 'RightUpLeg', 'Spine', 'Spine1', 'Spine2'],
      ['Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm']
    ]) for (let i=0;i<group.length;i++) for (let j=i+1;j<group.length;j++) this.link(names[group[i]], names[group[j]]);
    this.link(names.Neck, names.Head);
    // Limit folding and overextension at elbows and knees.
    for (const side of ['Left', 'Right']) for (const chain of [['Arm','ForeArm','Hand'],['UpLeg','Leg','Foot']]) {
      const [a,b,c] = chain.map(n => names[side+n]);
      const length = a.p.distanceTo(b.p) + b.p.distanceTo(c.p);
      this.links.push({a,b:c,min:length*.30,max:length*.985});
    }
    for (const p of this.points) if (p.child) p.axis = p.child.p.clone().sub(p.p).normalize();
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
          delta.multiplyScalar((length-target)/length*.5);
          a.p.add(delta);b.p.sub(delta);
        }
        for (const p of this.points) {
          collide(p.p,p.radius);
          const floor=ground(p.p.x,p.p.z)+p.radius;
          if (p.p.y<floor) {
            p.p.y=floor;
            p.previous.x += (p.p.x-p.previous.x)*.35;
            p.previous.z += (p.p.z-p.previous.z)*.35;
            p.previous.y=p.p.y;
          }
        }
      }
      const movement = Math.max(...this.points.map(p=>p.p.distanceToSquared(p.previous)));
      this.quiet = movement < .000004 ? this.quiet+STEP : 0;
      if ((this.time>1 && this.quiet>.4) || this.time>=5) { this.sleeping=true;break; }
    }
    this.apply();
  }
  apply() {
    // Parent-first traversal preserves the bone hierarchy. Fingers inherit the hand.
    for (const p of this.points) {
      const parent=p.bone.parent;
      parent.updateWorldMatrix(true,false);
      p.bone.position.copy(p.p);parent.worldToLocal(p.bone.position);
      if (p.child) {
        direction.subVectors(p.child.p,p.p).normalize();
        rotation.setFromUnitVectors(p.axis,direction).multiply(p.worldQ);
        parent.getWorldQuaternion(parentRotation).invert();
        p.bone.quaternion.copy(parentRotation.multiply(rotation));
      }
      p.bone.updateWorldMatrix(false,false);
    }
    this.body.updateWorldMatrix(true,true);
  }
}
