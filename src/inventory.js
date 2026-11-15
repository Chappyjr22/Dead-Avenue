// Inventory operations share the live weapon reserves and medkit count.
export const ITEMS = {
  ammo: { name: 'Pistol ammo', max: 120, amount: 12, detail: '12 pistol rounds', icon: 'ammo' },
  rifleAmmo: { name: 'Rifle ammo', max: 180, amount: 30, detail: '30 rifle rounds', icon: 'ammo' },
  medkit: { name: 'Medkit', max: 3, amount: 1, detail: 'Restores 40 health', icon: 'medkit' },
  food: { name: 'Canned beans', max: 5, amount: 1, detail: 'Restores 35 hunger', icon: 'food', stat: 'hunger', restore: 35 },
  water: { name: 'Bottled water', max: 5, amount: 1, detail: 'Restores 45 thirst', icon: 'water', stat: 'thirst', restore: 45 }
};
export const SURVIVAL = { hungerPerSecond: 100 / 1200, thirstPerSecond: 100 / 900, sprintMultiplier: 1.4, damagePerSecond: .5 };
export const newSupplies = () => ({ food: 1, water: 1 });
export function itemCount(player, kind) {
  if(kind==='ammo')return player.guns.makarov.spare;
  if(kind==='rifleAmmo')return player.guns.ak47.spare;
  if(kind==='medkit')return player.medkits;
  return player.supplies[kind] || 0;
}
function setCount(player,kind,count) {
  if(kind==='ammo')player.guns.makarov.spare=count;
  else if(kind==='rifleAmmo')player.guns.ak47.spare=count;
  else if(kind==='medkit')player.medkits=count;
  else player.supplies[kind]=count;
}
export function collectItem(player,kind,amount=ITEMS[kind]?.amount) {
  if(!ITEMS[kind] || !Number.isFinite(amount) || amount<=0)return 0;
  const count=itemCount(player,kind),take=Math.min(Math.floor(amount),Math.max(0,ITEMS[kind].max-count));
  setCount(player,kind,count+take);return take;
}
export function consumeItem(player,kind) {
  const item=ITEMS[kind];
  if(!item?.stat || player.hp<=0 || itemCount(player,kind)<1 || player[item.stat]>=100)return false;
  setCount(player,kind,itemCount(player,kind)-1);
  player[item.stat]=Math.min(100,player[item.stat]+item.restore);return true;
}
export function updateSurvival(player,dt) {
  if(player.hp<=0 || !Number.isFinite(dt) || dt<=0)return;
  const rate=player.sprinting?SURVIVAL.sprintMultiplier:1;
  // Only the portion of a step spent empty can cause damage.
  const emptyTime=(value,drain)=>Math.max(0,dt-value/(drain*rate));
  const empty=emptyTime(player.hunger,SURVIVAL.hungerPerSecond)+emptyTime(player.thirst,SURVIVAL.thirstPerSecond);
  player.hunger=Math.max(0,player.hunger-dt*SURVIVAL.hungerPerSecond*rate);
  player.thirst=Math.max(0,player.thirst-dt*SURVIVAL.thirstPerSecond*rate);
  player.hp=Math.max(0,player.hp-empty*SURVIVAL.damagePerSecond);
}
export function chooseLoot(type,roll) {
  const med=type.medkit||0;
  if(roll<med)return 'medkit';
  const r=(roll-med)/(1-med);
  if(['grocery','cafe'].includes(type.name))return r<.45?'food':r<.85?'water':r<.95?'ammo':'rifleAmmo';
  if(type.name==='liquor')return r<.6?'water':r<.75?'food':r<.9?'ammo':'rifleAmmo';
  return r<.12?'food':r<.28?'water':r<.72?'ammo':'rifleAmmo';
}
