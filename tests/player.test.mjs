import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { MOVEMENT, LOOT, MEDKIT, PLAYER_CONTROL, WEAPONS, START_WEAPON, WEAPON_SWITCH, AMMO_BOX_WEAPON } from '../src/data.js';
import { createPlayer, newArsenal } from '../src/state.js';
function setup(pickSpots = []) {
 const elements=new Map(),events={};
 function el(id) { if(!elements.has(id))elements.set(id,{hidden:true,style:{},firstElementChild:{style:{}},handlers:{},attrs:{},addEventListener(n,f){(this.handlers[n]??=[]).push(f);},setAttribute(k,v){this.attrs[k]=v;},emit(n,e={}){for(const f of this.handlers[n]||[])f(e);}});return elements.get(id); }
 const player=Object.assign(createPlayer(),{pitch:0});
 const game={ready:true,started:false,dead:false,touchMode:true,firing:false};
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const sounds=[];
 const context={MEDKIT,PLAYER_CONTROL,LOOT,MOVEMENT,WEAPONS,START_WEAPON,WEAPON_SWITCH,AMMO_BOX_WEAPON,newArsenal,THREE,player,game,camera,scene,canvas:el('view'),$:el,rnd:()=>0.5,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 AMMO_BOX:12,pickSpots,zombies:[],clock:{elapsedTime:0},
 groundY:()=>0,roomAt:()=>null,collide:()=>{},rayWorld:()=>140,hitZombieVisual:()=>{},placeZombie:()=>{},audioStart:()=>{},
 sfx:{medkit(){},dry(){},shot(){sounds.push('shot');},rifle(){sounds.push('rifle');},swap(){},reload(){},thud(){},jump(){},land(){},pickup(){},voice(){},stopVoice(){}},mkCanvas:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})}),
 document:{getElementById:el,addEventListener(n,f){events[n]=f;},hidden:false},
 addEventListener(n,f){(events[n]??=[]).push(f);},innerWidth:800,setTimeout:()=>0,Math};
 const source=fs.readFileSync(new URL('../src/player.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace(/^export .*;$/gm,'');
 vm.runInNewContext(source+'\nglobalThis.api={begin,updatePlayer,torch,resetInput,fire,reload,fp,held,pickups,interact,heal,jump,toggleCrouch,selectWeapon};',context);
 return {context,el,events,player,game,camera,sounds,api:context.api};
}
test('flashlight attached, mobile toggle controls intensity and preserves manual choice',()=>{
 const {api,camera,el}=setup();api.begin();
 assert.equal(api.torch.parent,camera);assert.equal(api.torch.target.parent,camera);
 assert.equal(el('flashlight').hidden,false);
 el('flashlight').emit('touchstart',{preventDefault(){}});
 api.updatePlayer(0.1);assert.equal(api.torch.intensity,15);
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
const medkit=(x,y,z)=>Object.assign(new THREE.Vector3(x,y,z),{kind:'medkit'});
const press=(events,code)=>events.keydown.forEach(f=>f({code,repeat:false}));
test('health does not regenerate on its own',()=>{
 const {api,player}=setup();api.begin();player.hp=40;
 for(let i=0;i<200;i++)api.updatePlayer(.05);
 assert.equal(player.hp,40);
});
test('looking at a medkit labels it as a medkit and E adds one to the carried count',()=>{
 const {api,el,player,events}=setup([medkit(41,1,42.5),new THREE.Vector3(43,1,42.5)]);api.begin();
 assert.equal(api.pickups[0].kind,'medkit');assert.equal(api.pickups[1].kind,'ammo');
 player.pitch=-Math.atan2(.68,1.5);api.updatePlayer(.01);
 assert.equal(el('loot-name').textContent,'MEDKIT');assert.ok(!/round/i.test(el('loot-amount').textContent));
 assert.ok(!/round/i.test(el('interact').attrs['aria-label']));assert.match(el('interact').attrs['aria-label'],/medkit/i);
 press(events,'KeyE');
 assert.equal(player.medkits,MEDKIT.start+1);assert.equal(player.spare,24);assert.equal(api.pickups[0].taken,true);
 assert.match(el('loot-toast').textContent,/medkit/i);assert.ok(!/round/i.test(el('loot-toast').textContent));
 assert.equal(el('medcount').textContent,`Medkits ${MEDKIT.start+1}/${MEDKIT.max}`);
});
test('at the carry cap the panel says so and the medkit stays put',()=>{
 const {api,el,player,events}=setup([medkit(41,1,42.5)]);api.begin();player.medkits=MEDKIT.max;
 player.pitch=-Math.atan2(.68,1.5);api.updatePlayer(.01);
 assert.equal(el('loot').hidden,false);assert.equal(el('interact').disabled,true);
 assert.match(el('loot-amount').textContent,/no room/i);assert.equal(el('interact').textContent,'CARRYING MAX');
 press(events,'KeyE');api.interact();
 assert.equal(player.medkits,MEDKIT.max);assert.equal(api.pickups[0].taken,false);assert.equal(api.pickups[0].m.visible,true);
});
test('H heals by the configured amount over the use time, spends one medkit, and blocks firing',()=>{
 const {api,player,events,el}=setup();api.begin();player.hp=30;player.medkits=2;
 press(events,'KeyH');
 assert.equal(player.medkits,1);assert.ok(player.healing>0);assert.equal(player.hp,30);
 assert.equal(el('medcount').textContent,'Healing');
 api.fire();assert.equal(player.ammo,12);
 press(events,'KeyH');assert.equal(player.medkits,1); // no second use while one is in progress
 const steps=Math.ceil(MEDKIT.time/.05);
 for(let i=0;i<steps-2;i++)api.updatePlayer(.05);
 assert.equal(player.hp,30);api.fire();assert.equal(player.ammo,12);
 for(let i=0;i<3;i++)api.updatePlayer(.05);
 assert.equal(player.healing,0);assert.equal(player.hp,30+MEDKIT.heal);
 api.fire();assert.equal(player.ammo,11);
 player.hp=90;player.cool=0;press(events,'KeyH');for(let i=0;i<steps+1;i++)api.updatePlayer(.05);
 assert.equal(player.hp,100);assert.equal(player.medkits,0);
});
test('H does nothing at full health or with no medkits',()=>{
 const {api,player,events}=setup();api.begin();
 player.hp=100;player.medkits=2;press(events,'KeyH');
 assert.equal(player.medkits,2);assert.equal(player.healing,0);
 player.hp=50;player.medkits=0;press(events,'KeyH');api.updatePlayer(.05);
 assert.equal(player.medkits,0);assert.equal(player.healing,0);assert.equal(player.hp,50);
});
test('the HEAL button shows and hides with the other touch buttons',()=>{
 const {api,el,player}=setup();api.begin();
 assert.equal(el('heal').hidden,false);player.hp=60;el('heal').emit('touchstart',{preventDefault(){}});
 assert.equal(player.medkits,MEDKIT.start-1);assert.ok(player.healing>0);
 player.hp=-1;api.updatePlayer(.01);assert.equal(el('heal').hidden,true);assert.equal(el('fire').hidden,true);
});
test('dying and going again resets health, medkits, an in-progress heal, and every pickup',()=>{
 const {api,player,events,game}=setup([medkit(41,1,42.5),new THREE.Vector3(41.25,1,42.5)]);api.begin();
 player.pitch=-Math.atan2(.68,1.5);api.updatePlayer(.01);press(events,'KeyE');
 assert.equal(api.pickups[0].taken,true);assert.equal(player.medkits,MEDKIT.start+1);
 player.hp=20;press(events,'KeyH');assert.ok(player.healing>0);
 player.hp=-1;api.updatePlayer(.01);assert.equal(game.dead,true);assert.equal(player.healing,0);
 api.begin();
 assert.equal(player.hp,100);assert.equal(player.medkits,MEDKIT.start);assert.equal(player.healing,0);
 assert.ok(api.pickups.every(p=>!p.taken&&p.m.visible));
 for(let i=0;i<30;i++)api.updatePlayer(.05);assert.equal(player.hp,100);
});

// Weapons: the Makarov and the AK-47 each keep their own rounds; switching, fire modes, damage and restart.
const switchTo=(api,id)=>{const ok=api.selectWeapon(id);for(let i=0;i<Math.ceil(WEAPON_SWITCH/.05)+1;i++)api.updatePlayer(.05);return ok;};
const zombie=(x,z)=>({root:{position:new THREE.Vector3(x,0,z)},hp:3,alert:0,dead:false,visual:{}});
test('the pistol and the rifle keep separate loaded and spare rounds',()=>{
 const {api,player}=setup();api.begin();
 assert.equal(player.weapon,START_WEAPON);assert.equal(player.ammo,WEAPONS.makarov.mag);assert.equal(player.spare,WEAPONS.makarov.spare);
 api.fire();assert.equal(player.ammo,11);
 assert.equal(switchTo(api,'ak47'),true);assert.equal(player.weapon,'ak47');
 assert.equal(player.ammo,30);assert.equal(player.spare,90);
 player.cool=0;api.fire();player.cool=0;api.fire();assert.equal(player.ammo,28);
 api.reload();for(let i=0;i<60;i++)api.updatePlayer(.05);assert.equal(player.ammo,30);assert.equal(player.spare,88);
 switchTo(api,'makarov');assert.equal(player.ammo,11);assert.equal(player.spare,24);
 assert.deepEqual(player.guns,{makarov:{ammo:11,spare:24},ak47:{ammo:30,spare:88}});
});
test('switching takes a moment, is refused mid-reload or mid-heal, drops aim, and works from keys and the touch button',()=>{
 const {api,el,events,player}=setup();api.begin();
 assert.equal(el('swap').hidden,false);assert.equal(el('swap').textContent,'RIFLE');
 el('aim').emit('click');for(let i=0;i<10;i++)api.updatePlayer(.05);assert.equal(player.aiming,true);
 press(events,'Digit2');assert.ok(player.switching>0);api.updatePlayer(.05);assert.equal(player.aiming,false);
 assert.equal(player.weapon,'makarov');api.fire();assert.equal(player.ammo,12,'no shot while changing');
 api.reload();assert.equal(player.reloading,0);
 assert.equal(api.selectWeapon('makarov'),false);
 for(let i=0;i<4;i++)api.updatePlayer(.05);assert.ok(api.fp.position.y<-.25,'weapon lowered halfway through');
 api.updatePlayer(.05);assert.equal(player.weapon,'ak47');assert.equal(api.held.ak47.group.visible,true);assert.equal(api.held.makarov.group.visible,false);
 for(let i=0;i<5;i++)api.updatePlayer(.05);assert.equal(player.switching,0);assert.ok(Math.abs(api.fp.position.y)<.05);
 player.ammo=20;api.reload();assert.ok(player.reloading>0);
 press(events,'Digit1');assert.equal(player.switching,0);assert.equal(player.weapon,'ak47');
 for(let i=0;i<60;i++)api.updatePlayer(.05);
 player.hp=50;press(events,'KeyH');assert.ok(player.healing>0);el('swap').emit('touchstart',{preventDefault(){}});assert.equal(player.switching,0);
 for(let i=0;i<30;i++)api.updatePlayer(.05);
 assert.equal(el('swap').textContent,'PISTOL');el('swap').emit('touchstart',{preventDefault(){}});
 for(let i=0;i<12;i++)api.updatePlayer(.05);assert.equal(player.weapon,'makarov');
 press(events,'Digit1');assert.equal(player.switching,0,'already in hand');
});
test('holding fire empties the rifle at its rate of fire but the pistol fires once per press',()=>{
 const {api,el,events,player,context,sounds}=setup();api.begin();context.document.pointerLockElement=el('view');
 el('view').emit('mousedown',{button:0});for(let i=0;i<30;i++)api.updatePlayer(1/60);
 assert.equal(player.ammo,11,'pistol: one shot for one press');assert.deepEqual(sounds,['shot']);
 events.mouseup.forEach(f=>f({button:0}));
 switchTo(api,'ak47');assert.equal(player.ammo,30);sounds.length=0;
 el('view').emit('mousedown',{button:0});for(let i=0;i<60;i++)api.updatePlayer(1/60);
 const spent=30-player.ammo;assert.ok(spent>=10&&spent<=11,`rifle spent ${spent} in one second`);
 assert.ok(sounds.every(s=>s==='rifle'));assert.equal(sounds.length,spent);
 assert.ok(player.pitch>0.05,'muzzle climbs during a burst');
});
test('the touch FIRE button keeps an automatic rifle firing while held, and a pistol fires once',()=>{
 const {api,el,player,game}=setup();api.begin();
 const t={identifier:3,clientX:700,clientY:300},ev={preventDefault(){},changedTouches:[t]};
 el('fire').emit('touchstart',ev);for(let i=0;i<30;i++)api.updatePlayer(1/60);assert.equal(player.ammo,11);
 el('fire').emit('touchend',ev);assert.equal(game.firing,false);
 switchTo(api,'ak47');el('fire').emit('touchstart',ev);for(let i=0;i<30;i++)api.updatePlayer(1/60);
 assert.ok(30-player.ammo>=5);const left=player.ammo;
 el('fire').emit('touchend',ev);for(let i=0;i<30;i++)api.updatePlayer(1/60);assert.equal(player.ammo,left);
});
test('an emptied rifle stops, reloads from spare and the dry click sounds once',()=>{
 const {api,el,player,context}=setup();api.begin();context.document.pointerLockElement=el('view');
 let dry=0;context.sfx.dry=()=>dry++;
 switchTo(api,'ak47');player.ammo=3;
 el('view').emit('mousedown',{button:0});for(let i=0;i<40;i++)api.updatePlayer(1/60);
 assert.equal(player.ammo,0);assert.ok(player.reloading>0);assert.equal(dry,0);
});
test('rifle body hits put a zombie down in fewer shots than the pistol; headshots kill with either',()=>{
 const shotsToKill=(id,pitch)=>{
  const {api,player,context}=setup();api.begin();if(id!=='makarov')switchTo(api,id);
  const z=zombie(41,40);context.zombies.push(z);player.pitch=pitch;let shots=0;
  while(!z.dead&&shots<10){player.cool=0;player.kick=0;player.pitch=pitch;api.updatePlayer(1e-4);api.fire();shots++;}
  return shots;
 };
 const body=-Math.atan2(.6,4),head=-Math.atan2(-.05,4);
 const pistol=shotsToKill('makarov',body),rifle=shotsToKill('ak47',body);
 assert.equal(pistol,3);assert.equal(rifle,2);assert.ok(rifle<pistol);
 assert.equal(shotsToKill('makarov',head),1);assert.equal(shotsToKill('ak47',head),1);
});
test('the HUD names the weapon in hand and shows its rounds',()=>{
 const {api,el,player}=setup();api.begin();api.updatePlayer(.01);
 assert.equal(el('gunname').textContent,'Makarov');assert.equal(el('rounds').textContent,12);assert.equal(el('ammonote').textContent,'24 spare');
 api.selectWeapon('ak47');api.updatePlayer(.05);assert.equal(el('rounds').textContent,'--');
 for(let i=0;i<12;i++)api.updatePlayer(.05);
 assert.equal(el('gunname').textContent,'AK-47');assert.equal(el('rounds').textContent,30);assert.equal(el('ammonote').textContent,'90 spare');
 assert.equal(el('swap').textContent,'PISTOL');assert.match(el('swap').attrs['aria-label'],/Makarov/);
 player.ammo=10;api.reload();api.updatePlayer(.05);assert.equal(el('ammonote').textContent,'reloading');
});
test('rifle ADS uses its own sight offsets and field of view; ammo boxes still hold pistol rounds',()=>{
 const {api,el,player,camera,events}=setup([new THREE.Vector3(41,1,42.5)]);api.begin();switchTo(api,'ak47');
 el('aim').emit('click');for(let i=0;i<30;i++)api.updatePlayer(.05);
 assert.ok(Math.abs(camera.fov-WEAPONS.ak47.adsFov)<.01);
 WEAPONS.ak47.ads.forEach((v,i)=>assert.ok(Math.abs(api.fp.position.getComponent(i)-v)<.002));
 assert.ok(Math.abs(api.fp.rotation.y)<1e-3);
 el('aim').emit('click');player.pitch=-Math.atan2(.68,1.5);api.updatePlayer(.01);press(events,'KeyE');
 assert.equal(player.spare,90);assert.equal(player.guns[AMMO_BOX_WEAPON].spare,36);
});
test('dying and going again resets both weapons and returns to the pistol',()=>{
 const {api,player,game}=setup();api.begin();
 api.fire();switchTo(api,'ak47');player.cool=0;api.fire();player.spare=5;
 player.hp=-1;api.updatePlayer(.01);assert.equal(game.dead,true);
 api.begin();
 assert.equal(player.weapon,'makarov');assert.equal(player.switching,0);
 assert.deepEqual(player.guns,newArsenal());assert.equal(player.ammo,12);
 assert.equal(api.held.makarov.group.visible,true);assert.equal(api.held.ak47.group.visible,false);
 game.dead=false;player.hp=-1;api.updatePlayer(.01);api.selectWeapon('ak47');player.hp=-1;api.updatePlayer(.05);api.begin();
 assert.equal(player.weapon,'makarov');assert.equal(player.switching,0);
});
