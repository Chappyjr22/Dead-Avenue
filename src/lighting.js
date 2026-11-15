// Day and night light. Everything lit follows one number, the night factor (0 day, 1 night): sky, sun or moon and
// its shadows, hemisphere light, fog, the environment map on glass and paint, bloom, windows, streetlights, ash and
// the far skyline. Only values change during play: no light is added, removed or hidden, so no shader recompiles.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { LIGHTING } from './data.js';
import { renderer, scene, SUN_DIR, LIGHT_DIR, MOON_DIR, FOG, sky, skyMat, sun, hemi, bloom } from './render.js';
import { winMat } from './textures.js';
import { litLamps, ash, farMat } from './streets.js';

const KEYS = [LIGHTING.day, LIGHTING.dusk, LIGHTING.night];
const lerp = (a, b, t) => a + (b - a) * t;
const mixRGB = (c, a, b, t) => c.setRGB(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
// The two keys either side of n and how far between them: day to dusk over the first half, dusk to night after.
let A = KEYS[0], B = KEYS[1], T = 0;
function between(n) { if (n < 0.5) { A = KEYS[0]; B = KEYS[1]; T = n * 2; } else { A = KEYS[1]; B = KEYS[2]; T = (n - 0.5) * 2; } }

const U = skyMat.uniforms;
// What the sky shader reads: the sun's place, fog colour and the sky blend. Also used to draw the environment maps.
function setSky(n) {
  between(n);
  SUN_DIR.set(LIGHTING.sunDir[0], lerp(A.sunY, B.sunY, T), LIGHTING.sunDir[2]).normalize();
  mixRGB(scene.fog.color, A.fog, B.fog, T); scene.fog.density = lerp(A.fogD, B.fogD, T);
  U.night.value = lerp(A.sky, B.sky, T); U.glow.value = lerp(A.glow, B.glow, T); mixRGB(U.tint.value, A.tint, B.tint, T);
}

// Environment maps: day, dusk and night are drawn from the sky once, at load. During twilight a single cheap pass
// blends the two nearest into one live map of the same size, so reflections and ambient light fade with no step.
const envs = [], blendMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: null }, b: { value: null }, t: { value: 0 } }, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D a, b; uniform float t; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(a, vUv), texture2D(b, vUv), t); }`
});
const quad = new FullScreenQuad(blendMat);
let live = null, envN = -1;
{
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene(); s.add(sky.clone());
  for (const n of [0, 0.5, 1]) { setSky(n); envs.push(pm.fromScene(s, 0, 0.1, 1200)); }
  pm.dispose();
  const src = envs[0];
  live = new THREE.WebGLRenderTarget(src.width, src.height, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
  live.texture.mapping = THREE.CubeUVReflectionMapping; live.texture.name = 'PMREM.cubeUv';
  scene.environment = live.texture;
}
function blendEnvironment(n) {
  const i = n < 0.5 ? 0 : 1;
  blendMat.uniforms.a.value = envs[i].texture; blendMat.uniforms.b.value = envs[i + 1].texture; blendMat.uniforms.t.value = n < 0.5 ? n * 2 : (n - 0.5) * 2;
  const prev = renderer.getRenderTarget(); renderer.setRenderTarget(live); quad.render(renderer); renderer.setRenderTarget(prev);
  envN = n;
}

const ashBase = ash.material.color.clone();
for (const L of litLamps) L.bulbBase = L.bulb.material.color.clone();
const lampBase = LIGHTING.day.lamps;

// Sets every light for night factor n. Cheap enough for every frame; the environment is redrawn only when n moved.
function applyDaylight(n) {
  setSky(n);
  // The light is the sun until dusk and the moon after; its intensity passes through zero at dusk, where it turns.
  mixRGB(sun.color, A.sun, B.sun, T);
  sun.intensity = lerp(A.sunI, B.sunI, T) + lerp(A.moonI, B.moonI, T);
  if (n < 0.5) { LIGHT_DIR.copy(SUN_DIR); if (LIGHT_DIR.y < 0.04) { LIGHT_DIR.y = 0.04; LIGHT_DIR.normalize(); } }
  else LIGHT_DIR.copy(MOON_DIR);
  mixRGB(hemi.color, A.hemiSky, B.hemiSky, T); mixRGB(hemi.groundColor, A.hemiGround, B.hemiGround, T); hemi.intensity = lerp(A.hemiI, B.hemiI, T);
  bloom.strength = lerp(A.bloom, B.bloom, T);
  renderer.toneMappingExposure = lerp(A.exposure, B.exposure, T);
  winMat.emissiveIntensity = lerp(A.windows, B.windows, T);
  const lamps = lerp(A.lamps, B.lamps, T);
  for (const L of litLamps) { L.base = lamps; L.bulb.material.color.copy(L.bulbBase).multiplyScalar(lamps / lampBase); }
  ash.material.color.copy(ashBase).multiplyScalar(lerp(A.ash, B.ash, T));
  // The skyline is drawn unfogged in colours made from the daytime fog: scale them to tonight's fog.
  const f = scene.fog.color; farMat.color.setRGB(f.r / FOG.r, f.g / FOG.g, f.b / FOG.b);
  if (Math.abs(n - envN) > 0.004 || (n !== envN && (n === 0 || n === 1))) blendEnvironment(n);
}

export { applyDaylight };
