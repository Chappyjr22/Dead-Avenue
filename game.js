import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildArms, GUN_POS } from './arms.js';

// ---------------------------------------------------------------- utilities
let seed = 20261114;
function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rnd();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const col = hex => new THREE.Color(hex);
const $ = id => document.getElementById(id);
const COARSE = matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, COARSE ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 1400);
camera.rotation.order = 'YXZ';
scene.add(camera);

const SUN_DIR = new THREE.Vector3(0.10, 0.17, -1).normalize();
const FOG = new THREE.Color().setRGB(0.50, 0.33, 0.25);
scene.fog = new THREE.FogExp2(FOG, 0.0095);

// ---------------------------------------------------------------- sky
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: SUN_DIR }, fogCol: { value: FOG } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 sunDir; uniform vec3 fogCol;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+7.1; a*=0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir);
      float h = max(d.y, 0.0);
      float sa = max(dot(d, sunDir), 0.0);
      float toward = dot(normalize(d.xz + 1e-5), normalize(sunDir.xz)) * 0.5 + 0.5;
      vec3 horizon = mix(vec3(0.34,0.30,0.36), vec3(1.25,0.62,0.26), pow(toward, 2.0));
      vec3 mid = mix(vec3(0.20,0.24,0.36), vec3(0.62,0.42,0.44), toward);
      vec3 zenith = vec3(0.07,0.12,0.24);
      vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
      c = mix(c, zenith, smoothstep(0.12, 0.85, h));
      vec2 cp = d.xz / (h + 0.12) * 0.9;
      float cl = smoothstep(0.48, 0.85, fbm(cp + vec2(3.0, 1.0))) * smoothstep(0.02, 0.2, h);
      vec3 cloudCol = mix(vec3(0.16,0.15,0.2), vec3(1.5,0.7,0.35), pow(toward, 3.0) * (1.0 - h));
      c = mix(c, cloudCol, cl * 0.75);
      c = mix(fogCol * (1.0 + 1.3 * pow(toward, 3.0)), c, 0.12 + 0.88 * smoothstep(0.0, 0.26, h));
      c += vec3(1.0,0.5,0.2) * pow(sa, 6.0) * 0.55;
      c += vec3(1.0,0.8,0.55) * pow(sa, 900.0) * 14.0;
      c = mix(fogCol, c, smoothstep(-0.02, 0.03, d.y));
      gl_FragColor = vec4(c, 1.0);
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
sky.frustumCulled = false;
scene.add(sky);
{ // image-based light from the sky so glass and car paint pick up the sunset
  const s = new THREE.Scene(); s.add(sky.clone());
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(s, 0, 0.1, 1200).texture;
  pm.dispose();
}

const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1.0, 0.62, 0.36), 3.6);
sun.castShadow = true;
sun.shadow.mapSize.set(COARSE ? 1536 : 2048, COARSE ? 1536 : 2048);
const SH = 70;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 420 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(new THREE.Color().setRGB(0.36, 0.42, 0.62), new THREE.Color().setRGB(0.30, 0.20, 0.14), 1.25));

// ---------------------------------------------------------------- procedural textures
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
const SIGNS = ['LIBERTY DELI', '24 HR PHARMACY', 'PAWN & LOAN', 'LAUNDROMAT', 'SAL’S PIZZA', 'HARDWARE', 'CORNER BODEGA', 'WINE & LIQUOR', 'NAILS', 'USED BOOKS', 'COFFEE', 'DINER', 'TAILOR', 'FLOWERS', 'BARBER', 'ELECTRONICS'];
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

// ---------------------------------------------------------------- instancing batches
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
const B = { far: new Batch(), wall: new Batch(), stone: new Batch(), plain: new Batch(), iron: new Batch(), win: new Batch(), sign: new Batch(), walk: new Batch() };
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

// ---------------------------------------------------------------- city layout
const PX = 82, PZ = 107, OX = 205, OZ = 267.5, NB = 5;      // block pitch, grid origin, blocks per side
const BOUND_X = 131, BOUND_Z = 168;                          // playable area
const G = 4.6, FH = 3.3;                                     // ground floor / upper floor heights
const WALLS = [0x7d3f30, 0x5e2f27, 0x6b4a37, 0x9a8266, 0xb3a58c, 0x7a7872, 0x4c4b4d, 0xa8a39a, 0x8a5a44, 0x6a3a30].map(col);
const TRIMS = [0xa39c8c, 0x8d877b, 0x6f6a62, 0xb8b0a0].map(col);
const AWN = [0x6d2a24, 0x2c4a3a, 0x2a3a5a, 0x8a7a4a, 0x3a3a3a].map(col);
const IRON = col(0x211f1e), DARK = col(0x1a1817);

function facade(F, width, floors, st, detail) {
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
function building(x0, x1, z0, z1, faces, detail) {
  const tall = rnd() < 0.12, floors = tall ? ri(15, 26) : ri(4, 11);
  const wall = pick(WALLS).clone().offsetHSL(0, rr(-0.04, 0.04), rr(-0.04, 0.04));
  const st = { wall, wall2: wall.clone().multiplyScalar(rr(0.82, 1.0)), trim: pick(TRIMS), band: pick([0x24211f, 0x3a342e, 0x2a2f33, 0x4a443c].map(col)), bay: rr(2.8, 3.6), pier: rr(0.55, 1.15), cornice: !tall && rnd() < 0.7, belt: rnd() < 0.4, lintel: rnd() < 0.6 };
  let H = 0;
  for (const f of faces) {
    const n = new THREE.Vector3(f[0], 0, f[1]), u = new THREE.Vector3(n.z, 0, -n.x);
    const p0 = new THREE.Vector3(f[0] < 0 ? x0 : f[0] > 0 ? x1 : (f[1] < 0 ? x1 : x0), 0, f[1] < 0 ? z0 : f[1] > 0 ? z1 : (f[0] < 0 ? z0 : z1));
    H = facade({ p0, u, n }, f[0] ? z1 - z0 : x1 - x0, floors, st, detail);
  }
  const roof = H - 0.7; // solid core behind the facades, plus the party walls
  _c.set((x0 + x1) / 2, roof / 2, (z0 + z1) / 2); obox(B.wall, _c, new THREE.Vector3(1, 0, 0), UP, new THREE.Vector3(0, 0, 1), x1 - x0 - 0.9, roof, z1 - z0 - 0.02, st.wall2.clone().multiplyScalar(0.8));
  _c.set((x0 + x1) / 2 + rr(-3, 3), roof + 1.3, (z0 + z1) / 2 + rr(-2, 2)); obox(B.wall, _c, new THREE.Vector3(1, 0, 0), UP, new THREE.Vector3(0, 0, 1), 3.2, 2.6, 4, st.wall2);
  if (rnd() < 0.4 && z1 - z0 > 9) towerSpots.push([rr(x0 + 4, x1 - 4), roof, rr(z0 + 3.5, z1 - 3.5)]);
}

const X3 = new THREE.Vector3(1, 0, 0), Z3 = new THREE.Vector3(0, 0, 1);
for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
  const cx = (i - 2) * PX, cz = (j - 2) * PZ, detail = i >= 1 && i <= 3 && j >= 1 && j <= 3;
  _c.set(cx, 0.09, cz); obox(B.walk, _c, X3, UP, Z3, 64, 0.18, 96, WHITE);
  for (const side of [-1, 1]) {
    let z = cz - 43.5; const zEnd = cz + 43.5;
    while (z < zEnd - 0.01) {
      let w = rr(10, 24); if (zEnd - (z + w) < 10) w = zEnd - z;
      const faces = [[side, 0]]; if (z === cz - 43.5) faces.push([0, -1]); if (z + w >= zEnd - 0.01) faces.push([0, 1]);
      building(side < 0 ? cx - 27.5 : cx, side < 0 ? cx : cx + 27.5, z, z + w, faces, detail);
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

// ---------------------------------------------------------------- streets
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), roadMat);
ground.receiveShadow = true; scene.add(ground);
const AVES = [-205, -123, -41, 41, 123, 205], STS = [-267.5, -160.5, -53.5, 53.5, 160.5, 267.5];
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
const circles = [];
const addCircle = (x, z, r, h = 3) => circles.push({ x, z, r, h });

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
const CAR_COLS = [0x6b6d70, 0x1d1e20, 0x8f9194, 0x5a1a16, 0x1f2f47, 0x8c7a5a, 0xb38f1d, 0xb38f1d, 0x3a4a3c, 0xa8a8a4].map(col);
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

const unitBox = new THREE.BoxGeometry(1, 1, 1), unitQuad = new THREE.PlaneGeometry(1, 1);
B.wall.build(unitBox, wallMat); B.stone.build(unitBox, stoneMat); B.walk.build(unitBox, walkMat, false, true);
B.far.build(unitBox, new THREE.MeshBasicMaterial({ fog: false }), false, false); B.plain.build(unitBox, plainMat); B.iron.build(unitBox, ironMat);
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

// ---------------------------------------------------------------- world queries
function local(x, z) { return [((x + OX) % PX + PX) % PX, ((z + OZ) % PZ + PZ) % PZ]; }
function groundY(x, z) { if (Math.abs(x) > OX || Math.abs(z) > OZ) return 0; const [mx, mz] = local(x, z); return mx > 9 && mx < 73 && mz > 5.5 && mz < 101.5 ? 0.18 : 0; }
function insideBuilding(x, z, pad = 0) { if (Math.abs(x) > OX || Math.abs(z) > OZ) return false; const [mx, mz] = local(x, z); return mx > 13.5 - pad && mx < 68.5 + pad && mz > 10 - pad && mz < 97 + pad; }
function collide(p, r, h = 0) { // push a circle out of buildings, cars and poles
  const [mx, mz] = local(p.x, p.z), cx = clamp(mx, 13.5, 68.5), cz = clamp(mz, 10, 97), dx = mx - cx, dz = mz - cz, d2 = dx * dx + dz * dz;
  if (d2 < r * r) {
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
    else { const e = [mx - 13.5, 68.5 - mx, mz - 10, 97 - mz], k = e.indexOf(Math.min(...e)); if (k === 0) p.x -= e[0] + r; else if (k === 1) p.x += e[1] + r; else if (k === 2) p.z -= e[2] + r; else p.z += e[3] + r; }
  }
  for (const c of circles) { const ex = p.x - c.x, ez = p.z - c.z, rr2 = r + c.r; if (Math.abs(ex) < rr2 && Math.abs(ez) < rr2) { const d = Math.hypot(ex, ez); if (d < rr2 && d > 1e-5) { p.x += ex / d * (rr2 - d); p.z += ez / d * (rr2 - d); } } }
  p.x = clamp(p.x, -BOUND_X, BOUND_X); p.z = clamp(p.z, -BOUND_Z, BOUND_Z);
}
function rayWorld(ox, oy, oz, dx, dy, dz, maxT) { // nearest hit against building blocks, cars and the ground
  let best = maxT;
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    const x0 = (i - 2) * PX - 27.5, x1 = x0 + 55, z0 = (j - 2) * PZ - 43.5, z1 = z0 + 87;
    let t0 = 0, t1 = best;
    if (Math.abs(dx) < 1e-6) { if (ox < x0 || ox > x1) continue; } else { let a = (x0 - ox) / dx, b = (x1 - ox) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (Math.abs(dz) < 1e-6) { if (oz < z0 || oz > z1) continue; } else { let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t0 <= t1 && t0 < best && oy + dy * t0 < 110) best = t0;
  }
  const hl = Math.hypot(dx, dz);
  if (hl > 1e-4) for (const c of circles) {
    const fx = c.x - ox, fz = c.z - oz, tca = (fx * dx + fz * dz) / (hl * hl); if (tca < 0 || tca > best) continue;
    const px = ox + dx * tca - c.x, pz = oz + dz * tca - c.z; if (px * px + pz * pz < c.r * c.r * 0.8) { const y = oy + dy * tca; if (y < c.h && y > 0 && tca < best) best = tca; }
  }
  if (dy < -1e-4) { const t = -oy / dy; if (t < best) best = t; }
  return best;
}

// ---------------------------------------------------------------- post-processing
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.7, 1.0);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, hurt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, hurt; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = mix(vec3(l), c.rgb, 0.9);
      c.rgb *= mix(vec3(0.88,0.99,1.12), vec3(1.07,1.0,0.92), smoothstep(0.0, 0.5, l));
      float v = smoothstep(0.98, 0.3, length(vUv - 0.5)); c.rgb *= mix(0.5, 1.0, v);
      c.rgb = mix(c.rgb, vec3(0.5,0.02,0.0) * (0.3 + l), hurt * (1.0 - v * 0.75));
      c.rgb *= 1.0 + (hash(vUv * 800.0) - 0.5) * 0.09;
      gl_FragColor = c; }`
});
composer.addPass(grade); composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 78 : 66; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- pistol
const gun = new THREE.Group();
{
  const gm = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.5, metalness: 0.7, envMapIntensity: 0.55 });
  const s = new THREE.Shape(); [[0.185, 0.02], [0.185, 0.0], [0.1, -0.002], [0.098, -0.03], [0.07, -0.034], [0.058, -0.006], [0.036, -0.1], [-0.02, -0.094], [0.006, 0.0], [-0.008, 0.02]].forEach((p, i) => s[i ? 'lineTo' : 'moveTo'](p[0], p[1]));
  const frame = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 3 }).translate(0, 0, -0.01).rotateY(Math.PI / 2);
  const sl = new THREE.Shape(); [[0.19, 0.016], [0.19, 0.05], [0.185, 0.056], [-0.008, 0.056], [-0.014, 0.05], [-0.014, 0.016]].forEach((p, i) => sl[i ? 'lineTo' : 'moveTo'](p[0], p[1]));
  const slide = new THREE.ExtrudeGeometry(sl, { depth: 0.024, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 3 }).translate(0, 0, -0.012).rotateY(Math.PI / 2);
  gun.add(new THREE.Mesh(frame, gm), new THREE.Mesh(slide, new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.35, metalness: 0.85, envMapIntensity: 0.7 })));
  for (const z of [-0.012, -0.172]) { const sight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.012), gm); sight.position.set(0, 0.06, z); gun.add(sight); }
  const fc = mkCanvas(64, 64), fx = fc.getContext('2d'), gr = fx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.8)'); gr.addColorStop(1, 'rgba(255,90,0,0)'); fx.fillStyle = gr; fx.fillRect(0, 0, 64, 64);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), blending: THREE.AdditiveBlending, depthTest: false, color: new THREE.Color().setRGB(4, 3, 2) }));
  flash.position.set(0, 0.036, -0.24); flash.scale.setScalar(0.22); flash.visible = false; gun.add(flash); gun.userData.flash = flash;
  const fl = new THREE.PointLight(new THREE.Color().setRGB(1, 0.7, 0.35), 0, 26, 1.6); fl.position.set(0, 0.05, -0.5); gun.add(fl); gun.userData.light = fl;
}
const fp = new THREE.Group(); // everything the player holds: pistol plus arms
gun.scale.setScalar(0.85); gun.position.copy(GUN_POS); fp.add(gun); camera.add(fp); fp.visible = false;

// ---------------------------------------------------------------- sound (all synthesised)
let actx = null, master = null, noiseBuf = null;
function audioStart() {
  if (actx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  actx = new AC(); master = actx.createGain(); master.gain.value = 0.7; master.connect(actx.destination);
  noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 6; }
  const wind = actx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.6; const g = actx.createGain(); g.gain.value = 0.11;
  const lfo = actx.createOscillator(); lfo.frequency.value = 0.09; const lg = actx.createGain(); lg.gain.value = 170; lfo.connect(lg).connect(f.frequency); lfo.start(); wind.connect(f).connect(g).connect(master); wind.start();
}
function burst(dur, freq, vol, q = 0.7, type = 'lowpass', pan = 0) {
  if (!actx) return; const t = actx.currentTime, s = actx.createBufferSource(); s.buffer = noiseBuf; const f = actx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.2), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); let node = s.connect(f).connect(g);
  if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); } node.connect(master); s.start(t, Math.random(), dur + 0.05);
}
function tone(f0, f1, dur, vol, type = 'sine', pan = 0) {
  if (!actx) return; const t = actx.currentTime, o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(520, t); f.frequency.linearRampToValueAtTime(260, t + dur); f.Q.value = 2.5; let node = o.connect(f).connect(g);
  if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); } node.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  shot() { burst(0.32, 2600, 0.9); burst(0.9, 700, 0.25); tone(150, 45, 0.16, 0.8); },
  dry() { burst(0.04, 4000, 0.25, 2, 'highpass'); },
  reload() { burst(0.05, 3000, 0.3, 2, 'bandpass'); setTimeout(() => burst(0.07, 1800, 0.35, 2, 'bandpass'), 520); setTimeout(() => burst(0.05, 3500, 0.3, 2, 'bandpass'), 900); },
  groan(vol, pan) { const f = 62 + Math.random() * 40; tone(f, f * 0.72, 1.1 + Math.random() * 0.8, vol, 'sawtooth', pan); },
  hurt() { tone(110, 50, 0.25, 0.7); burst(0.15, 500, 0.4); },
  thud(vol, pan) { burst(0.2, 300, vol, 0.7, 'lowpass', pan); }
};

// ---------------------------------------------------------------- the dead
const zombies = [], mixers = [];
let zProto = null, zClips = {};
const OUTFITS = [
  { skin: 0x6f7868, shirt: 0x2f3a44, legs: 0x1e2126, shoe: 0x0e0e0e, sleeve: true },
  { skin: 0x7a7466, shirt: 0x5a2a24, legs: 0x2a2f3a, shoe: 0x1a1512, sleeve: false },
  { skin: 0x66705f, shirt: 0x6a6a5c, legs: 0x3a3226, shoe: 0x0e0e0e, sleeve: false },
  { skin: 0x74685c, shirt: 0x26302a, legs: 0x2c2c30, shoe: 0x1a1512, sleeve: true },
  { skin: 0x6a7268, shirt: 0x7a7468, legs: 0x1c2430, shoe: 0x0e0e0e, sleeve: true },
  { skin: 0x70665a, shirt: 0x3f3550, legs: 0x4a4438, shoe: 0x1a1512, sleeve: false }
];
const dressCache = new Map();
function dressed(geo, skeleton, k) {
  const key = geo.uuid + k; if (dressCache.has(key)) return dressCache.get(key);
  const o = OUTFITS[k], g = geo.clone(), si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, pos = geo.attributes.position, n = pos.count, a = new Float32Array(n * 3);
  geo.computeBoundingBox(); const cell = geo.boundingBox.getSize(new THREE.Vector3()).y / 7;
  const C = { skin: col(o.skin), shirt: col(o.shirt), legs: col(o.legs), shoe: col(o.shoe) }, blood = col(0x2e0a08), c = new THREE.Color();
  const h3 = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 11.3) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < n; i++) {
    let b = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; b = si.getComponent(i, j); } }
    const name = skeleton.bones[b].name;
    const part = /Head|Neck|Hand/.test(name) ? 'skin' : /ForeArm/.test(name) ? (o.sleeve ? 'shirt' : 'skin') : /Foot|Toe/.test(name) ? 'shoe' : /Hips|UpLeg|Leg/.test(name) ? 'legs' : 'shirt';
    c.copy(C[part]);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), s1 = h3(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)), s2 = h3(Math.floor(x / cell * 2.7), Math.floor(y / cell * 2.7), Math.floor(z / cell * 2.7));
    if (s1 < 0.22) c.lerp(blood, 0.75); else if (s2 < 0.2) c.lerp(blood, 0.45);
    c.multiplyScalar(0.75 + s2 * 0.3); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); dressCache.set(key, g); return g;
}
function spawnPoint(minDist) {
  for (let k = 0; k < 60; k++) {
    let x, z; if (rnd() < 0.6) { x = pick(AVES.slice(1, 5)) + rr(-11, 11); z = rr(-150, 150); } else { z = pick(STS.slice(1, 5)) + rr(-8, 8); x = rr(-120, 120); }
    const p = { x, z }; if (insideBuilding(x, z, 0.6)) continue; collide(p, 0.45);
    if (Math.hypot(p.x - player.x, p.z - player.z) > minDist) return p;
  }
  return { x: -41, z: -120 };
}
function makeZombie() {
  const root = SkeletonUtils.clone(zProto), fit = ri(0, OUTFITS.length - 1);
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false;
    o.geometry = dressed(o.geometry, o.skeleton, fit);
    o.material = new THREE.MeshStandardMaterial({ vertexColors: true, color: /Joints/.test(o.material.name) ? 0x9a9a9a : 0xffffff, roughness: 0.85, metalness: 0, envMapIntensity: 0.45 });
  });
  const mixer = new THREE.AnimationMixer(root);
  const walk = mixer.clipAction(zClips.walk), idle = mixer.clipAction(zClips.idle), slump = mixer.clipAction(zClips.sad_pose), sneak = mixer.clipAction(zClips.sneak_pose);
  walk.play(); idle.play(); slump.play(); sneak.play(); walk.time = rnd() * 1.0;
  const z = { root, mixer, walk, idle, slump, sneak, bones: {}, hp: 3, dead: 0, state: 'wander', speed: rr(0.6, 1.25), heading: rnd() * 6.283, turnT: 0, alert: 0, groanT: rr(2, 9), hitT: 0, lean: rr(-0.22, 0.22), reach: 0, moving: 1 };
  root.traverse(o => { if (o.isBone) z.bones[o.name.replace('mixamorig', '')] = o; });
  slump.setEffectiveWeight(rr(0.6, 1)); sneak.setEffectiveWeight(rr(0.1, 0.5));
  const s = rr(0.95, 1.06); root.scale.setScalar(s);
  scene.add(root); zombies.push(z); placeZombie(z, 30); return z;
}
function placeZombie(z, minDist) {
  const p = spawnPoint(minDist); z.root.position.set(p.x, groundY(p.x, p.z), p.z); z.root.rotation.set(0, z.heading, 0);
  z.hp = 3; z.dead = 0; z.state = 'wander'; z.alert = 0; z.mixer.timeScale = 1; z.root.visible = true;
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function updateZombie(z, dt) {
  const r = z.root, dx = player.x - r.position.x, dz = player.z - r.position.z, dist = Math.hypot(dx, dz);
  if (z.dead) {
    z.dead += dt; const t = Math.min(1, z.dead / 0.7), e = 1 - (1 - t) * (1 - t);
    r.rotation.x = -e * Math.PI / 2 * 0.97; r.position.y = groundY(r.position.x, r.position.z) + e * 0.16 - Math.max(0, z.dead - 9) * 0.25;
    if (z.dead > 12) placeZombie(z, 45);
    return;
  }
  z.hitT = Math.max(0, z.hitT - dt);
  if (z.alert > 0) z.alert -= dt;
  const sees = dist < 34 && rayWorld(r.position.x, 1.5, r.position.z, dx / dist, 0, dz / dist, dist) >= dist - 0.01;
  if (sees) z.alert = 5;
  z.state = z.alert > 0 && player.hp > 0 ? 'chase' : 'wander';
  let speed = 0, want = z.heading;
  if (z.state === 'chase') { want = Math.atan2(dx, dz); speed = dist > 1.05 ? z.speed * 1.5 : 0; }
  else { z.turnT -= dt; if (z.turnT < 0) { z.turnT = rr(3, 9); z.heading2 = z.heading + rr(-1.4, 1.4); z.moving = rnd() < 0.7 ? 1 : 0; } want = z.heading2 ?? z.heading; speed = z.moving ? z.speed * 0.55 : 0; }
  if (z.hitT > 0) speed *= 0.2;
  let dh = want - z.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); z.heading += clamp(dh, -dt * 2.2, dt * 2.2);
  const bx = r.position.x, bz = r.position.z;
  r.position.x += Math.sin(z.heading) * speed * dt; r.position.z += Math.cos(z.heading) * speed * dt;
  collide(r.position, 0.38);
  for (const o of zombies) if (o !== z && !o.dead) { const ex = r.position.x - o.root.position.x, ez = r.position.z - o.root.position.z, d = Math.hypot(ex, ez); if (d < 0.75 && d > 1e-4) { r.position.x += ex / d * (0.75 - d) * 0.5; r.position.z += ez / d * (0.75 - d) * 0.5; } }
  const moved = Math.hypot(r.position.x - bx, r.position.z - bz) / Math.max(dt, 1e-4);
  if (z.state === 'wander' && speed > 0 && moved < speed * 0.3) z.turnT = Math.min(z.turnT, 0.3);
  r.position.y += (groundY(r.position.x, r.position.z) - r.position.y) * Math.min(1, dt * 10);
  r.rotation.set(0, z.heading, 0);
  const w = clamp(moved / 0.5, 0, 1); z.walk.setEffectiveWeight(w); z.idle.setEffectiveWeight(1 - w); z.walk.timeScale = clamp(moved / 1.45, 0.25, 1.6);
  z.reach += ((z.state === 'chase' ? 1 : 0) - z.reach) * Math.min(1, dt * 2);
  z.mixer.update(dt);
  // layered on top of the clips: crooked spine, lolling head, arms coming up when it has seen you
  const b = z.bones;
  if (b.Spine1) b.Spine1.quaternion.multiply(_q.setFromEuler(_e.set(0.12 + z.reach * 0.1, 0, z.lean)));
  if (b.Head) b.Head.quaternion.multiply(_q.setFromEuler(_e.set(z.reach * -0.35, 0, -z.lean * 1.6 + Math.sin(clock.elapsedTime * 1.3 + z.lean * 20) * 0.08)));
  if (z.reach > 0.01) { if (b.LeftArm) b.LeftArm.quaternion.multiply(_q.setFromEuler(_e.set(0, 0, -1.15 * z.reach))); if (b.RightArm) b.RightArm.quaternion.multiply(_q.setFromEuler(_e.set(0, 0, 0.95 * z.reach))); }
  if (z.hitT > 0 && b.Spine) b.Spine.quaternion.multiply(_q.setFromEuler(_e.set(-z.hitT * 2.2, 0, 0)));
  // bite
  if (z.state === 'chase' && dist < 1.25 && started && player.hp > 0) { player.hp -= 22 * dt; player.hurt = Math.min(1, player.hurt + dt * 4); if ((z.biteT = (z.biteT || 0) - dt) < 0) { z.biteT = 0.6; sfx.hurt(); } }
  z.groanT -= dt;
  if (z.groanT < 0 && dist < 45) { z.groanT = z.state === 'chase' ? rr(1.5, 4) : rr(5, 14); const side = Math.sin(Math.atan2(dx, dz) - player.yaw); sfx.groan(clamp(1.6 / (1 + dist * 0.18), 0.03, 0.6), clamp(side, -1, 1)); }
}

// ---------------------------------------------------------------- player
const player = { x: 41, z: 44, y: 0, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, ammo: 12, reloading: 0, cool: 0, bob: 0, kick: 0, kills: 0 };
const keys = {}; let started = false, dead = false, touchMode = false, firing = false;
const move = { x: 0, y: 0 };
function fire() {
  if (!started || dead || player.cool > 0 || player.reloading > 0) return;
  if (player.ammo <= 0) { sfx.dry(); player.cool = 0.25; reload(); return; }
  player.ammo--; player.cool = 0.19; player.kick = 1; sfx.shot();
  gun.userData.flash.visible = true; gun.userData.flash.material.rotation = Math.random() * 6; gun.userData.light.intensity = 420; setTimeout(() => { gun.userData.flash.visible = false; gun.userData.light.intensity = 0; }, 55);
  const d = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), o = camera.position;
  const wall = rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, 140);
  let best = null, bt = wall;
  for (const z of zombies) {
    if (z.dead) continue; const p = z.root.position, hl2 = d.x * d.x + d.z * d.z; if (hl2 < 1e-6) continue;
    const t = ((p.x - o.x) * d.x + (p.z - o.z) * d.z) / hl2; if (t < 0 || t > bt) continue;
    const ex = o.x + d.x * t - p.x, ez = o.z + d.z * t - p.z, y = o.y + d.y * t - p.y;
    if (ex * ex + ez * ez < 0.36 * 0.36 && y > 0 && y < 1.9) { best = z; bt = t; best.hitY = y; }
  }
  for (const z of zombies) if (!z.dead && Math.hypot(z.root.position.x - player.x, z.root.position.z - player.z) < 70) z.alert = Math.max(z.alert, 9);
  if (best) {
    best.hp -= best.hitY > 1.5 ? 3 : 1; best.hitT = 0.25; best.alert = 12; sfx.thud(0.5, 0);
    if (best.hp <= 0) { best.dead = 0.001; best.mixer.timeScale = 0; player.kills++; $('kills').textContent = player.kills; }
  }
}
function reload() { if (player.reloading > 0 || player.ammo === 12 || dead) return; player.reloading = 1.25; sfx.reload(); }
function begin() {
  audioStart(); if (actx && actx.state === 'suspended') actx.resume();
  if (dead) { dead = false; Object.assign(player, { x: 41, z: 44, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, ammo: 12, kills: 0 }); $('kills').textContent = '0'; zombies.forEach(z => placeZombie(z, 30)); }
  started = true; $('veil').hidden = true; fp.visible = true;
  for (const id of ['tally', 'cross', 'vitals', 'ammo']) $(id).hidden = false;
  if (touchMode) { for (const id of ['touch', 'fire', 'reload']) $(id).hidden = false; }
  else { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-to-look still works */ } }
}
$('go').addEventListener('click', begin);
addEventListener('touchstart', () => { touchMode = true; }, { once: true, passive: true });
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyR') reload(); if (e.code === 'Enter' && !started && !$('go').disabled) begin(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let dragging = false;
canvas.addEventListener('mousedown', e => {
  if (!started || dead) return;
  if (document.pointerLockElement === canvas) { firing = true; fire(); }
  else { dragging = true; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } firing = true; fire(); }
});
addEventListener('mouseup', () => { dragging = false; firing = false; });
addEventListener('mousemove', e => {
  if (!started || dead) return;
  if (document.pointerLockElement === canvas || dragging) { player.yaw -= e.movementX * 0.0022; player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.3, 1.3); }
});
// touch: left half is a floating stick, right half looks
const touch = $('touch'), stick = $('stick'); let moveId = null, lookId = null, mo = [0, 0], lp = [0, 0];
touch.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.45 && moveId === null) { moveId = t.identifier; mo = [t.clientX, t.clientY]; stick.hidden = false; stick.style.left = t.clientX - 48 + 'px'; stick.style.top = t.clientY - 48 + 'px'; stick.firstElementChild.style.transform = ''; }
    else if (lookId === null) { lookId = t.identifier; lp = [t.clientX, t.clientY]; }
  }
}, { passive: false });
touch.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === moveId) { let dx = (t.clientX - mo[0]) / 46, dy = (t.clientY - mo[1]) / 46; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } move.x = dx; move.y = dy; stick.firstElementChild.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`; }
    else if (t.identifier === lookId) { player.yaw -= (t.clientX - lp[0]) * 0.0052; player.pitch = clamp(player.pitch - (t.clientY - lp[1]) * 0.0052, -1.3, 1.3); lp = [t.clientX, t.clientY]; }
  }
}, { passive: false });
const endTouch = e => { for (const t of e.changedTouches) { if (t.identifier === moveId) { moveId = null; move.x = move.y = 0; stick.hidden = true; } if (t.identifier === lookId) lookId = null; } };
touch.addEventListener('touchend', endTouch); touch.addEventListener('touchcancel', endTouch);
$('fire').addEventListener('touchstart', e => { e.preventDefault(); firing = true; fire(); }, { passive: false });
$('fire').addEventListener('touchend', () => { firing = false; });
$('reload').addEventListener('touchstart', e => { e.preventDefault(); reload(); }, { passive: false });
$('fire').addEventListener('click', () => fire()); $('reload').addEventListener('click', () => reload());

function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (started && !dead) { fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + move.x; fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + move.y; }
  const l = Math.hypot(fx, fz), run = keys.ShiftLeft || keys.ShiftRight || (touchMode && l > 0.92);
  const sp = (run ? 6.2 : 3.4) * Math.min(1, l); if (l > 1e-3) { fx /= l; fz /= l; }
  const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  player.x += (fx * c + fz * s) * sp * dt; player.z += (-fx * s + fz * c) * sp * dt;
  collide(player, 0.42);
  player.y += (groundY(player.x, player.z) - player.y) * Math.min(1, dt * 12);
  player.bob += sp * dt * 1.9; player.kick = Math.max(0, player.kick - dt * 7); player.cool -= dt; player.hurt = Math.max(0, player.hurt - dt * 1.3);
  if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) player.ammo = 12; }
  if (player.hp < 100 && player.hurt <= 0) player.hp = Math.min(100, player.hp + dt * 2);
  const bob = Math.sin(player.bob * 2) * 0.035 * Math.min(1, sp / 3.4);
  camera.position.set(player.x, player.y + 1.68 + bob, player.z);
  camera.rotation.set(player.pitch + player.kick * 0.035, player.yaw, 0);
  const rl = player.reloading > 0 ? Math.sin(Math.min(1, (1.25 - player.reloading) / 1.25) * Math.PI) : 0, mv = Math.min(1, sp / 3.4);
  fp.position.set(Math.cos(player.bob) * 0.006 * mv, bob * 0.3 - rl * 0.3 - player.kick * 0.004, player.kick * 0.035);
  fp.rotation.set(player.kick * 0.07 - rl * 0.55, Math.sin(player.bob) * 0.006 * mv, 0);
  if (player.hp <= 0 && !dead && started) {
    dead = true; started = false; firing = false; if (document.exitPointerLock) document.exitPointerLock();
    $('title').textContent = 'They got you'; $('blurb').textContent = `You put down ${player.kills} before the avenue took you.`; $('go').textContent = 'Go again'; $('veil').hidden = false;
    for (const id of ['touch', 'fire', 'reload', 'stick', 'cross']) $(id).hidden = true; fp.visible = false;
  }
  $('hpfill').style.width = clamp(player.hp, 0, 100) + '%';
  $('rounds').textContent = player.reloading > 0 ? '--' : player.ammo; $('ammonote').textContent = player.reloading > 0 ? 'reloading' : player.ammo === 0 ? 'empty' : '9mm';
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock(); let idleT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!started && !dead) { idleT += dt; player.yaw = Math.sin(idleT * 0.12) * 0.22; player.pitch = 0.05; }
  updatePlayer(dt);
  for (const z of zombies) updateZombie(z, dt);
  sky.position.copy(camera.position);
  const tx = Math.round(player.x / 2) * 2, tz = Math.round(player.z / 2) * 2;
  sun.target.position.set(tx, 0, tz - 10); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 260);
  for (const L of litLamps) { L.t += dt; const fl = Math.sin(L.t * 31) * Math.sin(L.t * 7.3) > 0.72 ? 0.25 : 1; L.light.intensity = L.base * fl; L.bulb.visible = fl > 0.5; }
  { const a = ash.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let x = a.getX(i) + dt * 0.35, y = a.getY(i) + dt * (0.08 + (i % 5) * 0.03), z = a.getZ(i) + dt * 0.12; if (x > 15) x -= 30; if (y > 15) y -= 30; if (z > 15) z -= 30; a.setXYZ(i, x, y, z); } a.needsUpdate = true; ash.position.set(Math.round(player.x / 30) * 30, 6, Math.round(player.z / 30) * 30); }
  grade.uniforms.time.value = t % 10; grade.uniforms.hurt.value = Math.max(player.hurt, dead ? 0.7 : 0);
  composer.render(dt);
  if (firing && touchMode) fire();
  if (!window.__manual) requestAnimationFrame(frame);
}
frame();

// ---------------------------------------------------------------- load the dead, then open the gate
const loadFail = () => { $('go').disabled = false; $('go').textContent = 'Enter the city'; $('note').textContent = 'The walkers failed to load, so the streets are empty this time.'; };
function onWalker(gltf) {
  zProto = gltf.scene;
  fp.add(buildArms(gltf.scene));
  for (const c of gltf.animations) {
    let clip = c;
    if (c.name === 'sad_pose' || c.name === 'sneak_pose') { THREE.AnimationUtils.makeClipAdditive(clip); clip = THREE.AnimationUtils.subclip(clip, clip.name, 2, 3, 30); }
    zClips[c.name] = clip;
  }
  for (let i = 0; i < (COARSE ? 12 : 18); i++) makeZombie();
  // a few placed where the opening view finds them
  [[38, 18], [45, -4], [36, -30], [49, 30]].forEach((p, i) => { const z = zombies[i]; z.root.position.set(p[0], 0, p[1]); z.heading = z.heading2 = rr(-0.5, 0.5); });
  $('go').disabled = false; $('go').textContent = 'Enter the city';
}
// The model ships as a .glb in the repo; the published artifact can't serve that type, so it falls back to an embedded copy.
new GLTFLoader().load('assets/walker.glb', onWalker, undefined, () => {
  import('./walker-data.js').then(m => { const bin = atob(m.default), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); new GLTFLoader().parse(buf.buffer, '', onWalker, loadFail); }).catch(loadFail);
});

window.__game = { player, zombies, camera, begin, frame, renderer };
