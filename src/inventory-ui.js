import { player, game } from './state.js';
import { ITEMS, GEAR, itemCount, consumeItem, capacity, usedSlots, inventoryStacks } from './inventory.js';
import { itemArt } from './inventory-art.js';
import { $ } from './util.js';
let selected='food';
let controllerSlot=0;
export function inventoryController(direction,activate=false){
 if(!game.inventoryOpen)return;
 const stacks=inventoryStacks(player);
 if(direction&&stacks.length){
  controllerSlot=Math.max(0,Math.min(stacks.length-1,controllerSlot+direction));
  select(stacks[controllerSlot].kind);
  const cells=$('inventory').querySelectorAll('.inv-cell:not(:disabled)');
  cells[controllerSlot]?.focus();cells[controllerSlot]?.scrollIntoView?.({block:'nearest'});
 }
 if(activate){const use=$('use-'+selected);if(use&&!use.hidden&&!use.disabled)use.click();}
}
const art=k=>itemArt(k);
function select(kind){selected=kind;updateInventoryUI();}
export function updateInventoryUI() {
 $('hunger-value').textContent=Math.ceil(player.hunger)+'%';$('thirst-value').textContent=Math.ceil(player.thirst)+'%';
 $('needs').classList.toggle('low',player.hunger<20||player.thirst<20);
 if(!game.inventoryOpen)return;
 $('pack-stats').textContent=`HEALTH ${Math.ceil(player.hp)} / 100     HUNGER ${Math.ceil(player.hunger)} / 100     THIRST ${Math.ceil(player.thirst)} / 100`;
 $('pack-space').textContent=`${usedSlots(player)} / ${capacity(player)} SLOTS`;
 const stacks=inventoryStacks(player);let offset=0;
 for(const slot of ['backpack','clothing']){
  const gear=GEAR[player.equipment[slot]],grid=$('grid-'+slot);
  $('label-'+slot).textContent=gear.name;
  grid.innerHTML='';
  for(let i=0;i<gear.slots;i++){
   const stack=stacks[offset++],cell=document.createElement('button');cell.className='inv-cell'+(stack?.kind===selected?' selected':'');
   if(stack){cell.innerHTML=`<span>${ITEMS[stack.kind].name}</span>${art(stack.kind)}<b>${stack.count}</b>`;cell.setAttribute('aria-label',`${ITEMS[stack.kind].name}, ${stack.count}`);cell.addEventListener('click',()=>select(stack.kind));}
   else {cell.classList.add('empty');cell.disabled=true;cell.setAttribute('aria-label','Empty slot');}
   grid.appendChild(cell);
  }
  $('equip-'+slot).innerHTML=art(player.equipment[slot])+`<span>${gear.name}</span><small>${gear.slots} slots · equipped</small>`;
 }
 const item=ITEMS[selected];$('detail-art').innerHTML=art(selected);$('detail-title').textContent=item.name;
 $('detail-description').textContent=item.detail+(selected==='ammo'?' · Makarov reserve.':selected==='rifleAmmo'?' · AK-47 reserve.':'');
 $('detail-count').textContent=`${itemCount(player,selected)} carried`;
 for(const kind of ['food','water','medkit']){
  const use=$('use-'+kind);use.hidden=selected!==kind;
  use.disabled=itemCount(player,kind)===0||(kind==='medkit'?player.hp>=100||player.healing>0||player.reloading>0||player.switching>0:player[ITEMS[kind].stat]>=100);
 }
 $('pack-loaded').textContent=`Makarov ${player.guns.makarov.ammo} loaded · AK-47 ${player.guns.ak47.ammo} loaded`;
}
export function installInventoryUI({resetInput,heal}) {
 function setOpen(open){
  if(open&&(!game.started||game.dead||player.hp<=0))return;
  resetInput();game.inventoryOpen=open;$('inventory').hidden=!open;$('bag').setAttribute('aria-expanded',String(open));
  if(open){controllerSlot=0;const first=inventoryStacks(player)[0];if(game.controllerMode&&first)selected=first.kind;document.exitPointerLock?.();$('pack-message').textContent='Select an item to inspect or use it.';updateInventoryUI();$('pack-close').focus();}else $('bag').focus();
 }
 $('bag').addEventListener('click',()=>setOpen(!game.inventoryOpen));$('pack-close').addEventListener('click',()=>setOpen(false));
 for(const kind of ['food','water','medkit'])$('use-'+kind).addEventListener('click',()=>{
  if(!game.inventoryOpen||!game.started||game.dead)return;
  if(kind==='medkit'){setOpen(false);heal();return;}
  if(consumeItem(player,kind)){$('pack-message').textContent=kind==='food'?'Ate canned beans. Hunger restored.':'Drank water. Thirst restored.';updateInventoryUI();$('use-'+kind).focus();}
 });
 for(const k of ['makarov','ak47'])$('equip-'+k).innerHTML=itemArt(k)+`<span>${k==='makarov'?'Makarov':'AK-47'}</span>`;
 addEventListener('keydown',e=>{
  if(e.code==='KeyI'&&!e.repeat){e.preventDefault();setOpen(!game.inventoryOpen);}
  if(!game.inventoryOpen)return;
  if(e.code==='Escape'){e.preventDefault();setOpen(false);}
  if(e.code==='Tab'){
   const buttons=Array.from($('inventory').querySelectorAll('button:not(:disabled)')).filter(b=>!b.hidden);
   const index=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
  }
 });return setOpen;
}
