// Enterable shop interiors.
import * as THREE from 'three';
import { rnd, rr, ri, pick, col } from './util.js';
import { B, obox, fb, UP, WHITE } from './batch.js';
import { rooms, pickSpots, lurkSpots, circles } from './world.js';

const DIM = c => col(c).multiplyScalar(0.5);
function shopInterior(F, width, door, block, type) {
  const GOODS = type.goods.map(DIM);
  const Dp = 12.5, FL = 0.2, CE = 3.5, w2 = (a, d) => new THREE.Vector3().copy(F.p0).addScaledVector(F.u, a).addScaledVector(F.n, d);
  fb(B.tile, F, 0, width, 0.17, FL, -Dp, -0.02, WHITE);
  fb(B.int, F, 0, width, CE, CE + 0.12, -Dp, -0.5, DIM(0x8a8880));
  const wallC = DIM(pick(type.wall));
  fb(B.int, F, 0, 0.4, FL, CE, -Dp, -0.5, wallC); fb(B.int, F, width - 0.4, width, FL, CE, -Dp, -0.5, wallC); fb(B.int, F, 0, width, FL, CE, -Dp - 0.4, -Dp, wallC);
  fb(B.int, F, 0.4, width - 0.4, FL, FL + 0.12, -Dp + 0.0, -Dp + 0.03, DIM(0x3a3632));
  for (let a = 2; a < width - 2; a += 3.2) fb(B.int, F, a, a + 1.3, CE - 0.07, CE, -Dp + 2, -Dp + 2.3, DIM(0xd8d8d0)), fb(B.int, F, a, a + 1.3, CE - 0.07, CE, -5, -4.7, DIM(0xd8d8d0)); // dead strip lights
  const loot = p => pickSpots.push(Object.assign(p, { kind: rnd() < (type.medkit || 0) ? 'medkit' : 'ammo' })); // the kind rides on the Vector3
  const circ = (a, d, r, h) => { const p = w2(a, d); circles.push({ x: p.x, z: p.z, r, h }); };
  // chiller cabinets along the back wall
  if (type.chillers) for (let a = 0.6; a + 1.1 < width - 0.6; a += 1.15) {
    fb(B.int, F, a, a + 1.1, FL, 2.25, -Dp + 0.02, -Dp + 0.75, DIM(0xc4c4bc));
    fb(B.int, F, a + 0.07, a + 1.03, FL + 0.25, 2.1, -Dp + 0.74, -Dp + 0.78, col(0x0c1012));
    fb(B.int, F, a + 0.93, a + 0.97, 1.0, 1.5, -Dp + 0.78, -Dp + 0.83, DIM(0x9a9a98));
  } else for (let a = 0.6; a + 1.1 < width - 0.6; a += 1.15) { // tall wall shelving with products
    fb(B.int, F, a, a + 1.1, FL, 2.3, -Dp + 0.02, -Dp + 0.05, DIM(0x6a6258));
    fb(B.int, F, a, a + 0.04, FL, 2.3, -Dp + 0.02, -Dp + 0.5, DIM(0x6a6258)); fb(B.int, F, a + 1.06, a + 1.1, FL, 2.3, -Dp + 0.02, -Dp + 0.5, DIM(0x6a6258));
    for (const y of [0.2, 0.75, 1.3, 1.85]) {
      fb(B.int, F, a, a + 1.1, y, y + 0.04, -Dp + 0.02, -Dp + 0.5, DIM(0x7a7468));
      for (let q = a + 0.08; q < a + 1.0; ) { const w = rr(0.08, 0.2); if (rnd() < type.fill + 0.2) fb(B.int, F, q, q + w, y + 0.04, y + 0.04 + rr(0.15, 0.4), -Dp + 0.08, -Dp + 0.08 + rr(0.1, 0.3), pick(GOODS)); q += w + rr(0.02, 0.15); }
    }
  }
  for (let a = 1; a < width - 1; a += 0.9) circ(a, -Dp + 0.4, 0.55, 2.2);
  // counter and till beside the door
  const side = rnd() < 0.5 ? 1 : -1, ca = side > 0 ? width - 3.6 : 0.9, cd0 = -4.2, cd1 = -1.6;
  fb(B.int, F, ca + (side > 0 ? 0 : 2.0), ca + (side > 0 ? 0.7 : 2.7), FL, 1.12, cd0, cd1, DIM(0x5a4636));
  fb(B.int, F, ca + (side > 0 ? -0.04 : 1.96), ca + (side > 0 ? 0.74 : 2.74), 1.12, 1.17, cd0 - 0.04, cd1 + 0.04, DIM(0x2a2826));
  const ta = ca + (side > 0 ? 0.35 : 2.35);
  fb(B.int, F, ta - 0.2, ta + 0.2, 1.17, 1.42, -3.1, -2.7, DIM(0x3a3c3e)); fb(B.int, F, ta - 0.16, ta + 0.16, 1.42, 1.62, -3.05, -3.0, DIM(0x1a1c1e));
  for (let d = cd0 + 0.3; d < cd1; d += 0.7) circ(ta, d, 0.5, 1.2);
  loot(w2(ta, -3.8).setY(1.22));
  // shelving runs, mostly stripped
  const lo = side > 0 ? 1.7 : 4.4, hi = side > 0 ? width - 4.6 : width - 1.7, n = Math.max(1, Math.floor((hi - lo) / 2.7) + 1), step = n > 1 ? (hi - lo) / (n - 1) : 0;
  for (let k = 0; k < n; k++) {
    const a = n > 1 ? lo + k * step : (lo + hi) / 2, d0 = -Dp + 2.6, d1 = -3.4 - rr(0, 1.2), mc = DIM(0x8a8a86);
    if (Math.abs(a - (door.a0 + door.a1) / 2) < 1.2 && d1 > -4.4) continue;
    fb(B.int, F, a - 0.03, a + 0.03, FL, 1.75, d0, d1, mc); fb(B.int, F, a - 0.5, a + 0.5, FL, FL + 0.16, d0, d1, DIM(0x4a4a48));
    for (const y of [0.55, 0.95, 1.35]) {
      fb(B.int, F, a - 0.47, a + 0.47, y, y + 0.03, d0, d1, mc);
      for (const sd of [-1, 1]) for (let d = d0 + 0.1; d < d1 - 0.25; ) {
        const w = rr(0.06, 0.13), h = rr(0.09, 0.24), dp = rr(0.08, 0.18), run = rnd() < type.fill ? ri(2, 6) : 0, c = pick(GOODS); // a few facings of the same product survive together
        for (let q = 0; q < run; q++) { if (d > d1 - 0.2) break; for (let row = 0; row < (rnd() < 0.5 ? 2 : 1); row++) fb(B.int, F, a + sd * (0.06 + row * (dp + 0.01)), a + sd * (0.06 + row * (dp + 0.01) + dp), y + 0.03, y + 0.03 + h, d, d + w, c); d += w + 0.012; }
        d += rr(0.05, 0.7);
      }
    }
    for (let d = d0 + 0.4; d < d1; d += 0.8) circ(a, d, 0.56, 1.75);
    if (rnd() < 0.5) loot(w2(a + (rnd() < 0.5 ? 0.25 : -0.25), rr(d0 + 0.5, d1 - 0.5)).setY(0.98 + 0.03));
  }
  for (let i = 0; i < 60; i++) { // goods and paper knocked onto the floor
    const a = rr(0.8, width - 0.8), d = rr(-Dp + 1.2, -0.9), yaw = rnd() * 3, flat = rnd() < 0.5, w = flat ? rr(0.15, 0.4) : rr(0.06, 0.13);
    const ax = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), az = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)), p = w2(a, d);
    p.y = FL + (flat ? 0.004 : w / 2); obox(B.int, p, ax, UP, az, w, flat ? 0.008 : w, flat ? rr(0.12, 0.3) : rr(0.1, 0.26), flat ? DIM(0xb8b2a4) : pick(GOODS));
  }
  loot(w2(rr(1.5, width - 1.5), -Dp + 1.4).setY(FL + 0.05));
  if (rnd() < 0.55) lurkSpots.push(w2(width / 2 + rr(-2, 2), -Dp + 1.6));
  const A = w2(0.4, -0.5), Bc = w2(width - 0.4, -Dp), dA = w2(door.a0 + 0.02, -1.15), dB = w2(door.a1 - 0.02, 0.7);
  rooms.push({ type: type.name, block, fx: F.p0.x, nx: F.n.x, x0: Math.min(A.x, Bc.x), x1: Math.max(A.x, Bc.x), z0: Math.min(A.z, Bc.z), z1: Math.max(A.z, Bc.z), dx0: Math.min(dA.x, dB.x), dx1: Math.max(dA.x, dB.x), dz0: Math.min(dA.z, dB.z), dz1: Math.max(dA.z, dB.z), cx: (A.x + Bc.x) / 2, cz: (A.z + Bc.z) / 2 });
}

export { shopInterior };
