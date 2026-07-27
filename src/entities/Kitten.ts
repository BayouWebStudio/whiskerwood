// Kitten character — uses AI-generated sprites with code-driven animation
// Large expressive eyes, tiny accessories, emotive sounds only

import { KittenCustomization } from '../engine/GameState';
import { GameEngine } from '../engine/GameEngine';

export class Kitten {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number = 1;
  facing: number = 1;
  blinkTimer: number = 3;
  isBlinking: boolean = false;
  blinkProgress: number = 0;
  tailWag: number = 0;
  bobOffset: number = 0;
  walking: boolean = false;
  walkPhase: number = 0;
  walkFrame: number = 0;
  happy: number = 0;
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

  walkTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.walking = true;
    if (x < this.x) this.facing = -1;
    else if (x > this.x) this.facing = 1;
  }

  update(dt: number): void {
    if (this.walking) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 3) {
        const speed = 80;
        this.x += (dx / d) * speed * dt;
        this.y += (dy / d) * speed * dt;
        this.walkPhase += dt * 8;
        this.walkFrame = Math.floor(this.walkPhase) % 2;
      } else {
        this.walking = false;
        this.walkPhase = 0;
        this.walkFrame = 0;
      }
    }

    this.bobOffset = Math.sin(performance.now() / 1000 * 2) * 2;
    this.tailWag += dt * 2;

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }
    if (this.isBlinking) {
      this.blinkProgress += dt * 8;
      if (this.blinkProgress >= 1) {
        this.isBlinking = false;
        this.blinkTimer = 2 + Math.random() * 4;
      }
    }

    if (this.happy > 0) this.happy = Math.max(0, this.happy - dt * 0.5);
  }

  beHappy(): void {
    this.happy = 1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const size = 80 * this.scale;
    const cx = this.x;
    const cy = this.y + this.bobOffset;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.4, size * 0.35, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Choose sprite based on state
    let spriteKey = 'kitten_sitting';
    if (this.walking) {
      spriteKey = this.walkFrame === 0 ? 'kitten_walking1' : 'kitten_walking2';
    } else if (this.happy > 0.3) {
      spriteKey = 'kitten_happy';
    }

    // Try to use image asset
    if (this.engine) {
      const assets = this.engine.getAssets();
      const img = assets.get(spriteKey);
      if (img) {
        ctx.save();
        ctx.translate(cx, cy);
        if (this.facing === -1) {
          ctx.scale(-1, 1);
        }
        // Calculate scale to fit sprite to desired size
        const imgScale = size / Math.max(img.naturalWidth, img.naturalHeight);
        const w = img.naturalWidth * imgScale;
        const h = img.naturalHeight * imgScale;

        // Blink effect — reduce opacity briefly
        let alpha = 1;
        if (this.isBlinking) {
          alpha = 0.7 + 0.3 * (1 - Math.sin(this.blinkProgress * Math.PI));
        }

        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);

        // Happy sparkles
        if (this.happy > 0.3) {
          const sparkleAlpha = this.happy * 0.6;
          for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 * i) / 3 + this.tailWag;
            const sx = Math.cos(angle) * size * 0.3;
            const sy = -size * 0.3 + Math.sin(angle) * size * 0.2;
            ctx.fillStyle = `rgba(255, 240, 150, ${sparkleAlpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
        return;
      }
    }

    // Fallback: simple code-drawn kitten if assets not loaded
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.facing, 1);
    ctx.fillStyle = this.custom.bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#1a1028';
    ctx.beginPath();
    ctx.arc(-size * 0.1, -size * 0.05, size * 0.06, 0, Math.PI * 2);
    ctx.arc(size * 0.1, -size * 0.05, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
