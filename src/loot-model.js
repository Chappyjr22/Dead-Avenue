import * as THREE from 'three';
// Distinct silhouettes and physical details remain legible without a glowing cube.
const geo = new Map(), textures = new Map();
const box=(x,y,z)=>{const key=[x,y,z].join();if(!geo.has(key))geo.set(key,new THREE.BoxGeometry(x,y,z));return geo.get(key);};
const cylinder=(top,bottom,height)=>{const key=['c',top,bottom,height].join();if(!geo.has(key))geo.set(key,new THREE.CylinderGeometry(top,bottom,height,10));return geo.get(key);};
function label(text,bg) {
  if(typeof document==='undefined' || !document.createElement)return null;
  const key=text+bg;if(textures.has(key))return textures.get(key);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,256,128);
  c.strokeStyle='#e7d9b9';c.lineWidth=5;c.strokeRect(8,8,240,112);
  c.fillStyle='#fff2d2';c.textAlign='center';c.font='bold 35px sans-serif';c.fillText(text,128,58);
  c.font='18px sans-serif';c.fillText(text==='BEANS'?'READY TO EAT':text==='WATER'?'DRINKING WATER':'CARTRIDGES',128,94);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.set(key,texture);return texture;
}
export function buildLoot(kind) {
  const root=new THREE.Group();
  const color=kind==='water'?0x527e89:kind==='food'?0x754735:kind==='medkit'?0x767c7a:kind==='rifleAmmo'?0x435044:0x7b6546;
  const material=new THREE.MeshStandardMaterial({color,roughness:.85,emissive:color,emissiveIntensity:.15});
  root.material=material; // Only the main packaging pulses when targeted.
  const metal=new THREE.MeshStandardMaterial({color:0x8b8b80,metalness:.65,roughness:.4});
  function part(g,m,x=0,y=0,z=0){const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;}
  function panel(text,bg,w,h,y,z,top=false) {
    const map=label(text,bg);if(!map)return;
    const m=new THREE.MeshStandardMaterial({map,roughness:1,side:THREE.DoubleSide});
    const mesh=part(new THREE.PlaneGeometry(w,h),m,0,y,z);
    if(top)mesh.rotation.x=-Math.PI/2;
  }
  if(kind==='food'){
    part(cylinder(.065,.065,.15),material);
    part(cylinder(.067,.067,.009),metal,0,.079);
    part(cylinder(.067,.067,.009),metal,0,-.079);
    const ring=part(new THREE.TorusGeometry(.018,.003,4,12),metal,0,.086);ring.rotation.x=-Math.PI/2;
    panel('BEANS','#66392a',.102,.09,0,.066);
  }else if(kind==='water'){
    part(cylinder(.045,.045,.17),material,0,-.015);
    part(cylinder(.021,.045,.045),material,0,.092);
    part(cylinder(.024,.024,.025),new THREE.MeshStandardMaterial({color:0xd8d7c7}),0,.125);
    panel('WATER','#224959',.075,.07,-.015,.046);
  }else if(kind==='medkit'){
    part(box(.26,.11,.18),material);
    const red=new THREE.MeshStandardMaterial({color:0xb01810,roughness:.6});
    part(box(.14,.008,.045),red,0,.059);part(box(.045,.008,.14),red,0,.059);
    part(box(.045,.09,.008),red,0,0,.094);part(box(.09,.045,.008),red,0,0,.094);
  }else{
    part(box(.25,.105,.155),material);
    part(box(.26,.015,.165),material,0,.059);
    panel(kind==='rifleAmmo'?'7.62 MM':'9 MM','#302b23',.23,.13,.068,0,true);
    panel(kind==='rifleAmmo'?'7.62 MM':'9 MM','#302b23',.22,.075,0,.079);
    const brass=new THREE.MeshStandardMaterial({color:0xb5934c,metalness:.65,roughness:.35});
    // Three exposed rounds beside the box make it recognizable as ammunition.
    for(let i=0;i<3;i++){
      const round=part(cylinder(.009,.009,.062),brass,.15,.0,(i-1)*.025);round.rotation.z=Math.PI/2;
      const tip=part(new THREE.SphereGeometry(.009,6,4),brass,.184,0,(i-1)*.025);tip.scale.x=1.5;
    }
  }
  return root;
}
