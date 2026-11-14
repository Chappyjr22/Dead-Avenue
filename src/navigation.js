// Shared, incremental A*: collision-sized routes through streets and shop doors.
// Grid occupancy is lazy and cached; invalidate when future building changes solids.
import { collide, circles, BOUND_X, BOUND_Z } from './world.js';
const STEP = 0.75, RADIUS = 0.40;
const cells = new Map();
export function clearNavigation() { cells.clear(); }
function clearPoint(x, z) {
  if (Math.abs(x) > BOUND_X || Math.abs(z) > BOUND_Z) return false;
  // collide intentionally ignores exact circle centres; navigation must not.
  for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + RADIUS) return false;
  const p = { x, z }; collide(p, RADIUS);
  return Math.hypot(p.x - x, p.z - z) < 0.001;
}
export function clearSegment(a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2));
  for (let i = 0; i <= n; i++) if (!clearPoint(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false;
  return true;
}
const key = (x, z) => x + ',' + z;
function cell(x, z) {
  const k = key(x, z);
  if (!cells.has(k)) cells.set(k, clearPoint(x * STEP, z * STEP));
  return cells.get(k);
}
function anchor(p) {
  const x = Math.round(p.x / STEP), z = Math.round(p.z / STEP);
  const candidates = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const q = { x: (x + dx) * STEP, z: (z + dz) * STEP, gx: x + dx, gz: z + dz };
    if (cell(q.gx, q.gz)) candidates.push(q);
  }
  candidates.sort((a, b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  return candidates.find(q => clearSegment(p, q));
}
function push(heap, node) {
  let i = heap.length; heap.push(node);
  while (i) { const p = (i - 1) >> 1; if (heap[p].f <= node.f) break; heap[i] = heap[p]; i = p; }
  heap[i] = node;
}
function pop(heap) {
  const first = heap[0], last = heap.pop(); if (!heap.length) return first;
  let i = 0;
  while (i * 2 + 1 < heap.length) {
    let c = i * 2 + 1; if (c + 1 < heap.length && heap[c+1].f < heap[c].f) c++;
    if (heap[c].f >= last.f) break; heap[i] = heap[c]; i = c;
  }
  heap[i] = last; return first;
}
export function* findRoute(from, to) {
  if (clearSegment(from, to)) return [{ ...to }];
  const start = anchor(from), end = anchor(to); if (!start || !end) return [];
  const open = [], scores = new Map(), closed = new Set();
  const h = (x,z) => Math.hypot(x-end.gx,z-end.gz);
  push(open, { x:start.gx,z:start.gz,g:0,f:h(start.gx,start.gz),parent:null });
  scores.set(key(start.gx,start.gz),0);
  let expanded = 0;
  while (open.length && expanded < 16000) {
    const n = pop(open), k = key(n.x,n.z); if (closed.has(k)) continue;
    closed.add(k); expanded++; yield;
    if (n.x === end.gx && n.z === end.gz) {
      const path = [{ ...to }]; let p = n;
      while (p) { path.push({x:p.x*STEP,z:p.z*STEP}); p=p.parent; }
      return path.reverse();
    }
    for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++) {
      if (!dx && !dz) continue;
      const x=n.x+dx,z=n.z+dz,k2=key(x,z),g=n.g+Math.hypot(dx,dz);
      if (closed.has(k2) || !cell(x,z) || g >= (scores.get(k2) ?? Infinity)) continue;
      if (!clearSegment({x:n.x*STEP,z:n.z*STEP},{x:x*STEP,z:z*STEP})) continue;
      scores.set(k2,g); push(open,{x,z,g,f:g+h(x,z),parent:n});
    }
  }
  return [];
}
const queue = [];
export function requestRoute(owner, from, to) {
  if (owner.navPending) return;
  const job = { owner, search:findRoute({...from},{...to}) };
  owner.navPending = job; queue.push(job);
}
export function updateNavigation() {
  // One shared budget, independent of zombie count. Round-robin avoids starvation.
  for (let i=0;i<160 && queue.length;i++) {
    const job=queue.shift();
    if (job.owner.navPending !== job) continue;
    const next=job.search.next();
    if (next.done) { job.owner.path=next.value; job.owner.navPending=null; }
    else queue.push(job);
  }
}
