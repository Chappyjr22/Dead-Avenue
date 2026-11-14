// Small position-based ragdoll. World-space particles on the joints, fixed 60 Hz Verlet steps,
// rigid and ranged distance links (ranges act as joint limits), ground and wall contact.
// No physics dependency; a body costs a few hundred link solves per step and sleeps within ~3 s.
import * as THREE from 'three';
const STEP = 1 / 60, PASSES = 6, MAX_TIME = 3, MAX_SPEED = 9;
const delta = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const basis = new THREE.Matrix4(), q = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
// Ranged links as fractions of the pose-at-death distance: thighs cannot fold into the chest, ankles stay firm,
// forearms stay out of the chest.
const RANGES = [['LeftLeg','Spine1',.72,1.12],['RightLeg','Spine1',.72,1.12],['LeftLeg','LeftToeBase',.85,1.08],['RightLeg','RightToeBase',.85,1.08],
  ['LeftForeArm','Spine1',.45,2],['RightForeArm','Spine1',.45,2]];
// Cone limits in a torso bone's frame: [frame bone, joint, tip, half angle]. The cone is centred halfway between the
// limb's direction at death and the torso axis, so the zombie's craned neck can lie flat or snap back, but not fold over.
const CONES = [['Spine2','Neck','Head',70]];
const APART = [['LeftLeg','RightLeg',.18],['LeftFoot','RightFoot',.16],['LeftHand','RightHand',.14]];
// Torso bones take their full orientation (with twist) from a forward axis and a side axis.
const FRAMES = { Hips:['Spine1','LeftUpLeg','RightUpLeg'], Spine:['Spine1','LeftUpLeg','RightUpLeg'],
  Spine1:['Spine2','LeftArm','RightArm'], Spine2:['Neck','LeftArm','RightArm'], Neck:['Head','LeftArm','RightArm'] };
function orient(m, { p, frame: [t, s0, s1] }) { // orthonormal basis: y towards the first frame point, x along the side axis
  b.subVectors(t.p, p).normalize(); a.subVectors(s1.p, s0.p); a.addScaledVector(b, -a.dot(b)).normalize(); c.crossVectors(a, b);
  return m.makeBasis(a, b, c);
}
function push(p, collide, still) { // the world's circle collision, marking the points that touched a wall this step
  const x = p.p.x, z = p.p.z; collide(p.p, p.radius);
  if (p.p.x === x && p.p.z === z) return p.wall;
  // A limb that starts inside a car or a wall is moved out without being thrown.
  if (still) { p.previous.x += p.p.x - x; p.previous.z += p.p.z - z; }
  return (p.wall = true);
}
export class ZombieRagdoll {
  // impulse: direction of the killing shot; hitHeight: metres above the feet where it struck.
  constructor(body, impulse, hitHeight = 1.2) {
    body.updateWorldMatrix(true, true);
    this.body = body; this.points = []; this.links = []; this.time = 0; this.accumulator = 0; this.sleeping = false; this.quiet = 0;
    const map = new Map();
    body.traverse(bone => {
      if (!bone.isBone || /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(bone.name)) return;
      const name = bone.name.replace('CityDeadOutfit', ''), p = bone.getWorldPosition(new THREE.Vector3());
      const radius = /Head/.test(name) ? .13 : /Hips|Spine/.test(name) ? .12 : /Hand|Foot|Toe/.test(name) ? .06 : .08;
      const point = { bone, name, p, previous: p.clone(), radius, q: bone.getWorldQuaternion(new THREE.Quaternion()),
        q0: null, child: null, parent: null };
      point.q0 = point.q.clone(); this.points.push(point); map.set(bone, point);
    });
    const N = this.named = Object.fromEntries(this.points.map(p => [p.name, p]));
    for (const p of this.points) {
      p.parent = map.get(p.bone.parent) || null;
      if (p.parent) { this.link(p.parent, p); if (!p.parent.child) p.parent.child = p; }
    }
    // The torso is one rigid volume; the head, arms and legs swing from it.
    const trunk = ['Hips','LeftUpLeg','RightUpLeg','Spine','Spine1','Spine2','Neck','LeftShoulder','RightShoulder','LeftArm','RightArm'];
    for (let i = 0; i < trunk.length; i++) for (let j = i + 1; j < trunk.length; j++) this.link(N[trunk[i]], N[trunk[j]]);
    for (const [x, y, lo, hi] of RANGES) this.link(N[x], N[y], lo, hi);
    for (const [x, y, gap] of APART) if (N[x] && N[y]) this.links.push({ a: N[x], b: N[y], min: gap, max: Infinity });
    // Knees and elbows bend but neither fold flat nor overextend.
    for (const side of ['Left','Right']) for (const [u, m, l, lo] of [['Arm','ForeArm','Hand',.3],['UpLeg','Leg','Foot',.5]]) {
      const [x, y, z] = [u, m, l].map(n => N[side + n]); if (!x || !y || !z) continue;
      const length = x.p.distanceTo(y.p) + y.p.distanceTo(z.p); this.links.push({ a: x, b: z, min: length * lo, max: length * .99 });
    }
    for (const p of this.points) {
      const f = FRAMES[p.name], ok = f && f.every(n => N[n]);
      if (ok) { p.frame = f.map(n => N[n]); p.rest = orient(new THREE.Matrix4(), p).transpose(); }
      else if (p.child) p.axis = p.child.p.clone().sub(p.p).normalize();
    }
    this.cones = CONES.filter(([o, j, t]) => N[o]?.frame && N[j] && N[t]).map(([o, j, t, deg]) => ({ o: N[o], j: N[j], t: N[t],
      rest: N[t].p.clone().sub(N[j].p).normalize().applyMatrix4(N[o].rest).add(new THREE.Vector3(0, 1, 0)).normalize(), cos: Math.cos(deg * Math.PI / 180), sin: Math.sin(deg * Math.PI / 180) }));
    this.kick(impulse, hitHeight);
  }
  link(x, y, lo = 1, hi = 1) {
    if (!x || !y || this.links.some(l => (l.a === x && l.b === y) || (l.a === y && l.b === x))) return;
    const length = x.p.distanceTo(y.p); this.links.push({ a: x, b: y, min: length * lo, max: length * hi });
  }
  // Initial velocities: the body pivots on its feet away from the shot, most strongly where it was hit;
  // a headshot throws the head back on its neck. A little sideways randomness keeps deaths varied.
  kick(impulse, hitHeight) {
    const push = new THREE.Vector3(impulse?.x || 0, 0, impulse?.z || 0);
    if (push.lengthSq() < 1e-6) push.set(0, 0, -1); push.normalize();
    const side = new THREE.Vector3(-push.z, 0, push.x).multiplyScalar((Math.random() - .5) * .9), base = Math.min(...this.points.map(p => p.p.y));
    const head = hitHeight > 1.4;
    for (const p of this.points) {
      const h = Math.max(0, p.p.y - base), hit = Math.exp(-(((h - hitHeight) / .25) ** 2));
      let v = .25 + h * 1.55 + hit * (head ? .6 : 1.2);
      if (head && /Head/.test(p.name)) v += 3.4; else if (head && p.name === 'Neck') v += .9;
      delta.copy(push).multiplyScalar(v).addScaledVector(side, h);
      if (head && /Head/.test(p.name)) delta.y += .6;
      p.previous.addScaledVector(delta, -STEP);
    }
  }
  update(dt, ground = () => 0, collide = () => {}) {
    if (this.sleeping) return;
    this.accumulator += Math.min(Math.max(dt, 0), .1);
    while (this.accumulator >= STEP && !this.sleeping) {
      this.accumulator -= STEP; this.time += STEP;
      // Air drag, then extra damping once the fall is over so the body comes to rest rather than creeping.
      const drag = this.time < 1.2 ? .992 : .96;
      let walls = false;
      for (const p of this.points) {
        delta.subVectors(p.p, p.previous).multiplyScalar(drag).clampLength(0, MAX_SPEED * STEP);
        p.previous.copy(p.p); p.p.add(delta); p.p.y -= 9.81 * STEP * STEP;
        p.floor = ground(p.p.x, p.p.z) + p.radius; p.wall = false;
        if (push(p, collide, true)) walls = true;
      }
      for (let pass = 0; pass < PASSES; pass++) {
        for (const { a: x, b: y, min, max } of this.links) {
          delta.subVectors(y.p, x.p); const length = delta.length();
          if (length < 1e-6 || (length >= min && length <= max)) continue;
          delta.multiplyScalar((length - (length < min ? min : max)) / length * .5);
          x.p.add(delta); y.p.sub(delta);
        }
        for (const k of this.cones) {
          if (k.t.p.y <= k.t.floor + .01) continue; // resting on the ground already holds it; fighting the floor would creep
          orient(basis, k.o); c.copy(k.rest).applyMatrix4(basis); // the limb's direction at death, carried by the torso
          delta.subVectors(k.t.p, k.j.p); const length = delta.length(), cos = delta.dot(c) / length;
          if (!(cos < k.cos)) continue;
          delta.addScaledVector(c, -cos * length).normalize().multiplyScalar(k.sin).addScaledVector(c, k.cos); // nearest edge of the cone
          k.t.p.copy(k.j.p).addScaledVector(delta, length);
        }
        // Walls are solved with the links only while the body touches one, which keeps open-street deaths cheap.
        for (const p of this.points) { if (p.p.y < p.floor) p.p.y = p.floor; if (walls) push(p, collide); }
      }
      let movement = 0;
      for (const p of this.points) {
        if (p.p.y <= p.floor + 1e-4) { // contact: no bounce, and friction on the ground
          p.p.y = p.floor; p.previous.y = p.p.y;
          p.previous.x += (p.p.x - p.previous.x) * .3; p.previous.z += (p.p.z - p.previous.z) * .3;
        }
        if (p.wall) p.previous.lerp(p.p, .5); // walls absorb the impact instead of bouncing the body back
        movement = Math.max(movement, p.p.distanceToSquared(p.previous));
      }
      this.quiet = movement < 4e-6 ? this.quiet + STEP : 0;
      if ((this.time > .8 && this.quiet > .25) || this.time >= MAX_TIME) this.sleeping = true;
    }
    this.apply();
  }
  // Writes the particles back into the skeleton, parent first. Fingers inherit the hand.
  apply() {
    this.points[0].bone.parent.updateWorldMatrix(true, false);
    for (const p of this.points) {
      const parent = p.bone.parent;
      p.bone.position.copy(p.p); parent.worldToLocal(p.bone.position);
      if (p.frame) q.setFromRotationMatrix(orient(basis, p).multiply(p.rest)).multiply(p.q0);
      else if (p.axis) q.setFromUnitVectors(p.axis, delta.subVectors(p.child.p, p.p).normalize()).multiply(p.q0);
      if (p.parent) parentQ.copy(p.parent.q); else parent.getWorldQuaternion(parentQ);
      if (p.frame || p.axis) { p.q.copy(q); p.bone.quaternion.copy(parentQ.invert().multiply(q)); }
      else p.q.copy(parentQ).multiply(p.bone.quaternion);
      p.bone.updateWorldMatrix(false, false);
    }
    this.body.updateWorldMatrix(false, true);
  }
}
