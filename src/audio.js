// Synthesised effects with a cached ElevenLabs player voice layer.
import { PlayerVoice } from './player-audio.js';


let playerVoice = null;
let actx = null, master = null, noiseBuf = null;
function audioStart() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  actx = new AC(); master = actx.createGain(); master.gain.value = 0.7; master.connect(actx.destination);
  playerVoice = new PlayerVoice(actx, master); playerVoice.load();
  noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 6; }
  const wind = actx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.6; const g = actx.createGain(); g.gain.value = 0.11;
  const lfo = actx.createOscillator(); lfo.frequency.value = 0.09; const lg = actx.createGain(); lg.gain.value = 170; lfo.connect(lg).connect(f.frequency); lfo.start(); wind.connect(f).connect(g).connect(master); wind.start();
}
function burst(dur, freq, vol, q = 0.7, type = 'lowpass', pan = 0) {
  if (!actx) return; const t = actx.currentTime, s = actx.createBufferSource(); s.buffer = noiseBuf; const f = actx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.2), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); let node = s.connect(f).connect(g);
  if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); } node.connect(master); s.start(t, Math.random(), dur + 0.05);
}
function tone(f0, f1, dur, vol, type = 'sine', pan = 0) {
  if (!actx) return; const t = actx.currentTime, o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(520, t); f.frequency.linearRampToValueAtTime(260, t + dur); f.Q.value = 2.5; let node = o.connect(f).connect(g);
  if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); } node.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  voice(name) { return playerVoice?.play(name) ?? false; },
  stopVoice() { playerVoice?.stop(); },
  jump() { if (!playerVoice?.play('jump')) burst(0.12, 450, 0.12); },
  land() { burst(0.16, 260, 0.28); },
  pickup() { burst(0.07, 1800, 0.2); playerVoice?.play('pickup'); },
  shot() { burst(0.32, 2600, 0.9); burst(0.9, 700, 0.25); tone(150, 45, 0.16, 0.8); },
  dry() { burst(0.04, 4000, 0.25, 2, 'highpass'); },
  reload() { burst(0.05, 3000, 0.3, 2, 'bandpass'); setTimeout(() => burst(0.07, 1800, 0.35, 2, 'bandpass'), 520); setTimeout(() => burst(0.05, 3500, 0.3, 2, 'bandpass'), 900); },
  groan(vol, pan) { const f = 62 + Math.random() * 40; tone(f, f * 0.72, 1.1 + Math.random() * 0.8, vol, 'sawtooth', pan); },
  hurt() { if (playerVoice?.play('hurt')) return; tone(110, 50, 0.25, 0.7); burst(0.15, 500, 0.4); },
  thud(vol, pan) { burst(0.2, 300, vol, 0.7, 'lowpass', pan); }
};

export { audioStart, sfx };
