import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
function setup() {
 const elements=new Map(),events={};
 function el(id) { if(!elements.has(id))elements.set(id,{hidden:true,style:{},firstElementChild:{style:{}},handlers:{},attrs:{},addEventListener(n,f){(this.handlers[n]??=[]).push(f);},setAttribute(k,v){this.attrs[k]=v;},emit(n,e={}){for(const f of this.handlers[n]||[])f(e);}});return elements.get(id); }
 const player={x:41,z:44,y:0,yaw:0,pitch:0,hp:100,hurt:0,ammo:12,spare:24,kills:0,reloading:0,cool:0,bob:0,kick:0};
 const game={ready:true,started:false,dead:false,touchMode:true,firing:false};
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const context={THREE,player,game,camera,scene,canvas:el('view'),$:el,rnd:()=>0.5,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 MAG_SIZE:12,START_SPARE:24,AMMO_BOX:12,pickSpots:[],zombies:[],clock:{elapsedTime:0},GUN_POS:new THREE.Vector3(),
 groundY:()=>0,roomAt:()=>null,collide:()=>{},rayWorld:()=>140,hitZombieVisual:()=>{},buildPistol:()=>new THREE.Group(),placeZombie:()=>{},audioStart:()=>{},
 sfx:{dry(){},shot(){},reload(){},thud(){}},mkCanvas:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})}),
 document:{getElementById:el,addEventListener(n,f){events[n]=f;},hidden:false},
 addEventListener(n,f){(events[n]??=[]).push(f);},innerWidth:800,setTimeout:()=>0,Math};
 const source=fs.readFileSync(new URL('../src/player.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace(/^export .*;$/gm,'');
 vm.runInNewContext(source+'\nglobalThis.api={begin,updatePlayer,torch,resetInput};',context);
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
