// Frame loop and model loading.
import { Vector2 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { $ } from './util.js';
import { renderer, scene, camera, SUN_DIR, sky, sun, composer, grade } from './render.js';
import { rooms, roomAt, collide, rayWorld } from './world.js';
import { litLamps, ash } from './streets.js';
import { player, zombies, game, clock } from './state.js';
import { updateZombie } from './zombies.js';
import { fp, held, pickups, fire, begin, selectWeapon, updatePlayer, installWeapon, pollController } from './player.js';
import { buildArms, POSES } from './arms.js';
import { buildPistol, buildRifle } from './weapon-model.js';
import { WEAPONS } from './data.js';
import { initZombies } from './zombies.js';

import { updateNavigation } from './navigation.js';

let idleT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  pollController(dt);
  if (!game.started && !game.dead) { idleT += dt; player.yaw = Math.sin(idleT * 0.12) * 0.22; player.pitch = 0.05; }
  if(!game.inventoryOpen && !document.hidden) {
    updatePlayer(dt);
    updateNavigation();
    for (const z of zombies) updateZombie(z, dt);
  }
  sky.position.copy(camera.position);
  const tx = Math.round(player.x / 2) * 2, tz = Math.round(player.z / 2) * 2;
  sun.target.position.set(tx, 0, tz - 10); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 260);
  for (const L of litLamps) { L.t += dt; const fl = Math.sin(L.t * 31) * Math.sin(L.t * 7.3) > 0.72 ? 0.25 : 1; L.light.intensity = L.base * fl; L.bulb.visible = fl > 0.5; }
  { const a = ash.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let x = a.getX(i) + dt * 0.35, y = a.getY(i) + dt * (0.08 + (i % 5) * 0.03), z = a.getZ(i) + dt * 0.12; if (x > 15) x -= 30; if (y > 15) y -= 30; if (z > 15) z -= 30; a.setXYZ(i, x, y, z); } a.needsUpdate = true; ash.position.set(Math.round(player.x / 30) * 30, 6, Math.round(player.z / 30) * 30); }
  grade.uniforms.time.value = t % 10; grade.uniforms.hurt.value = Math.max(player.hurt, game.dead ? 0.7 : 0);
  composer.render(dt);
  if (!window.__manual) requestAnimationFrame(frame);
}
frame();

// Load arms separately: replacing the zombies must not replace the player's rig.
const loader = new GLTFLoader();
async function loadModel(name) {
  try { return await loader.loadAsync('assets/' + name + '.glb'); }
  catch (error) {
    // Artifact builds embed GLBs in modules; normal static hosting serves the files.
    const module = await import('../' + name + '-data.js');
    const binary = atob(module.default), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return loader.parseAsync(bytes.buffer, '');
  }
}
// Compile every shader and upload every texture and buffer now, behind the loading screen. Three.js does this on
// first sight, so on a phone the first shot (the muzzle flash sprite), the first look down a new street, the first
// weapon switch and entering the city (the held weapon's muzzle light changes the light count, which recompiles
// every lit material) each stalled the GPU mid-play. One render per light setup, with frustum culling off, into a
// tiny frame: shaders, textures and buffers do not depend on its size.
function prewarm() {
  const culled = [], size = renderer.getSize(new Vector2());
  composer.setSize(32, 18);
  for (const L of litLamps) L.bulb.visible = true; // flickering bulbs; the next frame sets them again
  scene.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  const shown = fp.visible;
  fp.visible = false; composer.render(0); // title and death screens: no weapon in hand
  fp.visible = true;
  for (const id in held) {
    for (const other in held) held[other].group.visible = other === id;
    held[id].flash.visible = true; composer.render(0); held[id].flash.visible = false;
  }
  for (const id in held) held[id].group.visible = id === player.weapon;
  fp.visible = shown;
  for (const o of culled) o.frustumCulled = true;
  composer.setSize(size.x, size.y);
}
let loading = false;
async function loadAssets() {
  if (loading || game.ready) return;
  loading = true; $('go').disabled = true; $('go').textContent = 'Loading the city';
  try {
    const [arms, pistol, rifle, zombie] = await Promise.all([
      loadModel('walker'), loadModel(WEAPONS.makarov.model), loadModel(WEAPONS.ak47.model), loadModel('city-zombie')
    ]);
    // One arm rig per weapon, each posed onto its own grip.
    installWeapon('makarov', buildPistol(pistol), buildArms(arms.scene, POSES.makarov));
    installWeapon('ak47', buildRifle(rifle), buildArms(arms.scene, POSES.ak47));
    initZombies(zombie);
    prewarm();
    game.ready = true; $('go').textContent = 'Enter the city'; $('note').textContent = 'Sound starts when you enter.';
  } catch (error) {
    console.error('Game models failed to load:', error);
    $('go').textContent = 'Retry loading'; $('note').textContent = 'A model could not load. Tap Retry loading to try again.';
  } finally { loading = false; $('go').disabled = false; }
}
$('go').addEventListener('click', () => { if (!game.ready) loadAssets(); });
loadAssets();

window.__game = { updateNavigation, updateZombie, updatePlayer, player, zombies, camera, begin, frame, fire, selectWeapon, fp, game, renderer, rooms, pickups, collide, roomAt, rayWorld };
