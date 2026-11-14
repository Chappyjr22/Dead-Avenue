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
 for(let i=0;i<360;i++)updateZombieVisual(a,1/60,{dead:true});assert.equal(a.current,'ragdoll');assert.equal(a.ragdoll.sleeping,true);
 assert.deepEqual(bone(b.body).quaternion.toArray(),before);
 resetZombieVisual(a);assert.equal(a.current,'idle');assert.equal(a.ragdoll,null);
 updateZombieVisual(a,.2,{speed:.8});assert.equal(a.current,'walk');
 for(const visual of [a,b]){visual.root.updateMatrixWorld(true);visual.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
});
test('new zombies contain all four required source clips and a derived idle pose',()=>{
 assert.equal(city.animations.length,4);
 const model=prepareZombieModel(city);
 assert.throws(()=>prepareZombieModel({...city,animations:[]}),/missing/);
 assert.equal(model.clips.death,undefined);
 assert.ok(model.clips.idle.tracks.length>0);
 // Textures are intentionally skipped only by the geometry test loader.
 assert.ok(city.scene.children.length>0);
});

test('two-handed viewmodel retains its support arm and seated trigger finger', async()=>{
 const arms=buildArms((await loadGeometry('assets/walker.glb')).scene);
 let indexTip, supportVertices=0;
 arms.updateMatrixWorld(true);
 arms.traverse(o=>{
  if(o.name==='mixamorigRightHandIndex4') indexTip=o.getWorldPosition(new THREE.Vector3());
  if(!o.isSkinnedMesh) return;
  const si=o.geometry.attributes.skinIndex, sw=o.geometry.attributes.skinWeight;
  for(const i of o.geometry.index.array){
   let left=0;
   for(let j=0;j<4;j++) if(/Left(Shoulder|Arm|ForeArm|Hand)/.test(o.skeleton.bones[si.getComponent(i,j)].name)) left+=sw.getComponent(i,j);
   if(left>.5) supportVertices++;
  }
 });
 assert.ok(supportVertices>0,'support arm remains visible');
 assert.ok(indexTip.distanceTo(new THREE.Vector3(.075,-.135,-.50))<.025,'finger reaches the trigger');
});

test('ragdolls settle above terrain, retain limb lengths, respect obstacles and reset their skeleton',()=>{
 const model=prepareZombieModel(city),v=createZombieVisual(model);
 v.root.position.set(8,.18,-4);v.root.rotation.y=.7;v.root.scale.setScalar(1.06);
 updateZombieVisual(v,.23,{speed:1});
 v.deathImpulse=new THREE.Vector3(1,0,.3);v.hitHeight=1.65;
 let collisions=0;
 for(let i=0;i<360;i++)updateZombieVisual(v,1/60,{dead:true,ground:()=>.18,collide:p=>{collisions++;p.x=Math.min(p.x,8.8);}});
 assert.ok(collisions>0);assert.ok(v.ragdoll.sleeping);
 for(const p of v.ragdoll.points){
  assert.ok(p.p.toArray().every(Number.isFinite));
  assert.ok(p.p.y>=.18+p.radius-1e-6);
  assert.ok(p.p.x<=8.8+1e-6);
 }
 const hip=v.ragdoll.points.find(p=>p.name==='Hips');
 assert.ok(hip.p.y<.55,'hips collapsed to ground');
 for(const l of v.ragdoll.links) if(l.min===l.max) assert.ok(Math.abs(l.a.p.distanceTo(l.b.p)-l.min)<.045,'constraint length');
 resetZombieVisual(v);v.root.updateMatrixWorld(true);
 const fresh=createZombieVisual(model);resetZombieVisual(fresh);
 for(let i=0;i<v.rest.length;i++) assert.ok(v.rest[i].bone.position.distanceTo(fresh.rest[i].bone.position)<1e-5,'respawn restores idle offsets');
});
