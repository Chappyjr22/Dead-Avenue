// Lays out every block and the distant skyline.
import './textures.js'; // textures draw from the seeded random sequence first, so they must run before the layout
import { rnd, rr } from './util.js';
import { FOG } from './render.js';
import { B, obox, _c, UP, WHITE, X3, Z3 } from './batch.js';
import { PX, PZ, NB } from './world.js';
import { building } from './buildings.js';

for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
  const cx = (i - 2) * PX, cz = (j - 2) * PZ, detail = i >= 1 && i <= 3 && j >= 1 && j <= 3;
  _c.set(cx, 0.09, cz); obox(B.walk, _c, X3, UP, Z3, 64, 0.18, 96, WHITE);
  for (const side of [-1, 1]) {
    let z = cz - 43.5; const zEnd = cz + 43.5;
    while (z < zEnd - 0.01) {
      let w = rr(10, 24); if (zEnd - (z + w) < 10) w = zEnd - z;
      const faces = [[side, 0]]; if (z === cz - 43.5) faces.push([0, -1]); if (z + w >= zEnd - 0.01) faces.push([0, 1]);
      const shop = detail && faces.length === 1 && w >= 11 && z <= cz + 22 && z + w > cz + 22; // one enterable shop per row
      building(side < 0 ? cx - 27.5 : cx, side < 0 ? cx : cx + 27.5, z, z + w, faces, detail, shop, i * NB + j);
      z += w;
    }
  }
}
// hazy skyline beyond the grid: flat silhouettes a little darker than the haze
for (let i = 0; i < 110; i++) {
  const a = rnd() * 6.283, r = rr(300, 640), x = Math.cos(a) * r, z = Math.sin(a) * r * 1.15;
  if (Math.abs(x) < 240 && Math.abs(z) < 300) continue;
  const w = rr(22, 55), d = rr(22, 55), h = rr(35, 150), tc = FOG.clone().multiplyScalar(rr(0.62, 0.9) + (r - 300) / 340 * 0.12); _c.set(x, h / 2, z); obox(B.far, _c, X3, UP, Z3, w, h, d, tc);
  if (rnd() < 0.6) { const h2 = h * rr(0.15, 0.4); _c.set(x, h + h2 / 2, z); obox(B.far, _c, X3, UP, Z3, w * 0.62, h2, d * 0.62, tc); if (rnd() < 0.5) { _c.set(x, h + h2 + h2 * 0.3, z); obox(B.far, _c, X3, UP, Z3, w * 0.3, h2 * 0.6, d * 0.3, tc); } }
}
