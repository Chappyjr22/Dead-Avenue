// Renderer, camera, sky, sun and post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { $, COARSE } from './util.js';
import { LIGHTING } from './data.js';

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

// SUN_DIR is where the sun sits in the sky; LIGHT_DIR is where the directional light comes from (the sun by day,
// the moon by night). lighting.js moves both, and the fog colour, through the day; FOG stays the daytime colour.
const SUN_DIR = new THREE.Vector3(...LIGHTING.sunDir).normalize(), LIGHT_DIR = SUN_DIR.clone(), MOON_DIR = new THREE.Vector3(...LIGHTING.moonDir).normalize();
const FOG = new THREE.Color().setRGB(0.50, 0.33, 0.25);
scene.fog = new THREE.FogExp2(FOG, 0.0095);

// ---------------------------------------------------------------- sky
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: SUN_DIR }, fogCol: { value: scene.fog.color }, moonDir: { value: MOON_DIR }, night: { value: 0 }, glow: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 sunDir, fogCol, moonDir, tint; uniform float night, glow;
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
      c = mix(c, cloudCol, cl * 0.75) * tint;
      // night: deep blue, a moon, a few stars between dark clouds
      float ma = max(dot(d, moonDir), 0.0);
      vec3 nc = mix(vec3(0.05,0.07,0.13), vec3(0.008,0.014,0.04), smoothstep(0.0, 0.6, h));
      vec2 sp = floor(d.xz / (h + 0.35) * 160.0);
      nc += vec3(0.75,0.8,1.0) * step(0.9965, hash(sp)) * smoothstep(0.08, 0.4, h) * (1.0 - cl) * 0.8;
      nc = mix(nc, vec3(0.035,0.045,0.08), cl * 0.7);
      nc += vec3(0.30,0.40,0.65) * pow(ma, 10.0) * 0.22 + vec3(0.85,0.9,1.0) * smoothstep(0.99935, 0.99965, ma) * 2.2;
      c = mix(c, nc, night);
      c = mix(fogCol * (1.0 + 1.3 * glow * pow(toward, 3.0)), c, 0.12 + 0.88 * smoothstep(0.0, 0.26, h));
      c += vec3(1.0,0.5,0.2) * pow(sa, 6.0) * 0.55 * glow;
      c += vec3(1.0,0.8,0.55) * pow(sa, 900.0) * 14.0 * glow * smoothstep(-0.02, 0.01, sunDir.y);
      c = mix(fogCol, c, smoothstep(-0.02, 0.03, d.y));
      gl_FragColor = vec4(c, 1.0);
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
sky.frustumCulled = false;
scene.add(sky);

const sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1.0, 0.62, 0.36), 3.6);
sun.castShadow = true;
sun.shadow.mapSize.set(COARSE ? 1536 : 2048, COARSE ? 1536 : 2048);
const SH = 70;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 420 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(new THREE.Color().setRGB(0.36, 0.42, 0.62), new THREE.Color().setRGB(0.30, 0.20, 0.14), 1.25);
scene.add(hemi);

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

export { canvas, renderer, scene, camera, SUN_DIR, LIGHT_DIR, MOON_DIR, FOG, sky, skyMat, sun, hemi, bloom, composer, grade };
