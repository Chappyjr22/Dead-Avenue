import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadGeometry} from '../tools/inspect-models.mjs';
import {buildPistol} from '../src/weapon-model.js';
import {buildArms, GUN_POS} from '../src/arms.js';
import {prepareZombieModel,createZombieVisual,resetZombieVisual,hitZombieVisual,updateZombieVisual} from '../src/zombie-visual.js';
const city=await loadGeometry('assets/city-zombie.glb');
test('Makarov is seated, points forward, and keeps the existing arm rig', async()=>{
 const model=buildPistol(await loadGeometry('assets/makarov.glb'));
 const box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3());
 assert.ok(size.z>.15 && size.z<.24);
 const mag=new THREE.Box3().setFromObject(model.getObjectByName('Magazine'));
 const body=new THREE.Box3().setFromObject(model.getObjectByName('Body'));
 assert.ok(mag.intersectsBox(body),'magazine seated in grip');
 const muzzle=new THREE.Box3().setFromObject(model.getObjectByName('Barrel'));
 assert.ok(muzzle.min.z<-.18 && muzzle.max.z<0,'barrel points down camera -Z');
 const arms=buildArms((await loadGeometry('assets/walker.glb')).scene);
 let meshes=0;arms.traverse(o=>{if(o.isSkinnedMesh){meshes++;assert.ok(o.skeleton.bones.length>20);}});
 assert.ok(meshes>0); assert.equal(GUN_POS.z,-.42);
});
test('zombies have independent skeletons and transition through walk, hit, attack, death and respawn',()=>{
 const model=prepareZombieModel(city),a=createZombieVisual(model),b=createZombieVisual(model);
 const bone=o=>{let found;o.traverse(n=>{if(n.isBone && !found)found=n;});return found;};
 assert.notEqual(bone(a.body),bone(b.body));
 updateZombieVisual(a,.5,{speed:.8});assert.equal(a.current,'walk');
 assert.equal(b.current,'idle');
 const before=bone(b.body).quaternion.toArray();
 hitZombieVisual(a);updateZombieVisual(a,.1,{speed:.8});assert.equal(a.current,'hit');
 updateZombieVisual(a,.6,{attacking:true});assert.equal(a.current,'attack');
 updateZombieVisual(a,5,{dead:true});assert.equal(a.current,'death');assert.equal(a.actions.death.paused,true);
 assert.deepEqual(bone(b.body).quaternion.toArray(),before);
 resetZombieVisual(a);assert.equal(a.current,'idle');assert.equal(a.actions.death.isRunning(),false);
 updateZombieVisual(a,.2,{speed:.8});assert.equal(a.current,'walk');
 for(const visual of [a,b]){visual.root.updateMatrixWorld(true);visual.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
});
test('new zombies contain all four required source clips and a derived idle pose',()=>{
 assert.equal(city.animations.length,4);
 const model=prepareZombieModel(city);
 assert.throws(()=>prepareZombieModel({...city,animations:[]}),/missing/);
 assert.equal(model.clips.death.name,'BossDeath');
 assert.ok(model.clips.idle.tracks.length>0);
 // Textures are intentionally skipped only by the geometry test loader.
 assert.ok(city.scene.children.length>0);
});

test('one-handed viewmodel removes left-arm faces and seats the trigger finger', async()=>{
 const arms=buildArms((await loadGeometry('assets/walker.glb')).scene);
 let indexTip;
 arms.updateMatrixWorld(true);
 arms.traverse(o=>{
  if(o.name==='mixamorigRightHandIndex4') indexTip=o.getWorldPosition(new THREE.Vector3());
  if(!o.isSkinnedMesh) return;
  const si=o.geometry.attributes.skinIndex, sw=o.geometry.attributes.skinWeight;
  for(const i of o.geometry.index.array){
   let left=0;
   for(let j=0;j<4;j++) if(/Left(Shoulder|Arm|ForeArm|Hand)/.test(o.skeleton.bones[si.getComponent(i,j)].name)) left+=sw.getComponent(i,j);
   assert.ok(left<=.5,'no visible left-arm geometry');
  }
 });
 assert.ok(indexTip.distanceTo(new THREE.Vector3(.075,-.135,-.50))<.025,'finger reaches the trigger');
});
