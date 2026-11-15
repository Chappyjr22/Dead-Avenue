import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {loadGeometry} from '../tools/inspect-models.mjs';
import * as visual from '../src/zombie-visual.js';
import { HORDE } from '../src/data.js';
import { newDaytime } from '../src/daynight.js';
const model=visual.prepareZombieModel(await loadGeometry('assets/city-zombie.glb'));
// zombies.js runs against stub world modules: flat road at y 0, pavement at 0.18 for x>10, a wall at x=-1.
function setup(obstacle) {
 const player={x:0,z:6,hp:100},zombies=[],ground=(x)=>x>10?.18:0,walls=[];
 const context={THREE,player,zombies,game:{started:true},clock:{elapsedTime:0},sfx:{groan(){},hurt(){}},scene:{add(){}},COARSE:false,
  rnd:Math.random,rr:(a,b)=>a+(b-a)*.5,pick:a=>a[0],clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lurkSpots:[],AVES:[0,0,0,0,0,0],STS:[0,0,0,0,0,0],
  groundY:ground,insideBuilding:()=>false,collide:obstacle||((p,r)=>{walls.push(p);if(p.x<-1+r)p.x=-1+r;}),rayWorld:()=>140,
  clearSegment:()=>true,requestRoute(){},Math,...visual,
  HORDE,threat:{...HORDE.day,sight:34},daytime:newDaytime(),hordeAt:()=>{},hordeCap:()=>18,activeTarget:()=>18};
 const source=fs.readFileSync(new URL('../src/zombies.js',import.meta.url),'utf8').replace(/^import [\s\S]*?;$/gm,'').replace(/^export .*;$/gm,'').replace(/^export function/gm,'function');
 vm.runInNewContext(source+'\nglobalThis.api={makeZombie,placeZombie,updateZombie,setModel:m=>{zombieModel=m;}};',context);
 const api=context.api; api.setModel(model);
 return {api,player,zombies,walls,ground};
}
// Same state changes as fire() in player.js for a killing shot at height hitY.
function kill(z,hitY){z.hitY=hitY;z.hp=0;z.hitT=.25;z.dead=.001;z.path=[];z.navPending=null;}
const bonesOf=v=>{const out=[];v.body.traverse(b=>{if(b.isBone)out.push(b);});return out;};
function run(api,z,seconds){for(let i=0;i<Math.round(seconds*60);i++)api.updateZombie(z,1/60);}

test('a kill starts a ragdoll, not the death clip, and it falls away from the shooter',()=>{
 const {api,player}=setup(),z=api.makeZombie();
 z.root.position.set(0,0,0);z.heading=0;z.alert=0;run(api,z,.3);
 kill(z,1.2);run(api,z,1/60);
 const v=z.visual;
 assert.equal(v.current,'ragdoll');assert.ok(v.ragdoll);assert.equal(v.actions.death,undefined);
 assert.equal(v.mixer.timeScale,0,'the animation mixer no longer drives the skeleton');
 const chest=v.ragdoll.named.Spine2.p.clone();run(api,z,2);
 // The shooter stands at +z, so the body must end up further along -z.
 assert.ok(v.ragdoll.named.Spine2.p.z<chest.z-.4,'falls away from the shot');
 assert.ok(Math.abs(player.z-6)<1e-9);
});

test('ragdolls settle within three seconds and rest on the road or the pavement',()=>{
 for(const [x,ground] of [[0,0],[14,.18]]) for(const hitY of [.6,1.2,1.7]) for(let k=0;k<3;k++) {
  const {api}=setup(),z=api.makeZombie();
  z.root.position.set(x,ground,0);z.heading=k*2.1;z.alert=0;run(api,z,.2);
  kill(z,hitY);let t=0;
  while(!z.visual.ragdoll?.sleeping && t<4){api.updateZombie(z,1/60);t+=1/60;}
  const r=z.visual.ragdoll;
  assert.ok(r.sleeping && t<=3.05,`settled after ${t.toFixed(2)} s`);
  for(const p of r.points){assert.ok(p.p.toArray().every(Number.isFinite));assert.ok(p.p.y>=ground+p.radius-1e-6,'nothing sinks into the ground');}
  const hips=r.named.Hips.p.y,top=Math.max(...r.points.map(p=>p.p.y));
  assert.ok(hips<ground+.3,`hips rest on the ground (${hips.toFixed(2)})`);assert.ok(top<ground+.6,`lying, not standing (${top.toFixed(2)})`);
  // Once asleep the skeleton stays put.
  const before=bonesOf(z.visual).map(b=>b.getWorldPosition(new THREE.Vector3()));run(api,z,.5);
  bonesOf(z.visual).forEach((b,i)=>assert.ok(b.getWorldPosition(new THREE.Vector3()).distanceTo(before[i])<1e-6));
 }
});

test('limbs keep their length and major joints stay out of walls',()=>{
 const {api,walls}=setup(),z=api.makeZombie();
 z.root.position.set(-.6,0,0);z.heading=Math.PI/2;z.alert=0;run(api,z,.2);
 api.updateZombie(z,1/60);
 const v=z.visual;kill(z,1.3);v.deathImpulse={x:-1,z:0};// shot from +x, falls towards the wall at x=-1
 let worst=0;
 for(let i=0;i<190;i++){api.updateZombie(z,1/60);for(const l of v.ragdoll.links)if(l.min===l.max)worst=Math.max(worst,Math.abs(l.a.p.distanceTo(l.b.p)-l.min));}
 assert.ok(walls.length>0);assert.ok(v.ragdoll.sleeping,"comes to rest against the wall");assert.ok(worst<.08,`bones stretch at most ${worst.toFixed(3)} m`);
 for(const p of v.ragdoll.points){assert.ok(p.p.x>=-1+p.radius-.03-1e-6,`${p.name} stays out of the wall`);}
});

test('a body that dies with its arms inside a car is eased out, not thrown',()=>{
 const car={x:0,z:.9,r:.6};// arms reach forward (+z) into the circle
 const {api}=setup((p,r)=>{const dx=p.x-car.x,dz=p.z-car.z,d=Math.hypot(dx,dz);if(d<car.r+r&&d>1e-6){p.x+=dx/d*(car.r+r-d);p.z+=dz/d*(car.r+r-d);}}),z=api.makeZombie();
 z.root.position.set(0,0,0);z.heading=0;z.alert=0;z.root.rotation.set(0,0,0);api.updateZombie(z,1/60);z.root.position.set(0,0,0);
 kill(z,1.2);z.visual.deathImpulse={x:0,z:1};// shot from behind, into the car
 let fastest=0;
 for(let i=0;i<180;i++){api.updateZombie(z,1/60);if(i>0)for(const p of z.visual.ragdoll.points)fastest=Math.max(fastest,p.p.distanceTo(p.previous)*60);}
 assert.ok(fastest<9.01,`no joint flies off (${fastest.toFixed(1)} m/s)`);
 const r=z.visual.ragdoll;assert.ok(r.sleeping);
 for(const p of r.points)assert.ok(Math.hypot(p.p.x-car.x,p.p.z-car.z)>car.r+p.radius-.05,`${p.name} ends outside the car`);
 assert.ok(r.named.Hips.p.distanceTo(new THREE.Vector3(0,.12,0))<1.6,'the body stays where it fell');
});

test('a headshot snaps the head back before the body lands',()=>{
 const tilt=hitY=>{
  const {api}=setup(),z=api.makeZombie();z.root.position.set(0,0,0);z.heading=0;z.alert=0;run(api,z,.2);
  kill(z,hitY);run(api,z,1/60);const N=z.visual.ragdoll.named,rel=()=>N.Head.p.z-N.Spine2.p.z;// the shot travels along -z
  const start=rel();run(api,z,.12);return rel()-start;
 };
 assert.ok(tilt(1.7)<tilt(1.1)-.05,'the head moves back relative to the chest');
});

test('respawn returns the skeleton to normal animation and a zombie can die twice',()=>{
 const {api}=setup(),z=api.makeZombie(),ref=visual.createZombieVisual(model);
 for(let round=0;round<2;round++){
  z.root.position.set(0,0,0);z.alert=0;kill(z,1.2);
  run(api,z,11);assert.ok(z.root.position.y<-.4,'the body sinks before it is recycled');
  while(z.dead)api.updateZombie(z,1/60);// the dead timer retires it from the streets
  assert.equal(z.active,false);assert.equal(z.root.visible,false);
  api.placeZombie(z,0);// and the horde brings it back
  assert.equal(z.dead,0);assert.equal(z.active,true);assert.equal(z.hp,3);assert.equal(z.visual.ragdoll,null);assert.equal(z.root.visible,true);
  assert.equal(z.visual.mixer.timeScale,1);assert.equal(z.visual.current,'idle');assert.equal(z.visual.deathImpulse,null);
  assert.ok(Math.abs(z.root.position.y)<1e-9,'root back on the ground');assert.equal(z.root.scale.x,z.root.scale.y);
  // Same animated pose as a zombie that never died.
  visual.resetZombieVisual(ref);
  for(const v of [z.visual,ref]){visual.updateZombieVisual(v,.3,{speed:.8});v.body.updateWorldMatrix(true,true);}
  const a=bonesOf(z.visual),b=bonesOf(ref);
  a.forEach((bone,i)=>{assert.ok(bone.position.distanceTo(b[i].position)<1e-4,bone.name);assert.ok(bone.quaternion.angleTo(b[i].quaternion)<1e-3,bone.name);assert.ok(bone.scale.distanceTo(b[i].scale)<1e-6);});
 }
});
