import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer} from '../src/state.js';
import {collectItem,consumeItem,itemCount,updateSurvival,chooseLoot} from '../src/inventory.js';
import {buildLoot} from '../src/loot-model.js';

test('inventory shares reserves, caps stacks, and never converts food to ammunition',()=>{
 const p=createPlayer();p.weapon='ak47';p.guns.makarov.spare=115;
 assert.equal(collectItem(p,'ammo',12),5);assert.equal(p.guns.makarov.spare,120);assert.equal(p.spare,90);
 assert.equal(collectItem(p,'ammo'),0);assert.equal(collectItem(p,'food',10),4);assert.equal(itemCount(p,'food'),5);
 assert.equal(p.spare,90);assert.equal(collectItem(p,'unknown'),0);
});
test('food and drink restore only their need, are consumed once, and cannot be wasted at full stats',()=>{
 const p=createPlayer();assert.equal(consumeItem(p,'food'),false);assert.equal(p.supplies.food,1);
 p.hunger=80;p.thirst=10;assert.equal(consumeItem(p,'food'),true);assert.equal(p.hunger,100);assert.equal(p.thirst,10);
 assert.equal(consumeItem(p,'food'),false);assert.equal(consumeItem(p,'water'),true);assert.equal(p.thirst,55);
 assert.equal(consumeItem(p,'ammo'),false);
});
test('survival drain is time based, sprint costs more, and empty needs cause bounded damage',()=>{
 const p=createPlayer();updateSurvival(p,60);assert.equal(p.hunger,95);assert.ok(Math.abs(p.thirst-93.3333333333)<1e-6);assert.equal(p.hp,100);
 const q=createPlayer();q.sprinting=true;updateSurvival(q,60);assert.equal(q.hunger,93);
 p.hunger=0;p.thirst=0;updateSurvival(p,2);assert.equal(p.hp,98);
 updateSurvival(p,1000);assert.equal(p.hp,0);assert.equal(p.hunger,0);
 const r=createPlayer();r.hunger=1/24;updateSurvival(r,1);assert.equal(r.hp,99.75);
});
test('shop loot includes supplies and both ammo types while retaining pharmacy medkits',()=>{
 const kinds=new Set(Array.from({length:100},(_,i)=>chooseLoot({name:'hardware',medkit:.05},i/100)));
 assert.deepEqual([...kinds].sort(),['ammo','food','medkit','rifleAmmo','water']);
 assert.equal(chooseLoot({name:'pharmacy',medkit:.75},.7),'medkit');
 assert.equal(chooseLoot({name:'grocery',medkit:.2},.4),'food');
 assert.equal(chooseLoot({name:'liquor',medkit:.05},.4),'water');
});
test('all loot models have separate physical silhouettes and targetable packaging',()=>{
 for(const kind of ['ammo','rifleAmmo','food','water','medkit']){
  const model=buildLoot(kind);assert.ok(model.children.length>=3);assert.ok(model.material.isMeshStandardMaterial);
 }
 assert.ok(buildLoot('ammo').children.length>buildLoot('water').children.length);
});
