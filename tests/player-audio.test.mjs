import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerVoice} from '../src/player-audio.js';
function setup(){
 const starts=[];
 const ctx={state:'running',currentTime:0,decodeAudioData:async b=>b,
 createGain:()=>({gain:{value:0},connect(){return this;},disconnect(){}}),
 createBufferSource:()=>({connect(n){return n;},start(){starts.push(this);},stop(){this.stopped=true;this.onended?.();},disconnect(){}})};
 const voice=new PlayerVoice(ctx,{});return {voice,ctx,starts};
}
test('generated audio loads once per cue, priorities prevent overlapping chatter, and stop cancels playback',async()=>{
 const {voice,ctx,starts}=setup();let requests=0;
 await voice.load(async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};});
 assert.equal(requests,5);assert.equal(voice.play('reload'),true);assert.equal(starts.length,1);
 voice.play('pickup');assert.equal(starts.length,1);
 voice.play('hurt');assert.equal(starts.length,2);assert.equal(starts[0].stopped,true);
 voice.play('hurt');assert.equal(starts.length,2);
 voice.stop();assert.equal(starts[1].stopped,true);
 ctx.currentTime=7;voice.play('pickup');assert.equal(starts.length,3);
 voice.stop();ctx.currentTime=8;voice.play('pickup');assert.equal(starts.length,3);
});
test('failed downloads and suspended audio leave synthesis available without throwing',async()=>{
 const {voice,ctx}=setup();await voice.load(async()=>{throw Error('offline');});
 assert.equal(voice.play('jump'),false);voice.buffers.set('jump',{});ctx.state='suspended';assert.equal(voice.play('jump'),false);
});

test('rapid jumps suppress repeated vocals without requesting a fallback sound',async()=>{
 const {voice,ctx,starts}=setup();voice.buffers.set('jump',{});
 assert.equal(voice.play('jump'),true);voice.stop();
 ctx.currentTime=.7;assert.equal(voice.play('jump'),true);assert.equal(starts.length,1);
 ctx.currentTime=1.4;assert.equal(voice.play('jump'),true);assert.equal(starts.length,1);
 ctx.currentTime=2.1;assert.equal(voice.play('jump'),true);assert.equal(starts.length,2);
});
