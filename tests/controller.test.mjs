import test from 'node:test';
import assert from 'node:assert/strict';
import {stick,createController} from '../src/controller.js';
const pad=()=>({index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
const press=(p,i,on=true)=>p.buttons[i]={pressed:on,value:on?1:0};
test('radial dead zone eliminates drift and preserves analog magnitude without diagonal boost',()=>{
 assert.deepEqual(stick(.1,-.1),{x:0,y:0});assert.ok(stick(.5,0).x>0&&stick(.5,0).x<.5);
 assert.ok(Math.abs(Math.hypot(...Object.values(stick(1,1)))-1)<1e-9);assert.deepEqual(stick(NaN,undefined),{x:0,y:0});
});
test('button edges fire once per press while held triggers remain readable',()=>{
 const c=createController(),p=pad();c.sample([p],.016);press(p,7);assert.equal(c.sample([p],.016).edge[7],true);
 const held=c.sample([p],.016);assert.equal(held.edge[7],false);assert.equal(held.buttons[7],true);
 press(p,7,false);c.sample([p],.016);press(p,7);assert.equal(c.sample([p],.016).edge[7],true);
});
test('suspend requires neutral controls and prevents held fire on menu exit or refocus',()=>{
 const c=createController(),p=pad();press(p,7);c.sample([p],.016);c.suspend();
 assert.equal(c.sample([p],.016).blocked,true);press(p,7,false);c.sample([p],.016);
 press(p,7);assert.equal(c.sample([p],.016).edge[7],true);
 assert.equal(c.sample([p],.016,false).blocked,true);assert.equal(c.sample([p],.016,true).blocked,true);
});
test('supports sparse slots, hot unplug and reconnection; unmapped pads are not guessed',()=>{
 const c=createController(),p=pad();p.index=2;assert.equal(c.sample([null,null,p],.016).connected,true);
 assert.equal(c.sample([], .016).connected,false);p.mapping='';assert.equal(c.sample([p],.016).unsupported,true);
 p.mapping='standard';assert.equal(c.sample([p],.016).connected,true);
});
test('inventory stick and d-pad repeat after delay without rapid accidental selection',()=>{
 const c=createController(),p=pad();press(p,15);assert.equal(c.sample([p],.016).navigate,1);
 for(let i=0;i<3;i++)assert.equal(c.sample([p],.1).navigate,0);
 assert.equal(c.sample([p],.1).navigate,1);press(p,15,false);c.sample([p],.016);
 p.axes[1]=-.8;assert.equal(c.sample([p],.016).navigate,-4);
});
