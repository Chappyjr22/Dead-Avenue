import { player, game } from './state.js';
import { ITEMS, itemCount, consumeItem } from './inventory.js';
import { $ } from './util.js';

export function updateInventoryUI() {
  $('hunger-value').textContent=Math.ceil(player.hunger)+'%';
  $('thirst-value').textContent=Math.ceil(player.thirst)+'%';
  $('needs').classList.toggle('low',player.hunger<20||player.thirst<20);
  if(!game.inventoryOpen)return;
  $('pack-stats').textContent=`Health ${Math.ceil(player.hp)} · Hunger ${Math.ceil(player.hunger)} · Thirst ${Math.ceil(player.thirst)}`;
  for(const [kind,item] of Object.entries(ITEMS)){
    const count=itemCount(player,kind);
    $('count-'+kind).textContent=count+' / '+item.max;
    const use=$('use-'+kind);
    if(use) use.disabled=count===0 || (kind==='medkit'?player.hp>=100||player.healing>0||player.reloading>0||player.switching>0:player[item.stat]>=100);
  }
  $('pack-loaded').textContent=`Loaded: Makarov ${player.guns.makarov.ammo} · AK-47 ${player.guns.ak47.ammo}`;
}
export function installInventoryUI({resetInput,heal}) {
  function setOpen(open) {
    if(open && (!game.started||game.dead||player.hp<=0))return;
    resetInput();game.inventoryOpen=open;$('inventory').hidden=!open;
    $('bag').setAttribute('aria-expanded',String(open));
    if(open){document.exitPointerLock?.();updateInventoryUI();$('pack-close').focus();}
    else $('bag').focus();
  }
  $('bag').addEventListener('click',()=>setOpen(!game.inventoryOpen));
  $('pack-close').addEventListener('click',()=>setOpen(false));
  for(const kind of ['food','water','medkit'])$('use-'+kind).addEventListener('click',()=>{
    if(!game.inventoryOpen||!game.started||game.dead)return;
    if(kind==='medkit'){setOpen(false);heal();return;}
    if(consumeItem(player,kind)){
      $('pack-message').textContent=kind==='food'?'Ate canned beans. Hunger restored.':'Drank water. Thirst restored.';
      updateInventoryUI();
    }
  });
  addEventListener('keydown',e=>{
    if(e.code==='KeyI'&&!e.repeat){e.preventDefault();setOpen(!game.inventoryOpen);}
    if(!game.inventoryOpen)return;
    if(e.code==='Escape'){e.preventDefault();setOpen(false);}
    if(e.code==='Tab'){
      const buttons=Array.from($('inventory').querySelectorAll('button:not(:disabled)'));
      const index=buttons.indexOf(document.activeElement);
      e.preventDefault();buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
    }
  });
  return setOpen;
}
