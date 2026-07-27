// AudioManager — Web Audio API based ambient + interaction sounds
// All sounds are synthesized procedurally, no external files needed

export type InstrumentKind =
  | 'cello' | 'sax' | 'trumpet' | 'harp' | 'violin' | 'lyre'
  | 'flower1' | 'flower2' | 'flower3' | 'bell' | 'shroom';

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
      this.masterGain.gain.value = this.muted ? 0 : 0.5;
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
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      osc.start();
      this.ambientNodes.push(osc);
    });

    // Gentle shimmer LFO on the ambient bus. The modulation depth must stay a
    // small fraction of the base gain (0.15) — a large value here made the pad
    // slam between silent and blaring.
    this.ambientLfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    this.ambientLfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.04;
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

  // Celebration — rising arpeggio with sparkle tail
  playCelebration(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playChime(freq, 1.0), i * 90);
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

  // ---- Creature sounds (all synthesized) ----

  // Soft kitten mew — two-part pitch sweep with a little vibrato
  playMew(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(940, now + 0.12);
    osc.frequency.linearRampToValueAtTime(520, now + 0.34);
    // vibrato
    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.value = 9;
    vibGain.gain.value = 18;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    vib.start(now);
    vib.stop(now + 0.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Cozy purr — amplitude-modulated filtered noise
  playPurr(duration: number = 1.1): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.ctx.sampleRate;
      // 26 Hz rumble mod on brown-ish noise
      const mod = 0.55 + 0.45 * Math.sin(t * Math.PI * 2 * 26);
      data[i] = (Math.random() * 2 - 1) * mod;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.15);
    gain.gain.setValueAtTime(0.3, now + duration - 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + duration);
  }

  // Bird chirp — quick rising blips
  playChirp(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t0 = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1900, t0);
      osc.frequency.exponentialRampToValueAtTime(2600, t0 + 0.07);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + 0.11);
    }
  }

  // Small-critter squeak (bunny/squirrel)
  playSqueak(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.16);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Gentle owl hoot
  playHoot(): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [0, 0.28].forEach((off, i) => {
      const t0 = now + off;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? 340 : 300, t0);
      osc.frequency.linearRampToValueAtTime(i === 0 ? 310 : 270, t0 + 0.22);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.2, t0 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.28);
    });
  }

  // ---- Music Garden instrument voices ----

  playInstrument(kind: InstrumentKind): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    switch (kind) {
      case 'cello':   this.playVoice('sawtooth', 130.81, 0.09, 1.4, 420, 0.24); break; // C3
      case 'sax':     this.playVoice('sawtooth', 196.0, 0.05, 0.9, 900, 0.2, 4); break; // G3, reedy
      case 'trumpet': this.playVoice('square', 261.63, 0.03, 0.7, 1500, 0.14); break; // C4
      case 'violin':  this.playVoice('sawtooth', 523.25, 0.16, 1.1, 2400, 0.13, 1, 6); break; // C5, vibrato
      case 'lyre':    this.playPluck(329.63); break; // E4
      case 'harp':    [261.63, 329.63, 392.0].forEach((f, i) => setTimeout(() => this.playPluck(f), i * 95)); break;
      case 'flower1': this.playVoice('sine', 440.0, 0.2, 1.6, 1200, 0.18); break; // A4 "ooh" pad
      case 'flower2': this.playVoice('sine', 659.25, 0.2, 1.6, 1400, 0.16); break; // E5
      case 'flower3': this.playVoice('sine', 392.0, 0.2, 1.6, 1100, 0.18); break; // G4
      case 'bell':    this.playBell(1318.5 + Math.floor(Math.random() * 3) * 130); break;
      case 'shroom':  this.playBoop(); break;
    }
  }

  private playVoice(
    type: OscillatorType, freq: number, attack: number, release: number,
    cutoff: number, vol: number, q: number = 1, vibrato: number = 0
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc2.type = type;
    osc2.frequency.value = freq * 1.004; // slight detune for warmth
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = q;
    if (vibrato > 0) {
      const vib = this.ctx.createOscillator();
      const vibGain = this.ctx.createGain();
      vib.frequency.value = vibrato;
      vibGain.gain.value = freq * 0.012;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);
      vibGain.connect(osc2.frequency);
      vib.start(now);
      vib.stop(now + attack + release);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + attack + release + 0.05);
    osc2.stop(now + attack + release + 0.05);
  }

  private playPluck(freq: number): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.35);
    // bright transient
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 3;
    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.2);
  }

  private playBell(freq: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    // Inharmonic partials give the bell shimmer
    [1, 2.76, 5.4].forEach((mult, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const vol = 0.16 / (i + 1);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2 - i * 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 2.3);
    });
  }

  private playBoop(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.28);
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
