// Kitten character — sprite-based with code-driven animation.
// Big, tappable, and full of life: breathing, squash-and-stretch hops,
// happy hearts, idle sleeping with dream bubbles.

import { KittenCustomization } from '../engine/GameState';
import { GameEngine } from '../engine/GameEngine';

interface DreamBubble {
  age: number;
  offsetX: number;
}

export class Kitten {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** Largest sprite dimension in CSS px before depth scaling */
  baseSize: number = 150;
  /** Pseudo-3D scale set by the scene from the kitten's position */
  depthScale: number = 1;
  facing: number = 1;
  walking: boolean = false;
  sleeping: boolean = false;
  happy: number = 0;
  /** Seconds since the player last interacted with the kitten/scene */
  idleTime: number = 0;
  /** px/s — scenes can slow this down for lazy idle strolls */
  speed: number = 175;

  private walkPhase = 0;
  private walkFrame = 0;
  private breathe = Math.random() * Math.PI * 2;
  private squash = 0; // 1 → decays; drives landing squash-and-stretch
  private blinkTimer = 3;
  private happyBounce = 0;
  private soundCooldown = 0;
  private dreams: DreamBubble[] = [];
  private dreamTimer = 0;
  private onArrive: (() => void) | null = null;
  custom: KittenCustomization;
  private engine: GameEngine | null = null;

  constructor(x: number, y: number, custom: KittenCustomization, engine?: GameEngine) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.custom = custom;
    this.engine = engine ?? null;
  }

  setEngine(engine: GameEngine): void {
    this.engine = engine;
  }

  /** Current rendered size (largest dimension, CSS px) */
  get size(): number {
    return this.baseSize * this.depthScale;
  }

  walkTo(x: number, y: number, onArrive?: () => void): void {
    if (this.sleeping) this.wake();
    this.targetX = x;
    this.targetY = y;
    this.walking = true;
    this.onArrive = onArrive ?? null;
    if (Math.abs(x - this.x) > 4) this.facing = x < this.x ? -1 : 1;
  }

  /** Is this screen point on the kitten? Generous for small fingers. */
  hitTest(x: number, y: number): boolean {
    const dx = x - this.x;
    const dy = y - (this.y - this.size * 0.18);
    const r = this.size * 0.55;
    return dx * dx + dy * dy < r * r;
  }

  /** Player tapped the kitten — react with love */
  pet(): void {
    if (this.sleeping) {
      this.wake();
      return;
    }
    this.happy = 1;
    this.happyBounce = 1;
    this.idleTime = 0;
    this.walking = false;
    if (this.engine) {
      this.engine.getParticles().spawnHearts(this.x, this.y - this.size * 0.45, 4);
      if (this.soundCooldown <= 0) {
        Math.random() < 0.6 ? this.engine.getAudio().playMew() : this.engine.getAudio().playPurr();
        this.soundCooldown = 0.38;
      }
    }
  }

  sleep(): void {
    if (this.sleeping) return;
    this.sleeping = true;
    this.walking = false;
    this.dreams = [];
    this.dreamTimer = 0.5;
    this.engine?.getAudio().playPurr(1.6);
  }

  wake(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.happy = 1;
    this.happyBounce = 1;
    this.squash = 1;
    this.idleTime = 0;
    this.dreams = [];
    if (this.engine) {
      this.engine.getAudio().playMew();
      this.engine.getParticles().spawnSparkles(this.x, this.y - this.size * 0.6, 5);
      this.engine.getParticles().spawnHearts(this.x, this.y - this.size * 0.5, 2);
    }
  }

  update(dt: number): void {
    this.soundCooldown = Math.max(0, this.soundCooldown - dt);
    this.breathe += dt * 1.9;

    if (this.walking) {
      this.idleTime = 0;
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      // Ease into the last stretch so arrivals feel soft, not robotic
      const speed = this.speed * this.depthScale * (d < 60 ? Math.max(0.45, d / 60) : 1);
      if (d > 4) {
        this.x += (dx / d) * speed * dt;
        this.y += (dy / d) * speed * dt;
        this.walkPhase += dt * 9;
        this.walkFrame = Math.floor(this.walkPhase) % 2;
      } else {
        this.walking = false;
        this.walkPhase = 0;
        this.walkFrame = 0;
        this.squash = 1; // landing squash
        this.engine?.getParticles().spawnDust(this.x, this.y + this.size * 0.32, 5);
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      }
    } else if (!this.sleeping) {
      this.idleTime += dt;
    }

    // Blink substitute — tiny periodic squash pulse, no alpha ghosting
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.squash = Math.max(this.squash, 0.28);
      this.blinkTimer = 2.5 + Math.random() * 4;
    }

    this.squash = Math.max(0, this.squash - dt * 4);
    this.happyBounce = Math.max(0, this.happyBounce - dt * 2.2);
    if (this.happy > 0) this.happy = Math.max(0, this.happy - dt * 0.45);

    // Dream bubbles while sleeping
    if (this.sleeping) {
      this.dreamTimer -= dt;
      if (this.dreamTimer <= 0) {
        this.dreams.push({ age: 0, offsetX: (Math.random() - 0.5) * 14 });
        this.dreamTimer = 1.7;
      }
    }
    for (let i = this.dreams.length - 1; i >= 0; i--) {
      this.dreams[i].age += dt;
      if (this.dreams[i].age > 2.8) this.dreams.splice(i, 1);
    }
  }

  beHappy(): void {
    this.happy = 1;
    this.idleTime = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const size = this.size;
    const bob = this.walking ? Math.abs(Math.sin(this.walkPhase * Math.PI)) * -size * 0.045 : 0;
    const bounce = Math.sin(this.happyBounce * Math.PI * 3) * this.happyBounce * size * 0.08;
    const cx = this.x;
    const cy = this.y + bob - bounce;

    // Shadow — tracks the hop so the kitten feels grounded
    const shadowShrink = 1 - (bob + bounce) / (size * 0.3);
    ctx.save();
    ctx.fillStyle = 'rgba(20, 10, 30, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, this.y + size * 0.34, size * 0.34 * Math.max(0.6, shadowShrink), size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Choose sprite
    let spriteKey = 'kitten_sitting';
    if (this.sleeping) {
      spriteKey = 'kitten_sleeping';
    } else if (this.walking) {
      spriteKey = this.walkFrame === 0 ? 'kitten_walking1' : 'kitten_walking2';
    } else if (this.happy > 0.3) {
      spriteKey = 'kitten_happy';
    }

    const assets = this.engine?.getAssets();
    const img = assets?.get(spriteKey) ?? null;

    // Breathing + squash-and-stretch
    const breatheS = this.walking || this.sleeping ? 0 : Math.sin(this.breathe) * 0.015;
    const sq = this.squash * 0.14;
    const scaleX = 1 + sq - breatheS * 0.6;
    const scaleY = 1 - sq + breatheS;
    const rot = this.walking ? Math.sin(this.walkPhase * Math.PI) * 0.05 * this.facing : 0;

    if (img && assets) {
      const s = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(this.facing * scaleX, scaleY);
      // Anchor at the bottom so squash keeps feet planted
      ctx.drawImage(img, -w / 2, -h + size * 0.36, w, h);
      ctx.restore();
    } else {
      // Fallback: simple code-drawn kitten if assets not loaded
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.facing * scaleX, scaleY);
      ctx.fillStyle = this.custom.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1028';
      ctx.beginPath();
      ctx.arc(-size * 0.1, -size * 0.05, size * 0.05, 0, Math.PI * 2);
      ctx.arc(size * 0.1, -size * 0.05, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dream bubbles rise while sleeping
    if (assets) {
      for (const d of this.dreams) {
        const t = d.age / 2.8;
        assets.drawFit(
          ctx, 'dream_bubble',
          cx + this.facing * size * 0.28 + d.offsetX + Math.sin(d.age * 2) * 6,
          cy - size * 0.5 - t * size * 0.55,
          size * (0.14 + t * 0.1),
          (1 - t) * 0.85
        );
      }
    }

    // Happy sparkles
    if (this.happy > 0.3 && !this.sleeping) {
      const sparkleAlpha = this.happy * 0.7;
      for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 * i) / 3 + this.breathe;
        const sx = cx + Math.cos(angle) * size * 0.34;
        const sy = cy - size * 0.42 + Math.sin(angle) * size * 0.18;
        ctx.fillStyle = `rgba(255, 240, 150, ${sparkleAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
