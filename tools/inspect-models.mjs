// Geometry-only snapshots for offline fit/pose inspection when WebGL is unavailable.
// Run: node tools/inspect-models.mjs /absolute/output-directory
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildArms, GUN_POS } from '../src/arms.js';
import { buildPistol } from '../src/weapon-model.js';
import { prepareZombieModel, createZombieVisual, updateZombieVisual } from '../src/zombie-visual.js';
globalThis.self = globalThis;
export async function loadGeometry(file) {
 const loader = new GLTFLoader();
 loader.register(() => ({name:'GEOMETRY_INSPECTION',loadTexture:()=>Promise.resolve(null)}));
 const bytes=fs.readFileSync(file);
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function snapshot(root) {
 root.updateMatrixWorld(true);
 const meshes=[];
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(o.isSkinnedMesh)o.skeleton.update();
  const p=o.geometry.attributes.position,c=o.geometry.attributes.color,verts=[],colors=[],v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);
   v.applyMatrix4(o.matrixWorld);verts.push(v.toArray());
   if(c)colors.push([c.getX(i),c.getY(i),c.getZ(i),1]);
  }
  const index=o.geometry.index,faces=[];
  for(let i=0;i<(index?.count??p.count);i+=3)faces.push(index?[index.getX(i),index.getX(i+1),index.getX(i+2)]:[i,i+1,i+2]);
  meshes.push({name:o.name,verts,faces,colors,color:o.material.color?.toArray()??[.4,.4,.4]});
 });
 return meshes;
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]){
 const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
 const arms=await loadGeometry('assets/walker.glb'),pistol=await loadGeometry('assets/makarov.glb'),zombie=await loadGeometry('assets/city-zombie.glb');
 const fp=new THREE.Group(),gun=new THREE.Group();gun.position.copy(GUN_POS);gun.scale.setScalar(.85);gun.add(buildPistol(pistol));fp.add(gun,buildArms(arms.scene));
 fs.writeFileSync(out+'/pistol.json',JSON.stringify(snapshot(fp)));
 const visual=createZombieVisual(prepareZombieModel(zombie));
 updateZombieVisual(visual,0.5,{speed:.8});
 fs.writeFileSync(out+'/zombie-walk.json',JSON.stringify(snapshot(visual.root)));
 updateZombieVisual(visual,0.7,{attacking:true});
 fs.writeFileSync(out+'/zombie-attack.json',JSON.stringify(snapshot(visual.root)));
 updateZombieVisual(visual,5,{dead:true});
 fs.writeFileSync(out+'/zombie-death.json',JSON.stringify(snapshot(visual.root)));
}
