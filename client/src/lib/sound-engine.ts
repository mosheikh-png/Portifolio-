export type SoundName = "click" | "navigate" | "langSwitch" | "success" | "error";
export type TransitionEvent = "coverStart";

type Cooldowns = Record<SoundName, number>;

const COOLDOWNS: Cooldowns = {
  click: 120,
  navigate: 250,
  langSwitch: 200,
  success: 200,
  error: 200,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private unlocked = false;
  private masterVolume = 0.18;
  private lastPlayed = new Map<SoundName, number>();

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.masterGain) this.masterGain.gain.value = v ? this.masterVolume : 0;
  }

  isEnabled() { return this.enabled; }
  isUnlocked() { return this.unlocked; }

  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.unlocked = true;
    } catch { /* silent */ }
  }

  getCtx(): AudioContext | null {
    if (!this.ctx || this.ctx.state === "closed") {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.ctx.destination);
        this.unlocked = true;
      } catch { return null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  dest(): AudioNode | null {
    this.getCtx();
    return this.masterGain;
  }

  getTransitionManager(): TransitionSoundManager {
    return new TransitionSoundManager(this);
  }

  play(name: SoundName) {
    if (!this.enabled || !this.unlocked) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? 0) < COOLDOWNS[name]) return;
    this.lastPlayed.set(name, now);

    const ctx = this.getCtx();
    const dest = this.dest();
    if (!ctx || !dest) return;

    switch (name) {
      case "click":
      case "success":
      case "error":
        this.playClick(ctx, dest); break;
      case "navigate": this.playNavigate(ctx, dest); break;
      case "langSwitch": this.playLangSwitch(ctx, dest); break;
    }
  }

  private playClick(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const len = 0.025;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6) * 0.18;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    src.buffer = buf;
    f.type = "bandpass";
    f.frequency.value = 2200;
    f.Q.value = 1.2;
    g.gain.value = 0.14;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + len);
  }

  private playNavigate(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const len = 0.07;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const p = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.sin(p * Math.PI) * (1 - p) * 0.1;
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    src.buffer = buf;
    f.type = "lowpass";
    f.frequency.value = 600;
    g.gain.value = 0.13;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + len);
  }

  private playLangSwitch(ctx: AudioContext, dest: AudioNode) {
    const t = ctx.currentTime;
    const len = 0.028;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5) * 0.16;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    src.buffer = buf;
    f.type = "highpass";
    f.frequency.value = 3000;
    g.gain.value = 0.10;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + len);
  }
}

export const soundEngine = new SoundEngine();

export class TransitionSoundManager {
  private engine: SoundEngine;
  constructor(engine: SoundEngine) { this.engine = engine; }

  trigger(event: string) {
    if (!this.engine.isEnabled() || !this.engine.isUnlocked()) return;
    if (event === "coverStart") {
      const ctx = this.engine.getCtx();
      if (!ctx) return;
      const dest = this.engine.dest();
      if (!dest) return;
      const t = ctx.currentTime;
      const len = 0.06;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const p = i / d.length;
        d[i] = (Math.random() * 2 - 1) * Math.sin(p * Math.PI) * (1 - p) * 0.08;
      }
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      src.buffer = buf;
      f.type = "lowpass";
      f.frequency.value = 500;
      g.gain.value = 0.10;
      src.connect(f).connect(g).connect(dest);
      src.start(t);
      src.stop(t + len);
    }
  }
}
