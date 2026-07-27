// HubScene — The magical tree castle on a floating island
// Uses AI-generated watercolor assets with code-driven animations and interactions

import { Scene, RenderContext } from '../engine/types';
import { GameEngine, SceneName } from '../engine/GameEngine';
import { Kitten } from '../entities/Kitten';
import { lerp, clamp, dist } from '../engine/utils';

interface RoomDoor {
  name: SceneName;
  label: string;
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  radius: number;
  playable: boolean;
  glowPhase: number;
  assetKey: string;
}

export class HubScene implements Scene {
  private engine: GameEngine;
  private kitten: Kitten;
  private doors: RoomDoor[] = [];
  private time = 0;
  private ambientSpawned = false;
  private islandOffset = 0;
  private lanternGlow: number[] = [];
  private flowerGlow: number[] = [];
  private tapRipples: { x: number; y: number; r: number; life: number }[] = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.kitten = new Kitten(0, 0, engine.getState().kitten, engine);
    this.setupDoors();
  }

  private setupDoors(): void {
    this.doors = [
      { name: 'greenhouse', label: 'Greenhouse', x: 0.25, y: 0.45, radius: 55, playable: true, glowPhase: 0, assetKey: 'door_greenhouse' },
      { name: 'potion-kitchen', label: 'Potion Kitchen', x: 0.72, y: 0.38, radius: 50, playable: false, glowPhase: 1.5, assetKey: 'door_potion_kitchen' },
      { name: 'observatory', label: 'Observatory', x: 0.5, y: 0.22, radius: 50, playable: false, glowPhase: 3, assetKey: 'door_observatory' },
      { name: 'story-library', label: 'Story Library', x: 0.15, y: 0.28, radius: 45, playable: false, glowPhase: 4.5, assetKey: 'door_story_library' },
      { name: 'music-garden', label: 'Music Garden', x: 0.82, y: 0.58, radius: 48, playable: false, glowPhase: 2.5, assetKey: 'door_music_garden' },
      { name: 'forest-trail', label: 'Forest Trail', x: 0.55, y: 0.68, radius: 50, playable: false, glowPhase: 5, assetKey: 'door_forest_trail' },
      { name: 'bedroom', label: 'Bedroom', x: 0.35, y: 0.68, radius: 45, playable: false, glowPhase: 0.5, assetKey: 'door_bedroom' },
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

    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(25, w, h);
      this.ambientSpawned = true;
    }

    this.lanternGlow = new Array(8).fill(0).map((_, i) => i * 0.8);
    this.flowerGlow = new Array(12).fill(0).map((_, i) => i * 1.2);

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

    for (let i = 0; i < this.lanternGlow.length; i++) this.lanternGlow[i] += dt;
    for (let i = 0; i < this.flowerGlow.length; i++) this.flowerGlow[i] += dt;

    this.islandOffset = Math.sin(time * 0.5) * 3;

    for (const door of this.doors) door.glowPhase += dt;

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

    // 1. Background image (covers full canvas)
    if (!assets.drawBackground(ctx, 'hub_bg', width, height)) {
      // Fallback gradient if image not loaded
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0d0820');
      grad.addColorStop(0.4, '#1a1040');
      grad.addColorStop(0.7, '#2d1850');
      grad.addColorStop(1, '#3d2060');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Extra stars (code-drawn, for twinkle animation on top of bg)
    this.drawTwinkleStars(ctx, width, height);

    // 3. Clouds (drifting, code-animated)
    this.drawDriftClouds(ctx, width, height);

    // 4. Lanterns (image sprites with code-driven glow)
    this.drawLanterns(ctx, width, height);

    // 5. Bioluminescent flowers (image sprites with pulse)
    this.drawBiolumFlowers(ctx, width, height);

    // 6. Room doors (image sprites)
    for (const door of this.doors) {
      this.drawDoor(ctx, door, width, height);
    }

    // 7. Kitten
    this.kitten.render(ctx);

    // 8. Tap ripples
    for (const r of this.tapRipples) {
      ctx.strokeStyle = `rgba(255, 220, 150, ${r.life * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawTwinkleStars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 73.41) % 1) * width;
      const sy = ((i * 31.17) % 1) * height * 0.4;
      const twinkle = 0.3 + Math.sin(this.time * 0.5 + i) * 0.3;
      if (twinkle > 0.5) {
        assets.draw(ctx, 'star_tiny', sx, sy, 0.03 + twinkle * 0.02, twinkle * 0.7);
      }
    }
  }

  private drawDriftClouds(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    for (let i = 0; i < 4; i++) {
      const cx = (width * (i / 4) + Math.sin(this.time * 0.05 + i) * 30) % (width + 200) - 100;
      const cy = height * (0.15 + i * 0.04);
      const key = i % 2 === 0 ? 'cloud_1' : 'cloud_2';
      assets.draw(ctx, key, cx, cy, 0.15, 0.2);
    }
  }

  private drawLanterns(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    const islandCY = height * 0.55 + this.islandOffset;
    const cx = width * 0.5;

    const positions = [
      { x: cx - 80, y: islandCY - 80 },
      { x: cx + 80, y: islandCY - 80 },
      { x: cx - 100, y: islandCY - 40 },
      { x: cx + 100, y: islandCY - 40 },
      { x: cx - 60, y: islandCY - 160 },
      { x: cx + 60, y: islandCY - 160 },
      { x: cx - 130, y: islandCY + 10 },
      { x: cx + 130, y: islandCY + 10 },
    ];

    for (let i = 0; i < positions.length; i++) {
      const lp = positions[i];
      const glow = 0.4 + Math.sin(this.lanternGlow[i] * 0.8) * 0.3;
      // Glow halo
      ctx.save();
      ctx.fillStyle = `rgba(255, 180, 80, ${glow * 0.2})`;
      ctx.filter = 'blur(15px)';
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();
      // Lantern sprite
      assets.draw(ctx, 'lantern', lp.x, lp.y, 0.06, 0.6 + glow * 0.4);
    }
  }

  private drawBiolumFlowers(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    const islandCY = height * 0.55 + this.islandOffset;
    const cx = width * 0.5;

    const positions = [
      { x: cx - 140, y: islandCY - 10, key: 'biolum_flower_purple' },
      { x: cx + 140, y: islandCY - 5, key: 'biolum_flower_pink' },
      { x: cx - 170, y: islandCY + 20, key: 'biolum_flower_blue' },
      { x: cx + 170, y: islandCY + 15, key: 'biolum_flower_purple' },
      { x: cx - 100, y: islandCY + 30, key: 'biolum_flower_pink' },
      { x: cx + 100, y: islandCY + 30, key: 'biolum_flower_blue' },
      { x: cx - 60, y: islandCY + 50, key: 'biolum_flower_purple' },
      { x: cx + 60, y: islandCY + 50, key: 'biolum_flower_pink' },
    ];

    for (let i = 0; i < positions.length; i++) {
      const fp = positions[i];
      const glow = 0.3 + Math.sin(this.flowerGlow[i] * 0.5) * 0.3;
      // Glow halo
      ctx.save();
      ctx.fillStyle = `rgba(180, 120, 255, ${glow * 0.15})`;
      ctx.filter = 'blur(12px)';
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();
      // Flower sprite
      assets.draw(ctx, fp.key, fp.x, fp.y, 0.05, 0.5 + glow * 0.4);
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D, door: RoomDoor, width: number, height: number): void {
    const assets = this.engine.getAssets();
    const dx = door.x * width;
    const dy = door.y * height + this.islandOffset;
    const glow = 0.3 + Math.sin(door.glowPhase * 0.5) * 0.2;

    // Door glow
    ctx.save();
    if (door.playable) {
      ctx.fillStyle = `rgba(100, 255, 150, ${glow * 0.2})`;
    } else {
      ctx.fillStyle = `rgba(150, 120, 255, ${glow * 0.12})`;
    }
    ctx.filter = 'blur(20px)';
    ctx.beginPath();
    ctx.arc(dx, dy, door.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // Door image
    const scale = door.radius * 2 / 140; // fit to radius
    assets.draw(ctx, door.assetKey, dx, dy, scale, 0.9);

    // Label below
    ctx.font = `500 ${Math.max(12, width * 0.018)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = door.playable ? 'rgba(150, 255, 180, 0.9)' : 'rgba(200, 180, 255, 0.5)';
    ctx.fillText(door.label, dx, dy + door.radius * 0.9);

    // "Coming soon" for non-playable
    if (!door.playable) {
      const sparkleAlpha = 0.3 + Math.sin(door.glowPhase * 1.5) * 0.2;
      ctx.fillStyle = `rgba(200, 180, 255, ${sparkleAlpha})`;
      ctx.font = `300 ${Math.max(8, width * 0.012)}px Georgia, serif`;
      ctx.fillText('✨ coming soon ✨', dx, dy + door.radius * 1.15);
    }
  }

  handleTap(x: number, y: number): void {
    this.tapRipples.push({ x, y, r: 5, life: 0.5 });

    for (const door of this.doors) {
      const dx = door.x * this.engine.getWidth();
      const dy = door.y * this.engine.getHeight() + this.islandOffset;
      if (dist(x, y, dx, dy) < door.radius) {
        if (door.playable) {
          this.kitten.walkTo(dx, dy + 20);
          this.engine.getAudio().playPentatonicChime(2);
          setTimeout(() => this.engine.changeScene(door.name), 800);
        } else {
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

    const islandCY = this.engine.getHeight() * 0.55 + this.islandOffset;
    const clampedX = clamp(x, this.engine.getWidth() * 0.15, this.engine.getWidth() * 0.85);
    const clampedY = clamp(y, islandCY - 20, islandCY + 60);
    this.kitten.walkTo(clampedX, clampedY);
    this.engine.getAudio().playPop();
  }

  handleMove(x: number, y: number): void {}
}
