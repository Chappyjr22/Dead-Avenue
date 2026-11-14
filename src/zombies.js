// The dead: appearance, behaviour and spawning.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rnd, rr, ri, pick, clamp, col, COARSE } from './util.js';
import { ZOMBIE_OUTFITS } from './data.js';
import { scene } from './render.js';
import { lurkSpots, AVES, STS, groundY, insideBuilding, collide, rayWorld } from './world.js';
import { sfx } from './audio.js';
import { player, zombies, game, clock } from './state.js';


import { clearSegment, requestRoute } from './navigation.js';

let zProto = null, zClips = {};
const OUTFITS = ZOMBIE_OUTFITS;
const dressCache = new Map();
function dressed(geo, skeleton, k) {
  const key = geo.uuid + k; if (dressCache.has(key)) return dressCache.get(key);
  const o = OUTFITS[k], g = geo.clone(), si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, pos = geo.attributes.position, n = pos.count, a = new Float32Array(n * 3);
  geo.computeBoundingBox(); const cell = geo.boundingBox.getSize(new THREE.Vector3()).y / 7;
  const C = { skin: col(o.skin), shirt: col(o.shirt), legs: col(o.legs), shoe: col(o.shoe) }, blood = col(0x2e0a08), c = new THREE.Color();
  const h3 = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 11.3) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < n; i++) {
    let b = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; b = si.getComponent(i, j); } }
    const name = skeleton.bones[b].name;
    const part = /Head|Neck|Hand/.test(name) ? 'skin' : /ForeArm/.test(name) ? (o.sleeve ? 'shirt' : 'skin') : /Foot|Toe/.test(name) ? 'shoe' : /Hips|UpLeg|Leg/.test(name) ? 'legs' : 'shirt';
    c.copy(C[part]);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), s1 = h3(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)), s2 = h3(Math.floor(x / cell * 2.7), Math.floor(y / cell * 2.7), Math.floor(z / cell * 2.7));
    if (s1 < 0.22) c.lerp(blood, 0.75); else if (s2 < 0.2) c.lerp(blood, 0.45);
    c.multiplyScalar(0.75 + s2 * 0.3); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); dressCache.set(key, g); return g;
}
function spawnPoint(minDist) {
  for (let k = 0; k < 60; k++) {
    let x, z; if (rnd() < 0.6) { x = pick(AVES.slice(1, 5)) + rr(-11, 11); z = rr(-150, 150); } else { z = pick(STS.slice(1, 5)) + rr(-8, 8); x = rr(-120, 120); }
    const p = { x, z }; if (insideBuilding(x, z, 0.6)) continue; collide(p, 0.45);
    if (Math.hypot(p.x - player.x, p.z - player.z) > minDist) return p;
  }
  return { x: -41, z: -120 };
}
function makeZombie() {
  const root = SkeletonUtils.clone(zProto), fit = ri(0, OUTFITS.length - 1);
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false;
    o.geometry = dressed(o.geometry, o.skeleton, fit);
    o.material = new THREE.MeshStandardMaterial({ vertexColors: true, color: /Joints/.test(o.material.name) ? 0x9a9a9a : 0xffffff, roughness: 0.85, metalness: 0, envMapIntensity: 0.45 });
  });
  const mixer = new THREE.AnimationMixer(root);
  const walk = mixer.clipAction(zClips.walk), idle = mixer.clipAction(zClips.idle), slump = mixer.clipAction(zClips.sad_pose), sneak = mixer.clipAction(zClips.sneak_pose);
  walk.play(); idle.play(); slump.play(); sneak.play(); walk.time = rnd() * 1.0;
  const z = { root, mixer, walk, idle, slump, sneak, bones: {}, hp: 3, dead: 0, state: 'wander', speed: rr(0.6, 1.25), heading: rnd() * 6.283, turnT: 0, alert: 0, groanT: rr(2, 9), hitT: 0, lean: rr(-0.22, 0.22), reach: 0, moving: 1 };
  root.traverse(o => { if (o.isBone) z.bones[o.name.replace('mixamorig', '')] = o; });
  slump.setEffectiveWeight(rr(0.6, 1)); sneak.setEffectiveWeight(rr(0.1, 0.5));
  const s = rr(0.95, 1.06); root.scale.setScalar(s);
  scene.add(root); zombies.push(z); placeZombie(z, 30); return z;
}
function placeZombie(z, minDist) {
  const p = spawnPoint(minDist); z.root.position.set(p.x, groundY(p.x, p.z), p.z); z.root.rotation.set(0, z.heading, 0);
  z.path = []; z.navPending = null; z.navTimer = 0; z.turnT = 0; z.moving = 1;
  z.hp = 3; z.dead = 0; z.state = 'wander'; z.alert = 0; z.mixer.timeScale = 1; z.root.visible = true;
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function updateZombie(z, dt) {
  const r = z.root, dx = player.x - r.position.x, dz = player.z - r.position.z, dist = Math.hypot(dx, dz);
  if (z.dead) {
    z.dead += dt; const t = Math.min(1, z.dead / 0.7), e = 1 - (1 - t) * (1 - t);
    r.rotation.x = -e * Math.PI / 2 * 0.97; r.position.y = groundY(r.position.x, r.position.z) + e * 0.16 - Math.max(0, z.dead - 9) * 0.25;
    if (z.dead > 12) placeZombie(z, 45);
    return;
  }
  z.hitT = Math.max(0, z.hitT - dt);
  if (z.alert > 0) z.alert -= dt;
  const sees = dist > 0.001 && dist < 34 && rayWorld(r.position.x, 1.5, r.position.z, dx / dist, 0, dz / dist, dist) >= dist - 0.01;
  if (sees) z.alert = 5;
  z.state = z.alert > 0 && player.hp > 0 ? 'chase' : 'wander';
  let speed = 0, want = z.heading;
  if (z.state === 'chase') {
    z.navTimer = (z.navTimer || 0) - dt;
    if (z.navTimer <= 0) {
      z.direct = clearSegment(r.position, player);
      if (z.direct) { z.path = []; z.navPending = null; }
      else requestRoute(z, r.position, player);
      z.navTimer = 0.6;
    }
    let target = z.direct ? player : null;
    if (!target && z.path?.length) {
      // Follow only reachable waypoints, including when the zombie moved during search.
      for (let i=Math.min(z.path.length-1,8); i>=0; i--) {
        if (clearSegment(r.position,z.path[i])) { z.path.splice(0,i); target=z.path[0]; break; }
      }
      if (target && Math.hypot(target.x-r.position.x,target.z-r.position.z)<0.25) { z.path.shift(); target=z.path[0]; }
    }
    if (target) { want=Math.atan2(target.x-r.position.x,target.z-r.position.z); speed=dist>1.05 ? z.speed*1.5 : 0; }
  }
  else { z.turnT -= dt; if (z.turnT < 0) { z.turnT = rr(3, 9); z.heading2 = z.heading + rr(-1.4, 1.4); z.moving = rnd() < 0.7 ? 1 : 0; } want = z.heading2 ?? z.heading; speed = z.moving ? z.speed * 0.55 : 0; }
  if (z.hitT > 0) speed *= 0.2;
  let dh = want - z.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); z.heading += clamp(dh, -dt * 2.2, dt * 2.2);
  if (z.state === 'chase') speed *= Math.max(0, Math.cos(want - z.heading));
  const bx = r.position.x, bz = r.position.z;
  r.position.x += Math.sin(z.heading) * speed * dt; r.position.z += Math.cos(z.heading) * speed * dt;
  collide(r.position, 0.38);
  for (const o of zombies) if (o !== z && !o.dead) { const ex = r.position.x - o.root.position.x, ez = r.position.z - o.root.position.z, d = Math.hypot(ex, ez); if (d < 0.75 && d > 1e-4) { r.position.x += ex / d * (0.75 - d) * 0.5; r.position.z += ez / d * (0.75 - d) * 0.5; } }
  collide(r.position, 0.38); // separation must not push enemies through walls
  const moved = Math.hypot(r.position.x - bx, r.position.z - bz) / Math.max(dt, 1e-4);
  if (z.state === 'wander' && speed > 0 && moved < speed * 0.3) z.turnT = Math.min(z.turnT, 0.3);
  r.position.y += (groundY(r.position.x, r.position.z) - r.position.y) * Math.min(1, dt * 10);
  r.rotation.set(0, z.heading, 0);
  const w = clamp(moved / 0.5, 0, 1); z.walk.setEffectiveWeight(w); z.idle.setEffectiveWeight(1 - w); z.walk.timeScale = clamp(moved / 1.45, 0.25, 1.6);
  z.reach += ((z.state === 'chase' ? 1 : 0) - z.reach) * Math.min(1, dt * 2);
  z.mixer.update(dt);
  // layered on top of the clips: crooked spine, lolling head, arms coming up when it has seen you
  const b = z.bones;
  if (b.Spine1) b.Spine1.quaternion.multiply(_q.setFromEuler(_e.set(0.12 + z.reach * 0.1, 0, z.lean)));
  if (b.Head) b.Head.quaternion.multiply(_q.setFromEuler(_e.set(z.reach * -0.35, 0, -z.lean * 1.6 + Math.sin(clock.elapsedTime * 1.3 + z.lean * 20) * 0.08)));
  if (z.reach > 0.01) { if (b.LeftArm) b.LeftArm.quaternion.multiply(_q.setFromEuler(_e.set(0, 0, -1.15 * z.reach))); if (b.RightArm) b.RightArm.quaternion.multiply(_q.setFromEuler(_e.set(0, 0, 0.95 * z.reach))); }
  if (z.hitT > 0 && b.Spine) b.Spine.quaternion.multiply(_q.setFromEuler(_e.set(-z.hitT * 2.2, 0, 0)));
  // bite
  if (z.state === 'chase' && dist < 1.25 && sees && game.started && player.hp > 0) { player.hp -= 22 * dt; player.hurt = Math.min(1, player.hurt + dt * 4); if ((z.biteT = (z.biteT || 0) - dt) < 0) { z.biteT = 0.6; sfx.hurt(); } }
  z.groanT -= dt;
  if (z.groanT < 0 && dist < 45) { z.groanT = z.state === 'chase' ? rr(1.5, 4) : rr(5, 14); const side = Math.sin(Math.atan2(dx, dz) - player.yaw); sfx.groan(clamp(1.6 / (1 + dist * 0.18), 0.03, 0.6), clamp(side, -1, 1)); }
}

// Prepare the model's clips, then populate the streets and a few shops.
export function initZombies(gltf) {
  zProto = gltf.scene;
  for (const c of gltf.animations) {
    let clip = c;
    if (c.name === 'sad_pose' || c.name === 'sneak_pose') { THREE.AnimationUtils.makeClipAdditive(clip); clip = THREE.AnimationUtils.subclip(clip, clip.name, 2, 3, 30); }
    zClips[c.name] = clip;
  }
  for (let i = 0; i < (COARSE ? 12 : 18); i++) makeZombie();
  // a few placed where the opening view finds them
  [[38, 18], [45, -4], [36, -30], [49, 30]].forEach((p, i) => { const z = zombies[i]; z.root.position.set(p[0], 0, p[1]); z.heading = z.heading2 = rr(-0.5, 0.5); });
  lurkSpots.forEach((p, i) => { const z = zombies[zombies.length - 1 - i]; if (!z || i > 5) return; z.root.position.set(p.x, 0.18, p.z); z.moving = 0; z.turnT = 1e9; z.lurk = true; });
}

export { makeZombie, placeZombie, updateZombie };
