// MusicGardenScene — the second fully playable room.
// The watercolor painting has real instruments in it (cello, saxophone,
// trumpet, harp, violin, lyre, singing flowers, mushrooms, hanging bells,
// and a bunny). Each is a tappable hotspot with its own synthesized voice.
// The bunny teaches little echo-songs — there is no way to get it wrong.

import { Scene, RenderContext } from '../engine/types';
import { GameEngine } from '../engine/GameEngine';
import { Kitten } from '../entities/Kitten';
import { clamp, dist, drawGlow, randomRange, pick } from '../engine/utils';
import { InstrumentKind } from '../engine/AudioManager';

const BG = 'stub_music_garden';

// Where the kitten may wander (image space, along the mossy path)
const WALK = { u0: 0.16, v0: 0.68, u1: 0.88, v1: 0.93 };

interface Hotspot {
  u: number;
  v: number;
  kind: InstrumentKind;
  label: string;
  radius: number; // in image-height units
  hue: number;
  phase: number;
  bounceT: number;
  teach: boolean; // eligible for bunny songs
}

interface FloatText { text: string; x: number; y: number; life: number; maxLife: number; color: string }

export class MusicGardenScene implements Scene {
  private engine: GameEngine;
  private kitten: Kitten;
  private time = 0;
  private hotspots: Hotspot[] = [];
  private bunny = { u: 0.455, v: 0.60, bounceT: 0, phase: 0 };
  private floatTexts: FloatText[] = [];
  private tapRipples: { x: number; y: number; r: number; life: number }[] = [];
  private exitButton = { x: 0, y: 0, r: 28 };
  private ambientSpawned = false;
  private petalTimer = 2;

  // Echo-song game
  getMode(): 'free' | 'teaching' | 'echo' { return this.mode; }
  private mode: 'free' | 'teaching' | 'echo' = 'free';
  private song: Hotspot[] = [];
  private teachIdx = 0;
  private teachTimer = 0;
  private echoCount = 0;
  private celebrateT = 0;

  // Dream-seed rewards for playing
  private notesPlayed = 0;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.kitten = new Kitten(0, 0, engine.getState().kitten, engine);
    this.setupHotspots();
  }

  private setupHotspots(): void {
    const H = (u: number, v: number, kind: InstrumentKind, label: string, radius: number, hue: number, teach = true): Hotspot =>
      ({ u, v, kind, label, radius, hue, phase: Math.random() * 6, bounceT: 0, teach });

    this.hotspots = [
      H(0.185, 0.60, 'cello', 'Cello', 0.115, 35),
      H(0.355, 0.545, 'sax', 'Saxophone', 0.095, 45),
      H(0.575, 0.485, 'trumpet', 'Trumpet', 0.085, 48),
      H(0.72, 0.55, 'harp', 'Harp', 0.105, 40),
      H(0.855, 0.60, 'violin', 'Violin', 0.095, 30),
      H(0.335, 0.82, 'lyre', 'Lyre', 0.075, 42),
      H(0.325, 0.375, 'flower1', 'Singing Flower', 0.085, 320),
      H(0.615, 0.36, 'flower2', 'Singing Flower', 0.08, 210),
      H(0.775, 0.46, 'flower3', 'Singing Flower', 0.07, 330),
      H(0.06, 0.875, 'shroom', 'Boop-shroom', 0.065, 15, false),
      // Hanging bells across the top
      H(0.045, 0.20, 'bell', 'Bell', 0.055, 190, false),
      H(0.115, 0.155, 'bell', 'Bell', 0.055, 200, false),
      H(0.185, 0.215, 'bell', 'Bell', 0.055, 210, false),
      H(0.255, 0.14, 'bell', 'Bell', 0.055, 220, false),
      H(0.745, 0.155, 'bell', 'Bell', 0.055, 190, false),
      H(0.815, 0.215, 'bell', 'Bell', 0.055, 200, false),
      H(0.885, 0.15, 'bell', 'Bell', 0.055, 210, false),
      H(0.955, 0.205, 'bell', 'Bell', 0.055, 220, false),
    ];
  }

  private toScreen(u: number, v: number): { x: number; y: number } {
    return this.engine.getAssets().anchor(BG, u, v, this.engine.getWidth(), this.engine.getHeight());
  }

  private toImage(x: number, y: number): { u: number; v: number } {
    return this.engine.getAssets().toImage(BG, x, y, this.engine.getWidth(), this.engine.getHeight());
  }

  private hotspotScreenRadius(h: Hotspot): number {
    const t = this.engine.getAssets().coverTransform(BG, this.engine.getWidth(), this.engine.getHeight());
    return Math.max(30, h.radius * t.dh * 0.55);
  }

  layout(): void {
    const w = this.engine.getWidth();
    const h = this.engine.getHeight();
    this.exitButton = { x: Math.max(44, w * 0.05), y: Math.max(46, h * 0.075), r: 28 };
    this.kitten.baseSize = clamp(Math.min(w, h) * 0.185, 100, 175);
  }

  enter(): void {
    const state = this.engine.getState();
    this.layout();

    const start = this.toScreen(0.70, 0.87);
    this.kitten.x = start.x;
    this.kitten.y = start.y;
    this.kitten.targetX = start.x;
    this.kitten.targetY = start.y;

    this.mode = 'free';
    this.celebrateT = 0;

    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(12, this.engine.getWidth(), this.engine.getHeight());
      this.ambientSpawned = true;
    }

    if (!state.hasVisited('music-garden')) {
      state.markVisited('music-garden');
      this.engine.showStoryboard([
        { text: 'Welcome to the Music Garden, where everything wants to sing.', duration: 3.2 },
        { text: 'Tap the instruments, the flowers, the bells — each one has its own voice.', duration: 3.4 },
        { text: 'The little bunny knows songs. Tap the bunny and listen, then play along!', duration: 3.4 },
        { text: 'Any tune you make is beautiful here.', duration: 2.6 },
      ], () => {});
    } else {
      this.engine.showStoryboard([
        { text: 'Welcome back to the Music Garden 🎵', duration: 1.6 },
      ], () => {});
    }
  }

  exit(): void {
    this.ambientSpawned = false;
    this.engine.getParticles().clear();
    this.engine.getState().flush();
  }

  update(dt: number, time: number): void {
    this.time = time;

    const kImg = this.toImage(this.kitten.x, this.kitten.y);
    this.kitten.depthScale = 0.8 + clamp((kImg.v - 0.66) / (0.94 - 0.66), 0, 1) * 0.25;
    this.kitten.update(dt);

    for (const h of this.hotspots) {
      h.phase += dt;
      h.bounceT = Math.max(0, h.bounceT - dt * 2.6);
    }
    this.bunny.phase += dt;
    this.bunny.bounceT = Math.max(0, this.bunny.bounceT - dt * 2.2);
    this.celebrateT = Math.max(0, this.celebrateT - dt);

    // Bunny teaching sequence
    if (this.mode === 'teaching') {
      this.teachTimer -= dt;
      if (this.teachTimer <= 0) {
        if (this.teachIdx < this.song.length) {
          const h = this.song[this.teachIdx];
          h.bounceT = 1;
          this.engine.getAudio().playInstrument(h.kind);
          const p = this.toScreen(h.u, h.v);
          this.engine.getParticles().spawnNotes(p.x, p.y - 20, 2, h.hue);
          this.teachIdx++;
          this.teachTimer = 0.62;
        } else {
          this.mode = 'echo';
          this.echoCount = 0;
        }
      }
    }

    // Drifting petals
    this.petalTimer -= dt;
    if (this.petalTimer <= 0) {
      this.engine.getParticles().spawnPetals(
        randomRange(0, this.engine.getWidth()), -10, 1
      );
      this.petalTimer = randomRange(1.2, 3);
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.life -= dt;
      ft.y -= dt * 30;
      if (ft.life <= 0) this.floatTexts.splice(i, 1);
    }
    for (let i = this.tapRipples.length - 1; i >= 0; i--) {
      const r = this.tapRipples[i];
      r.r += dt * 200;
      r.life -= dt;
      if (r.life <= 0) this.tapRipples.splice(i, 1);
    }
  }

  render(rc: RenderContext): void {
    const { ctx, width, height } = rc;
    const assets = this.engine.getAssets();

    if (!assets.drawBackground(ctx, BG, width, height)) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#141020');
      grad.addColorStop(0.5, '#241a34');
      grad.addColorStop(1, '#1a1226');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Hotspot shimmer — a gentle glow invites tapping without covering the art
    for (const h of this.hotspots) {
      const p = this.toScreen(h.u, h.v);
      const r = this.hotspotScreenRadius(h);
      const idle = 0.10 + Math.sin(h.phase * 1.4) * 0.05;
      const burst = Math.sin(Math.min(1, h.bounceT) * Math.PI);
      drawGlow(ctx, p.x, p.y, r * (1.1 + burst * 0.5), `${hueToRgb(h.hue)}`, idle + burst * 0.42);
      if (burst > 0.01) {
        ctx.strokeStyle = `hsla(${h.hue}, 90%, 80%, ${burst * 0.8})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (0.6 + (1 - h.bounceT) * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Bunny highlight — it's the song teacher
    {
      const p = this.toScreen(this.bunny.u, this.bunny.v);
      const t = this.engine.getAssets().coverTransform(BG, width, height);
      const r = t.dh * 0.075;
      const pulse = 0.14 + Math.sin(this.bunny.phase * 1.8) * 0.07;
      const burst = Math.sin(Math.min(1, this.bunny.bounceT) * Math.PI);
      drawGlow(ctx, p.x, p.y, r * (1.2 + burst * 0.4), '255, 235, 200', pulse + burst * 0.4);
      if (this.mode === 'free' && Math.sin(this.time * 2) > 0) {
        ctx.save();
        ctx.font = `500 ${Math.max(14, height * 0.022)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 245, 220, 0.75)';
        ctx.shadowColor = 'rgba(15, 8, 25, 0.8)';
        ctx.shadowBlur = 5;
        ctx.fillText('♪', p.x + r * 0.9, p.y - r * 0.9);
        ctx.restore();
      }
    }

    // Kitten dances along the path
    this.kitten.render(ctx);

    // Banner for the echo game
    if (this.mode === 'echo' || this.mode === 'teaching' || this.celebrateT > 0) {
      const text = this.mode === 'teaching' ? '🐰 Listen...'
        : this.mode === 'echo' ? `Your turn! Play ${3 - this.echoCount} more ♪`
        : 'Beautiful! ✨';
      ctx.save();
      ctx.font = `500 ${Math.max(16, height * 0.028)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 248, 230, 0.95)';
      ctx.shadowColor = 'rgba(15, 8, 25, 0.85)';
      ctx.shadowBlur = 8;
      ctx.fillText(text, width / 2, height * 0.10);
      ctx.restore();
    }

    // Floating texts
    for (const ft of this.floatTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life / ft.maxLife);
      ctx.font = '500 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(15, 8, 25, 0.7)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    this.drawExitButton(ctx);

    for (const r of this.tapRipples) {
      ctx.strokeStyle = `rgba(255, 220, 150, ${r.life * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawExitButton(ctx: CanvasRenderingContext2D): void {
    const assets = this.engine.getAssets();
    const { x, y, r } = this.exitButton;
    // Soft dark backing so the button reads on busy art
    ctx.save();
    ctx.fillStyle = 'rgba(25, 15, 40, 0.42)';
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 215, 245, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    if (assets.drawFit(ctx, 'btn_home', x, y, r * 2, 0.95)) {
      ctx.save();
      ctx.font = '400 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(230, 215, 240, 0.75)';
      ctx.shadowColor = 'rgba(15, 8, 25, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText('Home', x, y + r + 14);
      ctx.restore();
      return;
    }
    ctx.save();
    drawGlow(ctx, x, y, r + 8, '200, 180, 255', 0.15);
    ctx.fillStyle = '#3a2a4a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a5a7a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ccaadd';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x - 3, y - 5);
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x - 3, y + 5);
    ctx.stroke();
    ctx.font = '400 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aa9aba';
    ctx.fillText('Home', x, y + r + 15);
    ctx.restore();
  }

  private addFloatText(text: string, x: number, y: number, color: string): void {
    this.floatTexts.push({ text, x, y, life: 1.8, maxLife: 1.8, color });
  }

  private playHotspot(h: Hotspot): void {
    h.bounceT = 1;
    this.engine.getAudio().playInstrument(h.kind);
    const p = this.toScreen(h.u, h.v);
    this.engine.getParticles().spawnNotes(p.x, p.y - 16, 2, h.hue);
    this.engine.getParticles().spawnSparkles(p.x, p.y, 2);
    this.kitten.beHappy();

    // Every 8 notes of free play earns a dream seed
    this.notesPlayed++;
    if (this.notesPlayed % 8 === 0) {
      this.engine.getState().addStars(1);
      this.addFloatText('+1 dream seed', p.x, p.y - 46, '#a8f5c8');
      this.engine.getAudio().playSparkle();
    }

    // Echo game progress — ANY 3 notes complete the song. No fail states.
    if (this.mode === 'echo') {
      this.echoCount++;
      if (this.echoCount >= 3) {
        this.mode = 'free';
        this.celebrateT = 2.4;
        this.engine.getAudio().playCelebration();
        this.engine.getState().addStars(1);
        const c = this.toScreen(0.5, 0.4);
        this.engine.getParticles().spawnSparkles(c.x, c.y, 14);
        this.engine.getParticles().spawnStars(c.x, c.y, 8);
        this.addFloatText('+1 dream seed', c.x, c.y, '#ffe9a8');
        this.bunny.bounceT = 1;
        this.engine.getAudio().playSqueak();
      }
    }
  }

  private startSong(): void {
    const teachable = this.hotspots.filter(h => h.teach);
    this.song = [pick(teachable), pick(teachable), pick(teachable)];
    this.mode = 'teaching';
    this.teachIdx = 0;
    this.teachTimer = 0.7;
    this.bunny.bounceT = 1;
    this.engine.getAudio().playSqueak();
    const p = this.toScreen(this.bunny.u, this.bunny.v);
    this.engine.getParticles().spawnNotes(p.x, p.y - 30, 3);
  }

  handleTap(x: number, y: number): void {
    this.tapRipples.push({ x, y, r: 5, life: 0.5 });

    // Pet the kitten
    if (this.kitten.hitTest(x, y)) {
      this.kitten.pet();
      return;
    }

    // Exit home
    if (dist(x, y, this.exitButton.x, this.exitButton.y) < this.exitButton.r + 8) {
      this.engine.getAudio().playPop();
      this.engine.changeScene('hub');
      return;
    }

    // The bunny teaches a song
    {
      const p = this.toScreen(this.bunny.u, this.bunny.v);
      const t = this.engine.getAssets().coverTransform(BG, this.engine.getWidth(), this.engine.getHeight());
      if (dist(x, y, p.x, p.y) < Math.max(38, t.dh * 0.075) && this.mode !== 'teaching') {
        this.startSong();
        return;
      }
    }

    // Instruments — everything sings (taps during teaching are queued as joy,
    // not errors: they just play too)
    for (const h of this.hotspots) {
      const p = this.toScreen(h.u, h.v);
      if (dist(x, y, p.x, p.y) < this.hotspotScreenRadius(h)) {
        this.playHotspot(h);
        return;
      }
    }

    // Walk the kitten along the path
    const img = this.toImage(x, y);
    const target = this.toScreen(clamp(img.u, WALK.u0, WALK.u1), clamp(img.v, WALK.v0, WALK.v1));
    this.kitten.speed = 165;
    this.kitten.walkTo(target.x, target.y);
    this.engine.getAudio().playPop();
  }

  handleMove(_x: number, _y: number): void {}
}

// "h" in 0..360 → "r, g, b" string for drawGlow
function hueToRgb(h: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = 0.75 - 0.55 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  return `${f(0)}, ${f(8)}, ${f(4)}`;
}
