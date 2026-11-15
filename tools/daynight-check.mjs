// Logic checks for the day-night cycle, the horde, noise and death, run in the real game through tools/shot.mjs.
// PORT=8796 node tools/daynight-check.mjs   (prints its results as [warning] lines; renders one small frame)
import { execFileSync } from 'child_process';

const js = String.raw`
const out = (...a) => console.warn(a.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' '));
const live = () => g.zombies.filter(z => z.active && !z.dead);
const settle = (s) => { for (let i = 0; i < s * 2; i++) g.updateHorde(0.5); };
const P0 = { x: 41, z: 44 };

// 1. The clock.
out('clock at start', g.daytime);

// 2. Horde size by day and night (the horde tops up or stands down one zombie each half second).
const counts = {};
g.setTime(13, 1); settle(240); counts.day1 = live().length;
for (const n of [1, 2, 3]) { g.setTime(23, n); settle(240); counts['night' + n] = live().length; out('threat night ' + n, Object.fromEntries(Object.entries(g.threat).map(([k, v]) => [k, +(+v).toFixed(2)]))); }
g.setTime(13, 4); settle(240); counts.day4 = live().length;
out('active zombies (pool ' + g.zombies.length + ')', counts);

// 3. Pistol versus rifle: the same 24 zombies at the same spots, count who hears each shot.
g.setTime(13, 1);
const spots = []; Object.assign(g.player, P0);
for (let i = 0; i < g.zombies.length; i++) { const d = 8 + i * 5.5; for (let a = i * 2.4, k = 0; k < 400; k++, a += 0.05) { const x = P0.x + Math.sin(a) * d, z = P0.z + Math.cos(a) * d; if (g.isStreetSpot(x, z)) { spots.push({ x, z }); break; } } }
out('test spots on streets', spots.length);
const reset = () => g.zombies.forEach((z, i) => { z.active = true; z.dead = 0; z.root.visible = true; z.hunt = 0; z.sees = false; z.state = 'wander'; z.path = []; z.navPending = null; z.root.position.set(spots[i].x, 0, spots[i].z); });
const hearers = () => g.zombies.filter(z => z.hunt > 0).length;
g.player.pitch = 1.2; // aim at the sky so the shot hits nobody
reset(); g.player.cool = 0; g.fire(); const pistol = hearers();
g.selectWeapon('ak47'); for (let i = 0; i < 12; i++) g.updatePlayer(0.05);
reset(); Object.assign(g.player, P0); g.player.cool = 0; g.fire(); const rifle = hearers();
out('zombies at 8..135 m that heard one shot by day', { pistol, rifle, weapon: g.player.weapon });
for (let i = 0; i < 12; i++) g.updatePlayer(0.05);
reset(); Object.assign(g.player, P0); let shots = 0;
for (let t = 0; t < 3; t += 0.05) { g.player.cool = Math.min(g.player.cool, 0); if (g.player.ammo > 0) { g.fire(); } g.updatePlayer(0.05); }
out('rifle, three seconds of sustained fire: zombies drawn', hearers());

// 4. They go to the noise, not to the player: fire, then move away out of sight; where do they end up?
reset(); Object.assign(g.player, P0, { reloading: 0, cool: 0, pitch: 1.2 }); g.player.ammo = 30; g.fire();
const drawn = g.zombies.filter(z => z.hunt > 0), before = drawn.map(z => Math.hypot(z.root.position.x - P0.x, z.root.position.z - P0.z));
Object.assign(g.player, { x: -41, z: -120 }); // two blocks away, behind buildings
const toPlayerBefore = drawn.map(z => Math.hypot(z.root.position.x - g.player.x, z.root.position.z - g.player.z));
for (let i = 0; i < 30 * 60; i++) { g.updateNavigation(); for (const z of g.zombies) g.updateZombie(z, 1 / 30); }
const after = drawn.map(z => Math.hypot(z.root.position.x - P0.x, z.root.position.z - P0.z)), toPlayer = drawn.map(z => Math.hypot(z.root.position.x - g.player.x, z.root.position.z - g.player.z));
const med = a => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };
out('after 60 s, the ' + drawn.length + ' that heard: median distance to the shot', { before: med(before), after: med(after), within6m: after.filter(d => d < 6).length, toPlayerBefore: med(toPlayerBefore), toPlayerAfter: med(toPlayer), chasing: drawn.filter(z => z.state === 'chase').length });

// 5. Sprint and crouch make different noise.
for (const mode of ['walk', 'sprint', 'crouch']) {
  reset(); Object.assign(g.player, P0, { yaw: 0 }); g.player.hp = 100;
  const down = c => dispatchEvent(new KeyboardEvent('keydown', { code: c })), up = c => dispatchEvent(new KeyboardEvent('keyup', { code: c }));
  if (mode === 'crouch') down('KeyC'); down('KeyW'); if (mode === 'sprint') down('ShiftLeft');
  for (let i = 0; i < 20; i++) g.updatePlayer(0.05);
  up('KeyW'); up('ShiftLeft'); if (mode === 'crouch') down('KeyC');
  out('one second of ' + mode + 'ing: zombies within ' + spots.length + ' heard', hearers(), 'nearest at', Math.hypot(spots[0].x - P0.x, spots[0].z - P0.z).toFixed(1) + ' m');
  for (let i = 0; i < 4; i++) g.updatePlayer(0.05);
}
`;
const js2 = String.raw`
const out = (...a) => console.warn(a.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' '));
// 6. Logic time per frame at night 3 with every zombie in the pool alive and chasing.
g.setTime(23, 3);
Object.assign(g.player, { x: 41, z: 0, hp: 1e6 });
g.zombies.forEach((z, i) => { z.active = true; z.dead = 0; z.root.visible = true; const a = i / g.zombies.length * 6.283, d = 12 + (i % 4) * 7; z.root.position.set(41 + Math.sin(a) * Math.min(d, 9), 0, Math.cos(a) * d); z.path = []; z.navPending = null; });
const times = [];
for (let i = 0; i < 400; i++) { const t0 = performance.now(); g.updatePlayer(1 / 60); g.updateHorde(1 / 60); g.updateNavigation(); for (const z of g.zombies) g.updateZombie(z, 1 / 60); times.push(performance.now() - t0); }
const s = times.slice(100).sort((a, b) => a - b);
out('logic ms/frame, ' + g.zombies.filter(z => z.active && !z.dead).length + ' alive, ' + g.zombies.filter(z => z.state === 'chase').length + ' chasing', { median: +s[s.length >> 1].toFixed(3), p95: +s[Math.floor(s.length * 0.95)].toFixed(3), max: +s[s.length - 1].toFixed(3) });

// 7. Death: carry extra supplies, ammo and medkits, die, read the screen, get up.
g.player.hp = 100;
const p = g.player; p.supplies.food = 3; p.supplies.water = 2; p.guns.makarov.spare = 60; p.guns.ak47.spare = 150; p.medkits = 3; p.equipment.backpack = 'hikingPack';
const takenBefore = g.pickups.filter(q => q.taken).length; g.pickups[0].taken = true; g.pickups[0].m.visible = false;
const clockBefore = { ...g.daytime }, kills = p.kills, zpos = g.zombies.map(z => z.root.position.x.toFixed(2)).join();
p.hp = 0; g.updatePlayer(0.016);
out('death screen', document.getElementById('title').textContent, '|', document.getElementById('blurb').textContent, '|', document.getElementById('go').textContent);
g.begin();
const near = Math.min(...g.zombies.filter(z => z.active && !z.dead).map(z => Math.hypot(z.root.position.x - p.x, z.root.position.z - p.z)));
out('world after getting up', { clock: g.daytime, clockBefore, pickup0Taken: g.pickups[0].taken, zombiesUnmoved: zpos === g.zombies.map(z => z.root.position.x.toFixed(2)).join(), killsKept: p.kills === kills });
out('player after getting up', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), street: g.isStreetSpot(p.x, p.z), nearestZombie: +near.toFixed(1), hp: p.hp, hunger: p.hunger, thirst: p.thirst, supplies: p.supplies, guns: p.guns, medkits: p.medkits, equipment: p.equipment, weapon: p.weapon, kills: p.kills === kills, clock: g.daytime, clockBefore, pickup0Taken: g.pickups[0].taken, zombiesUnmoved: zpos === g.zombies.map(z => z.root.position.x.toFixed(2)).join() });
`;
const steps = [
  { name: 'check-a', begin: true, frames: 1, js, p: { x: 41, z: 44 } },
  { name: 'check-b', frames: 1, js: js2 }
];
let text; try { text = execFileSync('node', ['tools/shot.mjs', JSON.stringify(steps), '320', '180'], { env: process.env, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { text = e.stdout + e.stderr; }
process.stdout.write(text.split('\n').filter(l => !/Canvas2D|ERR_FAILED/.test(l)).join('\n'));
