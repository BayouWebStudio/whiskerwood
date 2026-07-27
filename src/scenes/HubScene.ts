// HubScene — The magical tree castle on a floating island
// Lanterns, bioluminescent flowers, tiny bridges, fireflies, friendly animals
// All rooms are visible as tappable doors, only greenhouse is playable

import { Scene, RenderContext } from '../engine/types';
import { GameEngine, SceneName } from '../engine/GameEngine';
import { Kitten } from '../entities/Kitten';
import { lerp, easeInOut, clamp, dist } from '../engine/utils';

interface RoomDoor {
  name: SceneName;
  label: string;
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  radius: number;
  playable: boolean;
  glowPhase: number;
  icon: string;
}

export class HubScene implements Scene {
  private engine: GameEngine;
  private kitten: Kitten;
  private doors: RoomDoor[] = [];
  private time = 0;
  private ambientSpawned = false;
  private bgGradient: CanvasGradient | null = null;
  private islandOffset = 0;
  private lanternGlow: number[] = [];
  private flowerGlow: number[] = [];

  // Tap feedback
  private tapRipples: { x: number; y: number; r: number; life: number }[] = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.kitten = new Kitten(0, 0, engine.getState().kitten);
    this.setupDoors();
  }

  private setupDoors(): void {
    this.doors = [
      { name: 'greenhouse', label: 'Greenhouse', x: 0.25, y: 0.45, radius: 55, playable: true, glowPhase: 0, icon: 'flower' },
      { name: 'potion-kitchen', label: 'Potion Kitchen', x: 0.72, y: 0.38, radius: 50, playable: false, glowPhase: 1.5, icon: 'potion' },
      { name: 'observatory', label: 'Observatory', x: 0.5, y: 0.22, radius: 50, playable: false, glowPhase: 3, icon: 'star' },
      { name: 'story-library', label: 'Story Library', x: 0.15, y: 0.28, radius: 45, playable: false, glowPhase: 4.5, icon: 'book' },
      { name: 'music-garden', label: 'Music Garden', x: 0.82, y: 0.58, radius: 48, playable: false, glowPhase: 2.5, icon: 'music' },
      { name: 'forest-trail', label: 'Forest Trail', x: 0.55, y: 0.68, radius: 50, playable: false, glowPhase: 5, icon: 'tree' },
      { name: 'bedroom', label: 'Bedroom', x: 0.35, y: 0.68, radius: 45, playable: false, glowPhase: 0.5, icon: 'moon' },
    ];
  }

  enter(): void {
    const w = this.engine.getWidth();
    const h = this.engine.getHeight();
    this.kitten.x = w * 0.5;
    this.kitten.y = h * 0.75;
    this.kitten.targetX = w * 0.5;
    this.kitten.targetY = h * 0.75;
    this.kitten.scale = 1;

    // Spawn fireflies
    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(25, w, h);
      this.ambientSpawned = true;
    }

    // Init lantern and flower glow phases
    this.lanternGlow = new Array(8).fill(0).map((_, i) => i * 0.8);
    this.flowerGlow = new Array(12).fill(0).map((_, i) => i * 1.2);

    // Show hub intro storyboard on first visit
    if (this.engine.getState().firstVisit) {
      this.engine.showStoryboard([
        { text: 'This is Whiskerwood — your magical tree castle home.', duration: 3.5 },
        { text: 'Each doorway leads to a cozy adventure.', duration: 3 },
        { text: 'The Greenhouse is ready to explore. Other rooms are still sparkling to life...', duration: 4 },
      ], () => {});
    }
  }

  exit(): void {
    this.ambientSpawned = false;
    this.engine.getParticles().clear();
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.kitten.update(dt);

    // Update lantern glow
    for (let i = 0; i < this.lanternGlow.length; i++) {
      this.lanternGlow[i] += dt;
    }
    for (let i = 0; i < this.flowerGlow.length; i++) {
      this.flowerGlow[i] += dt;
    }

    // Island gentle bob
    this.islandOffset = Math.sin(time * 0.5) * 3;

    // Update door glow phases
    for (const door of this.doors) {
      door.glowPhase += dt;
    }

    // Update tap ripples
    for (let i = this.tapRipples.length - 1; i >= 0; i--) {
      const r = this.tapRipples[i];
      r.r += dt * 200;
      r.life -= dt;
      if (r.life <= 0) this.tapRipples.splice(i, 1);
    }
  }

  render(rc: RenderContext): void {
    const { ctx, width, height } = rc;

    // Sky gradient — deep twilight to warm horizon
    if (!this.bgGradient) {
      this.bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      this.bgGradient.addColorStop(0, '#0d0820');
      this.bgGradient.addColorStop(0.4, '#1a1040');
      this.bgGradient.addColorStop(0.7, '#2d1850');
      this.bgGradient.addColorStop(1, '#3d2060');
    }
    ctx.fillStyle = this.bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Stars in the sky
    this.drawStars(ctx, width, height);

    // Distant mountains/clouds
    this.drawDistantClouds(ctx, width, height);

    // Floating island
    const islandCY = height * 0.55 + this.islandOffset;
    const islandCX = width * 0.5;

    // Island shadow (below)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(islandCX, islandCY + 120, width * 0.35, 15, 0, 0, Math.PI * 2);
    ctx.filter = 'blur(20px)';
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // Island base — rocky root shape
    ctx.save();
    ctx.fillStyle = '#3a2a4a';
    ctx.beginPath();
    ctx.moveTo(width * 0.15, islandCY);
    ctx.quadraticCurveTo(width * 0.2, islandCY + 80, width * 0.35, islandCY + 100);
    ctx.quadraticCurveTo(width * 0.5, islandCY + 130, width * 0.65, islandCY + 100);
    ctx.quadraticCurveTo(width * 0.8, islandCY + 80, width * 0.85, islandCY);
    ctx.closePath();
    ctx.fill();

    // Island top — mossy ground
    ctx.fillStyle = '#2a4a2a';
    ctx.beginPath();
    ctx.ellipse(islandCX, islandCY, width * 0.38, height * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grass tufts
    ctx.strokeStyle = '#3a6a3a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      const gx = width * 0.16 + (width * 0.68 * (i / 30));
      const gy = islandCY - 5 + Math.sin(i * 0.7) * 3;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.sin(i) * 3, gy - 8 - Math.random() * 4);
      ctx.stroke();
    }
    ctx.restore();

    // Tree castle — central trunk
    this.drawTreeCastle(ctx, islandCX, islandCY, width, height);

    // Lanterns hanging from branches
    this.drawLanterns(ctx, islandCX, islandCY, width, height);

    // Bioluminescent flowers
    this.drawBioluminescentFlowers(ctx, islandCX, islandCY, width, height);

    // Tiny bridges between platforms
    this.drawBridges(ctx, islandCX, islandCY, width, height);

    // Room doors
    for (const door of this.doors) {
      this.drawDoor(ctx, door, width, height, islandCY);
    }

    // Kitten
    this.kitten.render(ctx);

    // Tap ripples
    for (const r of this.tapRipples) {
      ctx.strokeStyle = `rgba(255, 220, 150, ${r.life * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Static star field using seeded positions
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 73.41) % 1) * width;
      const sy = ((i * 31.17) % 1) * height * 0.5;
      const twinkle = 0.3 + Math.sin(this.time * 0.5 + i) * 0.3;
      ctx.fillStyle = `rgba(255, 240, 200, ${twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3 === 0 ? 1 : 0), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawDistantClouds(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.filter = 'blur(30px)';
    ctx.fillStyle = '#5d3a7a';
    for (let i = 0; i < 5; i++) {
      const cx = (width * (i / 5) + Math.sin(this.time * 0.05 + i) * 20) % width;
      const cy = height * (0.25 + i * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, 80 + i * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = 'none';
    ctx.restore();
  }

  private drawTreeCastle(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number): void {
    // Central trunk
    ctx.fillStyle = '#4a3a3a';
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy);
    ctx.quadraticCurveTo(cx - 30, cy - 100, cx - 20, cy - 150);
    ctx.quadraticCurveTo(cx - 15, cy - 200, cx - 10, cy - 220);
    ctx.lineTo(cx + 10, cy - 220);
    ctx.quadraticCurveTo(cx + 15, cy - 200, cx + 20, cy - 150);
    ctx.quadraticCurveTo(cx + 30, cy - 100, cx + 25, cy);
    ctx.closePath();
    ctx.fill();

    // Bark texture lines
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 20 + i * 10, cy - 10);
      ctx.quadraticCurveTo(cx - 22 + i * 10, cy - 100, cx - 15 + i * 10, cy - 210);
      ctx.stroke();
    }

    // Canopy — layered circles for foliage
    const canopyColors = ['#2a4a2a', '#3a5a3a', '#4a6a4a', '#3a5a3a'];
    for (let layer = 0; layer < 4; layer++) {
      ctx.fillStyle = canopyColors[layer];
      const ly = cy - 220 - layer * 30;
      const lr = 60 + layer * 15;
      ctx.beginPath();
      ctx.arc(cx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Windows in the trunk — glowing
    for (let i = 0; i < 3; i++) {
      const wy = cy - 80 - i * 60;
      const glow = 0.5 + Math.sin(this.time * 0.3 + i) * 0.3;
      ctx.fillStyle = `rgba(255, 200, 100, ${glow * 0.3})`;
      ctx.filter = 'blur(8px)';
      ctx.beginPath();
      ctx.arc(cx, wy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';

      ctx.fillStyle = `rgba(255, 220, 150, ${glow})`;
      ctx.beginPath();
      ctx.roundRect(cx - 8, wy - 12, 16, 24, 8);
      ctx.fill();
    }

    // Door at the base (main entrance)
    const doorGlow = 0.5 + Math.sin(this.time * 0.2) * 0.2;
    ctx.fillStyle = `rgba(255, 200, 100, ${doorGlow * 0.2})`;
    ctx.filter = 'blur(15px)';
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
  }

  private drawLanterns(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number): void {
    const lanternPositions = [
      { x: cx - 80, y: cy - 80 },
      { x: cx + 80, y: cy - 80 },
      { x: cx - 100, y: cy - 40 },
      { x: cx + 100, y: cy - 40 },
      { x: cx - 60, y: cy - 160 },
      { x: cx + 60, y: cy - 160 },
      { x: cx - 130, y: cy + 10 },
      { x: cx + 130, y: cy + 10 },
    ];

    for (let i = 0; i < lanternPositions.length; i++) {
      const lp = lanternPositions[i];
      const glow = 0.4 + Math.sin(this.lanternGlow[i] * 0.8) * 0.3;

      // Glow
      ctx.save();
      ctx.fillStyle = `rgba(255, 180, 80, ${glow * 0.2})`;
      ctx.filter = 'blur(15px)';
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();

      // Lantern body
      ctx.fillStyle = '#8a6a3a';
      ctx.beginPath();
      ctx.roundRect(lp.x - 8, lp.y - 12, 16, 20, 8);
      ctx.fill();

      // Lantern light
      ctx.fillStyle = `rgba(255, 220, 120, ${glow})`;
      ctx.beginPath();
      ctx.roundRect(lp.x - 5, lp.y - 8, 10, 14, 5);
      ctx.fill();

      // String to branch
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lp.x, lp.y - 12);
      ctx.lineTo(lp.x, lp.y - 40);
      ctx.stroke();
    }
  }

  private drawBioluminescentFlowers(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number): void {
    const flowerPositions = [
      { x: cx - 140, y: cy - 10, hue: 280 },
      { x: cx + 140, y: cy - 5, hue: 300 },
      { x: cx - 170, y: cy + 20, hue: 260 },
      { x: cx + 170, y: cy + 15, hue: 320 },
      { x: cx - 100, y: cy + 30, hue: 200 },
      { x: cx + 100, y: cy + 30, hue: 180 },
      { x: cx - 60, y: cy + 50, hue: 290 },
      { x: cx + 60, y: cy + 50, hue: 270 },
      { x: cx - 200, y: cy + 40, hue: 310 },
      { x: cx + 200, y: cy + 35, hue: 250 },
      { x: cx - 30, y: cy + 60, hue: 190 },
      { x: cx + 30, y: cy + 60, hue: 220 },
    ];

    for (let i = 0; i < flowerPositions.length; i++) {
      const fp = flowerPositions[i];
      const glow = 0.3 + Math.sin(this.flowerGlow[i] * 0.5) * 0.3;

      // Glow halo
      ctx.save();
      ctx.fillStyle = `hsla(${fp.hue}, 70%, 60%, ${glow * 0.15})`;
      ctx.filter = 'blur(12px)';
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();

      // Petals
      ctx.fillStyle = `hsla(${fp.hue}, 60%, 50%, ${0.6 + glow * 0.3})`;
      for (let p = 0; p < 5; p++) {
        const angle = (Math.PI * 2 * p) / 5;
        ctx.beginPath();
        ctx.arc(
          fp.x + Math.cos(angle) * 5,
          fp.y + Math.sin(angle) * 5,
          5, 0, Math.PI * 2
        );
        ctx.fill();
      }

      // Center
      ctx.fillStyle = `hsla(${fp.hue + 30}, 80%, 70%, ${0.7 + glow * 0.3})`;
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBridges(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number): void {
    // Small bridges connecting door platforms
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const bridges = [
      { x1: cx - 80, y1: cy - 10, x2: cx - 160, y2: cy },
      { x1: cx + 80, y1: cy - 10, x2: cx + 160, y2: cy },
      { x1: cx - 50, y1: cy + 20, x2: cx - 130, y2: cy + 30 },
      { x1: cx + 50, y1: cy + 20, x2: cx + 130, y2: cy + 30 },
    ];

    for (const b of bridges) {
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.quadraticCurveTo((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2 - 15, b.x2, b.y2);
      ctx.stroke();

      // Bridge planks
      ctx.lineWidth = 2;
      for (let t = 0.2; t < 0.8; t += 0.15) {
        const px = lerp(b.x1, b.x2, t);
        const py = lerp(b.y1, b.y2, t) - Math.sin(t * Math.PI) * 15;
        ctx.beginPath();
        ctx.moveTo(px - 5, py);
        ctx.lineTo(px + 5, py);
        ctx.stroke();
      }
      ctx.lineWidth = 4;
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D, door: RoomDoor, width: number, height: number, islandCY: number): void {
    const dx = door.x * width;
    const dy = door.y * height + this.islandOffset;
    const glow = 0.3 + Math.sin(door.glowPhase * 0.5) * 0.2;

    // Platform under door
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath();
    ctx.ellipse(dx, dy + door.radius * 0.5, door.radius * 0.6, door.radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Door glow
    if (door.playable) {
      ctx.save();
      ctx.fillStyle = `rgba(100, 255, 150, ${glow * 0.2})`;
      ctx.filter = 'blur(20px)';
      ctx.beginPath();
      ctx.arc(dx, dy, door.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = `rgba(150, 120, 255, ${glow * 0.12})`;
      ctx.filter = 'blur(15px)';
      ctx.beginPath();
      ctx.arc(dx, dy, door.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();
    }

    // Door arch
    const doorColor = door.playable ? '#3a5a3a' : '#3a3a4a';
    ctx.fillStyle = doorColor;
    ctx.beginPath();
    ctx.arc(dx, dy, door.radius * 0.5, Math.PI, 0);
    ctx.lineTo(dx + door.radius * 0.5, dy + door.radius * 0.3);
    ctx.lineTo(dx - door.radius * 0.5, dy + door.radius * 0.3);
    ctx.closePath();
    ctx.fill();

    // Door interior (dark)
    ctx.fillStyle = door.playable ? '#1a3a1a' : '#2a2a3a';
    ctx.beginPath();
    ctx.arc(dx, dy - 2, door.radius * 0.38, Math.PI, 0);
    ctx.lineTo(dx + door.radius * 0.38, dy + door.radius * 0.2);
    ctx.lineTo(dx - door.radius * 0.38, dy + door.radius * 0.2);
    ctx.closePath();
    ctx.fill();

    // Icon on door
    this.drawDoorIcon(ctx, door.icon, dx, dy - door.radius * 0.1, door.radius * 0.2, door.playable);

    // Label below
    ctx.font = `500 ${Math.max(12, width * 0.018)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = door.playable ? 'rgba(150, 255, 180, 0.9)' : 'rgba(200, 180, 255, 0.5)';
    ctx.fillText(door.label, dx, dy + door.radius * 0.9);

    // "Coming soon" sparkle for non-playable
    if (!door.playable) {
      const sparkleAlpha = 0.3 + Math.sin(door.glowPhase * 1.5) * 0.2;
      ctx.fillStyle = `rgba(200, 180, 255, ${sparkleAlpha})`;
      ctx.font = `300 ${Math.max(8, width * 0.012)}px Georgia, serif`;
      ctx.fillText('✨ coming soon ✨', dx, dy + door.radius * 1.15);
    }
  }

  private drawDoorIcon(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number, playable: boolean): void {
    const color = playable ? 'rgba(150, 255, 180, 0.8)' : 'rgba(200, 180, 255, 0.4)';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    switch (icon) {
      case 'flower':
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5;
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5, size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'potion':
        ctx.beginPath();
        ctx.moveTo(x - size * 0.3, y - size * 0.5);
        ctx.lineTo(x + size * 0.3, y - size * 0.5);
        ctx.lineTo(x + size * 0.5, y + size * 0.5);
        ctx.lineTo(x - size * 0.5, y + size * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      case 'star':
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? size : size * 0.4;
          const px = x + Math.cos(angle) * r;
          const py = y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'book':
        ctx.beginPath();
        ctx.roundRect(x - size * 0.6, y - size * 0.4, size * 1.2, size * 0.8, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.4);
        ctx.lineTo(x, y + size * 0.4);
        ctx.stroke();
        break;
      case 'music':
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y + size * 0.3, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + size * 0.3, y + size * 0.3, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.05, y + size * 0.3);
        ctx.lineTo(x - size * 0.05, y - size * 0.5);
        ctx.moveTo(x + size * 0.55, y + size * 0.3);
        ctx.lineTo(x + size * 0.55, y - size * 0.5);
        ctx.stroke();
        break;
      case 'tree':
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y - size * 0.2, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - size * 0.1, y, size * 0.2, size * 0.5);
        break;
      case 'moon':
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x + size * 0.25, y - size * 0.1, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }

  handleTap(x: number, y: number): void {
    // Ripple
    this.tapRipples.push({ x, y, r: 5, life: 0.5 });

    // Check door taps
    for (const door of this.doors) {
      const dx = door.x * this.engine.getWidth();
      const dy = door.y * this.engine.getHeight() + this.islandOffset;
      if (dist(x, y, dx, dy) < door.radius) {
        if (door.playable) {
          // Walk kitten to door then enter
          this.kitten.walkTo(dx, dy + 20);
          this.engine.getAudio().playPentatonicChime(2);

          setTimeout(() => {
            this.engine.changeScene(door.name);
          }, 800);
        } else {
          // Show "coming soon" message via storyboard
          this.engine.getAudio().playPop();
          this.engine.getParticles().spawnSparkles(dx, dy, 6);
          this.engine.showStoryboard([
            { text: `${door.label} is still sparkling to life...`, duration: 2.5 },
            { text: 'Come back soon!', duration: 2 },
          ], () => {});
        }
        return;
      }
    }

    // Walk kitten to tap location (staying on island)
    const islandCY = this.engine.getHeight() * 0.55 + this.islandOffset;
    const clampedX = clamp(x, this.engine.getWidth() * 0.15, this.engine.getWidth() * 0.85);
    const clampedY = clamp(y, islandCY - 20, islandCY + 60);
    this.kitten.walkTo(clampedX, clampedY);
    this.engine.getAudio().playPop();
  }

  handleMove(x: number, y: number): void {
    // Could implement hover effects on doors
  }
}
