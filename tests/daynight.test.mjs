import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_CYCLE, HORDE, WEAPONS, NOISE, DEATH, MEDKIT } from '../src/data.js';
import { newDaytime, advanceClock, setClock, isNightHour, nightFactor, formatHour, nightValues, hordeAt, hordeCap, activeTarget } from '../src/daynight.js';
import { createPlayer, newArsenal } from '../src/state.js';
import { applyDeath, describeLoss } from '../src/inventory.js';
globalThis.matchMedia = () => ({ matches: false });
const { chooseRespawnPoint, isStreetSpot } = await import('../src/respawn.js');
const { BOUND_X, BOUND_Z, insideBuilding } = await import('../src/world.js');

const C = DAY_CYCLE, near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const dayRate = (C.dusk - C.dawn) / C.dayLength;

test('the cycle is about twelve minutes, two thirds day; a game starts on day 1 in daylight', () => {
  const total = C.dayLength + C.nightLength;
  assert.ok(total >= 600 && total <= 840, `${total} s`);
  assert.ok(near(C.dayLength / total, 2 / 3, 0.05));
  const t = newDaytime(); assert.equal(t.day, 1); assert.equal(isNightHour(t.hour), false); assert.equal(nightFactor(t.hour), 0);
});
test('the clock advances at the day rate, slows to the night rate after dusk and starts a new day at dawn', () => {
  const t = newDaytime();
  advanceClock(t, 60); assert.ok(near(t.hour, C.startHour + 60 * dayRate));
  setClock(t, C.dusk - 1, 1); advanceClock(t, 1 / dayRate); assert.ok(near(t.hour, C.dusk)); assert.equal(t.day, 1);
  advanceClock(t, C.nightLength / 2); assert.ok(near(t.hour, (C.dusk + (24 - C.dusk + C.dawn) / 2) % 24)); assert.equal(t.day, 1, 'past midnight is still the same night');
  advanceClock(t, C.nightLength / 2); assert.ok(near(t.hour, C.dawn)); assert.equal(t.day, 2);
  // One full cycle in many small steps, or in one big step, lands on the same hour of the next day.
  const a = setClock(newDaytime(), 9, 3), b = setClock(newDaytime(), 9, 3);
  for (let i = 0; i < (C.dayLength + C.nightLength) * 60; i++) advanceClock(a, 1 / 60);
  advanceClock(b, C.dayLength + C.nightLength);
  for (const x of [a, b]) { assert.equal(x.day, 4); assert.ok(near(x.hour, 9, 1e-6)); }
  // A step longer than a whole day still counts every dawn.
  const c = setClock(newDaytime(), 12, 1); advanceClock(c, 2 * (C.dayLength + C.nightLength) + 1); assert.equal(c.day, 3);
  assert.equal(formatHour(7.5), '07:30'); assert.equal(formatHour(23.999), '23:59'); assert.equal(formatHour(0), '00:00');
});
test('night falls and lifts smoothly across the twilight, with no jump', () => {
  assert.equal(nightFactor(12), 0); assert.equal(nightFactor(0), 1); assert.equal(nightFactor(C.dusk + C.twilight), 1);
  assert.ok(near(nightFactor(C.dusk), 0.5)); assert.ok(near(nightFactor(C.dawn), 0.5));
  let last = nightFactor(0), step = 0;
  for (let h = 0.001; h < 24; h += 0.001) { const n = nightFactor(h); step = Math.max(step, Math.abs(n - last)); last = n; }
  assert.ok(step < 0.002, `largest step ${step}`);
});

test('each night is harder than the last, by the table and then perNight, within the limits', () => {
  for (let n = 1; n <= HORDE.nights.length; n++) assert.deepEqual(nightValues(n), HORDE.nights[n - 1]);
  const day = HORDE.day;
  let prev = day;
  for (let n = 1; n <= 12; n++) {
    const v = nightValues(n);
    for (const k of ['active', 'speed', 'sight', 'hearing']) { assert.ok(v[k] >= prev[k], `${k} night ${n}`); assert.ok(v[k] <= HORDE.max[k]); }
    for (const k of ['respawn', 'spawnMin', 'spawnMax']) { assert.ok(v[k] <= prev[k], `${k} night ${n}`); assert.ok(v[k] >= HORDE.max[k]); }
    if (n <= 4) assert.ok(v.active > prev.active || v.active === HORDE.max.active, 'more of the pool walks each night');
    prev = v;
  }
  assert.ok(nightValues(4).speed > nightValues(3).speed);
  assert.equal(nightValues(50).speed, HORDE.max.speed);
});
test('the zombie cap holds at any hour, and days are quieter than the old fixed 18 and 12', () => {
  assert.ok(HORDE.cap.desktop <= 24 && HORDE.cap.phone <= 16);
  assert.equal(hordeCap(false), HORDE.cap.desktop); assert.equal(hordeCap(true), HORDE.cap.phone);
  const t = {};
  for (const phone of [false, true]) {
    const pool = hordeCap(phone);
    hordeAt(1, 13, t); const day = activeTarget(t, pool);
    assert.ok(day < (phone ? 12 : 18), `day ${day}`);
    let last = day;
    for (let n = 1; n <= 30; n++) { hordeAt(n, 1, t); const night = activeTarget(t, pool); assert.ok(night <= pool); assert.ok(night >= last); last = night; }
    hordeAt(1, 23, t); assert.ok(activeTarget(t, pool) > day);
    hordeAt(1, C.dusk, t); const mid = activeTarget(t, pool); assert.ok(mid > day && mid < activeTarget(hordeAt(1, 23, {}), pool), 'dusk ramps up');
  }
  assert.equal(hordeAt(2, 1, t).nightNumber, 2); assert.equal(hordeAt(2, 13, t).nightNumber, 0);
});

test('weapons, sprinting and crouching set noise radii; the rifle is much louder than the pistol', () => {
  assert.ok(WEAPONS.makarov.noise > 0); assert.ok(WEAPONS.ak47.noise >= 2 * WEAPONS.makarov.noise);
  assert.ok(NOISE.sprint > 0 && NOISE.sprint < WEAPONS.makarov.noise); assert.equal(NOISE.crouch, 0); assert.equal(NOISE.walk, 0);
});

test('death keeps the weapons with starting rounds, starting medkits and worn gear; everything else is lost', () => {
  const p = createPlayer();
  p.supplies = { food: 3, water: 2 }; p.guns.makarov.spare = 60; p.guns.makarov.ammo = 5; p.guns.ak47.spare = 150; p.medkits = 3; p.healing = 0.5;
  p.equipment = { backpack: 'fieldPack', clothing: 'cargoVest' };
  const lost = applyDeath(p);
  assert.deepEqual(lost, { food: 3, water: 2, ammo: 65 - WEAPONS.makarov.mag - WEAPONS.makarov.spare, rifleAmmo: 150 - WEAPONS.ak47.spare, medkit: 3 - MEDKIT.start });
  assert.deepEqual(p.guns, newArsenal()); assert.equal(p.medkits, MEDKIT.start); assert.deepEqual(p.supplies, { food: 0, water: 0 });
  assert.deepEqual(p.equipment, { backpack: 'fieldPack', clothing: 'cargoVest' }); assert.equal(p.healing, 0);
  assert.match(describeLoss(lost), /3 canned beans, 2 bottles of water, 29 pistol rounds, 60 rifle rounds, 2 medkits/);
  // With nothing extra carried, nothing is lost, and a used-up starting medkit comes back.
  const q = createPlayer(); q.supplies = { food: 0, water: 0 }; q.medkits = 0; q.guns.makarov.ammo = 0; q.guns.makarov.spare = 3;
  assert.equal(describeLoss(applyDeath(q)), ''); assert.equal(q.medkits, MEDKIT.start); assert.equal(q.guns.makarov.ammo, WEAPONS.makarov.mag);
  assert.ok(DEATH.hp > 0 && DEATH.hunger > 0 && DEATH.thirst > 0);
});
test('the respawn point is a walkable street spot in the playable area, away from the dead', () => {
  let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const zombie = (x, z) => ({ root: { position: { x, z } }, dead: 0, active: true });
  const horde = [zombie(41, 44), zombie(-41, 0), zombie(123, -100), zombie(41, -53.5), zombie(-123, 120)];
  for (let i = 0; i < 40; i++) {
    const p = chooseRespawnPoint(horde, random);
    assert.ok(isStreetSpot(p.x, p.z)); assert.ok(!insideBuilding(p.x, p.z)); assert.ok(Math.abs(p.x) < BOUND_X && Math.abs(p.z) < BOUND_Z);
    for (const z of horde) assert.ok(Math.hypot(z.root.position.x - p.x, z.root.position.z - p.z) >= DEATH.minZombieDist);
    assert.ok(Number.isFinite(p.yaw));
  }
  // Dead and stood-down zombies do not count; a crowded city still gives the emptiest spot found.
  const crowd = []; for (let x = -123; x <= 123; x += 82) for (let z = -160; z <= 160; z += 20) crowd.push(zombie(x, z));
  const p = chooseRespawnPoint(crowd, random); assert.ok(isStreetSpot(p.x, p.z));
  assert.ok(chooseRespawnPoint([{ ...zombie(41, 44), dead: 1 }], random));
});
