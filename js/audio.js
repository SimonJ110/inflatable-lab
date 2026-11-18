// Procedural audio + haptics driven by simulation state. No sample files.
export class SensoryAudio {
  constructor() { this.intensity = .8; this.calm = false; this.haptics = true; this.ready = false; }
  start() {
    if (this.ready) { this.ctx.resume(); return; }
    const x = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = x.createGain(); this.lp = x.createBiquadFilter(); this.lp.type = 'lowpass';
    this.master.connect(this.lp); this.lp.connect(x.destination);
    const nb = this.noise = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, f, q) => { const s = x.createBufferSource(); s.buffer = nb; s.loop = true;
      const b = x.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q;
      const g = x.createGain(); g.gain.value = 0; s.connect(b); b.connect(g); g.connect(this.master); s.start(); return { b, g }; };
    this.fan = loop('bandpass', 500, .8); this.hiss = loop('highpass', 3500, .3);
    this.hum = x.createOscillator(); this.hum.type = 'sawtooth';
    const hf = x.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 260;
    this.humG = x.createGain(); this.humG.gain.value = 0;
    this.hum.connect(hf); hf.connect(this.humG); this.humG.connect(this.master); this.hum.start();
    this.ready = true; this.apply();
  }
  apply() {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.intensity * (this.calm ? .45 : 1), t, .05);
    this.lp.frequency.setTargetAtTime(this.calm ? 1400 : 16000, t, .05);
  }
  update(s) { // s: spin, leak, pf, deflating
    if (!this.ready) return; const t = this.ctx.currentTime;
    this.hum.frequency.setTargetAtTime(48 + s.spin * 40, t, .1);
    this.humG.gain.setTargetAtTime(.10 * s.spin, t, .1);
    this.fan.b.frequency.setTargetAtTime(300 + s.spin * 900, t, .1);
    this.fan.g.gain.setTargetAtTime(.12 * s.spin, t, .1);
    this.hiss.g.gain.setTargetAtTime(Math.min(.1, s.leak / 2500), t, .15);
    if (s.deflating && s.pf > .25 && s.pf < .9 && Math.random() < .004) this.creak();
  }
  thump(v) {
    this.buzz(20 + v * 6);
    if (!this.ready) return; const x = this.ctx, t = x.currentTime, g = Math.min(1, v / 7);
    const o = x.createOscillator(), og = x.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + .35);
    og.gain.setValueAtTime(g * .9, t); og.gain.exponentialRampToValueAtTime(.001, t + .4);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + .45);
    const n = x.createBufferSource(); n.buffer = this.noise; const nf = x.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 300;
    const ng = x.createGain(); ng.gain.setValueAtTime(g * .3, t); ng.gain.exponentialRampToValueAtTime(.001, t + .18);
    n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start(t); n.stop(t + .2);
  }
  creak() {
    if (!this.ready) return; const x = this.ctx, t = x.currentTime;
    const o = x.createOscillator(), f = x.createBiquadFilter(), g = x.createGain(); o.type = 'sawtooth';
    const b = 180 + Math.random() * 120; o.frequency.setValueAtTime(b, t); o.frequency.exponentialRampToValueAtTime(b * .6, t + .25);
    f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 8;
    g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .3);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + .32);
  }
  buzz(ms) { if (this.haptics && navigator.vibrate) navigator.vibrate(Math.round(ms * this.intensity)); }
}
