// Reward Stairs — sound. WebAudio, started by the first key / tap (browsers block audio before that).
//   play(name) one-shots · music(name) crossfades · chime(step) a rising bell per card · toggle() mute
export const ONESHOTS = ['jump', 'land', 'step_stone', 'collect', 'respawn'];
export const MUSIC = ['music_climb', 'music_end'];
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];   // C major pentatonic, 2 octaves

export class Sound {
  constructor(base = 'assets/audio/') {
    this.base = base; this.ctx = null; this.buf = {}; this.track = null; this.trackName = null; this.want = null;
    this.muted = new URLSearchParams(location.search).has('mute');
    this.ready = false; this.errors = [];
  }
  async start() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3; comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(comp);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.bus = ctx.createGain(); this.bus.gain.value = 0.42; this.bus.connect(this.master);
    // a little shared reverb for the bells
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.4); const wet = ctx.createGain(); wet.gain.value = 0.32; this.verb.connect(wet); wet.connect(this.master);
    const load = async n => {
      try {
        const get = () => fetch(`${this.base}${n}.mp3`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r; });
        const r = await get().catch(() => new Promise(res => setTimeout(res, 400)).then(get));
        this.buf[n] = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { this.errors.push(`${n}: ${e.message}`); console.warn('sound missing', n, e.message); }
    };
    await Promise.all([...ONESHOTS, ...MUSIC].map(load));
    this.ready = true;
    if (this.want) { const w = this.want; this.want = null; this.music(w); }
  }
  impulse(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05); return this.muted; }
  play(name, vol = 1, rate = 1) {
    if (!this.ready || !this.buf[name]) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = this.buf[name]; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g); g.connect(this.sfx); s.start();
  }
  // soft bell: a sine plus a bright partial, fast attack, long tail into the reverb
  bell(freq, vol = 0.18, delay = 0, len = 1.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    for (const [mul, v] of [[1, 1], [2.76, 0.28], [5.4, 0.08]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * mul;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len / mul ** 0.3);
      o.connect(g); g.connect(this.sfx); g.connect(this.verb); o.start(t); o.stop(t + len + 0.1);
    }
  }
  chime(k) { this.bell(SCALE[k % SCALE.length], 0.16); this.bell(SCALE[(k + 2) % SCALE.length] * 2, 0.05, 0.07, 1.1); }
  fanfare() { [0, 2, 4, 5].forEach((k, i) => this.bell(SCALE[k] * 0.5, 0.2, i * 0.16, 2.6)); this.bell(SCALE[5], 0.14, 0.7, 3.2); }
  music(name, vol = 1, fade = 1.6) {
    if (!this.ready) { this.want = name; return; }
    if (this.trackName === name) return;
    const t = this.ctx.currentTime;
    if (this.track) { const old = this.track; old.g.gain.setTargetAtTime(0, t, fade / 3); setTimeout(() => { try { old.s.stop(); } catch (e) { /* stopped */ } }, fade * 2000); }
    this.trackName = name; this.track = null;
    if (!name || !this.buf[name]) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = this.buf[name]; s.loop = name !== 'music_end'; g.gain.value = 0;
    s.connect(g); g.connect(this.bus); s.start();
    g.gain.setTargetAtTime(vol, t, fade / 3);
    this.track = { s, g };
  }
}
