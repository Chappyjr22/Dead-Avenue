// The dead: appearance, behaviour and spawning.
import { rnd, rr, pick, clamp, COARSE } from './util.js';
import { prepareZombieModel, createZombieVisual, resetZombieVisual, updateZombieVisual } from './zombie-visual.js';
import { scene } from './render.js';
import { lurkSpots, AVES, STS, groundY, insideBuilding, collide, rayWorld } from './world.js';
import { sfx } from './audio.js';
import { player, zombies, game, clock, daytime } from './state.js';

import { HORDE } from './data.js';
import { threat, hordeAt, hordeCap, activeTarget } from './daynight.js';
import { clearSegment, requestRoute } from './navigation.js';

// Each zombie is in one of three states. wander: drifts about. investigate: heard a noise and is routing to where it
// came from (z.goal); it does not know where the player is. chase: can see the player right now and heads for them.
// Losing sight turns a chase into an investigation of the last place the player was seen.
let zombieModel = null;
// A spawn point on a street between minDist and maxDist from the player and out of their line of sight, if one can be
// found; failing that, any street point beyond minDist.
function spawnPoint(minDist, maxDist = Infinity) {
  let fallback = null;
  for (let k = 0; k < 120; k++) {
    let x, z; if (rnd() < 0.6) { x = pick(AVES.slice(1, 5)) + rr(-11, 11); z = rr(-150, 150); } else { z = pick(STS.slice(1, 5)) + rr(-8, 8); x = rr(-120, 120); }
    const p = { x, z }; if (insideBuilding(x, z, 0.6)) continue; collide(p, 0.45);
    const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz);
    if (d <= minDist) continue;
    if (!fallback) fallback = p;
    if (d > maxDist) continue;
    if (rayWorld(player.x, 1.5, player.z, dx / d, 0, dz / d, d) >= d - 0.5) continue; // the player would see it appear
    return p;
  }
  return fallback || { x: -41, z: -120 };
}
function makeZombie() {
  const visual = createZombieVisual(zombieModel, rnd()), { root, mixer } = visual;
  const z = { root, mixer, visual, hp: 3, dead: 0, state: 'wander', speed: rr(0.6, 1.25), heading: rnd() * 6.283, turnT: 0, alert: 0, groanT: rr(2, 9), hitT: 0, moving: 1, active: true, idle: 0, hunt: 0, sees: false, stuckT: 0, goal: { x: 0, z: 0 } };
  const s = rr(0.95, 1.06); root.scale.setScalar(s);
  scene.add(root); zombies.push(z); placeZombie(z, 30); return z;
}
function placeZombie(z, minDist, maxDist) {
  const p = spawnPoint(minDist, maxDist); z.root.position.set(p.x, groundY(p.x, p.z), p.z); z.root.rotation.set(0, z.heading, 0);
  z.path = []; z.navPending = null; z.navTimer = Math.random() * 0.6; // staggered so a gunshot does not make every zombie plan a route in the same frame
  z.turnT = 0; z.moving = 1; z.lurk = false; z.active = true; z.idle = 0; z.hunt = 0; z.sees = false; z.direct = false;
  resetZombieVisual(z.visual); z.hitT = 0; z.biteT = 0;
  z.hp = 3; z.dead = 0; z.state = 'wander'; z.alert = 0; z.mixer.timeScale = 1; z.root.visible = true;
}
// Takes a zombie off the streets (a corpse that has sunk, or one the day no longer needs). It waits, hidden and not
// updated, until the horde wants it back; z.idle counts how long it has been gone.
function retireZombie(z) {
  z.active = false; z.root.visible = false; z.dead = 0; z.idle = 0; z.hunt = 0; z.sees = false; z.alert = 0; z.state = 'wander';
  z.path = []; z.navPending = null;
}
// A zombie hears something at (x, z) and goes to look. It learns where the noise was, not where the player is.
function hearNoise(z, x, zz) {
  if (!z.active || z.dead) return false;
  // Long enough to walk there and then search: a far zombie must not give up halfway.
  z.goal.x = x; z.goal.z = zz; z.hunt = HORDE.search + 1.5 * Math.hypot(z.root.position.x - x, z.root.position.z - zz) / Math.max(0.4, z.speed);
  if (!z.sees) { z.navPending = null; z.direct = false; z.path.length = 0; z.navTimer = Math.random() * 0.4; } // staggered route planning
  return true;
}
// A noise at (x, z) heard within radius metres (scaled by the horde's hearing). Returns how many zombies heard it.
function makeNoise(x, z, radius) {
  const r = radius * threat.hearing; let heard = 0;
  if (!(r > 0)) return 0;
  for (let i = 0; i < zombies.length; i++) {
    const o = zombies[i]; if (!o.active || o.dead) continue;
    const dx = o.root.position.x - x, dz = o.root.position.z - z;
    if (dx * dx + dz * dz <= r * r && hearNoise(o, x, z)) heard++;
  }
  return heard;
}
// Day and night: bring zombies back or take them away, one every half second, to match the horde size for this hour.
let hordeT = 0;
function updateHorde(dt) {
  hordeAt(daytime.day, daytime.hour, threat);
  let active = 0; for (let i = 0; i < zombies.length; i++) { const z = zombies[i]; if (z.active) active++; else z.idle += dt; }
  if ((hordeT -= dt) > 0) return; hordeT = 0.5;
  const target = activeTarget(threat, zombies.length);
  if (active < target) {
    let best = null; for (let i = 0; i < zombies.length; i++) { const z = zombies[i]; if (!z.active && z.idle >= threat.respawn && (!best || z.idle > best.idle)) best = z; }
    if (best) placeZombie(best, threat.spawnMin, threat.spawnMax);
  } else if (active > target) {
    // Only one that is idle, far off and out of sight goes, so nobody sees the dead vanish.
    let best = null, bd = 40;
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]; if (!z.active || z.dead || z.state !== 'wander') continue;
      const dx = z.root.position.x - player.x, dz = z.root.position.z - player.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > bd && (d > 90 || rayWorld(player.x, 1.5, player.z, dx / d, 0, dz / d, d) < d - 0.5)) { best = z; bd = d; }
    }
    if (best) retireZombie(best);
  }
}
function updateZombie(z, dt) {
  if (!z.active) return;
  const r = z.root, dx = player.x - r.position.x, dz = player.z - r.position.z, dist = Math.hypot(dx, dz);
  if (z.dead) {
    const v = z.visual;
    // The body falls away from the shooter, hardest where the killing shot struck.
    if (!v.ragdoll) { v.deathImpulse ??= { x: -dx, z: -dz }; v.hitHeight ??= z.hitY; }
    z.dead += dt;
    updateZombieVisual(v, dt, { dead: true, ground: groundY, collide });
    // The ragdoll sleeps within 3 s; after that the skeleton follows the root, which sinks the body.
    r.position.y = groundY(r.position.x, r.position.z) - Math.max(0, z.dead - 9) * 0.25;
    if (z.dead > 12) retireZombie(z); // placeZombie resets the skeleton when the horde brings it back
    return;
  }
  z.hitT = Math.max(0, z.hitT - dt);
  const sees = player.hp > 0 && dist > 0.001 && dist < threat.sight && rayWorld(r.position.x, 1.5, r.position.z, dx / dist, 0, dz / dist, dist) >= dist - 0.01;
  if (sees) { z.goal.x = player.x; z.goal.z = player.z; z.hunt = HORDE.search * 2; }
  if (sees !== z.sees) { z.navTimer = 0; z.direct = false; z.path.length = 0; z.navPending = null; } // spotted, or lost sight: replan toward the player or where they were last seen
  z.sees = sees; z.alert = sees ? 1 : 0;
  if (z.hunt > 0) z.hunt -= dt;
  z.state = sees ? 'chase' : z.hunt > 0 ? 'investigate' : 'wander';
  let speed = 0, want = z.heading;
  if (z.state !== 'wander') {
    const goal = sees ? player : z.goal;
    const gx = goal.x - r.position.x, gz = goal.z - r.position.z;
    if (!sees && gx * gx + gz * gz < 2.25) { z.hunt = Math.min(z.hunt, HORDE.search); z.path.length = 0; z.direct = false; } // arrived: look about, then give up
    else {
      z.navTimer = (z.navTimer || 0) - dt;
      if (z.navTimer <= 0) {
        z.direct = clearSegment(r.position, goal);
        if (z.direct) { z.path.length = 0; z.navPending = null; }
        else if (sees || !z.path.length) requestRoute(z, r.position, goal); // a noise or last sighting does not move: one route will do
        z.navTimer = 0.6;
      }
    }
    let target = z.direct ? goal : null;
    if (!target && z.path?.length) {
      // Follow only reachable waypoints, including when the zombie moved during search.
      for (let i=Math.min(z.path.length-1,8); i>=0; i--) {
        if (clearSegment(r.position,z.path[i])) { if (i) { z.path.copyWithin(0,i); z.path.length-=i; } target=z.path[0]; break; } // splice would allocate
      }
      // Standing closer to a car than navigation allows makes every segment look blocked: head for the first waypoint anyway.
      if (!target) target=z.path[0];
      if (target && Math.hypot(target.x-r.position.x,target.z-r.position.z)<0.25) { z.path.shift(); target=z.path[0]; }
    }
    if (!target && !z.navPending && !sees) target = goal; // no route: walk at it and let collision slide us round
    if (target) { want=Math.atan2(target.x-r.position.x,target.z-r.position.z); speed=sees ? (dist>1.05 ? z.speed*1.5*threat.speed : 0) : z.speed*1.2*threat.speed; }
  }
  else { z.turnT -= dt; if (z.turnT < 0) { z.turnT = rr(3, 9); z.heading2 = z.heading + rr(-1.4, 1.4); z.moving = rnd() < 0.7 ? 1 : 0; } want = z.heading2 ?? z.heading; speed = z.moving ? z.speed * 0.55 * threat.speed : 0; }
  if (z.hitT > 0) speed *= 0.2;
  let dh = want - z.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); z.heading += clamp(dh, -dt * 2.2, dt * 2.2);
  if (z.state !== 'wander') speed *= Math.max(0, Math.cos(want - z.heading));
  const bx = r.position.x, bz = r.position.z;
  r.position.x += Math.sin(z.heading) * speed * dt; r.position.z += Math.cos(z.heading) * speed * dt;
  collide(r.position, 0.38);
  for (let i = 0; i < zombies.length; i++) { const o = zombies[i]; if (o !== z && o.active && !o.dead) { const ex = r.position.x - o.root.position.x, ez = r.position.z - o.root.position.z, d = Math.sqrt(ex * ex + ez * ez); if (d < 0.75 && d > 1e-4) { r.position.x += ex / d * (0.75 - d) * 0.5; r.position.z += ez / d * (0.75 - d) * 0.5; } } }
  collide(r.position, 0.38); // separation must not push enemies through walls
  const moved = Math.hypot(r.position.x - bx, r.position.z - bz) / Math.max(dt, 1e-4);
  if (z.state === 'wander' && speed > 0 && moved < speed * 0.3) z.turnT = Math.min(z.turnT, 0.3);
  // Pinned against something on the way to a goal: drop the route and plan a fresh one from here.
  if (z.state !== 'wander' && speed > 0.2 && moved < speed * 0.25) { if ((z.stuckT += dt) > 1.2) { z.stuckT = 0; z.path.length = 0; z.navTimer = 0; } } else z.stuckT = 0;
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
  const pool = hordeCap(COARSE);
  for (let i = 0; i < pool; i++) makeZombie();
  // a few placed where the opening view finds them
  [[38, 18], [45, -4], [36, -30], [49, 30]].forEach((p, i) => { const z = zombies[i]; z.root.position.set(p[0], 0, p[1]); z.heading = z.heading2 = rr(-0.5, 0.5); });
  lurkSpots.forEach((p, i) => { const z = zombies[zombies.length - 1 - i]; if (!z || i > 5) return; z.root.position.set(p.x, 0.18, p.z); z.moving = 0; z.turnT = 1e9; z.lurk = true; });
  // The opening hour wants fewer than the pool: keep the four in the opening view, and stand down the rest,
  // alternating street wanderers and shop lurkers so both stay in play.
  hordeAt(daytime.day, daytime.hour, threat);
  const lurk = zombies.filter(z => z.lurk), walk = zombies.slice(4).filter(z => !z.lurk), order = [];
  while (lurk.length || walk.length) { if (walk.length) order.push(walk.pop()); if (lurk.length) order.push(lurk.pop()); }
  let active = pool; for (const z of order) { if (active <= activeTarget(threat, pool)) break; retireZombie(z); z.idle = 1e9; active--; }
}

export { makeZombie, placeZombie, retireZombie, updateZombie, updateHorde, makeNoise, hearNoise, spawnPoint };
