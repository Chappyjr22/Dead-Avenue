// Player input, the pistol and torch, pickups and the HUD.
import './streets.js'; // pickups are placed by the city build
import * as THREE from 'three';
import { rnd, clamp, $ } from './util.js';
import { MAG_SIZE, START_SPARE, AMMO_BOX } from './data.js';
import { canvas, scene, camera } from './render.js';
import { mkCanvas } from './textures.js';
import { pickSpots, groundY, roomAt, collide, rayWorld } from './world.js';
import { audioStart, sfx } from './audio.js';
import { player, zombies, game, clock } from './state.js';
import { hitZombieVisual } from './zombie-visual.js';
import { buildPistol } from './weapon-model.js';
import { placeZombie } from './zombies.js';
import { GUN_POS } from './arms.js';

const gun = new THREE.Group();
{
  const fc = mkCanvas(64, 64), fx = fc.getContext('2d'), gr = fx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.8)'); gr.addColorStop(1, 'rgba(255,90,0,0)'); fx.fillStyle = gr; fx.fillRect(0, 0, 64, 64);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), blending: THREE.AdditiveBlending, depthTest: false, color: new THREE.Color().setRGB(4, 3, 2) }));
  flash.position.set(0, 0.041, -0.20); flash.scale.setScalar(0.22); flash.visible = false; gun.add(flash); gun.userData.flash = flash;
  const fl = new THREE.PointLight(new THREE.Color().setRGB(1, 0.7, 0.35), 0, 26, 1.6); fl.position.set(0, 0.05, -0.5); gun.add(fl); gun.userData.light = fl;
}
const fp = new THREE.Group(); // everything the player holds: pistol plus arms
gun.scale.setScalar(0.85); gun.position.copy(GUN_POS); fp.add(gun); camera.add(fp); fp.visible = false;

const torch = new THREE.SpotLight(new THREE.Color().setRGB(1, 0.93, 0.8), 0, 34, 0.5, 0.6, 1.5);
torch.position.set(0.1, -0.06, -0.8); torch.target.position.set(0.04, -0.08, -6); // starts beyond the hands so it does not bleach them
camera.add(torch, torch.target);
let torchOn = false, torchAuto = false, torchManual = false;
function toggleTorch() {
  if (!game.started || game.dead) return;
  torchManual = true; torchOn = !torchOn;
}
const pickups = pickSpots.map(p => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.13), new THREE.MeshStandardMaterial({ color: 0x55602e, roughness: 0.6, emissive: 0x8a6a20, emissiveIntensity: 0.5 }));
  m.position.copy(p); m.rotation.y = rnd() * 3; scene.add(m); return { m, taken: false };
});
const keys = {};
const move = { x: 0, y: 0 };
function fire() {
  if (!game.started || game.dead || player.cool > 0 || player.reloading > 0) return;
  if (player.ammo <= 0) { sfx.dry(); player.cool = 0.25; if (player.spare > 0) reload(); return; }
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
    best.hp -= best.hitY > 1.5 ? 3 : 1; best.hitT = 0.25; hitZombieVisual(best.visual); best.alert = 12; sfx.thud(0.5, 0);
    if (best.hp <= 0) { best.dead = 0.001; best.path = []; best.navPending = null; player.kills++; $('kills').textContent = player.kills; }
  }
}
function reload() { if (player.reloading > 0 || player.ammo === MAG_SIZE || player.spare <= 0 || game.dead) return; player.reloading = 1.25; sfx.reload(); }
function begin() {
  if (!game.ready) return;
  audioStart();
  resetInput();
  if (game.dead) { game.dead = false; Object.assign(player, { x: 41, z: 44, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, ammo: MAG_SIZE, spare: START_SPARE, kills: 0, reloading: 0, cool: 0, kick: 0 }); pickups.forEach(p => { p.taken = false; p.m.visible = true; }); $('kills').textContent = '0'; zombies.forEach(z => placeZombie(z, 30)); }
  game.started = true; $('veil').hidden = true; fp.visible = true;
  for (const id of ['tally', 'cross', 'vitals', 'ammo']) $(id).hidden = false;
  if (game.touchMode) { for (const id of ['touch', 'fire', 'reload', 'flashlight']) $(id).hidden = false; }
  else { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-to-look still works */ } }
}
$('go').addEventListener('click', begin);
addEventListener('touchstart', () => { game.touchMode = true; }, { once: true, passive: true });
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyR') reload(); if (e.code === 'KeyF' && !e.repeat) toggleTorch(); if (e.code === 'Enter' && !game.started && !$('go').disabled) begin(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let dragging = false;
canvas.addEventListener('mousedown', e => {
  if (!game.started || game.dead) return;
  if (document.pointerLockElement === canvas) { game.firing = true; fire(); }
  else { dragging = true; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } game.firing = true; fire(); }
});
addEventListener('mouseup', () => { dragging = false; game.firing = false; });
addEventListener('mousemove', e => {
  if (!game.started || game.dead) return;
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
// Drag the firing thumb to aim while holding fire; the left thumb stays free.
let fireId = null, firePos = [0, 0];
$('fire').addEventListener('touchstart', e => {
  e.preventDefault();
  if (fireId !== null || !game.started || game.dead) return;
  const t = e.changedTouches[0]; fireId = t.identifier; firePos = [t.clientX, t.clientY];
  game.firing = true; fire();
}, { passive: false });
$('fire').addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) if (t.identifier === fireId) {
    player.yaw -= (t.clientX-firePos[0])*0.0052;
    player.pitch = clamp(player.pitch-(t.clientY-firePos[1])*0.0052,-1.3,1.3);
    firePos = [t.clientX,t.clientY];
  }
}, { passive: false });
const stopFire = e => { for (const t of e.changedTouches) if (t.identifier === fireId) { fireId=null; game.firing=false; } };
$('fire').addEventListener('touchend', stopFire);
$('fire').addEventListener('touchcancel', stopFire);
$('reload').addEventListener('touchstart', e => { e.preventDefault(); reload(); }, { passive: false });
$('flashlight').addEventListener('touchstart', e => { e.preventDefault(); toggleTorch(); }, { passive: false });
$('fire').addEventListener('click', () => fire());
$('reload').addEventListener('click', () => reload());
$('flashlight').addEventListener('click', toggleTorch);
function resetInput() {
  for (const k of Object.keys(keys)) delete keys[k];
  move.x=move.y=0; moveId=lookId=fireId=null; dragging=false; game.firing=false; stick.hidden=true;
}
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });

function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (game.started && !game.dead) { fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + move.x; fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + move.y; }
  const l = Math.hypot(fx, fz), run = keys.ShiftLeft || keys.ShiftRight || (game.touchMode && l > 0.92);
  const sp = (run ? 6.2 : 3.4) * Math.min(1, l); if (l > 1e-3) { fx /= l; fz /= l; }
  const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  player.x += (fx * c + fz * s) * sp * dt; player.z += (-fx * s + fz * c) * sp * dt;
  collide(player, 0.42);
  player.y += (groundY(player.x, player.z) - player.y) * Math.min(1, dt * 12);
  player.bob += sp * dt * 1.9; player.kick = Math.max(0, player.kick - dt * 7); player.cool -= dt; player.hurt = Math.max(0, player.hurt - dt * 1.3);
  if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) { const take = Math.min(MAG_SIZE - player.ammo, player.spare); player.ammo += take; player.spare -= take; } }
  const indoors = !!roomAt(player.x, player.z);
  if (indoors !== torchAuto) { torchAuto = indoors; if (!torchManual) torchOn = indoors; } // the torch comes on by itself indoors; F overrides
  $('flashlight').setAttribute('aria-pressed', String(torchOn));
  $('flashlight').textContent = torchOn ? 'LIGHT ON' : 'LIGHT OFF';
  torch.intensity += ((torchOn && game.started ? 95 : 0) - torch.intensity) * Math.min(1, dt * 10);
  if (game.started) for (const p of pickups) {
    if (p.taken) continue; p.m.material.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.3;
    if (Math.hypot(p.m.position.x - player.x, p.m.position.z - player.z) < 1.15) { p.taken = true; p.m.visible = false; player.spare += AMMO_BOX; sfx.reload(); }
  }
  if (player.hp < 100 && player.hurt <= 0) player.hp = Math.min(100, player.hp + dt * 2);
  const bob = Math.sin(player.bob * 2) * 0.035 * Math.min(1, sp / 3.4);
  camera.position.set(player.x, player.y + 1.68 + bob, player.z);
  camera.rotation.set(player.pitch + player.kick * 0.035, player.yaw, 0);
  const rl = player.reloading > 0 ? Math.sin(Math.min(1, (1.25 - player.reloading) / 1.25) * Math.PI) : 0, mv = Math.min(1, sp / 3.4);
  fp.position.set(Math.cos(player.bob) * 0.006 * mv, bob * 0.3 - rl * 0.3 - player.kick * 0.004, player.kick * 0.035);
  fp.rotation.set(player.kick * 0.07 - rl * 0.55, Math.sin(player.bob) * 0.006 * mv, 0);
  if (player.hp <= 0 && !game.dead && game.started) {
    game.dead = true; game.started = false; resetInput(); if (document.exitPointerLock) document.exitPointerLock();
    $('title').textContent = 'They got you'; $('blurb').textContent = `You put down ${player.kills} before the avenue took you.`; $('go').textContent = 'Go again'; $('veil').hidden = false;
    for (const id of ['touch', 'fire', 'reload', 'flashlight', 'stick', 'cross']) $(id).hidden = true; fp.visible = false;
  }
  $('hpfill').style.width = clamp(player.hp, 0, 100) + '%';
  $('rounds').textContent = player.reloading > 0 ? '--' : player.ammo; $('ammonote').textContent = player.reloading > 0 ? 'reloading' : `${player.spare} spare`;
}

function installPistol(gltf) { gun.add(buildPistol(gltf)); }

export { installPistol, fp, gun, pickups, fire, reload, begin, updatePlayer };
