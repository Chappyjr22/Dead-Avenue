// The dead: appearance, behaviour and spawning.
import { rnd, rr, pick, clamp, COARSE } from './util.js';
import { prepareZombieModel, createZombieVisual, resetZombieVisual, updateZombieVisual } from './zombie-visual.js';
import { scene } from './render.js';
import { lurkSpots, AVES, STS, groundY, insideBuilding, collide, rayWorld } from './world.js';
import { sfx } from './audio.js';
import { player, zombies, game, clock } from './state.js';


import { clearSegment, requestRoute } from './navigation.js';

let zombieModel = null;
function spawnPoint(minDist) {
  for (let k = 0; k < 60; k++) {
    let x, z; if (rnd() < 0.6) { x = pick(AVES.slice(1, 5)) + rr(-11, 11); z = rr(-150, 150); } else { z = pick(STS.slice(1, 5)) + rr(-8, 8); x = rr(-120, 120); }
    const p = { x, z }; if (insideBuilding(x, z, 0.6)) continue; collide(p, 0.45);
    if (Math.hypot(p.x - player.x, p.z - player.z) > minDist) return p;
  }
  return { x: -41, z: -120 };
}
function makeZombie() {
  const visual = createZombieVisual(zombieModel, rnd()), { root, mixer } = visual;
  const z = { root, mixer, visual, hp: 3, dead: 0, state: 'wander', speed: rr(0.6, 1.25), heading: rnd() * 6.283, turnT: 0, alert: 0, groanT: rr(2, 9), hitT: 0, moving: 1 };
  const s = rr(0.95, 1.06); root.scale.setScalar(s);
  scene.add(root); zombies.push(z); placeZombie(z, 30); return z;
}
function placeZombie(z, minDist) {
  const p = spawnPoint(minDist); z.root.position.set(p.x, groundY(p.x, p.z), p.z); z.root.rotation.set(0, z.heading, 0);
  z.path = []; z.navPending = null; z.navTimer = Math.random() * 0.6; // staggered so a gunshot does not make every zombie plan a route in the same frame
  z.turnT = 0; z.moving = 1;
  resetZombieVisual(z.visual); z.hitT = 0; z.biteT = 0;
  z.hp = 3; z.dead = 0; z.state = 'wander'; z.alert = 0; z.mixer.timeScale = 1; z.root.visible = true;
}
function updateZombie(z, dt) {
  const r = z.root, dx = player.x - r.position.x, dz = player.z - r.position.z, dist = Math.hypot(dx, dz);
  if (z.dead) {
    const v = z.visual;
    // The body falls away from the shooter, hardest where the killing shot struck.
    if (!v.ragdoll) { v.deathImpulse ??= { x: -dx, z: -dz }; v.hitHeight ??= z.hitY; }
    z.dead += dt;
    updateZombieVisual(v, dt, { dead: true, ground: groundY, collide });
    // The ragdoll sleeps within 3 s; after that the skeleton follows the root, which sinks the body.
    r.position.y = groundY(r.position.x, r.position.z) - Math.max(0, z.dead - 9) * 0.25;
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
  updateZombieVisual(z.visual, dt, {
    speed: moved,
    attacking: z.state === 'chase' && dist < 1.25 && sees && game.started && player.hp > 0
  });
  // bite
  if (z.state === 'chase' && dist < 1.25 && sees && game.started && player.hp > 0) { player.hp -= 22 * dt; player.hurt = Math.min(1, player.hurt + dt * 4); if ((z.biteT = (z.biteT || 0) - dt) < 0) { z.biteT = 0.6; sfx.hurt(); } }
  z.groanT -= dt;
  if (z.groanT < 0 && dist < 45) { z.groanT = z.state === 'chase' ? rr(1.5, 4) : rr(5, 14); const side = Math.sin(Math.atan2(dx, dz) - player.yaw); sfx.groan(clamp(1.6 / (1 + dist * 0.18), 0.03, 0.6), clamp(side, -1, 1)); }
}

// Prepare the model's clips, then populate the streets and a few shops.
export function initZombies(gltf) {
  zombieModel = prepareZombieModel(gltf);
  for (let i = 0; i < (COARSE ? 12 : 18); i++) makeZombie();
  // a few placed where the opening view finds them
  [[38, 18], [45, -4], [36, -30], [49, 30]].forEach((p, i) => { const z = zombies[i]; z.root.position.set(p[0], 0, p[1]); z.heading = z.heading2 = rr(-0.5, 0.5); });
  lurkSpots.forEach((p, i) => { const z = zombies[zombies.length - 1 - i]; if (!z || i > 5) return; z.root.position.set(p.x, 0.18, p.z); z.moving = 0; z.turnT = 1e9; z.lurk = true; });
}

export { makeZombie, placeZombie, updateZombie };
