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
