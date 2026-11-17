import type { SoundKind } from '../blocks/registry';

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  masterVolume = 0.7;
  effectsVolume = 0.8;

  unlock(): void {
    if (!this.context) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.effects = this.context.createGain();
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
      const count = Math.floor(this.context.sampleRate * 0.25);
      this.noise = this.context.createBuffer(1, count, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < count; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    this.apply();
  }

  apply(): void {
    if (!this.master || !this.effects) return;
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.effects.gain.value = this.effectsVolume;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number): void {
    if (!this.context || !this.effects || this.muted) return;
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    osc.connect(amp);
    amp.connect(this.effects);
    osc.start();
    osc.stop(this.context.currentTime + duration);
  }

  private burst(freq: number, q: number, duration: number, gain: number): void {
    if (!this.context || !this.effects || !this.noise || this.muted) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = this.context.createGain();
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.effects);
    source.start();
    source.stop(this.context.currentTime + duration);
  }

  play(kind: SoundKind): void {
    this.unlock();
    if (kind === 'dirt' || kind === 'grass') this.burst(180, 0.7, 0.16, 0.35);
    else if (kind === 'sand') this.burst(240, 0.8, 0.14, 0.28);
    else if (kind === 'stone') this.burst(520, 1.4, 0.12, 0.32);
    else if (kind === 'wood') this.burst(340, 1.1, 0.14, 0.3);
    else if (kind === 'glass') this.burst(1400, 2.2, 0.1, 0.18);
    else if (kind === 'snow') this.burst(900, 0.6, 0.12, 0.16);
    else if (kind === 'wet') this.burst(420, 0.5, 0.18, 0.22);
    else if (kind === 'plant') this.burst(700, 0.8, 0.08, 0.14);
    else this.tone(880, 0.05, 'square', 0.04);
  }

  place(): void {
    this.unlock();
    this.tone(210, 0.07, 'triangle', 0.08);
  }

  jump(): void {
    this.unlock();
    this.tone(160, 0.08, 'sine', 0.06);
  }

  hit(): void {
    this.unlock();
    this.tone(180, 0.05, 'square', 0.05);
    this.burst(240, 1.2, 0.08, 0.2);
  }

  hurt(): void {
    this.unlock();
    this.tone(90, 0.12, 'sawtooth', 0.06);
  }

  ui(): void {
    this.unlock();
    this.tone(640, 0.04, 'square', 0.03);
  }

  inventory(): void {
    this.unlock();
    this.tone(420, 0.06, 'triangle', 0.05);
  }
}

export const audio = new AudioManager();
