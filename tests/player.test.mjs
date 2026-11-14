import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { MOVEMENT, LOOT, PLAYER_CONTROL } from '../src/data.js';
function setup(pickSpots = []) {
 const elements=new Map(),events={};
 function el(id) { if(!elements.has(id))elements.set(id,{hidden:true,style:{},firstElementChild:{style:{}},handlers:{},attrs:{},addEventListener(n,f){(this.handlers[n]??=[]).push(f);},setAttribute(k,v){this.attrs[k]=v;},emit(n,e={}){for(const f of this.handlers[n]||[])f(e);}});return elements.get(id); }
 const player={x:41,z:44,y:0,yaw:0,pitch:0,hp:100,hurt:0,ammo:12,spare:24,kills:0,reloading:0,cool:0,bob:0,kick:0};
 const game={ready:true,started:false,dead:false,touchMode:true,firing:false};
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const context={PLAYER_CONTROL,LOOT,MOVEMENT,THREE,player,game,camera,scene,canvas:el('view'),$:el,rnd:()=>0.5,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 MAG_SIZE:12,START_SPARE:24,AMMO_BOX:12,pickSpots,zombies:[],clock:{elapsedTime:0},GUN_POS:new THREE.Vector3(),
 groundY:()=>0,roomAt:()=>null,collide:()=>{},rayWorld:()=>140,hitZombieVisual:()=>{},buildPistol:()=>new THREE.Group(),placeZombie:()=>{},audioStart:()=>{},
 sfx:{dry(){},shot(){},reload(){},thud(){},jump(){},land(){},pickup(){},voice(){},stopVoice(){}},mkCanvas:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})}),
 document:{getElementById:el,addEventListener(n,f){events[n]=f;},hidden:false},
 addEventListener(n,f){(events[n]??=[]).push(f);},innerWidth:800,setTimeout:()=>0,Math};
 const source=fs.readFileSync(new URL('../src/player.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace(/^export .*;$/gm,'');
 vm.runInNewContext(source+'\nglobalThis.api={begin,updatePlayer,torch,resetInput,fire,reload,fp,pickups,interact,jump,toggleCrouch};',context);
 return {context,el,events,player,game,camera,api:context.api};
}
test('flashlight attached, mobile toggle controls intensity and preserves manual choice',()=>{
 const {api,camera,el}=setup();api.begin();
 assert.equal(api.torch.parent,camera);assert.equal(api.torch.target.parent,camera);
 assert.equal(el('flashlight').hidden,false);
 el('flashlight').emit('touchstart',{preventDefault(){}});
 api.updatePlayer(0.1);assert.equal(api.torch.intensity,95);
 assert.equal(el('flashlight').attrs['aria-pressed'],'true');
 el('flashlight').emit('touchstart',{preventDefault(){}});
 api.updatePlayer(0.1);assert.equal(api.torch.intensity,0);
});
test('move while dragging fire, cancel firing, and reset on blur/death/restart',()=>{
 const {api,el,events,player,game}=setup();api.begin();
 const touch=(identifier,x,y)=>({identifier,clientX:x,clientY:y});
 const event=t=>({preventDefault(){},changedTouches:[t]});
 el('touch').emit('touchstart',event(touch(1,100,200)));
 el('touch').emit('touchmove',event(touch(1,100,154)));
 el('fire').emit('touchstart',event(touch(2,700,200)));
 el('fire').emit('touchmove',event(touch(2,720,190)));
 assert.ok(player.yaw<0);assert.ok(player.pitch>0);assert.equal(player.ammo,11);
 api.updatePlayer(0.05);assert.ok(player.z<44);
 el('fire').emit('touchcancel',event(touch(2,720,190)));assert.equal(game.firing,false);
 for(const f of events.blur)f();
 const before=player.z;api.updatePlayer(0.05);assert.equal(player.z,before);
 player.hp=-1;api.updatePlayer(0.01);assert.equal(game.dead,true);assert.equal(el('flashlight').hidden,true);
 player.reloading=0.8;api.begin();assert.equal(player.reloading,0);assert.equal(player.ammo,12);
});

test('mobile sprint is explicit, forward-only, and ADS takes priority with slower look',()=>{
 const {api,el,events,player,camera}=setup();api.begin();
 const key=(code)=>events.keydown.forEach(f=>f({code}));
 key('KeyW'); let z=player.z;api.updatePlayer(.1);assert.ok(Math.abs(z-player.z-0.25)<1e-8);
 el('sprint').emit('click');z=player.z;api.updatePlayer(.1);assert.ok(Math.abs(z-player.z-0.56)<1e-8);
 assert.equal(player.sprinting,true);assert.ok(api.fp.rotation.x<-.07);
 el('aim').emit('click');z=player.z;for(let i=0;i<20;i++)api.updatePlayer(.05);
 assert.equal(player.sprinting,false);assert.equal(player.aiming,true);
 assert.ok(Math.abs(z-player.z-1.5)<1e-7);assert.ok(Math.abs(camera.fov-52)<.01);
 assert.ok(Math.abs(api.fp.position.y-.0772)<.001);
 assert.equal(el('aim').attrs['aria-pressed'],'true');
 el('aim').emit('click');events.keyup.forEach(f=>f({code:'KeyW'}));key('KeyS');el('sprint').emit('click');
 z=player.z;api.updatePlayer(.1);assert.equal(player.sprinting,false);assert.ok(Math.abs(player.z-z-.25)<1e-8);
 for(const f of events.blur)f();assert.equal(player.aiming,false);assert.equal(camera.fov,68);
});
test('sprint-to-fire raises weapon before consuming ammo; reload and death clear modes',()=>{
 const {api,el,events,player,game}=setup();api.begin();events.keydown.forEach(f=>f({code:'KeyW'}));
 el('sprint').emit('click');for(let i=0;i<10;i++)api.updatePlayer(.05);
 api.fire();assert.equal(player.ammo,12);
 for(let i=0;i<8;i++)api.updatePlayer(.05);assert.equal(player.ammo,11);assert.equal(player.sprinting,false);
 el('aim').emit('click');api.updatePlayer(.1);assert.equal(player.aiming,true);
 api.reload();api.updatePlayer(.05);assert.equal(player.aiming,false);
 player.hp=-1;api.updatePlayer(.05);assert.equal(game.dead,true);assert.equal(el('aim').hidden,true);assert.equal(el('sprint').hidden,true);
 api.begin();assert.equal(player.aiming,false);assert.equal(player.sprinting,false);
});
test('right mouse aims without firing and ADS reduces mouse sensitivity',()=>{
 const {api,el,events,player,context}=setup();api.begin();context.document.pointerLockElement=el('view');
 el('view').emit('mousedown',{button:2});for(let i=0;i<20;i++)api.updatePlayer(.05);
 assert.equal(player.ammo,12);assert.equal(player.aiming,true);
 events.mousemove.forEach(f=>f({movementX:100,movementY:0}));assert.ok(Math.abs(player.yaw)<.11);
 events.mouseup.forEach(f=>f({button:2}));api.updatePlayer(.1);assert.equal(player.aiming,false);
});

test('ammo never auto-collects; looking at reachable loot reveals a deliberate single pickup',()=>{
 const {api,el,player}=setup([new THREE.Vector3(41,1,43.2)]);api.begin();
 player.pitch=-Math.atan2(.68,.8);
 for(let i=0;i<30;i++)api.updatePlayer(.05);
 assert.equal(player.spare,24);assert.equal(api.pickups[0].taken,false);
 assert.equal(el('loot').hidden,false);assert.equal(el('loot-name').textContent,'PISTOL AMMO');
 assert.equal(el('loot-amount').textContent,'12 rounds');assert.equal(el('interact').disabled,false);
 el('interact').emit('touchstart',{preventDefault(){}});
 assert.equal(player.spare,36);assert.equal(api.pickups[0].taken,true);assert.equal(api.pickups[0].m.visible,false);
 el('interact').emit('click');assert.equal(player.spare,36);
 assert.equal(el('loot').hidden,true);assert.equal(el('loot-toast').hidden,false);
});
test('loot requires line of sight and reach; turning away or death invalidates interaction',()=>{
 const {api,el,player,context}=setup([new THREE.Vector3(41,1,40)]);api.begin();
 player.pitch=-Math.atan2(.68,4);api.updatePlayer(.01);
 assert.equal(el('loot').hidden,false);assert.equal(el('interact').disabled,true);
 api.interact();assert.equal(player.spare,24);
 player.z=42;player.pitch=-Math.atan2(.68,2);api.updatePlayer(.01);
 assert.equal(el('interact').disabled,false);
 context.rayWorld=()=>.5;api.interact();assert.equal(player.spare,24);api.updatePlayer(.01);assert.equal(el('loot').hidden,true);
 context.rayWorld=()=>140;player.yaw=Math.PI;api.updatePlayer(.01);api.interact();assert.equal(player.spare,24);
 player.yaw=0;api.updatePlayer(.01);player.hp=-1;api.updatePlayer(.01);api.interact();assert.equal(player.spare,24);assert.equal(el('loot').hidden,true);
});
test('E collects only the viewed item, and restarting restores collected ammo boxes',()=>{
 const {api,player,events,game}=setup([new THREE.Vector3(41,1,42.5),new THREE.Vector3(41.25,1,42.5)]);api.begin();
 player.pitch=-Math.atan2(.68,1.5);api.updatePlayer(.01);
 events.keydown.forEach(f=>f({code:'KeyE',repeat:false}));assert.equal(player.spare,36);
 assert.equal(api.pickups[0].taken,true);assert.equal(api.pickups[1].taken,false);
 events.keydown.forEach(f=>f({code:'KeyE',repeat:true}));assert.equal(player.spare,36);
 game.dead=true;api.begin();assert.equal(api.pickups[0].taken,false);assert.equal(api.pickups[0].m.visible,true);
});

test('jump follows one grounded arc, rejects double jumps, and lands once',()=>{
 const {api,player,camera,context,el}=setup();api.begin();api.updatePlayer(.01);
 let landings=0,jumps=0;context.sfx.jump=()=>jumps++;context.sfx.land=()=>landings++;
 const ground=camera.position.y;api.jump();api.updatePlayer(.1);const first=camera.position.y;
 assert.ok(first>ground+.3);api.jump();assert.equal(jumps,1);
 let apex=first;for(let i=0;i<30;i++){api.updatePlayer(.025);apex=Math.max(apex,camera.position.y);}
 assert.ok(apex-ground>.75 && apex-ground<.9);assert.equal(landings,1);assert.equal(player.airborne,false);
 assert.ok(Math.abs(camera.position.y-ground)<.02);
 assert.equal(el('jump').hidden,false);api.jump();assert.equal(jumps,2);
 player.hp=-1;api.updatePlayer(.01);assert.equal(el('jump').hidden,true);api.jump();assert.equal(jumps,2);
 api.begin();api.updatePlayer(.01);assert.equal(player.airborne,false);
});
test('crouch lowers the eye and movement speed, sprint and jump stand the player up',()=>{
 const {api,el,events,player,camera}=setup();api.begin();el('crouch').emit('click');
 for(let i=0;i<20;i++)api.updatePlayer(.05);
 assert.equal(player.crouching,true);assert.ok(Math.abs(camera.position.y-1.08)<.01);
 events.keydown.forEach(f=>f({code:'KeyW'}));const before=player.z;api.updatePlayer(.1);
 assert.ok(Math.abs(before-player.z-.12)<1e-6);
 events.keydown.forEach(f=>f({code:'ShiftLeft'}));api.updatePlayer(.1);assert.equal(player.sprinting,false);
 el('sprint').emit('click');api.updatePlayer(.1);assert.equal(player.crouching,false);assert.equal(player.sprinting,true);
 el('crouch').emit('click');api.updatePlayer(.1);api.jump();api.updatePlayer(.1);
 assert.equal(player.crouching,false);assert.equal(player.airborne,true);
});
