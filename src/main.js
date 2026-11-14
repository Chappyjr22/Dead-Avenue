// Frame loop and model loading.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { $ } from './util.js';
import { renderer, camera, SUN_DIR, sky, sun, composer, grade } from './render.js';
import { rooms, roomAt, collide, rayWorld } from './world.js';
import { litLamps, ash } from './streets.js';
import { player, zombies, game, clock } from './state.js';
import { updateZombie } from './zombies.js';
import { fp, pickups, fire, begin, updatePlayer } from './player.js';
import { buildArms } from './arms.js';
import { initZombies } from './zombies.js';

import { updateNavigation } from './navigation.js';

let idleT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!game.started && !game.dead) { idleT += dt; player.yaw = Math.sin(idleT * 0.12) * 0.22; player.pitch = 0.05; }
  updatePlayer(dt);
  updateNavigation();
  for (const z of zombies) updateZombie(z, dt);
  sky.position.copy(camera.position);
  const tx = Math.round(player.x / 2) * 2, tz = Math.round(player.z / 2) * 2;
  sun.target.position.set(tx, 0, tz - 10); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 260);
  for (const L of litLamps) { L.t += dt; const fl = Math.sin(L.t * 31) * Math.sin(L.t * 7.3) > 0.72 ? 0.25 : 1; L.light.intensity = L.base * fl; L.bulb.visible = fl > 0.5; }
  { const a = ash.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let x = a.getX(i) + dt * 0.35, y = a.getY(i) + dt * (0.08 + (i % 5) * 0.03), z = a.getZ(i) + dt * 0.12; if (x > 15) x -= 30; if (y > 15) y -= 30; if (z > 15) z -= 30; a.setXYZ(i, x, y, z); } a.needsUpdate = true; ash.position.set(Math.round(player.x / 30) * 30, 6, Math.round(player.z / 30) * 30); }
  grade.uniforms.time.value = t % 10; grade.uniforms.hurt.value = Math.max(player.hurt, game.dead ? 0.7 : 0);
  composer.render(dt);
  if (game.firing && game.touchMode) fire();
  if (!window.__manual) requestAnimationFrame(frame);
}
frame();

// ---------------------------------------------------------------- load the game.dead, then open the gate
const loadFail = () => { $('go').disabled = false; $('go').textContent = 'Enter the city'; $('note').textContent = 'The walkers failed to load, so the streets are empty this time.'; };
function onWalker(gltf) {
  fp.add(buildArms(gltf.scene));
  initZombies(gltf);
  $('go').disabled = false; $('go').textContent = 'Enter the city';
}
// The model ships as a .glb in the repo; the published artifact can't serve that type, so it falls back to an embedded copy.
new GLTFLoader().load('assets/walker.glb', onWalker, undefined, () => {
  import('../walker-data.js').then(m => { const bin = atob(m.default), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); new GLTFLoader().parse(buf.buffer, '', onWalker, loadFail); }).catch(loadFail);
});

window.__game = { player, zombies, camera, begin, frame, renderer, rooms, pickups, collide, roomAt, rayWorld };
