// Visuals only: movement, damage and navigation remain in zombies.js.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function prepareZombieModel(gltf) {
  const byName = Object.fromEntries(gltf.animations.map(clip => [clip.name, clip]));
  for (const name of ['BossWalk', 'BossAttack', 'BossHit', 'BossDeath']) {
    if (!byName[name]) throw new Error('City zombie is missing ' + name);
  }
  // Hold a relaxed frame from the walk cycle instead of reverting to the T pose.
  const tracks = byName.BossWalk.tracks.map(track => {
    const sample = Array.from(track.createInterpolant().evaluate(0.6));
    return new track.constructor(track.name, [0, 1], [...sample, ...sample]);
  });
  return { scene: gltf.scene, clips: {
    walk: byName.BossWalk, idle: new THREE.AnimationClip('Rest', 1, tracks),
    attack: byName.BossAttack, hit: byName.BossHit, death: byName.BossDeath
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
  for (const name of ['hit','death']) {
    actions[name].setLoop(THREE.LoopOnce, 1); actions[name].clampWhenFinished = true;
  }
  actions.hit.setDuration(0.45);
  actions.attack.setDuration(1.2);
  const visual = { root, body, mixer, actions, current: null, hitRemaining: 0 };
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
  v.mixer.stopAllAction(); v.mixer.timeScale = 1; v.current = null; v.hitRemaining = 0;
  setAction(v, 'idle', true); v.mixer.update(0);
}
export function hitZombieVisual(v) {
  if (v.current === 'death') return;
  v.hitRemaining = 0.45;
  if (v.current === 'hit') v.actions.hit.reset().play();
  else setAction(v, 'hit');
}
export function updateZombieVisual(v, dt, { dead = false, attacking = false, speed = 0 } = {}) {
  v.hitRemaining = Math.max(0, v.hitRemaining - dt);
  const name = dead ? 'death' : v.hitRemaining > 0 ? 'hit' : attacking ? 'attack' : speed > 0.08 ? 'walk' : 'idle';
  setAction(v, name);
  if (name === 'walk') v.actions.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 0.8, 0.35, 2.2));
  v.mixer.update(dt);
}
