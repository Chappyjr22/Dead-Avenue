// Road markings, cars, street furniture and clutter, then builds all the batches.
import './city.js'; // blocks must be laid out first: both share the seeded random sequence
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rnd, rr, ri, pick, col, $ } from './util.js';
import { CAR_COLOURS } from './data.js';
import { scene } from './render.js';
import { mkCanvas, wallMat, stoneMat, walkMat, roadMat, plainMat, intMat, tileFloorMat, ironMat, winMat, signMat } from './textures.js';
import { Batch, B, obox, _m, _c, UP, WHITE, X3, Z3, unitBox, unitQuad } from './batch.js';
import { PX, PZ, OX, OZ, BOUND_X, BOUND_Z, AVES, STS, addCircle, groundY, insideBuilding } from './world.js';
import { WALLS, towerSpots } from './buildings.js';

const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), roadMat);
ground.receiveShadow = true; scene.add(ground);
const PAINT_W = col(0x9c9a94), PAINT_Y = col(0x9a8436);
function mark(x, z, sx, sz, c) { if (rnd() < 0.13) return; _c.set(x, 0.012, z); obox(B.plain, _c, X3, UP, Z3, sx, 0.012, sz, c.clone().multiplyScalar(rr(0.55, 1))); }
for (const ax of AVES) for (let z = -OZ; z < OZ; z += 9) {
  if (STS.some(s => Math.abs(z + 1.5 - s) < 12)) continue;
  for (const o of [-4.5, 4.5]) mark(ax + o, z + 1.5, 0.14, 3, PAINT_W);
  for (const o of [-0.14, 0.14]) mark(ax + o, z + 4.5, 0.11, 9, PAINT_Y);
}
for (const sz of STS) for (let x = -OX; x < OX; x += 9) { if (AVES.some(a => Math.abs(x + 1.5 - a) < 15)) continue; mark(x + 1.5, sz, 3, 0.13, PAINT_W); }
for (const ax of AVES) for (const sz of STS) { // zebra crossings
  for (let k = -8; k <= 8; k += 1.15) { mark(ax + k, sz - 8.2, 0.55, 3, PAINT_W); mark(ax + k, sz + 8.2, 0.55, 3, PAINT_W); }
  for (let k = -4.6; k <= 4.6; k += 1.15) { mark(ax - 11.7, sz + k, 3, 0.55, PAINT_W); mark(ax + 11.7, sz + k, 3, 0.55, PAINT_W); }
}

// obstacles the player and the dead walk around

// ---- abandoned cars
function carGeometry() {
  const body = new THREE.Shape();
  body.moveTo(-2.2, 0.32); body.lineTo(-1.72, 0.32); body.absarc(-1.35, 0.32, 0.37, Math.PI, 0, true); body.lineTo(0.98, 0.32); body.absarc(1.35, 0.32, 0.37, Math.PI, 0, true); body.lineTo(2.18, 0.32);
  body.quadraticCurveTo(2.3, 0.4, 2.26, 0.62); body.quadraticCurveTo(2.2, 0.78, 1.2, 0.86); body.lineTo(-1.7, 0.9); body.quadraticCurveTo(-2.24, 0.9, -2.28, 0.7); body.quadraticCurveTo(-2.3, 0.4, -2.2, 0.32);
  const cab = new THREE.Shape();
  cab.moveTo(-1.72, 0.86); cab.quadraticCurveTo(-1.45, 1.36, -0.95, 1.4); cab.lineTo(0.25, 1.4); cab.quadraticCurveTo(0.55, 1.38, 1.12, 0.86); cab.lineTo(-1.72, 0.86);
  const ext = (s, d, b) => { const g = new THREE.ExtrudeGeometry(s, { depth: d - b * 2, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 4, curveSegments: 12 }); g.translate(0, 0, -(d - b * 2) / 2); return g; };
  const tyre = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20).rotateX(Math.PI / 2), hub = new THREE.CylinderGeometry(0.19, 0.19, 0.26, 14).rotateX(Math.PI / 2);
  const paintGeo = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  return { body: ext(body, 1.78, 0.1), cab: ext(cab, 1.56, 0.12), wheel: mergeGeometries([paintGeo(tyre, col(0x0c0c0c)), paintGeo(hub, col(0x55585a))]) };
}
const CG = carGeometry(), carB = { body: new Batch(), cab: new Batch(), wheel: new Batch() };
const CAR_COLS = CAR_COLOURS.map(col);
function car(x, z, yaw) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw), s = rr(0.94, 1.06), c = pick(CAR_COLS).clone().multiplyScalar(rr(0.6, 1));
  const flat = rnd() < 0.3 ? -0.07 : 0;
  _m.compose(new THREE.Vector3(x, flat, z), q, new THREE.Vector3(s, s, s)); carB.body.add(_m, c); carB.cab.add(_m, WHITE);
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  for (const [lx, lz] of [[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]]) {
    _m.compose(new THREE.Vector3(x + (fx * lx + fz * lz) * s, 0.34 * s + flat, z + (fz * lx - fx * lz) * s), q, new THREE.Vector3(s, s, s)); carB.wheel.add(_m, WHITE);
  }
  for (const o of [-1.2, 0, 1.2]) addCircle(x + fx * o, z + fz * o, 1.05, 1.4);
}
for (const ax of AVES.slice(1, 5)) for (const side of [-1, 1]) {
  for (let z = -175; z < 175; z += rr(6.5, 26)) { if (STS.some(s => Math.abs(z - s) < 13)) continue; car(ax + side * 7.6 + rr(-0.2, 0.2), z, Math.PI / 2 * (side > 0 ? 1 : -1) + rr(-0.06, 0.06)); }
}
for (const sz of STS.slice(1, 5)) for (let x = -130; x < 130; x += rr(8, 30)) { if (AVES.some(a => Math.abs(x - a) < 16)) continue; car(x, sz + 4.3, rr(-0.05, 0.05)); }
for (let i = 0; i < 26; i++) { // stalled mid-road, some of them slewed across lanes
  const ax = pick(AVES.slice(1, 5)), z = rr(-165, 165); if (STS.some(s => Math.abs(z - s) < 9) && rnd() < 0.5) continue;
  if (Math.abs(ax - 41) < 1 && Math.abs(z - 44) < 12) continue;
  car(ax + rr(-4.5, 4.5), z, Math.PI / 2 + (rnd() < 0.35 ? rr(-1.2, 1.2) : rr(-0.15, 0.15)) + (rnd() < 0.5 ? Math.PI : 0));
}
carB.body.build(CG.body, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.45, envMapIntensity: 0.9 }));
carB.cab.build(CG.cab, new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: 0.12, metalness: 0.7, envMapIntensity: 1.6 }));
carB.wheel.build(CG.wheel, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));

// ---- street furniture
function lampGeometry() {
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 8, 10).translate(0, 4, 0), base = new THREE.CylinderGeometry(0.16, 0.2, 0.7, 10).translate(0, 0.35, 0);
  const arm = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 7.9, 0), new THREE.Vector3(0.1, 9.1, 0), new THREE.Vector3(2.3, 9.0, 0)), 14, 0.05, 8);
  const head = new THREE.SphereGeometry(0.3, 12, 8).scale(1.3, 0.3, 0.6).translate(2.55, 8.97, 0);
  return mergeGeometries([pole, base, arm, head]);
}
function signalGeometry() {
  const pole = new THREE.CylinderGeometry(0.09, 0.12, 6.4, 10).translate(0, 3.2, 0), arm = new THREE.CylinderGeometry(0.05, 0.07, 6, 8).rotateZ(Math.PI / 2).translate(3, 6.1, 0);
  const h1 = new THREE.BoxGeometry(0.34, 1.05, 0.3).translate(5.6, 5.5, 0), h2 = new THREE.BoxGeometry(0.34, 1.05, 0.3).translate(0.3, 3.4, 0);
  const lens = [0.32, 0, -0.32].map(y => new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1, 0.5).translate(5.6, 5.5 + y, 0.16));
  return mergeGeometries([pole, arm, h1, h2, ...lens]);
}
const lampB = new Batch(), sigB = new Batch(), lampHeads = [];
const yawM = (x, z, yaw, s = 1) => _m.compose(new THREE.Vector3(x, 0.18, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(s, s, s));
for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) {
  const cx = (i - 2) * PX, cz = (j - 2) * PZ;
  for (const side of [-1, 1]) for (let z = cz - 36; z <= cz + 36; z += 24) {
    const x = cx + side * 31.2; yawM(x, z, side > 0 ? 0 : Math.PI); lampB.add(_m, WHITE); addCircle(x, z, 0.3);
    lampHeads.push(new THREE.Vector3(x + side * 2.55, 9.0, z));
  }
  for (const [sx, sz, yaw] of [[-1, -1, -Math.PI / 2], [1, 1, Math.PI / 2], [1, -1, Math.PI], [-1, 1, 0]]) {
    const x = cx + sx * 31, z = cz + sz * 47; yawM(x, z, yaw); sigB.add(_m, WHITE); addCircle(x, z, 0.3);
  }
}
lampB.build(lampGeometry(), ironMat); sigB.build(signalGeometry(), ironMat);

{ // hydrants, bin bags, rubble, litter, weeds
  const hydG = mergeGeometries([new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.16, 0.06], [0.11, 0.1], [0.11, 0.52], [0.14, 0.55], [0.13, 0.6], [0.09, 0.7], [0.03, 0.76], [0, 0.77]].map(p => new THREE.Vector2(p[0], p[1])), 14), new THREE.CylinderGeometry(0.055, 0.055, 0.38, 8).rotateZ(Math.PI / 2).translate(0, 0.42, 0), new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8).rotateX(Math.PI / 2).translate(0, 0.38, 0.12)]);
  const bagG = new THREE.IcosahedronGeometry(0.42, 3); { const p = bagG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.16 * Math.sin(x * 9 + y * 5) * Math.cos(z * 8 + x * 3); p.setXYZ(i, x * n, Math.max(y * 0.72 * n, -0.22), z * n); } bagG.translate(0, 0.22, 0); bagG.computeVertexNormals(); }
  const hyd = new Batch(), bag = new Batch();
  for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) {
    const cx = (i - 2) * PX, cz = (j - 2) * PZ;
    for (const side of [-1, 1]) {
      const hz = cz + rr(-30, 30); yawM(cx + side * 30.6, hz, rnd() * 6); hyd.add(_m, col(0x8a2a1e)); addCircle(cx + side * 30.6, hz, 0.25, 0.8);
      for (let k = 0; k < 5; k++) { // heaps of bin bags against the buildings and at the kerb
        const bx = cx + side * (rnd() < 0.5 ? 28.3 : 30.9), bz = cz + rr(-42, 42), n = ri(2, 7);
        for (let b = 0; b < n; b++) { const s = rr(0.7, 1.3); _m.compose(new THREE.Vector3(bx + rr(-0.6, 0.6), 0.18 + (b > 3 ? 0.3 : 0), bz + rr(-1.1, 1.1)), new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 6), new THREE.Vector3(s, s * rr(0.8, 1.1), s)); bag.add(_m, pick([0x0c0c0d, 0x101112, 0x1a1a1a, 0x2a2c2a].map(col))); }
        addCircle(bx, bz, 0.7, 0.7);
      }
    }
  }
  hyd.build(hydG, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 })); bag.build(bagG, new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.1, envMapIntensity: 1.0 }));
  const LIT = [0xb8b2a4, 0x8f8a80, 0x6a5a48, 0x9a9488, 0x4a4844].map(col);
  for (let i = 0; i < 2600; i++) { // litter: paper, cardboard, fallen bricks
    const x = rr(-BOUND_X, BOUND_X), z = rr(-BOUND_Z, BOUND_Z); if (insideBuilding(x, z)) continue;
    const yaw = rnd() * 6.283, brick = rnd() < 0.2, gy = groundY(x, z);
    _c.set(x, gy + (brick ? 0.035 : 0.006), z);
    obox(B.plain, _c, new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), UP, new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), brick ? 0.2 : rr(0.15, 0.45), brick ? 0.07 : 0.008, brick ? 0.09 : rr(0.12, 0.32), brick ? pick(WALLS) : pick(LIT));
  }
  // weeds pushing through the kerb line and the cracks
  const gc = mkCanvas(256, 256), gx = gc.getContext('2d'); gx.lineCap = 'round';
  for (let k = 0; k < 120; k++) { const bx = 40 + Math.random() * 176, h = 70 + Math.random() * 170, lean = (Math.random() - 0.5) * 120; gx.strokeStyle = `rgb(${120 + Math.random() * 80},${125 + Math.random() * 70},${50 + Math.random() * 40})`; gx.lineWidth = 1.2 + Math.random() * 2.2; gx.beginPath(); gx.moveTo(bx, 256); gx.quadraticCurveTo(bx + lean * 0.15, 256 - h * 0.6, bx + lean, 256 - h); gx.stroke(); }
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const q1 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), tuftG = mergeGeometries([q1, q1.clone().rotateY(Math.PI / 3), q1.clone().rotateY(-Math.PI / 3)]);
  { const nrm = tuftG.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0); }
  const tuft = new Batch();
  const sprout = (x, z, s) => { if (insideBuilding(x, z)) return; _m.compose(new THREE.Vector3(x, groundY(x, z) - 0.02, z), new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 6), new THREE.Vector3(s * rr(0.8, 1.6), s, s * rr(0.8, 1.6))); tuft.add(_m, new THREE.Color().setHSL(rr(0.14, 0.27), rr(0.25, 0.5), rr(0.28, 0.5))); };
  for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) {
    const cx = (i - 2) * PX, cz = (j - 2) * PZ;
    for (let k = 0; k < 260; k++) { const side = rnd() < 0.5 ? -1 : 1; if (rnd() < 0.7) sprout(cx + side * rr(31.9, 32.5), cz + rr(-48, 48), rr(0.25, 0.7)); else sprout(cx + rr(-32, 32), cz + side * rr(47.9, 48.4), rr(0.25, 0.7)); }
    for (let k = 0; k < 110; k++) { const side = rnd() < 0.5 ? -1 : 1; sprout(cx + side * rr(27.6, 27.9), cz + rr(-43, 43), rr(0.3, 0.9)); }
  }
  for (let k = 0; k < 160; k++) { const x = rr(-BOUND_X, BOUND_X), z = rr(-BOUND_Z, BOUND_Z), n = ri(3, 9); for (let b = 0; b < n; b++) sprout(x + rr(-1.2, 1.2), z + rr(-1.2, 1.2), rr(0.3, 0.8)); }
  tuft.build(tuftG, new THREE.MeshStandardMaterial({ map: gt, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.3 }), false, true);
}

{ // rooftop water towers
  const tank = new THREE.CylinderGeometry(1.9, 1.9, 3.4, 18).translate(0, 5.0, 0), roof = new THREE.ConeGeometry(2.1, 1.3, 18).translate(0, 7.35, 0);
  const legs = [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]].map(p => new THREE.BoxGeometry(0.16, 3.3, 0.16).translate(p[0], 1.65, p[1]));
  const deck = new THREE.BoxGeometry(3.6, 0.14, 3.6).translate(0, 3.25, 0), tb = new Batch();
  for (const [x, y, z] of towerSpots) { _m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 3), new THREE.Vector3(1, 1, 1)); tb.add(_m, pick([0x4a382c, 0x3a2f28, 0x5a4636].map(col))); }
  tb.build(mergeGeometries([tank, roof, ...legs, deck]), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
}

{ // concrete barriers closing the roads at the edge of the playable area
  const s = new THREE.Shape(); s.moveTo(-0.32, 0); s.lineTo(-0.32, 0.18); s.lineTo(-0.14, 0.42); s.lineTo(-0.09, 0.9); s.lineTo(0.09, 0.9); s.lineTo(0.14, 0.42); s.lineTo(0.32, 0.18); s.lineTo(0.32, 0); s.lineTo(-0.32, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 2.9, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }).translate(0, 0, -1.45), bb = new Batch();
  for (const sz of STS.slice(1, 5)) for (const sx of [-1, 1]) for (let k = -6; k <= 6; k += 3) { _m.compose(new THREE.Vector3(sx * (BOUND_X + 1.2), 0, sz + k), new THREE.Quaternion().setFromAxisAngle(UP, rr(-0.05, 0.05)), new THREE.Vector3(1, 1, 1)); bb.add(_m, WHITE); }
  for (const ax of AVES.slice(1, 5)) for (const sz of [-1, 1]) for (let k = -9; k <= 9; k += 3) { _m.compose(new THREE.Vector3(ax + k, 0, sz * (BOUND_Z + 1.2)), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2 + rr(-0.05, 0.05)), new THREE.Vector3(1, 1, 1)); bb.add(_m, WHITE); }
  bb.build(g, stoneMat);
}

B.wall.build(unitBox, wallMat); B.stone.build(unitBox, stoneMat); B.walk.build(unitBox, walkMat, false, true);
B.int.build(unitBox, intMat, true, true); B.tile.build(unitBox, tileFloorMat, false, true); B.far.build(unitBox, new THREE.MeshBasicMaterial({ fog: false }), false, false); B.plain.build(unitBox, plainMat); B.iron.build(unitBox, ironMat);
B.win.build(unitQuad, winMat, false, true); B.sign.build(unitQuad, signMat, false, true);

// a few streetlights still have power
const litLamps = [];
{
  const near = lampHeads.filter(p => Math.abs(p.x - 41) < 14 && Math.abs(p.z) < 120).sort((a, b) => Math.abs(a.z - 20) - Math.abs(b.z - 20));
  for (const p of [near[1], near[5], near[10]].filter(Boolean)) {
    const light = new THREE.PointLight(new THREE.Color().setRGB(1, 0.62, 0.3), 260, 34, 1.8); light.position.copy(p).y -= 0.25;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(6, 3.2, 1.2) })); bulb.position.copy(light.position); bulb.scale.set(1.6, 0.5, 1);
    scene.add(light, bulb); litLamps.push({ light, bulb, t: rnd() * 10, base: 260 });
  }
}

// drifting ash
const ash = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: (() => { const c = mkCanvas(32, 32), x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })(), color: new THREE.Color().setRGB(1.6, 1.1, 0.7), size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
{ const n = 500, a = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) a[i] = (Math.random() - 0.5) * 30; ash.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); ash.frustumCulled = false; scene.add(ash); }

export { litLamps, ash, lampHeads };
