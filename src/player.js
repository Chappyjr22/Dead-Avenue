// Player input, the weapons and torch, pickups and the HUD.
import './streets.js'; // pickups are placed by the city build
import * as THREE from 'three';
import { ITEMS, pickupRoom, newEquipment, itemCount, collectItem, updateSurvival, newSupplies } from './inventory.js';
import { buildLoot } from './loot-model.js';
import { installInventoryUI, updateInventoryUI } from './inventory-ui.js';
import { rnd, clamp, $ } from './util.js';
import { AMMO_BOX, AMMO_BOX_WEAPON, MEDKIT, MOVEMENT, LOOT, PLAYER_CONTROL, WEAPONS, START_WEAPON, WEAPON_SWITCH } from './data.js';
import { canvas, scene, camera } from './render.js';
import { mkCanvas } from './textures.js';
import { pickSpots, groundY, roomAt, collide, rayWorld } from './world.js';
import { audioStart, sfx } from './audio.js';
import { player, zombies, game, clock, newArsenal } from './state.js';
import { hitZombieVisual } from './zombie-visual.js';
import { placeZombie } from './zombies.js';

// Everything the player holds hangs off fp. Each weapon has its own group (the model, its muzzle
// flash and light, and an arm rig posed for it); only the one in hand is shown.
const fp = new THREE.Group();
camera.add(fp); fp.visible = false;
const flashMap = (() => { const fc = mkCanvas(64, 64), fx = fc.getContext('2d'), gr = fx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.8)'); gr.addColorStop(1, 'rgba(255,90,0,0)'); fx.fillStyle = gr; fx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(fc); })();
const held = {};
for (const [id, w] of Object.entries(WEAPONS)) {
  const group = new THREE.Group(), gun = new THREE.Group();
  gun.position.fromArray(w.mount.pos); gun.rotation.set(...w.mount.rot); gun.scale.setScalar(w.mount.scale);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashMap, blending: THREE.AdditiveBlending, depthTest: false, color: new THREE.Color().setRGB(4, 3, 2) }));
  flash.position.fromArray(w.muzzle); flash.scale.setScalar(w.flash); flash.visible = false; gun.add(flash);
  const light = new THREE.PointLight(new THREE.Color().setRGB(1, 0.7, 0.35), 0, 26, 1.6); light.position.set(w.muzzle[0], w.muzzle[1] + 0.009, w.muzzle[2] - 0.3); gun.add(light);
  group.add(gun); group.visible = id === player.weapon; fp.add(group);
  held[id] = { group, gun, flash, light };
}
const gun = held.makarov.gun; // kept for callers that only know the pistol
const weapon = () => WEAPONS[player.weapon];
const showHeld = () => { for (const id in held) held[id].group.visible = id === player.weapon; };

// A gentle falloff: with true inverse-square the beam bleached anything within arm's reach.
const TORCH_POWER = 15;
const torch = new THREE.SpotLight(new THREE.Color().setRGB(1, 0.93, 0.8), 0, 34, 0.5, 0.6, 0.8);
torch.position.set(0.1, -0.06, -0.8); torch.target.position.set(0.04, -0.08, -6); // starts beyond the hands so it does not bleach them
camera.add(torch, torch.target);
let torchOn = false, torchAuto = false, torchManual = false;
function toggleTorch() {
  if (game.inventoryOpen || !game.started || game.dead) return;
  torchManual = true; torchOn = !torchOn;
}
// Every pickup remains a world item until deliberately collected.
const pickups = pickSpots.map(p => {
  const kind=ITEMS[p.kind]?p.kind:'ammo', def=ITEMS[kind], m=buildLoot(kind);
  m.position.copy(p);m.rotation.y=rnd()*3;scene.add(m);
  return {m,taken:false,kind,name:def.name.toUpperCase(),amount:def.amount,glow:.5};
});
const medFull = item => pickupRoom(player,item.kind)===0;
// Choose one visible item near the centre of the player's view. Revalidate on
// interaction so turning away, moving out of reach, or a wall cannot grant loot.
const lootDirection = new THREE.Vector3(), lootOffset = new THREE.Vector3();
let lootToastTime = 0;
function findLoot() {
  if (game.inventoryOpen || !game.started || game.dead || player.hp <= 0) return null;
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
    $('loot-amount').textContent = full ? 'No room or already wearing equal/better gear' : (item.kind==='ammo'||item.kind==='rifleAmmo') ? item.amount+' rounds' : ITEMS[item.kind].detail;
    $('interact').disabled = !reachable;
    $('interact').textContent = full ? 'CARRYING MAX' : target.distance > LOOT.reach ? 'MOVE CLOSER' : game.touchMode ? 'PICK UP' : '[E] PICK UP';
    $('interact').setAttribute('aria-label', full ? 'Cannot carry more '+ITEMS[item.kind].name : 'Pick up '+(med?'a medkit':item.kind==='ammo'?item.amount+' rounds of pistol ammo':ITEMS[item.kind].name));
  }
  lootToastTime = Math.max(0, lootToastTime - dt);
  $('loot-toast').hidden = lootToastTime <= 0 || !game.started || game.dead;
}
function interact() {
  const target = findLoot();
  if (!target || target.distance > LOOT.reach || medFull(target.item)) return;
  const { item } = target;
  const taken=collectItem(player,item.kind,item.amount);
  if(!taken)return;
  item.amount-=taken;item.taken=item.amount===0;item.m.visible=!item.taken;
  if(item.kind==='ammo'||item.kind==='rifleAmmo')sfx.pickup();else sfx.thud(.25,0);
  $('loot-toast').textContent='+'+taken+' '+ITEMS[item.kind].name.toLowerCase();
  updateAmmo();

  lootToastTime = 1.5;
  updateMeds(); updateLoot();
}
// H uses a medkit: it is spent at once and the health lands when the use finishes; the pistol is lowered meanwhile.
function heal() {
  if (game.inventoryOpen || !game.started || game.dead || player.hp <= 0 || player.healing > 0 || player.reloading > 0 || player.switching > 0 || player.medkits <= 0 || player.hp >= 100) return;
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
  if (game.inventoryOpen || !game.started || game.dead || jumpHeight > 0.001 || verticalSpeed > 0) return;
  crouchWanted = false;
  verticalSpeed = PLAYER_CONTROL.jumpSpeed;
  player.airborne = true;
  sfx.jump();
}
function toggleCrouch() {
  if (game.inventoryOpen || !game.started || game.dead || jumpHeight > 0.001 || verticalSpeed > 0) return;
  crouchWanted = !crouchWanted;
  if (crouchWanted) sprintWanted = false;
}
const lookScale = () => 1 - aimBlend * 0.55;
function setAim(active) {
  if (game.inventoryOpen || !game.started || game.dead) return;
  aimWanted = active;
  if (active) sprintWanted = false;
}
function toggleSprint() {
  if (game.inventoryOpen || !game.started || game.dead) return;
  sprintWanted = !sprintWanted;
  if (sprintWanted) { aimWanted = false; crouchWanted = false; }
}
// holding: the trigger is still down from an earlier shot. Automatic weapons keep firing; an empty
// magazine clicks once per press and reloads if there are rounds to load.
function fire(holding = false) {
  if (game.inventoryOpen || !game.started || game.dead || player.cool > 0 || player.reloading > 0 || player.healing > 0 || player.switching > 0) return;
  const w = weapon();
  if (holding && !w.auto) return;
  if (holding && player.ammo <= 0) { reload(); return; }
  sprintWanted = false;
  if (sprintBlend > 0.08) { shotQueued = true; return; } // Raise the weapon before the shot can leave it.
  shotQueued = false;
  if (player.ammo <= 0) { sfx.dry(); if (player.spare <= 0) sfx.voice('empty'); player.cool = 0.25; if (player.spare > 0) reload(); return; }
  // Carry a little of the cooldown overshoot so automatic fire keeps its rate at any frame rate.
  player.ammo--; player.cool = (player.cool > -0.05 ? player.cool : 0) + w.interval; player.kick = w.kick; sfx[w.sound]();
  if (w.climb) { player.pitch = clamp(player.pitch + w.climb, -1.3, 1.3); player.yaw += (Math.random() - 0.5) * 2 * w.yaw; }
  const { flash, light } = held[player.weapon];
  flash.visible = true; flash.material.rotation = Math.random() * 6; light.intensity = 420; setTimeout(() => { flash.visible = false; light.intensity = 0; }, 55);
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
    best.hp -= best.hitY > 1.5 ? w.headshot : w.damage; best.hitT = 0.25; hitZombieVisual(best.visual); best.alert = 12; sfx.thud(0.5, 0);
    if (best.hp <= 0) { best.dead = 0.001; best.path = []; best.navPending = null; player.kills++; $('kills').textContent = player.kills; }
  }
}
function reload() { if (game.inventoryOpen || player.reloading > 0 || player.healing > 0 || player.switching > 0 || player.ammo === weapon().mag || player.spare <= 0 || game.dead) return; aimWanted = sprintWanted = shotQueued = false; player.reloading = weapon().reload; sfx.reload(); sfx.voice('reload'); }
// Changing weapon is refused while reloading or healing. It drops aim; the held weapon lowers, and
// the new one is taken in hand halfway through and rises.
const order = Object.keys(WEAPONS);
function selectWeapon(id) {
  if (game.inventoryOpen || !game.started || game.dead || !WEAPONS[id] || id === player.weapon || player.switching > 0 || player.reloading > 0 || player.healing > 0) return false;
  aimWanted = shotQueued = false;
  player.switchTo = id; player.switching = WEAPON_SWITCH; sfx.swap();
  return true;
}
const nextWeapon = () => order[(order.indexOf(player.switching > 0 ? player.switchTo : player.weapon) + 1) % order.length];
function updateAmmo() {
  const w = weapon();
  $('gunname').textContent = w.name;
  $('rounds').textContent = player.reloading > 0 || player.switching > 0 ? '--' : player.ammo;
  $('ammonote').textContent = player.reloading > 0 ? 'reloading' : `${player.spare} spare`;
  $('swap').textContent = WEAPONS[nextWeapon()].short;
  $('swap').setAttribute('aria-label', 'Switch to the ' + WEAPONS[nextWeapon()].name);
}
function begin() {
  if (!game.ready) return;
  audioStart();
  game.inventoryOpen=false;$('inventory').hidden=true;
  resetInput();
  jumpHeight = verticalSpeed = crouchBlend = landingDip = 0; player.airborne = player.crouching = false;
  if (game.dead) { game.dead = false; Object.assign(player, { x: 41, z: 44, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, weapon: START_WEAPON, switchTo: START_WEAPON, switching: 0, guns: newArsenal(), kills: 0, reloading: 0, cool: 0, kick: 0, medkits: MEDKIT.start, healing: 0, hunger: 100, thirst: 100, supplies: newSupplies(), equipment: newEquipment() }); showHeld(); pickups.forEach(p => { p.taken = false; p.m.visible = true; p.amount=ITEMS[p.kind].amount; }); $('kills').textContent = '0'; zombies.forEach(z => placeZombie(z, 30)); }
  game.started = true; $('veil').hidden = true; fp.visible = true;
  for (const id of ['tally', 'cross', 'vitals', 'ammo', 'bag', 'needs']) $(id).hidden = false;
  updateAmmo();
  if (game.touchMode) { for (const id of ['touch', 'fire', 'reload', 'flashlight', 'aim', 'sprint', 'heal', 'jump', 'crouch', 'swap']) $(id).hidden = false; }
  else { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-to-look still works */ } }
}
$('go').addEventListener('click', begin);
addEventListener('touchstart', () => { game.touchMode = true; }, { once: true, passive: true });
addEventListener('keydown', e => { if(game.inventoryOpen)return; keys[e.code] = true; if (e.code === 'Space') { e.preventDefault?.(); if (!e.repeat) jump(); } if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !e.repeat) { e.preventDefault?.(); toggleCrouch(); } if (e.code === 'KeyE' && !e.repeat) interact(); if (e.code === 'KeyH' && !e.repeat) heal(); if (e.code === 'KeyR') reload(); if (e.code === 'KeyQ' && !e.repeat) setAim(!aimWanted); if (e.code === 'KeyF' && !e.repeat) toggleTorch(); if ((e.code === 'Digit1' || e.code === 'Numpad1') && !e.repeat) selectWeapon(order[0]); if ((e.code === 'Digit2' || e.code === 'Numpad2') && !e.repeat) selectWeapon(order[1]); if (e.code === 'Enter' && !game.started && !$('go').disabled) begin(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let dragging = false;
canvas.addEventListener('mousedown', e => {
  if (game.inventoryOpen || !game.started || game.dead) return;
  if (e.button === 2) { setAim(true); return; }
  if (e.button !== 0) return;
  if (document.pointerLockElement === canvas) { game.firing = true; fire(); }
  else { dragging = true; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } game.firing = true; fire(); }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (e.button === 2) setAim(false); else if (e.button === 0) { dragging = false; game.firing = false; } });
addEventListener('mousemove', e => {
  if (game.inventoryOpen || !game.started || game.dead) return;
  if (document.pointerLockElement === canvas || dragging) { player.yaw -= e.movementX * 0.0022 * lookScale(); player.pitch = clamp(player.pitch - e.movementY * 0.0022 * lookScale(), -1.3, 1.3); }
});
// touch: left half is a floating stick, right half looks
const touch = $('touch'), stick = $('stick'); let moveId = null, lookId = null, mo = [0, 0], lp = [0, 0];
touch.addEventListener('touchstart', e => {
  if(game.inventoryOpen)return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.45 && moveId === null) { moveId = t.identifier; mo = [t.clientX, t.clientY]; stick.hidden = false; stick.style.left = t.clientX - 48 + 'px'; stick.style.top = t.clientY - 48 + 'px'; stick.firstElementChild.style.transform = ''; }
    else if (lookId === null) { lookId = t.identifier; lp = [t.clientX, t.clientY]; }
  }
}, { passive: false });
touch.addEventListener('touchmove', e => {
  if(game.inventoryOpen)return;
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
  if (game.inventoryOpen || fireId !== null || !game.started || game.dead) return;
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
for (const [id, action] of [['aim', () => setAim(!aimWanted)], ['sprint', toggleSprint], ['heal', heal], ['jump', jump], ['crouch', toggleCrouch], ['swap', () => selectWeapon(nextWeapon())]]) {
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
  if(game.inventoryOpen || document.hidden){updateInventoryUI();return;}
  if(game.started&&!game.dead)updateSurvival(player,dt);
  updateInventoryUI();
  let fx = 0, fz = 0;
  if (game.started && !game.dead) { fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + move.x; fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + move.y; }
  const l = Math.hypot(fx, fz);
  const w = weapon();
  const aiming = aimWanted && player.reloading <= 0 && player.healing <= 0 && player.switching <= 0 && game.started && !game.dead;
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
  camera.fov = MOVEMENT.hipFov + (w.adsFov - MOVEMENT.hipFov) * aimBlend + 3 * sprintBlend;
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
  if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) { const take = Math.min(w.mag - player.ammo, player.spare); player.ammo += take; player.spare -= take; } }
  if (player.switching > 0) {
    player.switching = Math.max(0, player.switching - dt);
    if (player.switching <= WEAPON_SWITCH / 2 && player.switchTo !== player.weapon) { player.weapon = player.switchTo; showHeld(); }
  }
  const indoors = !!roomAt(player.x, player.z);
  if (indoors !== torchAuto) { torchAuto = indoors; if (!torchManual) torchOn = indoors; } // the torch comes on by itself indoors; F overrides
  $('flashlight').setAttribute('aria-pressed', String(torchOn));
  $('flashlight').textContent = torchOn ? 'LIGHT ON' : 'LIGHT OFF';
  torch.intensity += ((torchOn && game.started ? TORCH_POWER : 0) - torch.intensity) * Math.min(1, dt * 10);
  if (player.healing > 0) { player.healing -= dt; if (player.healing <= 0) { player.healing = 0; if (player.hp > 0) player.hp = Math.min(100, player.hp + MEDKIT.heal); } }
  const bob = Math.sin(player.bob * 2) * 0.022 * Math.min(1, sp / MOVEMENT.walk) * (1 - aimBlend * 0.9) * (player.airborne ? 0 : 1) * (1 - 0.6 * crouchBlend);
  camera.position.set(player.x, player.y + PLAYER_CONTROL.standEye + jumpHeight - (PLAYER_CONTROL.standEye - PLAYER_CONTROL.crouchEye) * crouchBlend + bob - landingDip, player.z);
  camera.rotation.set(player.pitch + player.kick * 0.035, player.yaw, 0);
  const rl = player.reloading > 0 ? Math.sin(Math.min(1, (w.reload - player.reloading) / w.reload) * Math.PI) : 0;
  const hl = player.healing > 0 ? Math.sin(Math.min(1, (MEDKIT.time - player.healing) / MEDKIT.time) * Math.PI) * 0.8 : 0, rp = w.reloadPose;
  const sw = player.switching > 0 ? Math.sin((1 - player.switching / WEAPON_SWITCH) * Math.PI) : 0; // 0 in hand, 1 fully lowered
  const mv = Math.min(1, sp / MOVEMENT.walk), steady = 1 - aimBlend, ads = w.ads, turn = w.hipTurn;
  // The whole grip moves together. ADS seats the actual front/rear sights on
  // the camera axis; sprint lowers and rolls the weapon with a running cadence.
  fp.position.set(
    ads[0] * aimBlend + 0.045 * sprintBlend + Math.cos(player.bob) * (0.006 * mv * steady + 0.012 * sprintBlend) + 0.05 * sw,
    ads[1] * aimBlend + 0.015 * sprintBlend + bob * 0.3 * steady - landingDip * 0.45 - rl * rp[0] - hl * 0.3 - 0.32 * sw - player.kick * 0.004,
    ads[2] * aimBlend + 0.025 * sprintBlend + player.kick * 0.035);
  fp.rotation.set(
    turn[0] * steady + player.kick * (0.07 - 0.04 * aimBlend) - rl * rp[1] - hl * 0.55 - 0.7 * sw - 0.16 * sprintBlend + Math.sin(player.bob * 2) * 0.025 * sprintBlend,
    turn[1] * steady + Math.sin(player.bob) * 0.006 * mv * steady,
    turn[2] * steady + 0.25 * sprintBlend + Math.cos(player.bob) * 0.018 * sprintBlend + rl * rp[2] + 0.3 * sw);
  if (player.hp <= 0 && !game.dead && game.started) {
    game.dead = true; game.started = false; game.inventoryOpen=false; $('inventory').hidden=true; $('bag').hidden=true; $('needs').hidden=true; player.healing = 0; jumpHeight = verticalSpeed = landingDip = 0; player.airborne = false; resetInput(); if (document.exitPointerLock) document.exitPointerLock();
    $('title').textContent = 'They got you'; $('blurb').textContent = `You put down ${player.kills} before the avenue took you.`; $('go').textContent = 'Go again'; $('veil').hidden = false;
    for (const id of ['touch', 'fire', 'reload', 'flashlight', 'aim', 'sprint', 'heal', 'jump', 'crouch', 'swap', 'stick', 'cross']) $(id).hidden = true; fp.visible = false;
  }
  updateLoot(dt);
  if (shotQueued && sprintBlend <= 0.08) fire();
  else if (game.firing) fire(true);
  $('hpfill').style.width = clamp(player.hp, 0, 100) + '%'; updateMeds();
  updateAmmo();
}

// main.js hands over each weapon's prepared model and the arm rig posed for it.
function installWeapon(id, model, arms) { held[id].gun.add(model); held[id].group.add(arms); }

export { installWeapon, fp, gun, held, pickups, fire, reload, heal, begin, selectWeapon, updatePlayer };

installInventoryUI({resetInput,heal});
