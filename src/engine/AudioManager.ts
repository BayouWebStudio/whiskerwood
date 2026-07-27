// AudioManager — Web Audio API based ambient + interaction sounds
// All sounds are synthesized procedurally, no external files needed

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientNodes: OscillatorNode[] = [];
  private ambientLfo: OscillatorNode | null = null;
  private started = false;
  private muted = false;

  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.15;
      this.ambientGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.3;
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn('AudioContext init failed', e);
    }
  }

  startAmbient(): void {
    if (!this.ctx || this.started) return;
    this.started = true;

    // Soft pad — pentatonic drone (C, E, G, A)
    const freqs = [130.81, 164.81, 196.0, 220.0]; // C3, E3, G3, A3
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 1;

      gain.gain.value = 0;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain!);

      // Fade in
      gain.gain.linearRampToValueAtTime(0.15 / freqs.length, this.ctx!.currentTime + 3 + i * 0.5);

      // LFO for gentle volume modulation
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.value = 0.05 + i * 0.03;
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      osc.start();
      this.ambientNodes.push(osc);
    });

    // Global shimmer LFO on master gain
    this.ambientLfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    this.ambientLfo.frequency.value = 0.08;
    lfoGain.gain.value = 200;
    this.ambientLfo.connect(lfoGain);
    lfoGain.connect(this.ambientGain!.gain);
    this.ambientLfo.start();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Soft chime on tap/interaction
  playChime(freq: number = 523.25, duration: number = 1.2): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Main tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration);

    // Overtone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + duration * 0.7);
  }

  // Pentatonic chime — pick a note from C major pentatonic
  playPentatonicChime(semitone: number = 0): void {
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5, D5, E5, G5, A5
    const freq = pentatonic[semitone % pentatonic.length] * Math.pow(2, Math.floor(semitone / pentatonic.length));
    this.playChime(freq);
  }

  // Magical sparkle for special interactions
  playSparkle(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playChime(freq, 0.8), i * 80);
    });
  }

  // Soft pop for UI button
  playPop(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Whoosh for scene transition
  playWhoosh(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    // Noise burst through filter
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.5);
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime + 0.3);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }
}
