// Standard browser gamepad layout. No browser/Three dependency: sampled frames are testable.
export function stick(x=0,y=0,dead=.18){
 x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;
 const length=Math.hypot(x,y);if(length<=dead)return {x:0,y:0};
 const magnitude=Math.min(1,(length-dead)/(1-dead));
 return {x:x/length*magnitude,y:y/length*magnitude};
}
export function createController(){
 let index=null,previous=[],blocked=false,repeatDir=0,repeatTime=0;
 return {
  suspend(){blocked=true;previous=[];repeatDir=0;repeatTime=0;},
  sample(pads,dt,focused=true){
   const available=Array.from(pads||[]).filter(p=>p&&p.connected!==false&&p.mapping==='standard');
   const pad=available.find(p=>p.index===index)||available[0];
   if(!pad){index=null;previous=[];repeatDir=0;return {connected:false,unsupported:Array.from(pads||[]).some(p=>p&&p.connected!==false)};}
   if(index!==pad.index){index=pad.index;previous=[];repeatDir=0;}
   const buttons=Array.from({length:17},(_,i)=>!!pad.buttons[i]?.pressed||(pad.buttons[i]?.value||0)>.35);
   const move=stick(pad.axes[0],pad.axes[1]),look=stick(pad.axes[2],pad.axes[3]);
   const active=buttons.some(Boolean)||!!(move.x||move.y||look.x||look.y);
   if(!focused)blocked=true;
   const edge=buttons.map((v,i)=>v&&!previous[i]);previous=buttons;
   if(blocked){if(!active&&focused)blocked=false;return {connected:true,active:false,blocked:true};}
   const dir=buttons[12]?-4:buttons[13]?4:buttons[14]?-1:buttons[15]?1:Math.abs(move.y)>.5?(move.y<0?-4:4):Math.abs(move.x)>.5?(move.x<0?-1:1):0;
   let navigate=0;
   if(dir!==repeatDir){repeatDir=dir;repeatTime=.35;navigate=dir;}
   else if(dir){repeatTime-=Math.min(.1,Math.max(0,dt));if(repeatTime<=0){navigate=dir;repeatTime=.13;}}
   return {connected:true,active,buttons,edge,move,look,navigate};
  }
 };
}
