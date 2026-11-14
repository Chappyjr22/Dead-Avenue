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

test('ragdolls tip fully onto the ground for front, back and side hits',()=>{
 const model=prepareZombieModel(city);
 for(let n=0;n<4;n++){
  const v=createZombieVisual(model);
  updateZombieVisual(v,.15+n*.2,{speed:.8});
  v.deathImpulse=new THREE.Vector3(Math.sin(n*Math.PI/2),0,Math.cos(n*Math.PI/2));
  for(let i=0;i<360;i++)updateZombieVisual(v,1/60,{dead:true});
  const {Hips,Spine2,Head}=v.ragdoll.names;
  assert.ok(Hips.p.y<.3 && Spine2.p.y<.3 && Head.p.y<.35,'torso rests on ground rather than kneeling');
  const torso=Spine2.p.clone().sub(Hips.p).normalize();
  assert.ok(Math.abs(torso.y)<.35,'spine settles approximately horizontal');
  assert.ok(v.ragdoll.sleeping);
 }
});

test('joint limits correct reverse knee bends and eject hands from the torso',()=>{
 const v=createZombieVisual(prepareZombieModel(city));
 updateZombieVisual(v,.2,{speed:.8});updateZombieVisual(v,0,{dead:true});
 const r=v.ragdoll,j=r.joints.find(j=>j.leg), frame=r.frameQuaternion(r.names.Hips);
 const front=new THREE.Vector3(0,0,1).applyQuaternion(frame);
 const axis=j.c.p.clone().sub(j.a.p).normalize();
 j.b.p.copy(j.a.p).addScaledVector(axis,j.upper*.7).addScaledVector(front,-.15);
 for(let i=0;i<20;i++)r.solveJoints();
 const bend=j.b.p.clone().sub(j.a.p);bend.addScaledVector(axis,-bend.dot(axis));
 assert.ok(bend.dot(front)>0,'knee is corrected to its permitted bending direction');
 const hand=r.names.LeftHand;
 hand.p.copy(r.names.Spine1.p).add(new THREE.Vector3(.001,0,0));
 r.separateTorso();
 const torso=r.names.Neck.p.clone().sub(r.names.Hips.p);
 const offset=hand.p.clone().sub(r.names.Hips.p);
 const closest=r.names.Hips.p.clone().addScaledVector(torso,THREE.MathUtils.clamp(offset.dot(torso)/torso.lengthSq(),0,1));
 assert.ok(hand.p.distanceTo(closest)>=.17+hand.radius-1e-6);
});

test('hips limit lateral spread separately from forward bending and shoulders relax without a velocity kick',()=>{
 const v=createZombieVisual(prepareZombieModel(city));
 updateZombieVisual(v,.2,{speed:.8});updateZombieVisual(v,0,{dead:true});
 const r=v.ragdoll,frame=r.frameQuaternion(r.names.Hips);
 const side=new THREE.Vector3(1,0,0).applyQuaternion(frame);
 const down=new THREE.Vector3(0,-1,0).applyQuaternion(frame);
 for(const j of r.joints.filter(j=>j.leg)){
  j.b.p.copy(j.a.p).addScaledVector(side,j.side*j.upper);
  j.c.p.copy(j.b.p).addScaledVector(down,j.lower);
 }
 for(let i=0;i<30;i++)r.solveJoints();
 for(const j of r.joints.filter(j=>j.leg)){
  const outward=j.b.p.clone().sub(j.a.p).dot(side)*j.side;
  assert.ok(outward<j.upper*.5,'thigh cannot remain in a sideways split');
 }
 const j=r.joints.find(j=>!j.leg);
 j.b.p.copy(j.a.p).addScaledVector(side,j.side*j.upper);
 j.c.p.copy(j.b.p).addScaledVector(down,j.lower);
 j.b.previous.copy(j.b.p);j.c.previous.copy(j.c.p);
 const before=j.b.p.clone().sub(j.a.p).dot(down);
 r.relaxShoulders();
 assert.ok(j.b.p.clone().sub(j.a.p).dot(down)>before,'arm gently lowers toward torso');
 assert.ok(j.b.p.distanceTo(j.b.previous)<1e-8,'rest bias introduces no launch velocity');
});
