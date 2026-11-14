// Instancing: everything static is collected into batches and drawn in a handful of calls.
import * as THREE from 'three';
import { col } from './util.js';
import { scene } from './render.js';

class Batch {
  constructor() { this.m = []; this.c = []; this.t = []; }
  add(mat, color, tx, ty) { const e = mat.elements; for (let i = 0; i < 16; i++) this.m.push(e[i]); this.c.push(color.r, color.g, color.b); if (tx !== undefined) this.t.push(tx, ty); }
  build(geo, material, cast = true, receive = true) {
    const n = this.m.length / 16; if (!n) return null;
    if (this.t.length) { geo = geo.clone(); geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(this.t), 2)); }
    const mesh = new THREE.InstancedMesh(geo, material, n);
    mesh.instanceMatrix.array.set(this.m); mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.c), 3);
    mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.frustumCulled = false; scene.add(mesh); return mesh;
  }
}
const B = { int: new Batch(), tile: new Batch(), far: new Batch(), wall: new Batch(), stone: new Batch(), plain: new Batch(), iron: new Batch(), win: new Batch(), sign: new Batch(), walk: new Batch() };
const _m = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), WHITE = col(0xffffff);
function obox(batch, c, ax, ay, az, sx, sy, sz, color, tx, ty) {
  _m.set(ax.x * sx, ay.x * sy, az.x * sz, c.x, ax.y * sx, ay.y * sy, az.y * sz, c.y, ax.z * sx, ay.z * sy, az.z * sz, c.z, 0, 0, 0, 1);
  batch.add(_m, color, tx, ty);
}
const _c = new THREE.Vector3();
// facade-local box: a = along the wall, y = up, d = out from the wall face
function fb(batch, F, a0, a1, y0, y1, d0, d1, color, tx, ty) {
  _c.copy(F.p0).addScaledVector(F.u, (a0 + a1) / 2).addScaledVector(F.n, (d0 + d1) / 2); _c.y = (y0 + y1) / 2;
  obox(batch, _c, F.u, UP, F.n, a1 - a0, y1 - y0, (d1 - d0) || 1, color, tx, ty);
}
const fq = (batch, F, a0, a1, y0, y1, d, tx, ty, color = WHITE) => fb(batch, F, a0, a1, y0, y1, d, d, color, tx, ty);
const X3 = new THREE.Vector3(1, 0, 0), Z3 = new THREE.Vector3(0, 0, 1);
const unitBox = new THREE.BoxGeometry(1, 1, 1), unitQuad = new THREE.PlaneGeometry(1, 1);

export { Batch, B, obox, fb, fq, _m, _c, UP, WHITE, X3, Z3, unitBox, unitQuad };
