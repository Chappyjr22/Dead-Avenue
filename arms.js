// First-person arms: the walker model worn by the camera, with gloves and sleeves painted on
// and both arms posed onto the pistol by a small two-bone IK solve done once at start-up.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const GUN_POS = new THREE.Vector3(0.075, -0.125, -0.42);
const GRIP = new THREE.Vector3(0, -0.045, -0.012); // grip centre in the pistol's own space

const DEFAULTS = {
  body: [0, -1.5, 0.04],
  R: { wrist: [0.04, -0.01, 0.095], fingers: [-0.3, 0.42, -1], palm: [-1, -0.1, 0.25], pole: [0.9, -1, 0.3], curl: [0.35, 1.25, 1.3, 1.35], thumb: 0.95 },
  L: { wrist: [-0.07, -0.035, 0.07], fingers: [0.62, 0.3, -1], palm: [1, 0.15, 0.3], pole: [-0.9, -1, 0.3], curl: [1.0, 1.05, 1.1, 1.15], thumb: 0.85 }
};

const v = a => new THREE.Vector3(a[0], a[1], a[2]);
const wq = b => b.getWorldQuaternion(new THREE.Quaternion());
const wp = b => b.getWorldPosition(new THREE.Vector3());
function setWorldQuat(bone, q) { bone.quaternion.copy(wq(bone.parent).invert().multiply(q)); bone.updateWorldMatrix(false, true); }
// a bone's length axis in its own space: the direction to its first child bone
const axisOf = b => { const c = b.children.find(o => o.isBone); return c ? c.position.clone().normalize() : new THREE.Vector3(0, 1, 0); };
function aim(bone, dir) { // swing the bone so its length axis points along dir, with no added twist
  const cur = axisOf(bone).applyQuaternion(wq(bone));
  setWorldQuat(bone, new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize()).multiply(wq(bone)));
}
function basis(f, n) { const y = f.clone().normalize(), x = new THREE.Vector3().crossVectors(y, n).normalize(), z = new THREE.Vector3().crossVectors(x, y); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); }

function paint(mesh) { // jacket sleeves, leather gloves
  const g = mesh.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = g.attributes.position.count, a = new Float32Array(n * 3);
  const glove = new THREE.Color(0x14110f), sleeve = new THREE.Color(0x2c3024), cuff = new THREE.Color(0x1d2018), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let b = 0, bw = -1, hand = 0; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j), name = mesh.skeleton.bones[si.getComponent(i, j)].name; if (/Hand/.test(name)) hand += w; if (w > bw) { bw = w; b = si.getComponent(i, j); } }
    c.copy(hand > 0.5 ? glove : hand > 0.15 ? cuff : sleeve); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); mesh.geometry = g;
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.5 });
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
}

export function buildArms(proto, opts = {}) {
  const P = { ...DEFAULTS, ...opts, R: { ...DEFAULTS.R, ...(opts.R || {}) }, L: { ...DEFAULTS.L, ...(opts.L || {}) } };
  const rig = SkeletonUtils.clone(proto), bones = {};
  rig.traverse(o => { if (o.isBone) bones[o.name.replace('mixamorig', '')] = o; if (o.isMesh) paint(o); });
  rig.rotation.y = Math.PI; rig.position.copy(v(P.body)); rig.updateMatrixWorld(true);
  for (const name of ['Head', 'Neck']) if (bones[name]) bones[name].scale.setScalar(0.001); // nothing in front of the lens
  rig.updateMatrixWorld(true);
  const grip = GUN_POS.clone().add(GRIP.clone().multiplyScalar(0.85));
  for (const side of ['Right', 'Left']) {
    const p = P[side[0]], arm = bones[side + 'Arm'], fore = bones[side + 'ForeArm'], hand = bones[side + 'Hand'];
    // rest-pose facts, taken before anything moves: T-pose palms face the floor
    const down = new THREE.Vector3(0, -1, 0), restHand = wq(hand), restF = bones[side + 'HandMiddle1'].position.clone().normalize().applyQuaternion(restHand);
    const fingers = [];
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (let k = 1; k <= 3; k++) {
      const b = bones[side + 'Hand' + f + k]; if (!b) continue;
      const q = wq(b), dir = (k < 3 ? axisOf(b) : b.position.clone().normalize()).applyQuaternion(k < 3 ? q : wq(b.parent)), toward = f === 'Thumb' ? restF.clone() : down;
      fingers.push({ b, f, k, axis: new THREE.Vector3().crossVectors(dir, toward).normalize().applyQuaternion(q.clone().invert()) });
    }
    const S = wp(arm), l1 = wp(fore).distanceTo(S), l2 = wp(hand).distanceTo(wp(fore)), W = grip.clone().add(v(p.wrist));
    const to = W.clone().sub(S), d = Math.min(to.length(), (l1 + l2) * 0.999), dir = to.clone().normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pole = v(p.pole), perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize(), E = S.clone().addScaledVector(dir, a).addScaledVector(perp, h);
    aim(arm, E.clone().sub(S)); aim(fore, W.clone().sub(wp(fore)));
    const delta = basis(v(p.fingers), v(p.palm)).multiply(basis(restF, down).invert());
    setWorldQuat(hand, delta.multiply(restHand));
    const idx = { Index: 0, Middle: 1, Ring: 2, Pinky: 3 };
    for (const { b, f, k, axis } of fingers) {
      const ang = f === 'Thumb' ? p.thumb * (k === 1 ? 0.6 : 1) : p.curl[idx[f]] * (k === 1 ? 0.75 : k === 2 ? 1 : 0.7);
      b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, ang));
    }
  }
  rig.updateMatrixWorld(true);
  return rig;
}
