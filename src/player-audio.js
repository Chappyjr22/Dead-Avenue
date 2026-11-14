// Small decoded voice cache: no streaming/API calls during gameplay.
export const PLAYER_CUES = {
  jump: { cooldown: 0.55, volume: 0.65, priority: 2 },
  hurt: { cooldown: 1.1, volume: 0.8, priority: 3 },
  reload: { cooldown: 14, volume: 0.75, priority: 1 },
  pickup: { cooldown: 14, volume: 0.75, priority: 1 },
  empty: { cooldown: 12, volume: 0.75, priority: 1 }
};
export class PlayerVoice {
  constructor(context, output) {
    this.context = context; this.output = output; this.buffers = new Map();
    this.last = new Map(); this.dialogueAt = -Infinity; this.active = null;
  }
  async load(fetcher = fetch) {
    await Promise.all(Object.keys(PLAYER_CUES).map(async name => {
      try {
        const response = await fetcher('assets/audio/player/' + name + '.mp3');
        if (!response.ok) return;
        this.buffers.set(name, await this.context.decodeAudioData(await response.arrayBuffer()));
      } catch { /* Missing audio never blocks play; synthesis remains available. */ }
    }));
  }
  play(name) {
    const cue = PLAYER_CUES[name], buffer = this.buffers.get(name);
    if (!cue || !buffer || this.context.state !== 'running') return false;
    const now = this.context.currentTime;
    if (now - (this.last.get(name) ?? -Infinity) < cue.cooldown) return true;
    if (cue.priority === 1 && now - this.dialogueAt < 6) return true;
    if (this.active && this.active.priority >= cue.priority) return true;
    this.stop();
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; gain.gain.value = cue.volume;
    source.connect(gain).connect(this.output);
    const active = { source, priority: cue.priority };
    this.active = active; this.last.set(name, now);
    if (cue.priority === 1) this.dialogueAt = now;
    source.onended = () => { gain.disconnect(); source.disconnect(); if (this.active === active) this.active = null; };
    source.start(); return true;
  }
  stop() { if (this.active) { try { this.active.source.stop(); } catch {} this.active = null; } }
}
