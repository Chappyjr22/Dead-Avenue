// Player input, the pistol and torch, pickups and the HUD.
import './streets.js'; // pickups are placed by the city build
import * as THREE from 'three';
import { rnd, clamp, $ } from './util.js';
import { MAG_SIZE, START_SPARE, AMMO_BOX, MEDKIT, MOVEMENT, LOOT, PLAYER_CONTROL } from './data.js';
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

// A gentle falloff: with true inverse-square the beam bleached anything within arm's reach.
const TORCH_POWER = 15;
const torch = new THREE.SpotLight(new THREE.Color().setRGB(1, 0.93, 0.8), 0, 34, 0.5, 0.6, 0.8);
torch.position.set(0.1, -0.06, -0.8); torch.target.position.set(0.04, -0.08, -6); // starts beyond the hands so it does not bleach them
camera.add(torch, torch.target);
let torchOn = false, torchAuto = false, torchManual = false;
function toggleTorch() {
  if (!game.started || game.dead) return;
  torchManual = true; torchOn = !torchOn;
}
// Each spot holds pistol ammo (olive box, warm glow) or a medkit (white case, red cross, cool glow).
// The case is a light grey rather than pure white so the torch does not wash out the cross.
const medCross = new THREE.MeshStandardMaterial({ color: 0xb01810, roughness: 0.6, emissive: 0xa0140c, emissiveIntensity: 0.8 });
const medGeo = [new THREE.BoxGeometry(0.26, 0.11, 0.18), new THREE.BoxGeometry(0.14, 0.008, 0.045), new THREE.BoxGeometry(0.045, 0.008, 0.14), new THREE.BoxGeometry(0.045, 0.09, 0.008), new THREE.BoxGeometry(0.09, 0.045, 0.008)];
const pickups = pickSpots.map(p => {
  if (p.kind === 'medkit') {
    const m = new THREE.Mesh(medGeo[0], new THREE.MeshStandardMaterial({ color: 0x767c7a, roughness: 0.85, emissive: 0x2f7fb8, emissiveIntensity: 0.5 }));
    for (const [g, y, z] of [[1, 0.059, 0], [2, 0.059, 0], [3, 0, 0.094], [4, 0, 0.094]]) { const c = new THREE.Mesh(medGeo[g], medCross); c.position.set(0, y, z); m.add(c); } // cross on the lid and the front
    m.position.copy(p).setY(p.y + 0.01); m.rotation.y = rnd() * 3; scene.add(m); return { m, taken: false, kind: 'medkit', name: 'MEDKIT', amount: 1, glow: 0.6 };
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.13), new THREE.MeshStandardMaterial({ color: 0x55602e, roughness: 0.6, emissive: 0x8a6a20, emissiveIntensity: 0.5 }));
  m.position.copy(p); m.rotation.y = rnd() * 3; scene.add(m); return { m, taken: false, kind: 'ammo', name: 'PISTOL AMMO', amount: AMMO_BOX, glow: 1 };
});
const medFull = item => item.kind === 'medkit' && player.medkits >= MEDKIT.max;
// Choose one visible item near the centre of the player's view. Revalidate on
// interaction so turning away, moving out of reach, or a wall cannot grant loot.
const lootDirection = new THREE.Vector3(), lootOffset = new THREE.Vector3();
let lootToastTime = 0;
function findLoot() {
  if (!game.started || game.dead || player.hp <= 0) return null;
  camera.getWorldDirection(lootDirection);
  let best = null, score = -Infinity;
  for (const item of pickups) {
    if (item.taken) continue;
    lootOffset.copy(item.m.position).sub(camera.position);
    const distance = lootOffset.length();
    if (distance < 0.01 || distance > LOOT.identifyRange) continue;
    lootOffset.multiplyScalar(1 / distance);
    const alignment = lootDirection.dot(lootOffset);
    if (alignment < LOOT.minAimDot) continue;
    const o = camera.position, d = lootOffset;
    if (rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, distance) < distance - LOOT.occlusionSlack) continue;
    const rank = alignment - distance * 0.001;
    if (rank > score) { score = rank; best = { item, distance }; }
  }
  return best;
}
function updateLoot(dt = 0) {
  const target = findLoot();
  for (const item of pickups) if (!item.taken) {
    item.m.material.emissiveIntensity = (target?.item === item ? 1.5 : 0.45 + Math.sin(clock.elapsedTime * 4) * 0.3) * item.glow;
  }
  $('loot').hidden = !target;
  if (target) {
    const { item } = target, med = item.kind === 'medkit', full = medFull(item), reachable = target.distance <= LOOT.reach && !full;
    $('loot-name').textContent = item.name;
    $('loot-amount').textContent = !med ? item.amount + ' rounds' : full ? `Carrying ${MEDKIT.max} of ${MEDKIT.max}, no room` : `Heals ${MEDKIT.heal} \u00b7 ${player.medkits} of ${MEDKIT.max} carried`;
    $('interact').disabled = !reachable;
    $('interact').textContent = full ? 'CARRYING MAX' : target.distance > LOOT.reach ? 'MOVE CLOSER' : game.touchMode ? 'PICK UP' : '[E] PICK UP';
    $('interact').setAttribute('aria-label', full ? `Cannot carry more than ${MEDKIT.max} medkits` : med ? 'Pick up a medkit' : 'Pick up ' + item.amount + ' rounds of pistol ammo');
  }
  lootToastTime = Math.max(0, lootToastTime - dt);
  $('loot-toast').hidden = lootToastTime <= 0 || !game.started || game.dead;
}
function interact() {
  const target = findLoot();
  if (!target || target.distance > LOOT.reach || medFull(target.item)) return;
  const { item } = target;
  item.taken = true; item.m.visible = false;
  if (item.kind === 'medkit') { player.medkits++; sfx.thud(0.35, 0); $('loot-toast').textContent = `+1 medkit (${player.medkits} of ${MEDKIT.max})`; }
  else { player.spare += item.amount; sfx.pickup(); $('loot-toast').textContent = '+' + item.amount + ' pistol rounds'; $('ammonote').textContent = player.spare + ' spare'; }
  lootToastTime = 1.5;
  updateMeds(); updateLoot();
}
// H uses a medkit: it is spent at once and the health lands when the use finishes; the pistol is lowered meanwhile.
function heal() {
  if (!game.started || game.dead || player.hp <= 0 || player.healing > 0 || player.reloading > 0 || player.medkits <= 0 || player.hp >= 100) return;
  aimWanted = sprintWanted = shotQueued = false;
  player.medkits--; player.healing = MEDKIT.time; sfx.medkit(); updateMeds();
}
function updateMeds() {
  $('medcount').textContent = player.healing > 0 ? 'Healing' : `Medkits ${player.medkits}/${MEDKIT.max}`;
  $('heal').setAttribute('aria-disabled', String(player.medkits <= 0 || player.hp >= 100 || player.healing > 0));
}
const keys = {};
const move = { x: 0, y: 0 };
let aimWanted = false, sprintWanted = false, aimBlend = 0, sprintBlend = 0, shotQueued = false;
let jumpHeight = 0, verticalSpeed = 0, crouchWanted = false, crouchBlend = 0, landingDip = 0;
function jump() {
  if (!game.started || game.dead || jumpHeight > 0.001 || verticalSpeed > 0) return;
  crouchWanted = false;
  verticalSpeed = PLAYER_CONTROL.jumpSpeed;
  player.airborne = true;
  sfx.jump();
}
function toggleCrouch() {
  if (!game.started || game.dead || jumpHeight > 0.001 || verticalSpeed > 0) return;
  crouchWanted = !crouchWanted;
  if (crouchWanted) sprintWanted = false;
}
const lookScale = () => 1 - aimBlend * 0.55;
function setAim(active) {
  if (!game.started || game.dead) return;
  aimWanted = active;
  if (active) sprintWanted = false;
}
function toggleSprint() {
  if (!game.started || game.dead) return;
  sprintWanted = !sprintWanted;
  if (sprintWanted) { aimWanted = false; crouchWanted = false; }
}
function fire() {
  if (!game.started || game.dead || player.cool > 0 || player.reloading > 0 || player.healing > 0) return;
  sprintWanted = false;
  if (sprintBlend > 0.08) { shotQueued = true; return; } // Raise the weapon before the shot can leave it.
  shotQueued = false;
  if (player.ammo <= 0) { sfx.dry(); if (player.spare <= 0) sfx.voice('empty'); player.cool = 0.25; if (player.spare > 0) reload(); return; }
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
    if (best.hp <= 0) { best.visual.deathImpulse = d.clone(); best.visual.hitHeight = best.hitY; best.dead = 0.001; best.path = []; best.navPending = null; player.kills++; $('kills').textContent = player.kills; }
  }
}
function reload() { if (player.reloading > 0 || player.healing > 0 || player.ammo === MAG_SIZE || player.spare <= 0 || game.dead) return; aimWanted = sprintWanted = shotQueued = false; player.reloading = 1.25; sfx.reload(); sfx.voice('reload'); }
function begin() {
  if (!game.ready) return;
  audioStart();
  resetInput();
  jumpHeight = verticalSpeed = crouchBlend = landingDip = 0; player.airborne = player.crouching = false;
  if (game.dead) { game.dead = false; Object.assign(player, { x: 41, z: 44, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, ammo: MAG_SIZE, spare: START_SPARE, kills: 0, reloading: 0, cool: 0, kick: 0, medkits: MEDKIT.start, healing: 0 }); pickups.forEach(p => { p.taken = false; p.m.visible = true; }); $('kills').textContent = '0'; zombies.forEach(z => placeZombie(z, 30)); }
  game.started = true; $('veil').hidden = true; fp.visible = true;
  for (const id of ['tally', 'cross', 'vitals', 'ammo']) $(id).hidden = false;
  if (game.touchMode) { for (const id of ['touch', 'fire', 'reload', 'flashlight', 'aim', 'sprint', 'heal', 'jump', 'crouch']) $(id).hidden = false; }
  else { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-to-look still works */ } }
}
$('go').addEventListener('click', begin);
addEventListener('touchstart', () => { game.touchMode = true; }, { once: true, passive: true });
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') { e.preventDefault?.(); if (!e.repeat) jump(); } if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !e.repeat) { e.preventDefault?.(); toggleCrouch(); } if (e.code === 'KeyE' && !e.repeat) interact(); if (e.code === 'KeyH' && !e.repeat) heal(); if (e.code === 'KeyR') reload(); if (e.code === 'KeyQ' && !e.repeat) setAim(!aimWanted); if (e.code === 'KeyF' && !e.repeat) toggleTorch(); if (e.code === 'Enter' && !game.started && !$('go').disabled) begin(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let dragging = false;
canvas.addEventListener('mousedown', e => {
  if (!game.started || game.dead) return;
  if (e.button === 2) { setAim(true); return; }
  if (e.button !== 0) return;
  if (document.pointerLockElement === canvas) { game.firing = true; fire(); }
  else { dragging = true; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } game.firing = true; fire(); }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (e.button === 2) setAim(false); else if (e.button === 0) { dragging = false; game.firing = false; } });
addEventListener('mousemove', e => {
  if (!game.started || game.dead) return;
  if (document.pointerLockElement === canvas || dragging) { player.yaw -= e.movementX * 0.0022 * lookScale(); player.pitch = clamp(player.pitch - e.movementY * 0.0022 * lookScale(), -1.3, 1.3); }
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
    else if (t.identifier === lookId) { player.yaw -= (t.clientX - lp[0]) * 0.0052 * lookScale(); player.pitch = clamp(player.pitch - (t.clientY - lp[1]) * 0.0052 * lookScale(), -1.3, 1.3); lp = [t.clientX, t.clientY]; }
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
    player.yaw -= (t.clientX-firePos[0])*0.0052 * lookScale();
    player.pitch = clamp(player.pitch-(t.clientY-firePos[1])*0.0052 * lookScale(),-1.3,1.3);
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
$('interact').addEventListener('touchstart', e => { e.preventDefault(); interact(); }, { passive: false });
$('interact').addEventListener('click', interact);
for (const [id, action] of [['aim', () => setAim(!aimWanted)], ['sprint', toggleSprint], ['heal', heal], ['jump', jump], ['crouch', toggleCrouch]]) {
  $(id).addEventListener('touchstart', e => { e.preventDefault(); action(); }, { passive: false });
  $(id).addEventListener('click', action);
}
function resetInput() {
  sfx.stopVoice();
  $('loot').hidden = $('loot-toast').hidden = true; lootToastTime = 0;
  crouchWanted = false;
  aimWanted = sprintWanted = shotQueued = false; aimBlend = sprintBlend = 0;
  player.aiming = player.sprinting = false;
  camera.fov = MOVEMENT.hipFov; camera.updateProjectionMatrix();
  for (const id of ['aim', 'sprint', 'crouch']) $(id).setAttribute('aria-pressed', 'false');
  for (const k of Object.keys(keys)) delete keys[k];
  move.x=move.y=0; moveId=lookId=fireId=null; dragging=false; game.firing=false; stick.hidden=true;
}
addEventListener('blur', resetInput);
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !game.touchMode) resetInput(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });

function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (game.started && !game.dead) { fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + move.x; fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + move.y; }
  const l = Math.hypot(fx, fz);
  const aiming = aimWanted && player.reloading <= 0 && player.healing <= 0 && game.started && !game.dead;
  const run = (sprintWanted || keys.ShiftLeft || keys.ShiftRight) && fz < -0.2 && l > 0.2 && !crouchWanted && !aiming && !game.firing && !shotQueued && player.cool <= 0 && player.reloading <= 0 && player.healing <= 0;
  player.aiming = aiming; player.sprinting = !!run;
  const blend = 1 - Math.exp(-dt * 14);
  aimBlend += ((aiming ? 1 : 0) - aimBlend) * blend;
  sprintBlend += ((run ? 1 : 0) - sprintBlend) * blend;
  player.crouching = crouchWanted;
  crouchBlend += ((crouchWanted ? 1 : 0) - crouchBlend) * blend;
  const sp = (crouchWanted ? PLAYER_CONTROL.crouchSpeed : aiming ? MOVEMENT.aim : run ? MOVEMENT.sprint : MOVEMENT.walk) * Math.min(1, l);
  if (l > 1e-3) { fx /= l; fz /= l; }
  $('crouch').setAttribute('aria-pressed', String(crouchWanted));
  $('aim').setAttribute('aria-pressed', String(aiming));
  $('sprint').setAttribute('aria-pressed', String(!!run || sprintWanted));
  $('cross').style.opacity = String(1 - Math.max(aimBlend, sprintBlend));
  camera.fov = MOVEMENT.hipFov + (MOVEMENT.aimFov - MOVEMENT.hipFov) * aimBlend + 3 * sprintBlend;
  camera.updateProjectionMatrix();
  const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  player.x += (fx * c + fz * s) * sp * dt; player.z += (-fx * s + fz * c) * sp * dt;
  collide(player, 0.42);
  if (jumpHeight > 0 || verticalSpeed > 0) {
    // Integrate a ballistic arc, then land once. Horizontal obstacles still block movement.
    jumpHeight += verticalSpeed * dt - 0.5 * PLAYER_CONTROL.gravity * dt * dt;
    verticalSpeed -= PLAYER_CONTROL.gravity * dt;
    if (jumpHeight <= 0) { jumpHeight = verticalSpeed = 0; landingDip = 0.07; sfx.land(); }
  }
  player.airborne = jumpHeight > 0 || verticalSpeed > 0;
  landingDip *= Math.exp(-dt * 13);
  player.y += (groundY(player.x, player.z) - player.y) * Math.min(1, dt * 12);
  player.bob += sp * dt * 1.9 * (player.airborne ? 0 : 1); player.kick = Math.max(0, player.kick - dt * 7); player.cool -= dt; player.hurt = Math.max(0, player.hurt - dt * 1.3);
  if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) { const take = Math.min(MAG_SIZE - player.ammo, player.spare); player.ammo += take; player.spare -= take; } }
  const indoors = !!roomAt(player.x, player.z);
  if (indoors !== torchAuto) { torchAuto = indoors; if (!torchManual) torchOn = indoors; } // the torch comes on by itself indoors; F overrides
  $('flashlight').setAttribute('aria-pressed', String(torchOn));
  $('flashlight').textContent = torchOn ? 'LIGHT ON' : 'LIGHT OFF';
  torch.intensity += ((torchOn && game.started ? TORCH_POWER : 0) - torch.intensity) * Math.min(1, dt * 10);
  if (player.healing > 0) { player.healing -= dt; if (player.healing <= 0) { player.healing = 0; if (player.hp > 0) player.hp = Math.min(100, player.hp + MEDKIT.heal); } }
  const bob = Math.sin(player.bob * 2) * 0.022 * Math.min(1, sp / MOVEMENT.walk) * (1 - aimBlend * 0.9) * (player.airborne ? 0 : 1) * (1 - 0.6 * crouchBlend);
  camera.position.set(player.x, player.y + PLAYER_CONTROL.standEye + jumpHeight - (PLAYER_CONTROL.standEye - PLAYER_CONTROL.crouchEye) * crouchBlend + bob - landingDip, player.z);
  camera.rotation.set(player.pitch + player.kick * 0.035, player.yaw, 0);
  const rl = player.reloading > 0 ? Math.sin(Math.min(1, (1.25 - player.reloading) / 1.25) * Math.PI) : player.healing > 0 ? Math.sin(Math.min(1, (MEDKIT.time - player.healing) / MEDKIT.time) * Math.PI) * 0.8 : 0;
  const mv = Math.min(1, sp / MOVEMENT.walk), steady = 1 - aimBlend;
  // The whole grip moves together. ADS seats the actual front/rear sights on
  // the camera axis; sprint lowers and rolls the pistol with a running cadence.
  fp.position.set(
    -GUN_POS.x * aimBlend + 0.045 * sprintBlend + Math.cos(player.bob) * (0.006 * mv * steady + 0.012 * sprintBlend),
    0.0772 * aimBlend + 0.015 * sprintBlend + bob * 0.3 * steady - landingDip * 0.45 - rl * 0.3 - player.kick * 0.004,
    0.04 * aimBlend + 0.025 * sprintBlend + player.kick * 0.035);
  fp.rotation.set(
    player.kick * (0.07 - 0.04 * aimBlend) - rl * 0.55 - 0.16 * sprintBlend + Math.sin(player.bob * 2) * 0.025 * sprintBlend,
    Math.sin(player.bob) * 0.006 * mv * steady,
    0.25 * sprintBlend + Math.cos(player.bob) * 0.018 * sprintBlend);
  if (player.hp <= 0 && !game.dead && game.started) {
    game.dead = true; game.started = false; player.healing = 0; jumpHeight = verticalSpeed = landingDip = 0; player.airborne = false; resetInput(); if (document.exitPointerLock) document.exitPointerLock();
    $('title').textContent = 'They got you'; $('blurb').textContent = `You put down ${player.kills} before the avenue took you.`; $('go').textContent = 'Go again'; $('veil').hidden = false;
    for (const id of ['touch', 'fire', 'reload', 'flashlight', 'aim', 'sprint', 'heal', 'jump', 'crouch', 'stick', 'cross']) $(id).hidden = true; fp.visible = false;
  }
  updateLoot(dt);
  if (shotQueued && sprintBlend <= 0.08) fire();
  $('hpfill').style.width = clamp(player.hp, 0, 100) + '%'; updateMeds();
  $('rounds').textContent = player.reloading > 0 ? '--' : player.ammo; $('ammonote').textContent = player.reloading > 0 ? 'reloading' : `${player.spare} spare`;
}

function installPistol(gltf) { gun.add(buildPistol(gltf)); }

export { installPistol, fp, gun, pickups, fire, reload, heal, begin, updatePlayer };
