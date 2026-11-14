import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.matchMedia = () => ({matches:false});
const {circles,rooms} = await import('../src/world.js');
const {findRoute,clearSegment,clearNavigation,requestRoute,updateNavigation}=await import('../src/navigation.js');
function route(a,b) { const search=findRoute(a,b); let n,count=0; do {n=search.next();count++;assert.ok(count<=16002);} while(!n.done); return n.value; }
function valid(a,b,path) {
 assert.ok(path.length>0,'route found');
 for(const p of path){assert.ok(clearSegment(a,p),'segment has clearance');a=p;}
 assert.deepEqual(a,b);
}
test('direct street, car detour, building corner and doorway routes',()=>{
 const start={x:41,z:10},end={x:41,z:25};
 valid(start,end,route(start,end));
 circles.push({x:41,z:17,r:2,h:2});clearNavigation();
 assert.equal(clearSegment(start,end),false);
 valid(start,end,route(start,end));
 circles.length=0;clearNavigation();
 const a={x:30,z:35},b={x:20,z:47};
 assert.equal(clearSegment(a,b),false);
 valid(a,b,route(a,b));
 rooms.push({cx:21,cz:0,fx:27.5,nx:1,x0:15,x1:27.5,z0:-5,z1:5,dx0:26.5,dx1:28.5,dz0:-1.2,dz1:1.2,block:12});
 clearNavigation();
 const street={x:33,z:8},inside={x:19,z:2};
 valid(street,inside,route(street,inside));
 valid(inside,street,route(inside,street));
 assert.equal(clearSegment({x:28,z:4},{x:26,z:4}),false,'wall beside door is blocked');
 rooms.length=0;clearNavigation();
});
test('unreachable targets and cancelled queued searches',()=>{
 assert.deepEqual(route({x:41,z:0},{x:0,z:0}),[]);
 const owner={};requestRoute(owner,{x:30,z:35},{x:20,z:47});
 owner.navPending=null;updateNavigation();assert.equal(owner.path,undefined);
});
