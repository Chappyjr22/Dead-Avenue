// City grid constants and the queries the game asks of the world: ground height, collision, ray hits.
import { clamp } from './util.js';

const PX = 82, PZ = 107, OX = 205, OZ = 267.5, NB = 5;      // block pitch, grid origin, blocks per side
const BOUND_X = 131, BOUND_Z = 168;                          // playable area
const G = 4.6, FH = 3.3;                                     // ground floor / upper floor heights
const rooms = [], pickSpots = [], lurkSpots = [];
const AVES = [-205, -123, -41, 41, 123, 205], STS = [-267.5, -160.5, -53.5, 53.5, 160.5, 267.5];
const circles = [];
const addCircle = (x, z, r, h = 3) => circles.push({ x, z, r, h });
// Obstacles bucketed into a coarse grid, so a query only looks at the handful nearby instead of all of them.
// Each circle is filed under every cell its padded bounds touch; one cell lookup then covers any agent standing in it.
const CELL = 4, PAD = 1.5, EMPTY = [];
let grid = null, gridCount = -1;
function clearCircleGrid() { grid = null; }
function nearCircles(x, z) {
  if (!grid || gridCount !== circles.length) { // rebuilt whenever obstacles are added or removed
    grid = new Map(); gridCount = circles.length;
    for (const c of circles) {
      const x0 = Math.floor((c.x - c.r - PAD) / CELL), x1 = Math.floor((c.x + c.r + PAD) / CELL), z0 = Math.floor((c.z - c.r - PAD) / CELL), z1 = Math.floor((c.z + c.r + PAD) / CELL);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 4096 + j; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); }
    }
  }
  return grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)) || EMPTY;
}

function local(x, z) { return [((x + OX) % PX + PX) % PX, ((z + OZ) % PZ + PZ) % PZ]; }
function groundY(x, z) { if (Math.abs(x) > OX || Math.abs(z) > OZ) return 0; const [mx, mz] = local(x, z); return mx > 9 && mx < 73 && mz > 5.5 && mz < 101.5 ? 0.18 : 0; }
function insideBuilding(x, z, pad = 0) { if (Math.abs(x) > OX || Math.abs(z) > OZ) return false; const [mx, mz] = local(x, z); return mx > 13.5 - pad && mx < 68.5 + pad && mz > 10 - pad && mz < 97 + pad; }
function roomAt(x, z) { for (const R of rooms) { if (Math.abs(x - R.cx) > 16 || Math.abs(z - R.cz) > 16) continue; if ((x > R.dx0 && x < R.dx1 && z > R.dz0 && z < R.dz1) || (x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1)) return R; } return null; }
function collide(p, r, h = 0) { // push a circle out of buildings, cars and poles; shop rooms and their doorways are walkable
  let indoors = false;
  for (const R of rooms) {
    if (Math.abs(p.x - R.cx) > 20 || Math.abs(p.z - R.cz) > 20) continue;
    if (p.x > R.dx0 && p.x < R.dx1 && p.z > R.dz0 - 0.3 && p.z < R.dz1 + 0.3) { p.z = clamp(p.z, R.dz0 + r, R.dz1 - r); indoors = true; break; }
    if (p.x > R.x0 - 0.3 && p.x < R.x1 + 0.3 && p.z > R.z0 - 0.3 && p.z < R.z1 + 0.3) { p.x = clamp(p.x, R.x0 + r, R.x1 - r); p.z = clamp(p.z, R.z0 + r, R.z1 - r); indoors = true; break; }
  }
  if (!indoors) {
    const [mx, mz] = local(p.x, p.z), cx = clamp(mx, 13.5, 68.5), cz = clamp(mz, 10, 97), dx = mx - cx, dz = mz - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
      else { const e = [mx - 13.5, 68.5 - mx, mz - 10, 97 - mz], k = e.indexOf(Math.min(...e)); if (k === 0) p.x -= e[0] + r; else if (k === 1) p.x += e[1] + r; else if (k === 2) p.z -= e[2] + r; else p.z += e[3] + r; }
    }
  }
  for (const c of nearCircles(p.x, p.z)) { const ex = p.x - c.x, ez = p.z - c.z, rr2 = r + c.r; if (Math.abs(ex) < rr2 && Math.abs(ez) < rr2) { const d = Math.hypot(ex, ez); if (d < rr2 && d > 1e-5) { p.x += ex / d * (rr2 - d); p.z += ez / d * (rr2 - d); } } }
  p.x = clamp(p.x, -BOUND_X, BOUND_X); p.z = clamp(p.z, -BOUND_Z, BOUND_Z);
}
// how far a ray travels inside a room before a wall stops it, and whether it left through the shop front
function roomExit(R, x, z, dx, dz) {
  const back = R.nx > 0 ? R.x0 : R.x1, front = R.fx; let t = Infinity, viaFront = false;
  if (Math.abs(dx) > 1e-6) { const tb = (back - x) / dx, tf = (front - x) / dx; if (tb > 1e-4) t = tb; if (tf > 1e-4 && tf < t) { t = tf; viaFront = true; } }
  if (Math.abs(dz) > 1e-6) { const ta = (R.z0 - z) / dz, tb = (R.z1 - z) / dz, tz = Math.max(ta, tb); if (tz > 1e-4 && tz < t) { t = tz; viaFront = false; } }
  return { t, viaFront };
}
function rayWorld(ox, oy, oz, dx, dy, dz, maxT) { // nearest hit against building blocks, shop walls, cars and the ground
  let best = maxT, skip = -1;
  const home = roomAt(ox, oz);
  if (home) {
    skip = home.block; const e = roomExit(home, ox, oz, dx, dz), ey = oy + dy * e.t;
    if (!(e.viaFront && ey > 0.7 && ey < 3.5)) best = Math.min(best, e.t);
    if (dy > 1e-4) best = Math.min(best, (3.5 - oy) / dy);
  }
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    if (i * NB + j === skip) continue;
    const x0 = (i - 2) * PX - 27.5, x1 = x0 + 55, z0 = (j - 2) * PZ - 43.5, z1 = z0 + 87;
    let t0 = 0, t1 = best;
    if (Math.abs(dx) < 1e-6) { if (ox < x0 || ox > x1) continue; } else { let a = (x0 - ox) / dx, b = (x1 - ox) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (Math.abs(dz) < 1e-6) { if (oz < z0 || oz > z1) continue; } else { let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (!(t0 <= t1 && t0 < best && oy + dy * t0 < 110)) continue;
    let hit = t0; // an open shop doorway lets the ray carry on to the room's far wall
    const hx = ox + dx * t0, hz = oz + dz * t0, hy = oy + dy * t0;
    for (const R of rooms) if (R.block === i * NB + j && Math.abs(hx - R.fx) < 0.05 && hz > R.dz0 && hz < R.dz1 && hy < 2.7) { hit = t0 + roomExit(R, hx - R.nx * 0.01, hz, dx, dz).t; break; }
    if (hit < best) best = hit;
  }
  const hl = Math.hypot(dx, dz);
  if (hl > 1e-4) for (const c of circles) {
    const fx = c.x - ox, fz = c.z - oz, tca = (fx * dx + fz * dz) / (hl * hl); if (tca < 0 || tca > best) continue;
    const px = ox + dx * tca - c.x, pz = oz + dz * tca - c.z; if (px * px + pz * pz < c.r * c.r * 0.8) { const y = oy + dy * tca; if (y < c.h && y > 0 && tca < best) best = tca; }
  }
  if (dy < -1e-4) { const t = -oy / dy; if (t < best) best = t; }
  return best;
}

export { PX, PZ, OX, OZ, NB, BOUND_X, BOUND_Z, G, FH, rooms, pickSpots, lurkSpots, AVES, STS, circles, addCircle, nearCircles, clearCircleGrid, local, groundY, insideBuilding, roomAt, collide, roomExit, rayWorld };
