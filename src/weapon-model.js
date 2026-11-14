import * as THREE from 'three';
// Reuse the assembled CC0 Makarov and keep the existing hand/grip coordinates.
export function buildPistol(gltf) {
  const model = gltf.scene;
  const magazine = model.getObjectByName('Magazine');
  if (!magazine || !model.getObjectByName('Body')) throw new Error('Unexpected Makarov hierarchy');
  // This source export parks its magazine 10 cm behind the grip.
  // Seat that one component once; preserve every other authored transform.
  magazine.position.z -= 0.1;
  model.scale.setScalar(1.15);
  model.position.set(-0.0048, -0.014, -0.04);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.envMapIntensity = 0.65;
  });
  model.updateMatrixWorld(true);
  return model;
}
// The CC0 AK-47 is authored at real scale with its muzzle toward -z, as the camera looks;
// it needs no re-seating. Its finish is fully metallic in the source, so it reflects the bright
// dusk sky far more than the pistol does: turn the reflections well down or the magazine reads as white.
export function buildRifle(gltf) {
  const model = gltf.scene;
  if (!model.getObjectByName('AK_47') || !model.getObjectByName('Magazine')) throw new Error('Unexpected AK-47 hierarchy');
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.envMapIntensity = 0.25; m.metalness = 0.6; }
  });
  // The authored front post is 1.5 mm wide, about two pixels when aiming: sleeve it in a slightly
  // thicker matte post with the same tip height so it reads inside the rear notch.
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.0145, 0.003), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 }));
  post.name = 'FrontPost'; post.position.set(-0.0026, 0.04475 - 0.00725, -0.29); model.add(post);
  model.updateMatrixWorld(true);
  return model;
}
