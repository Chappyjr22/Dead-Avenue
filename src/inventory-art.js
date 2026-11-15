// Generated cutout renders are shared by the grid, inspection panel and equipment.
const icons=new Set(['ammo','rifleAmmo','food','water','medkit','daypack','hikingPack','fieldPack','jacket','cargoVest','makarov','ak47']);
export function itemArt(kind){
 const id=icons.has(kind)?kind:kind==='clothing'?'jacket':'daypack';
 return `<img class="item-art" src="assets/icons/${id}.webp" width="320" height="320" alt="" aria-hidden="true" draggable="false" decoding="async">`;
}
