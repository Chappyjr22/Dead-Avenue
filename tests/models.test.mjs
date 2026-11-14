import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadGeometry} from '../tools/inspect-models.mjs';
import {buildPistol,buildRifle} from '../src/weapon-model.js';
import {buildArms, GUN_POS, POSES} from '../src/arms.js';
import {WEAPONS} from '../src/data.js';
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

// The AK-47: real scale, muzzle down camera -Z, its own two-handed arm rig, and iron sights that ADS lines up.
const AK=WEAPONS.ak47;
const rifleModel=async()=>buildRifle(await loadGeometry('assets/weapons/ak47.glb'));
test('AK-47 loads at real scale with its muzzle forward and magazine seated', async()=>{
 const model=await rifleModel();
 const box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3());
 assert.ok(size.z>.85 && size.z<.9,'about 0.88 m long');
 const body=new THREE.Box3().setFromObject(model.getObjectByName('AK_47')),mag=new THREE.Box3().setFromObject(model.getObjectByName('Magazine'));
 assert.ok(mag.intersectsBox(body),'magazine seated in the receiver');
 const trigger=new THREE.Box3().setFromObject(model.getObjectByName('Trigger')).getCenter(new THREE.Vector3());
 assert.ok(box.min.z<-.3 && box.max.z>.5,'muzzle toward -Z, stock toward +Z');
 assert.ok(trigger.z>mag.getCenter(new THREE.Vector3()).z,'trigger sits behind the magazine, so -Z is forward');
 assert.throws(()=>buildRifle({scene:new THREE.Group()}),/AK-47/);
});
const placed=(mount)=>new THREE.Matrix4().compose(new THREE.Vector3(...mount.pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...mount.rot)),new THREE.Vector3().setScalar(mount.scale));
test('rifle arm rig: right hand on the pistol grip with the finger at the trigger, left hand on the handguard, elbows bent the right way', async()=>{
 const arms=buildArms((await loadGeometry('assets/walker.glb')).scene,POSES.ak47);arms.updateMatrixWorld(true);
 const at=n=>arms.getObjectByName('mixamorig'+n).getWorldPosition(new THREE.Vector3()), M=placed(AK.mount), local=p=>new THREE.Vector3(...p).applyMatrix4(M);
 const trigger=local([0,-0.05,0.243]),grip=local([0,-0.09,0.3]),guard=local([0,-0.005,-0.06]);
 assert.ok(at('RightHandIndex4').distanceTo(trigger)<.035,'index finger reaches the trigger');
 assert.ok(at('RightHandMiddle1').distanceTo(grip)<.06,'right hand wraps the pistol grip');
 const leftPalm=at('LeftHandMiddle1');
 assert.ok(leftPalm.distanceTo(guard)<.07,'left hand on the handguard');
 assert.ok(leftPalm.z<local([0,0,0.04]).z,'left hand ahead of the magazine');
 for(const side of ['Right','Left']){
  const S=at(side+'Arm'),E=at(side+'ForeArm'),W=at(side+'Hand');
  const reach=E.distanceTo(S)+W.distanceTo(E);
  assert.ok(W.distanceTo(S)<reach*.999,side+' arm is not stretched past its length');
  const mid=S.clone().lerp(W,.5);assert.ok(E.y<mid.y,side+' elbow hangs below the shoulder-wrist line');
  assert.ok(side==='Right'?E.x>mid.x:E.x<mid.x,side+' elbow points outward, not across the body');
 }
});
test('rifle ADS puts the rear notch and the front sight post on the camera axis', async()=>{
 const fp=new THREE.Group(),gun=new THREE.Group();fp.add(gun);
 gun.position.fromArray(AK.mount.pos);gun.rotation.set(...AK.mount.rot);gun.scale.setScalar(AK.mount.scale);
 fp.position.fromArray(AK.ads);fp.updateMatrixWorld(true);
 const rear=new THREE.Vector3(-0.0026,0.042,0.047).applyMatrix4(gun.matrixWorld),post=new THREE.Vector3(-0.0026,0.04475,-0.29).applyMatrix4(gun.matrixWorld);
 for(const p of [rear,post]){assert.ok(p.z<-.12,'in front of the eye');assert.ok(Math.hypot(p.x,p.y)/-p.z<.002,'within 0.002 rad of the aim point');}
 assert.ok(post.z<rear.z);
 const pistol=WEAPONS.makarov;assert.deepEqual(pistol.mount.pos,[GUN_POS.x,GUN_POS.y,GUN_POS.z]);assert.equal(pistol.ads[0],-GUN_POS.x);
});
