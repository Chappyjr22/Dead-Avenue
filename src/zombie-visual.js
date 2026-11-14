// Visuals only: movement, damage and navigation remain in zombies.js.
import * as THREE from 'three';
import { ZombieRagdoll } from './ragdoll.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function prepareZombieModel(gltf) {
  const byName = Object.fromEntries(gltf.animations.map(clip => [clip.name, clip]));
  for (const name of ['BossWalk', 'BossAttack', 'BossHit']) {
    if (!byName[name]) throw new Error('City zombie is missing ' + name);
  }
  // Hold a relaxed frame from the walk cycle instead of reverting to the T pose.
  const tracks = byName.BossWalk.tracks.map(track => {
    const sample = Array.from(track.createInterpolant().evaluate(0.6));
    return new track.constructor(track.name, [0, 1], [...sample, ...sample]);
  });
  return { scene: gltf.scene, clips: {
    walk: byName.BossWalk, idle: new THREE.AnimationClip('Rest', 1, tracks),
    attack: byName.BossAttack, hit: byName.BossHit
  } };
}

export function createZombieVisual(model, variation = 0) {
  const root = new THREE.Group(), body = SkeletonUtils.clone(model.scene);
  root.add(body);
  // Textures and geometry remain shared between instances.
  body.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const tinted = materials.map(m => {
      const copy = m.clone();
      copy.color.multiply(new THREE.Color().setHSL(0.06 + variation * 0.04, 0.08, 0.88));
      copy.envMapIntensity = 0.45;
      return copy;
    });
    o.material = Array.isArray(o.material) ? tinted : tinted[0];
  });
  const mixer = new THREE.AnimationMixer(body);
  const actions = Object.fromEntries(Object.entries(model.clips).map(([name,clip]) => [name,mixer.clipAction(clip)]));
  for (const name of ['hit']) {
    actions[name].setLoop(THREE.LoopOnce, 1); actions[name].clampWhenFinished = true;
  }
  actions.hit.setDuration(0.45);
  actions.attack.setDuration(1.2);
  const rest = []; body.traverse(bone => { if (bone.isBone) rest.push({bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone()}); });
  const visual = { root, body, mixer, actions, rest, ragdoll: null, current: null, hitRemaining: 0 };
  setAction(visual, 'idle', true);
  return visual;
}
function setAction(v, name, immediate = false) {
  if (v.current === name) return;
  const previous = v.actions[v.current], next = v.actions[name];
  next.reset().setEffectiveWeight(1).play();
  if (previous && !immediate) { previous.fadeOut(0.12); next.fadeIn(0.12); }
  else if (previous) previous.stop();
  v.current = name;
}
export function resetZombieVisual(v) {
  v.mixer.stopAllAction(); v.ragdoll = null; v.deathImpulse = null;
  for (const p of v.rest) { p.bone.position.copy(p.position); p.bone.quaternion.copy(p.quaternion); p.bone.scale.copy(p.scale); }
  v.mixer.timeScale = 1; v.current = null; v.hitRemaining = 0;
  setAction(v, 'idle', true); v.mixer.update(0);
}
export function hitZombieVisual(v) {
  if (v.current === 'ragdoll') return;
  v.hitRemaining = 0.45;
  if (v.current === 'hit') v.actions.hit.reset().play();
  else setAction(v, 'hit');
}
export function updateZombieVisual(v, dt, { dead = false, attacking = false, speed = 0, ground, collide } = {}) {
  if (dead) {
    if (!v.ragdoll) {
      // Pause without stopAllAction: stopping would restore the bind pose.
      v.mixer.timeScale = 0;
      v.ragdoll = new ZombieRagdoll(v.body, v.deathImpulse, v.hitHeight);
      v.current = 'ragdoll';
    }
    v.ragdoll.update(dt, ground, collide); return;
  }
  v.hitRemaining = Math.max(0, v.hitRemaining - dt);
  const name = v.hitRemaining > 0 ? 'hit' : attacking ? 'attack' : speed > 0.08 ? 'walk' : 'idle';
  setAction(v, name);
  if (name === 'walk') v.actions.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 0.8, 0.35, 2.2));
  v.mixer.update(dt);
}
