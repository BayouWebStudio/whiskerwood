// Kitten character — customizable, drawn procedurally on canvas
// Large expressive eyes, tiny accessories, emotive sounds only

import { KittenCustomization } from '../engine/GameState';
import { easeOutBack, lerp } from '../engine/utils';

export class Kitten {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number = 1;
  facing: number = 1; // 1 = right, -1 = left
  blinkTimer: number = 3;
  isBlinking: boolean = false;
  blinkProgress: number = 0;
  tailWag: number = 0;
  bobOffset: number = 0;
  walking: boolean = false;
  walkPhase: number = 0;
  happy: number = 0; // 0-1, for happy expression
  custom: KittenCustomization;

  constructor(x: number, y: number, custom: KittenCustomization) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.custom = custom;
  }

  walkTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.walking = true;
    if (x < this.x) this.facing = -1;
    else if (x > this.x) this.facing = 1;
  }

  update(dt: number): void {
    // Walk towards target
    if (this.walking) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 3) {
        const speed = 80;
        this.x += (dx / d) * speed * dt;
        this.y += (dy / d) * speed * dt;
        this.walkPhase += dt * 8;
      } else {
        this.walking = false;
        this.walkPhase = 0;
      }
    }

    // Bob
    this.bobOffset = Math.sin(performance.now() / 1000 * 2) * 2;

    // Tail wag
    this.tailWag += dt * 2;

    // Blinking
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

    // Happy fade
    if (this.happy > 0) this.happy = Math.max(0, this.happy - dt * 0.5);
  }

  beHappy(): void {
    this.happy = 1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const size = 40 * this.scale;
    const cx = this.x;
    const cy = this.y + this.bobOffset;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.facing, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.55, size * 0.5, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail (behind body)
    const tailX = -size * 0.35;
    const tailY = size * 0.1;
    const wagOffset = Math.sin(this.tailWag) * size * 0.15;
    ctx.strokeStyle = this.custom.bodyColor;
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.quadraticCurveTo(tailX - size * 0.3, tailY - size * 0.2 + wagOffset, tailX - size * 0.35, tailY - size * 0.45 + wagOffset);
    ctx.stroke();

    // Body (rounded)
    ctx.fillStyle = this.custom.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.15, size * 0.38, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs — walking animation
    const legSwing = this.walking ? Math.sin(this.walkPhase) * size * 0.1 : 0;
    ctx.strokeStyle = this.custom.bodyColor;
    ctx.lineWidth = size * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 0.15, size * 0.42);
    ctx.lineTo(-size * 0.15, size * 0.55 + legSwing);
    ctx.moveTo(size * 0.15, size * 0.42);
    ctx.lineTo(size * 0.15, size * 0.55 - legSwing);
    ctx.stroke();

    // Accessory: Cape (behind head)
    if (this.custom.accessory === 'cape') {
      ctx.fillStyle = this.custom.accessoryColor;
      ctx.beginPath();
      ctx.moveTo(-size * 0.25, -size * 0.05);
      ctx.quadraticCurveTo(-size * 0.45, size * 0.1, -size * 0.35, size * 0.4);
      ctx.lineTo(size * 0.35, size * 0.4);
      ctx.quadraticCurveTo(size * 0.45, size * 0.1, size * 0.25, -size * 0.05);
      ctx.quadraticCurveTo(0, -size * 0.1, -size * 0.25, -size * 0.05);
      ctx.fill();
    }

    // Head
    ctx.fillStyle = this.custom.bodyColor;
    ctx.beginPath();
    ctx.arc(0, -size * 0.15, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, -size * 0.35);
    ctx.lineTo(-size * 0.15, -size * 0.5);
    ctx.lineTo(-size * 0.05, -size * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.35);
    ctx.lineTo(size * 0.15, -size * 0.5);
    ctx.lineTo(size * 0.05, -size * 0.38);
    ctx.closePath();
    ctx.fill();

    // Inner ears
    ctx.fillStyle = 'rgba(255, 180, 200, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.38);
    ctx.lineTo(-size * 0.15, -size * 0.46);
    ctx.lineTo(-size * 0.1, -size * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.2, -size * 0.38);
    ctx.lineTo(size * 0.15, -size * 0.46);
    ctx.lineTo(size * 0.1, -size * 0.38);
    ctx.closePath();
    ctx.fill();

    // Accessory: Scarf
    if (this.custom.accessory === 'scarf') {
      ctx.fillStyle = this.custom.accessoryColor;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.05, size * 0.3, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      // Scarf tail
      ctx.beginPath();
      ctx.moveTo(size * 0.1, size * 0.1);
      ctx.quadraticCurveTo(size * 0.2, size * 0.2, size * 0.12, size * 0.35);
      ctx.lineTo(size * 0.05, size * 0.35);
      ctx.quadraticCurveTo(size * 0.1, size * 0.2, 0, size * 0.12);
      ctx.fill();
    }

    // Accessory: Glasses
    if (this.custom.accessory === 'glasses') {
      ctx.strokeStyle = this.custom.accessoryColor;
      ctx.lineWidth = size * 0.03;
      ctx.beginPath();
      ctx.arc(-size * 0.12, -size * 0.15, size * 0.1, 0, Math.PI * 2);
      ctx.arc(size * 0.12, -size * 0.15, size * 0.1, 0, Math.PI * 2);
      ctx.moveTo(-size * 0.02, -size * 0.15);
      ctx.lineTo(size * 0.02, -size * 0.15);
      ctx.stroke();
    }

    // Accessory: Flower
    if (this.custom.accessory === 'flower') {
      const fx = size * 0.2;
      const fy = -size * 0.4;
      ctx.fillStyle = this.custom.accessoryColor;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(angle) * size * 0.08, fy + Math.sin(angle) * size * 0.08, size * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(fx, fy, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes — large and expressive
    const eyeY = -size * 0.15;
    const eyeSpacing = size * 0.13;
    const eyeRadius = size * 0.09;
    const eyeOpenness = this.isBlinking ? Math.max(0.05, 1 - this.blinkProgress * 2) * (this.blinkProgress < 0.5 ? 1 : (1 - (this.blinkProgress - 0.5) * 2)) : 1;

    // Eye whites
    ctx.fillStyle = '#1a1028';
    ctx.beginPath();
    ctx.ellipse(-eyeSpacing, eyeY, eyeRadius, eyeRadius * eyeOpenness, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeSpacing, eyeY, eyeRadius, eyeRadius * eyeOpenness, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils — big sparkly
    if (eyeOpenness > 0.1) {
      ctx.fillStyle = this.happy > 0.5 ? '#5dcfff' : '#3a8fd0';
      const pupilSize = eyeRadius * 0.7;
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, pupilSize, 0, Math.PI * 2);
      ctx.arc(eyeSpacing, eyeY, pupilSize, 0, Math.PI * 2);
      ctx.fill();

      // Eye shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(-eyeSpacing + eyeRadius * 0.3, eyeY - eyeRadius * 0.3, eyeRadius * 0.25, 0, Math.PI * 2);
      ctx.arc(eyeSpacing + eyeRadius * 0.3, eyeY - eyeRadius * 0.3, eyeRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Happy sparkle — extra shine when happy
      if (this.happy > 0.3) {
        ctx.fillStyle = `rgba(255, 255, 200, ${this.happy * 0.6})`;
        ctx.beginPath();
        ctx.arc(-eyeSpacing - eyeRadius * 0.2, eyeY + eyeRadius * 0.2, eyeRadius * 0.15, 0, Math.PI * 2);
        ctx.arc(eyeSpacing - eyeRadius * 0.2, eyeY + eyeRadius * 0.2, eyeRadius * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nose
    ctx.fillStyle = 'rgba(200, 120, 140, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-size * 0.02, size * 0.02);
    ctx.lineTo(size * 0.02, size * 0.02);
    ctx.lineTo(0, size * 0.05);
    ctx.closePath();
    ctx.fill();

    // Mouth — tiny smile, bigger when happy
    ctx.strokeStyle = 'rgba(150, 80, 100, 0.5)';
    ctx.lineWidth = size * 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const smileSize = size * 0.04 * (1 + this.happy * 0.5);
    ctx.arc(0, size * 0.08, smileSize, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    // Whiskers
    ctx.strokeStyle = 'rgba(200, 180, 160, 0.4)';
    ctx.lineWidth = size * 0.01;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(size * 0.08, size * 0.03);
      ctx.lineTo(size * 0.2, size * 0.03 + i * size * 0.04);
      ctx.moveTo(-size * 0.08, size * 0.03);
      ctx.lineTo(-size * 0.2, size * 0.03 + i * size * 0.04);
      ctx.stroke();
    }

    ctx.restore();
  }
}
