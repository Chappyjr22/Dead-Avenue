// Procedural textures and the shared materials built from them.
import * as THREE from 'three';
import { pick, $ } from './util.js';
import { SHOP_SIGNS } from './data.js';

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function speckle(ctx, w, h, amt) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(im, 0, 0);
}
function blotches(ctx, w, h, n, lo, hi, alpha, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(lo + Math.random() * (hi - lo)), r = rmin + Math.random() * (rmax - rmin);
    const x = Math.random() * w, y = Math.random() * h;
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},${alpha})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}
function normalFromHeight(src, strength) {
  const w = src.width, h = src.height, s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h), octx = out.getContext('2d'), im = octx.createImageData(w, h), d = im.data;
  const H = (x, y) => s[(((y + h) % h) * w + ((x + w) % w)) * 4];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) / 255 * strength, dy = (H(x, y + 1) - H(x, y - 1)) / 255 * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  octx.putImageData(im, 0, 0); return out;
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t;
}

function brickTextures() {
  const S = 512, rows = 30, cols = 10, bw = S / cols, bh = S / rows;
  const c = mkCanvas(S, S), x = c.getContext('2d'), hc = mkCanvas(S, S), hx = hc.getContext('2d');
  x.fillStyle = '#9a958c'; x.fillRect(0, 0, S, S); hx.fillStyle = '#404040'; hx.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) for (let k = -1; k < cols; k++) {
    const ox = k * bw + (r % 2 ? bw / 2 : 0), oy = r * bh, v = 170 + Math.random() * 70, t = (Math.random() - 0.5) * 22;
    x.fillStyle = `rgb(${v + t},${v},${v - t})`; x.fillRect(ox + 1.5, oy + 1.5, bw - 3, bh - 3);
    if (Math.random() < 0.06) { x.fillStyle = 'rgba(40,30,25,0.45)'; x.fillRect(ox + 1.5, oy + 1.5, bw - 3, bh - 3); }
    const hv = 190 + Math.random() * 50; hx.fillStyle = `rgb(${hv},${hv},${hv})`; hx.fillRect(ox + 2, oy + 2, bw - 4, bh - 4);
  }
  blotches(x, S, S, 26, 40, 110, 0.22, 40, 150); speckle(x, S, S, 26); speckle(hx, S, S, 40);
  return { map: tex(c), normal: tex(normalFromHeight(hc, 2.2), false) };
}
function concreteTextures(joints) {
  const S = 512, c = mkCanvas(S, S), x = c.getContext('2d'), hc = mkCanvas(S, S), hx = hc.getContext('2d');
  x.fillStyle = '#c4c0b8'; x.fillRect(0, 0, S, S); hx.fillStyle = '#808080'; hx.fillRect(0, 0, S, S);
  blotches(x, S, S, 40, 90, 230, 0.16, 30, 140); blotches(hx, S, S, 60, 60, 200, 0.2, 6, 40);
  for (let i = 0; i < 26; i++) { // drip streaks and stains
    const sx = Math.random() * S, len = 60 + Math.random() * 260, wd = 2 + Math.random() * 9, sy = Math.random() * S;
    const g = x.createLinearGradient(0, sy, 0, sy + len); g.addColorStop(0, 'rgba(50,42,36,0.3)'); g.addColorStop(1, 'rgba(50,42,36,0)');
    x.fillStyle = g; x.fillRect(sx, sy, wd, len);
  }
  if (joints) {
    for (let i = 0; i < 2; i++) {
      const p = i * S / 2;
      x.fillStyle = 'rgba(30,26,24,0.75)'; x.fillRect(p, 0, 4, S); x.fillRect(0, p, S, 4);
      hx.fillStyle = '#101010'; hx.fillRect(p, 0, 5, S); hx.fillRect(0, p, S, 5);
    }
    x.strokeStyle = 'rgba(25,22,20,0.7)'; x.lineWidth = 1.3;
    for (let i = 0; i < 9; i++) { let px = Math.random() * S, py = Math.random() * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (Math.random() - 0.5) * 50; py += (Math.random() - 0.3) * 40; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(30,28,26,${0.2 + Math.random() * 0.4})`; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 0, 7); x.fill(); }
  }
  speckle(x, S, S, 30); speckle(hx, S, S, 50);
  return { map: tex(c), normal: tex(normalFromHeight(hc, 1.4), false) };
}
function asphaltTextures() {
  const S = 1024, c = mkCanvas(S, S), x = c.getContext('2d'), hc = mkCanvas(S, S), hx = hc.getContext('2d');
  x.fillStyle = '#4b4a49'; x.fillRect(0, 0, S, S); hx.fillStyle = '#808080'; hx.fillRect(0, 0, S, S);
  blotches(x, S, S, 70, 20, 120, 0.2, 50, 260);
  for (let i = 0; i < 9; i++) { // repair patches
    const w = 80 + Math.random() * 220, h = 60 + Math.random() * 160, px = Math.random() * S, py = Math.random() * S, v = 40 + Math.random() * 30;
    x.fillStyle = `rgba(${v},${v},${v},0.55)`; x.fillRect(px, py, w, h); hx.fillStyle = 'rgba(150,150,150,0.5)'; hx.fillRect(px, py, w, h);
  }
  for (let i = 0; i < 20; i++) { // cracks
    let px = Math.random() * S, py = Math.random() * S, a = Math.random() * 7;
    x.strokeStyle = 'rgba(12,11,10,0.6)'; x.lineWidth = 0.8 + Math.random() * 1.8; hx.strokeStyle = '#000'; hx.lineWidth = x.lineWidth + 1;
    x.beginPath(); hx.beginPath(); x.moveTo(px, py); hx.moveTo(px, py);
    for (let k = 0; k < 14; k++) { a += (Math.random() - 0.5) * 1.3; px += Math.cos(a) * 26; py += Math.sin(a) * 26; x.lineTo(px, py); hx.lineTo(px, py); }
    x.stroke(); hx.stroke();
  }
  speckle(x, S, S, 46); speckle(hx, S, S, 90);
  return { map: tex(c), normal: tex(normalFromHeight(hc, 1.6), false) };
}

// world-space UVs so one texture tiles cleanly across every scaled, instanced box
function worldUV(mat, scale) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      { vec4 wp_ = vec4(position, 1.0); vec3 wn_ = normal;
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_; wn_ = mat3(instanceMatrix) * wn_;
        #endif
        wp_ = modelMatrix * wp_; wn_ = normalize(mat3(modelMatrix) * wn_);
        vec3 an_ = abs(wn_);
        vec2 wuv_ = (an_.y > 0.5 ? wp_.xz : (an_.x > 0.5 ? wp_.zy : wp_.xy)) * ${scale.toFixed(4)};
        #ifdef USE_MAP
          vMapUv = wuv_;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv_;
        #endif
      }`);
  };
  mat.customProgramCacheKey = () => 'wuv' + scale;
  return mat;
}
// per-instance tile picked from a texture atlas
function tileMat(mat, tx, ty) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 aTile;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      { vec2 tuv_ = (uv + aTile) / vec2(${tx.toFixed(1)}, ${ty.toFixed(1)});
        #ifdef USE_MAP
          vMapUv = tuv_;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = tuv_;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = tuv_;
        #endif
      }`);
  };
  mat.customProgramCacheKey = () => `tile${tx}x${ty}`;
  return mat;
}

const brickT = brickTextures(), stoneT = concreteTextures(false), walkT = concreteTextures(true), roadT = asphaltTextures();
const wallMat = worldUV(new THREE.MeshStandardMaterial({ map: brickT.map, normalMap: brickT.normal, roughness: 0.93, envMapIntensity: 0.35 }), 0.5);
const stoneMat = worldUV(new THREE.MeshStandardMaterial({ map: stoneT.map, normalMap: stoneT.normal, roughness: 0.9, envMapIntensity: 0.35 }), 0.33);
const walkMat = worldUV(new THREE.MeshStandardMaterial({ map: walkT.map, normalMap: walkT.normal, roughness: 0.95, color: 0x9a948c, envMapIntensity: 0.3 }), 1 / 3);
const roadMat = worldUV(new THREE.MeshStandardMaterial({ map: roadT.map, normalMap: roadT.normal, roughness: 0.86, color: 0xc4c2c0, envMapIntensity: 0.8 }), 1 / 9);
const plainMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1, envMapIntensity: 0.4 });
const intMat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.05, envMapIntensity: 0.06 }); // shop interiors: kept dim so the torch matters
const tileFloorMat = (() => {
  const c = mkCanvas(256, 256), x = c.getContext('2d');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#8f8c84' : '#5c5a55'; x.fillRect(i * 128, j * 128, 128, 128); }
  x.strokeStyle = 'rgba(20,18,16,0.8)'; x.lineWidth = 3; x.strokeRect(0, 0, 128, 128); x.strokeRect(128, 128, 128, 128); x.strokeRect(128, 0, 128, 128); x.strokeRect(0, 128, 128, 128);
  blotches(x, 256, 256, 30, 10, 60, 0.3, 10, 70); speckle(x, 256, 256, 30);
  return worldUV(new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.55, color: 0x777777, envMapIntensity: 0.12 }), 1 / 1.2);
})();
const ironMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.6, color: 0x1c1a19, envMapIntensity: 0.6 });

// ---- window + storefront atlas (4 x 3 tiles) with matching roughness and glow maps
const TW = 128, TH = 192;
const winC = mkCanvas(TW * 4, TH * 3), wx = winC.getContext('2d');
const rghC = mkCanvas(TW * 4, TH * 3), rx = rghC.getContext('2d');
const emiC = mkCanvas(TW * 4, TH * 3), ex = emiC.getContext('2d');
rx.fillStyle = '#fff'; rx.fillRect(0, 0, TW * 4, TH * 3); ex.fillStyle = '#000'; ex.fillRect(0, 0, TW * 4, TH * 3);
function glass(x0, y0, w, h, top = '#2b3947', bot = '#10161c') {
  const g = wx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, top); g.addColorStop(1, bot);
  wx.fillStyle = g; wx.fillRect(x0, y0, w, h);
  wx.save(); wx.beginPath(); wx.rect(x0, y0, w, h); wx.clip();
  wx.fillStyle = 'rgba(255,220,180,0.07)'; wx.beginPath(); wx.moveTo(x0 + w * 0.15, y0 + h); wx.lineTo(x0 + w * 0.55, y0); wx.lineTo(x0 + w * 0.8, y0); wx.lineTo(x0 + w * 0.4, y0 + h); wx.fill();
  wx.fillStyle = 'rgba(120,105,90,0.16)'; for (let i = 0; i < 40; i++) wx.fillRect(x0 + Math.random() * w, y0 + h * (0.5 + Math.random() * 0.5), 6 + Math.random() * 20, 2);
  wx.restore();
  rx.fillStyle = '#262626'; rx.fillRect(x0, y0, w, h);
}
const matte = (x0, y0, w, h) => { rx.fillStyle = '#fff'; rx.fillRect(x0, y0, w, h); };
function sash(i, variant) {
  const X = (i % 4) * TW, Y = Math.floor(i / 4) * TH, f = 9;
  wx.fillStyle = variant === 5 ? '#2a2623' : pick(['#3b3530', '#4a4741', '#2f3331']); wx.fillRect(X, Y, TW, TH);
  const gx = X + f, gy = Y + f, gw = TW - f * 2, gh = TH - f * 2;
  if (variant === 6) { wx.fillStyle = '#050505'; wx.fillRect(gx, gy, gw, gh); }
  else if (variant === 7) {
    const g = wx.createLinearGradient(0, gy, 0, gy + gh); g.addColorStop(0, '#ffd08a'); g.addColorStop(1, '#c9772e');
    wx.fillStyle = g; wx.fillRect(gx, gy, gw, gh); ex.fillStyle = g; ex.fillRect(gx, gy, gw, gh);
    wx.fillStyle = 'rgba(60,30,10,0.55)'; wx.fillRect(gx, gy + gh * 0.62, gw * 0.45, gh * 0.38); ex.fillStyle = 'rgba(0,0,0,0.6)'; ex.fillRect(gx, gy + gh * 0.62, gw * 0.45, gh * 0.38);
  } else glass(gx, gy, gw, gh);
  if (variant === 2) { matte(gx, gy, gw, gh * 0.62); for (let k = 0; k < 20; k++) { wx.fillStyle = k % 2 ? '#8d8676' : '#6f6a5d'; wx.fillRect(gx, gy + k * gh * 0.031, gw, gh * 0.031); } }
  if (variant === 3) { matte(gx, gy, gw * 0.3, gh); matte(gx + gw * 0.72, gy, gw * 0.28, gh); wx.fillStyle = '#5d4a48'; wx.fillRect(gx, gy, gw * 0.3, gh); wx.fillRect(gx + gw * 0.72, gy, gw * 0.28, gh); wx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 5; k++) { wx.fillRect(gx + k * 7, gy, 2, gh); wx.fillRect(gx + gw * 0.72 + k * 7, gy, 2, gh); } }
  if (variant === 4) {
    wx.fillStyle = '#030303'; wx.beginPath(); const cx = gx + gw * 0.55, cy = gy + gh * 0.68;
    for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283, r = 16 + Math.random() * 26; wx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.3); } wx.fill();
    wx.strokeStyle = 'rgba(210,220,225,0.5)'; wx.lineWidth = 1; for (let k = 0; k < 9; k++) { const a = Math.random() * 6.283; wx.beginPath(); wx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 22); wx.lineTo(cx + Math.cos(a) * 75, cy + Math.sin(a) * 85); wx.stroke(); }
  }
  if (variant === 5) { matte(X, Y, TW, TH); for (let k = 0; k < 8; k++) { const v = 95 + Math.random() * 50; wx.fillStyle = `rgb(${v + 22},${v},${v - 28})`; wx.fillRect(gx - 3, gy + k * gh / 8 + 2, gw + 6, gh / 8 - 4); } wx.fillStyle = '#111'; for (let k = 0; k < 8; k++) { wx.fillRect(gx + 4, gy + k * gh / 8 + gh / 16, 3, 3); wx.fillRect(gx + gw - 7, gy + k * gh / 8 + gh / 16, 3, 3); } }
  if (variant !== 5) { // sash bars
    wx.fillStyle = '#39342f'; wx.fillRect(gx, gy + gh * 0.5 - 4, gw, 8); matte(gx, gy + gh * 0.5 - 4, gw, 8);
    if (variant === 1 || variant === 3) { wx.fillRect(gx + gw / 2 - 2.5, gy, 5, gh); matte(gx + gw / 2 - 2.5, gy, 5, gh); }
  }
}
[0, 1, 2, 3, 4, 5, 6, 7].forEach(v => sash(v, v));
{ // row 3: shop glass, roller shutter, plywood, door
  const Y = TH * 2;
  wx.fillStyle = '#23211f'; wx.fillRect(0, Y, TW * 4, TH);
  glass(6, Y + 6, TW - 12, TH - 12, '#34424d', '#151a1d'); wx.fillStyle = 'rgba(190,170,140,0.5)'; wx.fillRect(34, Y + 60, 60, 44); wx.fillStyle = '#3a2a22'; wx.font = '700 15px sans-serif'; wx.fillText('CLOSED', 36, Y + 88); matte(34, Y + 60, 60, 44);
  for (let k = 0; k < 32; k++) { wx.fillStyle = k % 2 ? '#74777a' : '#5b5e61'; wx.fillRect(TW + 4, Y + 4 + k * (TH - 8) / 32, TW - 8, (TH - 8) / 32); }
  wx.lineWidth = 5; wx.lineCap = 'round';
  for (const c of ['#c2452f', '#d9b44a', '#3f7f8f']) { wx.strokeStyle = c; wx.globalAlpha = 0.75; wx.beginPath(); let px = TW + 14, py = Y + 70 + Math.random() * 80; wx.moveTo(px, py); for (let k = 0; k < 6; k++) { px += 16; py += (Math.random() - 0.5) * 60; wx.quadraticCurveTo(px - 8, py - 26, px, py); } wx.stroke(); }
  wx.globalAlpha = 1;
  for (let k = 0; k < 3; k++) { const v = 120 + Math.random() * 30; wx.fillStyle = `rgb(${v + 30},${v + 6},${v - 30})`; wx.fillRect(TW * 2 + 5 + k * 40, Y + 5, 38, TH - 10); }
  for (let k = 0; k < 14; k++) { wx.fillStyle = `rgba(40,30,22,${0.08 + Math.random() * 0.18})`; wx.fillRect(TW * 2 + 5 + Math.random() * 110, Y + 5 + Math.random() * 150, 3 + Math.random() * 14, 20 + Math.random() * 90); }
  wx.fillStyle = '#1a1614'; for (let k = 0; k < 3; k++) for (const yy of [16, 96, 176]) wx.fillRect(TW * 2 + 22 + k * 40, Y + yy, 3, 3);
  wx.fillStyle = '#2a2420'; wx.fillRect(TW * 3 + 14, Y + 8, TW - 28, TH - 8); glass(TW * 3 + 26, Y + 22, TW - 52, 96); wx.fillStyle = '#8a8478'; wx.fillRect(TW * 3 + 24, Y + 128, TW - 48, 5);
}
const winMat = tileMat(new THREE.MeshStandardMaterial({ map: tex(winC), roughnessMap: tex(rghC, false), emissiveMap: tex(emiC), emissive: 0xffffff, emissiveIntensity: 5, roughness: 1, metalness: 0, envMapIntensity: 1.5 }), 4, 3);

// ---- shop sign atlas (2 x 8)
const SIGNS = SHOP_SIGNS;
const signC = mkCanvas(1024, 768), sx_ = signC.getContext('2d');
SIGNS.forEach((s, i) => {
  const X = (i % 2) * 512, Y = Math.floor(i / 2) * 96, bg = pick(['#1f2a2e', '#5d1f1a', '#1e3524', '#2a2440', '#3a3126', '#c4b79a', '#7a2f22']);
  sx_.fillStyle = bg; sx_.fillRect(X, Y, 512, 96);
  sx_.fillStyle = bg === '#c4b79a' ? '#3a1c16' : pick(['#e6d8b8', '#e0b04a', '#d9d4c8']);
  sx_.font = `800 ${s.length > 12 ? 50 : 62}px "Arial Narrow", Impact, sans-serif`; sx_.textAlign = 'center'; sx_.textBaseline = 'middle';
  sx_.fillText(s, X + 256, Y + 50, 470);
  for (let k = 0; k < 90; k++) { sx_.fillStyle = `rgba(30,24,20,${Math.random() * 0.35})`; sx_.fillRect(X + Math.random() * 512, Y + Math.random() * 96, 2 + Math.random() * 30, 1 + Math.random() * 3); }
});
const signMat = tileMat(new THREE.MeshStandardMaterial({ map: tex(signC), roughness: 0.75, envMapIntensity: 0.4 }), 2, 8);

export { mkCanvas, speckle, blotches, normalFromHeight, tex, worldUV, tileMat, wallMat, stoneMat, walkMat, roadMat, plainMat, intMat, tileFloorMat, ironMat, winMat, signMat };
