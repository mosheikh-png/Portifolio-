export type SoundName = "hover" | "click" | "navigate" | "langSwitch" | "success" | "error";

export type TransitionEvent = "coverStart" | "switch" | "revealStart" | "complete";

const COOLDOWN_MS: Record<SoundName, number> = {
  hover: 80,
  click: 120,
  navigate: 300,
  langSwitch: 200,
  success: 300,
  error: 300,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private unlocked = false;
  private masterVolume = 0.35;
  private lastPlayed = new Map<SoundName, number>();
  private transitionMgr: TransitionSoundManager | null = null;

  private masterGain: GainNode | null = null;

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.masterGain) {
      this.masterGain.gain.value = v ? this.masterVolume : 0;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  isUnlocked() {
    return this.unlocked;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      this.unlocked = true;
    } catch {
      // AudioContext not supported — fail silently
    }
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx || this.ctx.state === "closed") {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.ctx.destination);
        this.unlocked = true;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private out(): GainNode | null {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return null;
    return this.masterGain;
  }

  getCtx(): AudioContext | null {
    return this.ensureCtx();
  }

  getDest(): AudioNode | null {
    return this.out();
  }

  play(name: SoundName) {
    if (!this.enabled || !this.unlocked) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < COOLDOWN_MS[name]) return;
    this.lastPlayed.set(name, now);

    const dest = this.out();
    if (!dest || !this.ctx) return;

    switch (name) {
      case "hover":
        this.synthHover(dest);
        break;
      case "click":
        this.synthClick(dest);
        break;
      case "navigate":
        this.synthNavigate(dest);
        break;
      case "langSwitch":
        this.synthLangSwitch(dest);
        break;
      case "success":
        this.synthSuccess(dest);
        break;
      case "error":
        this.synthError(dest);
        break;
    }
  }

  setVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? this.masterVolume : 0;
    }
  }

  getTransitionManager(): TransitionSoundManager {
    if (!this.transitionMgr) {
      this.transitionMgr = new TransitionSoundManager(this);
    }
    return this.transitionMgr;
  }

  private synthHover(dest: AudioNode) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.025);

    filter.type = "highpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  private synthClick(dest: AudioNode) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.02);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  private synthNavigate(dest: AudioNode) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(260, now + 0.1);

    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.015);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  private synthLangSwitch(dest: AudioNode) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.linearRampToValueAtTime(1050, now + 0.035);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1200, now + 0.02);
    osc2.frequency.linearRampToValueAtTime(900, now + 0.055);

    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = 1.2;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.008);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.06);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc1.stop(now + 0.045);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.065);
  }

  private synthSuccess(dest: AudioNode) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(780, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  private synthError(dest: AudioNode) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.16);
  }
}

export const soundEngine = new SoundEngine();

export class TransitionSoundManager {
  private engine: SoundEngine;
  private activeNodes: AudioNode[] = [];

  constructor(engine: SoundEngine) {
    this.engine = engine;
  }

  private cleanup() {
    this.activeNodes = [];
  }

  private noiseBuffer(): AudioBuffer | null {
    const ctx = this.engine.getCtx();
    if (!ctx) return null;
    const length = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    return buf;
  }

  trigger(event: TransitionEvent) {
    if (!this.engine.isEnabled() || !this.engine.isUnlocked()) return;
    this.cleanup();

    switch (event) {
      case "coverStart":
        this.playCoverSound();
        break;
      case "switch":
        this.playSwitchAccent();
        break;
      case "revealStart":
        this.playRevealSound();
        break;
      case "complete":
        break;
    }
  }

  private playCoverSound() {
    const ctx = this.engine.getCtx();
    if (!ctx) return;
    const dest = this.engine.getDest();
    if (!dest) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.55);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.linearRampToValueAtTime(500, now + 0.3);
    filter.frequency.linearRampToValueAtTime(250, now + 0.55);
    filter.Q.value = 0.6;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.04);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.35);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.56);
    this.activeNodes.push(osc, gain, filter);

    const noiseBuf = this.noiseBuffer();
    if (noiseBuf) {
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();

      noise.buffer = noiseBuf;
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 2000;
      noiseFilter.Q.value = 0.4;

      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.008, now + 0.02);
      noiseGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);

      noise.start(now);
      noise.stop(now + 0.13);
      this.activeNodes.push(noise, noiseGain, noiseFilter);
    }
  }

  private playSwitchAccent() {
    const ctx = this.engine.getCtx();
    if (!ctx) return;
    const dest = this.engine.getDest();
    if (!dest) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.015);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.03);
    this.activeNodes.push(osc, gain);
  }

  private playRevealSound() {
    const ctx = this.engine.getCtx();
    if (!ctx) return;
    const dest = this.engine.getDest();
    if (!dest) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.5);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.linearRampToValueAtTime(900, now + 0.2);
    filter.frequency.linearRampToValueAtTime(350, now + 0.5);
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.022, now + 0.03);
    gain.gain.linearRampToValueAtTime(0.015, now + 0.3);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.51);
    this.activeNodes.push(osc, gain, filter);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(2400, now);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.08);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.015, now + 0.008);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc2.connect(gain2);
    gain2.connect(dest);

    osc2.start(now);
    osc2.stop(now + 0.09);
    this.activeNodes.push(osc2, gain2);
  }
}
