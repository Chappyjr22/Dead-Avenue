// Facades and building shells.
import * as THREE from 'three';
import { rnd, rr, ri, pick, col } from './util.js';
import { WALL_COLOURS, TRIM_COLOURS, AWNING_COLOURS, SHOP_SIGNS, SHOP_TYPES } from './data.js';
import { B, obox, fb, fq, _c, UP } from './batch.js';
import { G, FH } from './world.js';
import { shopInterior } from './interiors.js';

const WALLS = WALL_COLOURS.map(col);
const TRIMS = TRIM_COLOURS.map(col);
const AWN = AWNING_COLOURS.map(col);
const IRON = col(0x211f1e), DARK = col(0x1a1817);
let lastDoor = null;
function facade(F, width, floors, st, detail, shop) {
  const H = G + (floors - 1) * FH + 1.0;
  const bays = Math.max(2, Math.round(width / st.bay)), bw = width / bays, pw = st.pier;
  for (let k = 0; k <= bays; k++) fb(B.wall, F, Math.max(0, k * bw - pw / 2), Math.min(width, k * bw + pw / 2), 0, H, -0.5, 0, st.wall);
  // spandrel bands between window rows, set back from the piers
  for (let f = 1; f < floors; f++) { const y = G + (f - 1) * FH; fb(B.wall, F, 0, width, f === 1 ? y - 0.1 : y - 0.45, y + 0.9, -0.5, -0.07, st.wall2); }
  const topY = G + (floors - 2) * FH + FH - 0.45;
  fb(B.wall, F, 0, width, topY, H, -0.5, -0.07, st.wall2);
  if (st.cornice) { fb(B.stone, F, -0.15, width + 0.15, H - 0.5, H, -0.5, 0.42, st.trim); fb(B.stone, F, -0.05, width + 0.05, H - 0.8, H - 0.5, -0.5, 0.2, st.trim); }
  else fb(B.stone, F, 0, width, H - 0.16, H, -0.55, 0.06, st.trim);
  for (let f = 1; f < floors; f++) {
    const y = G + (f - 1) * FH;
    if (st.belt) fb(B.stone, F, 0, width, y + 0.8, y + 0.9, -0.5, 0.1, st.trim);
    for (let k = 0; k < bays; k++) {
      const a0 = k * bw + pw / 2, a1 = (k + 1) * bw - pw / 2;
      if (!st.belt) fb(B.stone, F, a0 - 0.06, a1 + 0.06, y + 0.8, y + 0.9, -0.4, 0.09, st.trim);
      if (st.lintel) fb(B.stone, F, a0 - 0.1, a1 + 0.1, y + FH - 0.45, y + FH - 0.2, -0.4, 0.04, st.trim);
      const r = rnd(); const v = r < 0.004 ? 7 : r < 0.36 ? 0 : r < 0.6 ? 1 : r < 0.72 ? 2 : r < 0.82 ? 3 : r < 0.9 ? 4 : r < 0.95 ? 6 : 5;
      fq(B.win, F, a0, a1, y + 0.9, y + FH - 0.45, -0.33, v % 4, 2 - Math.floor(v / 4));
    }
  }
  // ground floor: sign band, bulkhead and storefront bays
  fb(B.plain, F, 0, width, G - 1.0, G - 0.1, -0.5, 0.1, st.band);
  if (shop) { // an open doorway in the middle bay, glazing either side
    const db = Math.floor(bays / 2), d0 = db * bw + pw / 2, d1 = (db + 1) * bw - pw / 2, mid = (d0 + d1) / 2;
    for (let k = 0; k < bays; k++) {
      if (k === db) continue;
      fb(B.stone, F, k * bw, (k + 1) * bw, 0, 0.65, -0.5, -0.1, st.trim);
      fq(B.win, F, k * bw + pw / 2, (k + 1) * bw - pw / 2, 0.65, G - 1.0, -0.3, 0, 0);
    }
    fb(B.plain, F, d0, d1, 2.6, G - 1.0, -0.36, -0.26, st.band);
    { const si = SHOP_SIGNS.indexOf(pick(shop.signs)); fq(B.sign, F, mid - 2.7, mid + 2.7, G - 0.96, G - 0.14, 0.115, si % 2, 7 - Math.floor(si / 2)); }
    const L = new THREE.Vector3().copy(F.u).multiplyScalar(Math.cos(1.25)).addScaledVector(F.n, -Math.sin(1.25)), Ln = new THREE.Vector3().crossVectors(L, UP); // door left ajar
    _c.copy(F.p0).addScaledVector(F.u, d0 + 0.04).addScaledVector(F.n, -0.3).addScaledVector(L, 0.5); _c.y = 0.18 + 1.2;
    obox(B.plain, _c, L, UP, Ln, 1.0, 2.38, 0.05, col(0x24302a));
    lastDoor = { a0: d0, a1: d1 };
  } else {
  fb(B.stone, F, 0, width, 0, 0.45, -0.5, -0.1, st.trim);
  let k = 0;
  while (k < bays) {
    const span = Math.min(bays - k, ri(1, 3)), kind = rnd(), a0 = k * bw + pw / 2, a1 = (k + span) * bw - pw / 2;
    for (let j = 0; j < span; j++) {
      const b0 = (k + j) * bw + pw / 2, b1 = (k + j + 1) * bw - pw / 2;
      if (j === 0 && kind < 0.75) fq(B.win, F, (b0 + b1) / 2 - 0.75, (b0 + b1) / 2 + 0.75, 0, G - 1.0, -0.09, 3, 0);
      else fq(B.win, F, b0, b1, 0.45, G - 1.0, -0.3, kind < 0.55 ? 0 : kind < 0.88 ? 1 : 2, 0);
    }
    if (detail && rnd() < 0.6) { const w = Math.min(a1 - a0, 5.6), mid = (a0 + a1) / 2; fq(B.sign, F, mid - w / 2, mid + w / 2, G - 0.96, G - 0.14, 0.115, ri(0, 1), ri(0, 7)); }
    if (detail && rnd() < 0.35) { // sloped awning
      const sl = new THREE.Vector3().copy(F.n).multiplyScalar(0.9).add(new THREE.Vector3(0, -0.45, 0)).normalize(), th = new THREE.Vector3().crossVectors(sl, F.u).normalize();
      _c.copy(F.p0).addScaledVector(F.u, (a0 + a1) / 2).addScaledVector(F.n, 0.75); _c.y = G - 1.35;
      obox(B.plain, _c, F.u, th, sl, a1 - a0 + 0.3, 0.06, 1.55, pick(AWN));
    }
    k += span;
  }
  }
  // fire escape
  if (detail && floors >= 4 && floors <= 9 && bays >= 4 && rnd() < 0.7) {
    const k0 = ri(1, bays - 3), a0 = k0 * bw + 0.15, a1 = (k0 + 2) * bw - 0.15, L = a1 - a0;
    for (let f = 2; f <= floors; f++) {
      const y = G + (f - 2) * FH + 0.02;
      fb(B.iron, F, a0, a1, y, y + 0.06, 0.02, 1.15, IRON);
      for (const hy of [0.5, 1.0]) { fb(B.iron, F, a0, a1, y + hy, y + hy + 0.04, 1.11, 1.15, IRON); fb(B.iron, F, a0, a0 + 0.04, y + hy, y + hy + 0.04, 0.02, 1.15, IRON); fb(B.iron, F, a1 - 0.04, a1, y + hy, y + hy + 0.04, 0.02, 1.15, IRON); }
      const nb = Math.round(L / 0.42); for (let j = 0; j <= nb; j++) { const a = a0 + j * (L - 0.03) / nb; fb(B.iron, F, a, a + 0.03, y, y + 1.0, 1.12, 1.15, IRON); }
      if (f < floors) { // stair up to the next landing
        const run = L - 1.4, diag = new THREE.Vector3().copy(F.u).multiplyScalar(run).add(new THREE.Vector3(0, FH, 0)), len = diag.length(); diag.normalize();
        const perp = new THREE.Vector3().crossVectors(F.n, diag).normalize();
        for (const d of [0.2, 0.75]) { _c.copy(F.p0).addScaledVector(F.u, a0 + 0.7 + run / 2).addScaledVector(F.n, d); _c.y = y + FH / 2; obox(B.iron, _c, diag, perp, F.n, len, 0.1, 0.04, IRON); }
        for (let s = 1; s < 9; s++) { const t = s / 9; fb(B.iron, F, a0 + 0.7 + run * t - 0.12, a0 + 0.7 + run * t + 0.12, y + FH * t, y + FH * t + 0.03, 0.2, 0.77, IRON); }
      }
    }
    for (const a of [a0 + 0.5, a0 + 0.95]) fb(B.iron, F, a, a + 0.04, 2.7, G + 0.02, 0.9, 0.94, IRON);
  }
  return H;
}

const towerSpots = [];
function building(x0, x1, z0, z1, faces, detail, shop, block) {
  const tall = rnd() < 0.12, floors = tall ? ri(15, 26) : ri(4, 11);
  const wall = pick(WALLS).clone().offsetHSL(0, rr(-0.04, 0.04), rr(-0.04, 0.04));
  const st = { wall, wall2: wall.clone().multiplyScalar(rr(0.82, 1.0)), trim: pick(TRIMS), band: pick([0x24211f, 0x3a342e, 0x2a2f33, 0x4a443c].map(col)), bay: rr(2.8, 3.6), pier: rr(0.55, 1.15), cornice: !tall && rnd() < 0.7, belt: rnd() < 0.4, lintel: rnd() < 0.6 };
  let H = 0;
  for (const f of faces) {
    const n = new THREE.Vector3(f[0], 0, f[1]), u = new THREE.Vector3(n.z, 0, -n.x);
    const p0 = new THREE.Vector3(f[0] < 0 ? x0 : f[0] > 0 ? x1 : (f[1] < 0 ? x1 : x0), 0, f[1] < 0 ? z0 : f[1] > 0 ? z1 : (f[0] < 0 ? z0 : z1));
    const F = { p0, u, n }, type = shop && f[0] !== 0 ? pick(SHOP_TYPES) : null;
    H = facade(F, f[0] ? z1 - z0 : x1 - x0, floors, st, detail, type);
    if (type) shopInterior(F, z1 - z0, lastDoor, block, type);
  }
  const roof = H - 0.7; // solid core behind the facades, plus the party walls
  const base = shop ? 3.62 : 0; _c.set((x0 + x1) / 2, (roof + base) / 2, (z0 + z1) / 2); obox(B.wall, _c, new THREE.Vector3(1, 0, 0), UP, new THREE.Vector3(0, 0, 1), x1 - x0 - 0.9, roof - base, z1 - z0 - 0.02, st.wall2.clone().multiplyScalar(0.8));
  _c.set((x0 + x1) / 2 + rr(-3, 3), roof + 1.3, (z0 + z1) / 2 + rr(-2, 2)); obox(B.wall, _c, new THREE.Vector3(1, 0, 0), UP, new THREE.Vector3(0, 0, 1), 3.2, 2.6, 4, st.wall2);
  if (rnd() < 0.4 && z1 - z0 > 9) towerSpots.push([rr(x0 + 4, x1 - 4), roof, rr(z0 + 3.5, z1 - 3.5)]);
}

export { WALLS, facade, building, towerSpots };
