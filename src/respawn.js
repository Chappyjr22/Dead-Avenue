// Where the player wakes after dying. One function decides it, so a later bed (or other home point) slots in here:
// check for it first and fall back to a street.
import { DEATH } from './data.js';
import { AVES, STS, BOUND_X, BOUND_Z, insideBuilding, collide, roomAt } from './world.js';

// A walkable street point inside the playable area, as far from the live dead as can be found: the first sample at
// least DEATH.minZombieDist from every live zombie wins, otherwise the sample furthest from the nearest one.
// random: a function returning [0, 1); Math.random by default (the seeded rnd() belongs to the city layout).
export function chooseRespawnPoint(zombies, random = Math.random) {
  let best = null, bestGap = -1;
  for (let k = 0; k < DEATH.tries; k++) {
    const onAvenue = random() < 0.6, p = { x: 0, z: 0, yaw: 0 };
    if (onAvenue) { p.x = AVES[1 + Math.floor(random() * 4)] + (random() - 0.5) * 16; p.z = (random() - 0.5) * 2 * (BOUND_Z - 8); p.yaw = random() < 0.5 ? 0 : Math.PI; }
    else { p.z = STS[1 + Math.floor(random() * 4)] + (random() - 0.5) * 10; p.x = (random() - 0.5) * 2 * (BOUND_X - 8); p.yaw = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    if (!isStreetSpot(p.x, p.z)) continue;
    let gap = Infinity;
    for (const z of zombies) if (z.active !== false && !z.dead) gap = Math.min(gap, Math.hypot(z.root.position.x - p.x, z.root.position.z - p.z));
    if (gap >= DEATH.minZombieDist) return p;
    if (gap > bestGap) { best = p; bestGap = gap; }
  }
  return best || { x: 41, z: 44, yaw: 0 };
}
// Open street: inside the barriers, not in a building or shop, and not overlapping a car, pole or other solid.
export function isStreetSpot(x, z) {
  if (Math.abs(x) > BOUND_X - 2 || Math.abs(z) > BOUND_Z - 2 || insideBuilding(x, z, 1) || roomAt(x, z)) return false;
  const q = { x, z }; collide(q, 0.6);
  return Math.abs(q.x - x) < 1e-6 && Math.abs(q.z - z) < 1e-6;
}
