// Seeded random numbers and small helpers. The seed fixes the city layout, so call order matters.
import * as THREE from 'three';

let seed = 20261114;
function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rnd();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const col = hex => new THREE.Color(hex);
const $ = id => document.getElementById(id);
const COARSE = matchMedia('(pointer: coarse)').matches;

export { rnd, rr, ri, pick, clamp, col, $, COARSE };
