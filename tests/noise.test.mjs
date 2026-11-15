import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { loadGeometry } from '../tools/inspect-models.mjs';
import * as visual from '../src/zombie-visual.js';
import { HORDE } from '../src/data.js';
import { newDaytime, setClock, threat, hordeAt, hordeCap, activeTarget, nightValues } from '../src/daynight.js';
const model = visual.prepareZombieModel(await loadGeometry('assets/city-zombie.glb'));
// zombies.js against a flat open world: no walls, routes are straight lines. view decides whether a zombie can see.
function setup() {
  const player = { x: 0, z: 0, hp: 100 }, zombies = [], daytime = newDaytime(), world = { view: false };
  const context = { THREE, player, zombies, daytime, game: { started: true }, clock: { elapsedTime: 0 }, sfx: { groan() {}, hurt() {} }, scene: { add() {} }, COARSE: false,
    rnd: Math.random, rr: (a, b) => a + (b - a) * .5, pick: a => a[0], clamp: (v, a, b) => Math.max(a, Math.min(b, v)), lurkSpots: [], AVES: [0, 0, 0, 0, 0, 0], STS: [0, 0, 0, 0, 0, 0],
    groundY: () => 0, insideBuilding: () => false, collide: () => {}, rayWorld: (ox, oy, oz, dx, dy, dz, max) => world.view ? max : 0,
    clearSegment: () => true, requestRoute() {}, Math, ...visual, HORDE, threat, hordeAt, hordeCap, activeTarget };
  const source = fs.readFileSync(new URL('../src/zombies.js', import.meta.url), 'utf8').replace(/^import [\s\S]*?;$/gm, '').replace(/^export .*;$/gm, '').replace(/^export function/gm, 'function');
  vm.runInNewContext(source + '\nglobalThis.api={makeZombie,placeZombie,retireZombie,updateZombie,updateHorde,makeNoise,hearNoise,setModel:m=>{zombieModel=m;}};', context);
  context.api.setModel(model); hordeAt(daytime.day, daytime.hour, threat);
  return { api: context.api, player, zombies, daytime, world };
}
const at = (z, x, zz) => { z.root.position.set(x, 0, zz); z.heading = 0; z.hunt = 0; z.sees = false; z.state = 'wander'; };
const run = (api, zombies, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) for (const z of zombies) api.updateZombie(z, 1 / 30); };
const dist = (z, p) => Math.hypot(z.root.position.x - p.x, z.root.position.z - p.z);

test('a zombie that hears a noise walks to where it was made, not to the player it cannot see', () => {
  const { api, player, zombies } = setup(), z = api.makeZombie(), deaf = api.makeZombie();
  at(z, 30, 0); at(deaf, 0, 80); player.x = 0; player.z = -40; // the player has moved off after making the noise
  const noise = { x: 0, z: 10 };
  assert.equal(api.makeNoise(noise.x, noise.z, 45), 1, 'only the zombie inside the radius hears it');
  assert.deepEqual([z.goal.x, z.goal.z], [0, 10]); assert.equal(deaf.hunt, 0);
  run(api, zombies, 1); assert.equal(z.state, 'investigate'); assert.equal(z.sees, false); assert.equal(deaf.state, 'wander');
  let closest = Infinity, nearPlayer = Infinity;
  for (let s = 0; s < 40; s++) { run(api, zombies, 1); closest = Math.min(closest, dist(z, noise)); nearPlayer = Math.min(nearPlayer, dist(z, player)); }
  assert.ok(closest < 2, `reached the noise (${closest.toFixed(1)} m off)`);
  assert.ok(nearPlayer > 45, 'and never went for the player');
  run(api, zombies, HORDE.search + 1); assert.equal(z.state, 'wander', 'gives up once there is nothing to find');
});
test('a zombie chases only once it sees the player, and loses them to the last place they were seen', () => {
  const { api, player, zombies, world } = setup(), z = api.makeZombie();
  at(z, 20, 0); player.x = 0; player.z = 0;
  api.makeNoise(0, 0, 45); run(api, zombies, .2); assert.equal(z.state, 'investigate'); assert.equal(z.alert, 0);
  world.view = true; run(api, zombies, .2); assert.equal(z.state, 'chase'); assert.equal(z.sees, true);
  player.x = -5; run(api, zombies, .1); assert.deepEqual([z.goal.x, z.goal.z], [-5, 0], 'while it sees, it tracks the player');
  world.view = false; player.x = -60; player.z = 30; run(api, zombies, .1);
  assert.equal(z.state, 'investigate'); assert.deepEqual([z.goal.x, z.goal.z], [-5, 0], 'out of sight, it heads for where the player was');
  // Beyond its sight range it does not see the player even in the open.
  world.view = true; player.x = z.root.position.x + threat.sight + 1; player.z = z.root.position.z; run(api, zombies, .1); assert.equal(z.sees, false);
});
test('hearing scales with the night, and dead or stood-down zombies hear nothing', () => {
  const { api, zombies, daytime } = setup(), z = api.makeZombie(), dead = api.makeZombie(), gone = api.makeZombie();
  at(z, 50, 0); at(dead, 10, 0); at(gone, 10, 0); dead.dead = 1; api.retireZombie(gone);
  assert.equal(api.makeNoise(0, 0, 45), 0, 'day: 50 m is out of a 45 m pistol radius');
  setClock(daytime, 1, 3); hordeAt(daytime.day, daytime.hour, threat);
  assert.equal(threat.hearing, nightValues(3).hearing);
  assert.equal(api.makeNoise(0, 0, 45), 1, 'night 3: the same shot carries further');
  assert.equal(dead.hunt, 0); assert.equal(gone.hunt, 0);
});
test('the horde grows at night and thins by day, one at a time, never past the pool', () => {
  const { api, player, zombies, daytime } = setup();
  const pool = 16; for (let i = 0; i < pool; i++) api.makeZombie();
  player.x = 0; player.z = 0;
  zombies.forEach((z, i) => { at(z, 100 + i * 3, 0); if (i >= 6) { api.retireZombie(z); z.idle = 1e9; } });
  const alive = () => zombies.filter(z => z.active && !z.dead).length;
  setClock(daytime, 13, 1); api.updateHorde(.5); assert.equal(activeTarget(threat, pool), Math.round(HORDE.day.active * pool));
  for (let i = 0; i < 100; i++) api.updateHorde(.5); assert.equal(alive(), activeTarget(threat, pool));
  setClock(daytime, 23, 2); api.updateHorde(.5); const before = alive(); api.updateHorde(.5); assert.ok(alive() <= before + 1, 'one at a time');
  for (let i = 0; i < 200; i++) api.updateHorde(.5);
  assert.equal(alive(), Math.round(nightValues(2).active * pool)); assert.ok(alive() <= pool);
  // Dawn: wanderers far off and out of sight are stood down; one in plain view stays.
  setClock(daytime, 13, 3); zombies.forEach((z, i) => { if (z.active) at(z, 100 + i * 3, 0); });
  for (let i = 0; i < 200; i++) api.updateHorde(.5);
  assert.equal(alive(), activeTarget(threat, pool));
});
