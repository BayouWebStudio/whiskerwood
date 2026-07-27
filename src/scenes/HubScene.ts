// HubScene — The magical tree castle on a floating island.
// Everything is anchored in background-image space (u, v in 0..1) and mapped
// through the cover-fit transform, so doors sit ON the painted tree and the
// kitten roams the actual walkable ground at any screen size.

import { Scene, RenderContext } from '../engine/types';
import { GameEngine, SceneName } from '../engine/GameEngine';
import { Kitten } from '../entities/Kitten';
import { clamp, dist, drawGlow, randomRange, pick } from '../engine/utils';

const BG = 'hub_bg';

interface RoomDoor {
  name: SceneName;
  label: string;
  u: number;
  v: number;
  playable: boolean;
  glowPhase: number;
  assetKey: string;
  bounceT: number;
  x: number; // computed screen pos
  y: number;
  size: number;
}

// Walkable ground rects in image space — the two levels of the island art:
// the main island around the tree, and the lower side platforms joined by
// rope bridges.
interface WalkRect { u0: number; v0: number; u1: number; v1: number }
const WALKABLE: WalkRect[] = [
  { u0: 0.295, v0: 0.645, u1: 0.72, v1: 0.785 },  // main island (upper level)
  { u0: 0.36, v0: 0.785, u1: 0.66, v1: 0.815 },   // main island front lip
  { u0: 0.02, v0: 0.77, u1: 0.235, v1: 0.915 },   // left platform (lower level)
  { u0: 0.77, v0: 0.775, u1: 0.985, v1: 0.915 },  // right platform (lower level)
  { u0: 0.20, v0: 0.79, u1: 0.335, v1: 0.85 },    // left rope bridge
  { u0: 0.655, v0: 0.79, u1: 0.80, v1: 0.855 },   // right rope bridge
];

function depthScaleFor(v: number): number {
  // Lower on screen = closer = bigger
  return 0.75 + clamp((v - 0.60) / (0.94 - 0.60), 0, 1) * 0.43;
}

interface Critter {
  key: string;
  u: number;
  v: number;
  size: number; // fraction of min(w,h)
  facing: number;
  mode: 'idle' | 'moving';
  fromU: number; fromV: number; toU: number; toV: number;
  moveT: number;
  moveDur: number;
  nextMove: number;
  hopHeight: number; // in size units; 0 = dart/glide
  zone: WalkRect | null; // roam area; null = fixed perch
  perches?: { u: number; v: number }[]; // for the bird
  reactT: number;
  sound: 'squeak' | 'chirp' | 'hoot';
}

interface Lantern {
  u: number; v: number;
  angle: number; vel: number;
  phase: number;
  flash: number;
}

interface GlowFlower {
  u: number; v: number;
  key: string;
  phase: number;
  bounceT: number;
  note: number;
  hue: number;
}

interface FloatText { text: string; x: number; y: number; life: number; maxLife: number; color: string }

export class HubScene implements Scene {
  private engine: GameEngine;
  readonly kitten: Kitten;
  private doors: RoomDoor[] = [];
  private critters: Critter[] = [];
  private lanterns: Lantern[] = [];
  private flowers: GlowFlower[] = [];
  private floatTexts: FloatText[] = [];
  private tapRipples: { x: number; y: number; r: number; life: number }[] = [];
  private time = 0;
  private ambientSpawned = false;
  private cloudSeeds: number[] = [0.1, 0.42, 0.65, 0.88];

  // Idle AI
  private timeSinceUser = 0;
  private nextStroll = 8;

  // Shooting star
  private shoot: { x: number; y: number; vx: number; vy: number; life: number; trail: number } | null = null;
  private nextShoot = 10;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.kitten = new Kitten(0, 0, engine.getState().kitten, engine);
    this.setupDoors();
    this.setupCritters();
    this.setupDecor();
  }

  private setupDoors(): void {
    this.doors = [
      { name: 'greenhouse', label: 'Greenhouse', u: 0.505, v: 0.545, playable: true, glowPhase: 0, assetKey: 'door_greenhouse', bounceT: 0, x: 0, y: 0, size: 0 },
      { name: 'music-garden', label: 'Music Garden', u: 0.725, v: 0.30, playable: true, glowPhase: 2.5, assetKey: 'door_music_garden', bounceT: 0, x: 0, y: 0, size: 0 },
      { name: 'story-library', label: 'Story Library', u: 0.335, v: 0.285, playable: false, glowPhase: 4.5, assetKey: 'door_story_library', bounceT: 0, x: 0, y: 0, size: 0 },
      { name: 'observatory', label: 'Observatory', u: 0.605, v: 0.10, playable: false, glowPhase: 3, assetKey: 'door_observatory', bounceT: 0, x: 0, y: 0, size: 0 },
      { name: 'potion-kitchen', label: 'Potion Kitchen', u: 0.075, v: 0.70, playable: false, glowPhase: 1.5, assetKey: 'door_potion_kitchen', bounceT: 0, x: 0, y: 0, size: 0 },
      { name: 'bedroom', label: 'Bedroom', u: 0.925, v: 0.73, playable: false, glowPhase: 0.5, assetKey: 'door_bedroom', bounceT: 0, x: 0, y: 0, size: 0 },
      { name: 'forest-trail', label: 'Forest Trail', u: 0.115, v: 0.475, playable: false, glowPhase: 5, assetKey: 'door_forest_trail', bounceT: 0, x: 0, y: 0, size: 0 },
    ];
  }

  private setupCritters(): void {
    const leftPlatform: WalkRect = { u0: 0.03, v0: 0.80, u1: 0.22, v1: 0.90 };
    const islandRight: WalkRect = { u0: 0.575, v0: 0.685, u1: 0.705, v1: 0.765 };
    this.critters = [
      {
        key: 'animal_bunny', u: 0.12, v: 0.85, size: 0.105, facing: 1, mode: 'idle',
        fromU: 0, fromV: 0, toU: 0, toV: 0, moveT: 0, moveDur: 0.55, nextMove: 2.5,
        hopHeight: 0.6, zone: leftPlatform, reactT: 0, sound: 'squeak',
      },
      {
        key: 'animal_squirrel', u: 0.64, v: 0.72, size: 0.095, facing: -1, mode: 'idle',
        fromU: 0, fromV: 0, toU: 0, toV: 0, moveT: 0, moveDur: 0.32, nextMove: 3.5,
        hopHeight: 0.15, zone: islandRight, reactT: 0, sound: 'squeak',
      },
      {
        key: 'animal_owl', u: 0.40, v: 0.335, size: 0.085, facing: 1, mode: 'idle',
        fromU: 0, fromV: 0, toU: 0, toV: 0, moveT: 0, moveDur: 1, nextMove: 9999,
        hopHeight: 0, zone: null, reactT: 0, sound: 'hoot',
      },
      {
        key: 'animal_bird', u: 0.70, v: 0.325, size: 0.062, facing: -1, mode: 'idle',
        fromU: 0, fromV: 0, toU: 0, toV: 0, moveT: 0, moveDur: 2.4, nextMove: 14,
        hopHeight: 0, zone: null, perches: [{ u: 0.70, v: 0.325 }, { u: 0.315, v: 0.295 }], reactT: 0, sound: 'chirp',
      },
    ];
  }

  private setupDecor(): void {
    this.lanterns = [
      { u: 0.315, v: 0.295, angle: 0, vel: 0, phase: 0.5, flash: 0 },
      { u: 0.435, v: 0.115, angle: 0, vel: 0, phase: 1.8, flash: 0 },
      { u: 0.625, v: 0.135, angle: 0, vel: 0, phase: 3.1, flash: 0 },
      { u: 0.705, v: 0.30, angle: 0, vel: 0, phase: 4.4, flash: 0 },
    ];
    const keys = ['biolum_flower_purple', 'biolum_flower_blue', 'biolum_flower_pink'];
    const hues = [270, 210, 320];
    const spots = [
      { u: 0.335, v: 0.685 }, { u: 0.425, v: 0.725 }, { u: 0.575, v: 0.725 },
      { u: 0.655, v: 0.69 }, { u: 0.075, v: 0.805 }, { u: 0.90, v: 0.805 },
      { u: 0.135, v: 0.865 }, { u: 0.86, v: 0.875 },
    ];
    this.flowers = spots.map((s, i) => ({
      u: s.u, v: s.v, key: keys[i % 3], phase: i * 1.2, bounceT: 0, note: i % 5, hue: hues[i % 3],
    }));
  }

  // --- coordinate helpers ---

  private toScreen(u: number, v: number): { x: number; y: number } {
    return this.engine.getAssets().anchor(BG, u, v, this.engine.getWidth(), this.engine.getHeight());
  }

  private toImage(x: number, y: number): { u: number; v: number } {
    return this.engine.getAssets().toImage(BG, x, y, this.engine.getWidth(), this.engine.getHeight());
  }

  // Nearest point inside the walkable ground (image space)
  private clampToWalkable(u: number, v: number): { u: number; v: number } {
    let best: { u: number; v: number } | null = null;
    let bestD = Infinity;
    for (const r of WALKABLE) {
      const cu = clamp(u, r.u0, r.u1);
      const cv = clamp(v, r.v0, r.v1);
      const d = (cu - u) * (cu - u) + (cv - v) * (cv - v) * 3.2; // weight v so taps snap to same level
      if (d < bestD) {
        bestD = d;
        best = { u: cu, v: cv };
      }
    }
    return best!;
  }

  layout(): void {
    const w = this.engine.getWidth();
    const h = this.engine.getHeight();
    const doorBase = clamp(Math.min(w, h) * 0.145, 74, 122);
    for (const door of this.doors) {
      const p = this.toScreen(door.u, door.v);
      door.size = doorBase * (door.playable ? 1.08 : 0.92);
      // Cover-fit crops the sides on narrow screens — slide doors back into
      // view so every room stays reachable on iPad portrait.
      door.x = clamp(p.x, door.size * 0.5 + 8, w - door.size * 0.5 - 8);
      door.y = clamp(p.y, door.size * 0.5 + 8, h - door.size * 0.5 - 8);
    }
    // Kitten sizing — Raul asked for a properly BIG cat
    this.kitten.baseSize = clamp(Math.min(w, h) * 0.21, 120, 205);
    // Keep the kitten on the island if the window changed shape
    const img = this.toImage(this.kitten.x, this.kitten.y);
    const cl = this.clampToWalkable(img.u, img.v);
    const p = this.toScreen(cl.u, cl.v);
    this.kitten.x = p.x;
    this.kitten.y = p.y;
    if (!this.kitten.walking) {
      this.kitten.targetX = p.x;
      this.kitten.targetY = p.y;
    }
  }

  // Visible horizontal range of the background in image space — keeps walk
  // targets on screen when cover-fit crops the sides.
  private visibleURange(): { min: number; max: number } {
    const w = this.engine.getWidth();
    return {
      min: this.toImage(10, 0).u,
      max: this.toImage(w - 10, 0).u,
    };
  }

  enter(): void {
    const start = this.toScreen(0.40, 0.745);
    this.kitten.x = start.x;
    this.kitten.y = start.y;
    this.kitten.targetX = start.x;
    this.kitten.targetY = start.y;
    this.layout();

    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(22, this.engine.getWidth(), this.engine.getHeight());
      this.ambientSpawned = true;
    }
    this.timeSinceUser = 0;
    this.nextStroll = randomRange(7, 12);
    this.nextShoot = randomRange(8, 18);
  }

  exit(): void {
    this.ambientSpawned = false;
    this.engine.getParticles().clear();
  }

  update(dt: number, time: number): void {
    this.time = time;

    // Depth scale follows the kitten around the island
    const kImg = this.toImage(this.kitten.x, this.kitten.y);
    this.kitten.depthScale = depthScaleFor(kImg.v);
    this.kitten.update(dt);

    for (const door of this.doors) {
      door.glowPhase += dt;
      door.bounceT = Math.max(0, door.bounceT - dt * 3);
    }

    this.updateCritters(dt);
    this.updateLanterns(dt);
    for (const f of this.flowers) {
      f.phase += dt;
      f.bounceT = Math.max(0, f.bounceT - dt * 3);
    }

    this.updateShootingStar(dt);
    this.updateIdleAI(dt);

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

  private updateIdleAI(dt: number): void {
    if (this.engine.getStoryboard().isActive()) return;
    this.timeSinceUser += dt;

    // Fall asleep when truly ignored
    if (this.timeSinceUser > 30 && !this.kitten.sleeping && !this.kitten.walking) {
      this.kitten.sleep();
      return;
    }
    // Lazy stroll around the island when idle
    if (!this.kitten.sleeping && !this.kitten.walking && this.timeSinceUser > this.nextStroll) {
      const r = pick(WALKABLE);
      const vis = this.visibleURange();
      const u = clamp(randomRange(r.u0, r.u1), vis.min, vis.max);
      const target = this.toScreen(u, randomRange(r.v0, r.v1));
      this.kitten.speed = 92;
      this.kitten.walkTo(target.x, target.y);
      this.nextStroll = this.timeSinceUser + randomRange(6, 12);
    }
  }

  private updateCritters(dt: number): void {
    for (const c of this.critters) {
      c.reactT = Math.max(0, c.reactT - dt * 2);
      if (c.mode === 'idle') {
        c.nextMove -= dt;
        if (c.nextMove <= 0) this.startCritterMove(c);
      } else {
        c.moveT += dt / c.moveDur;
        if (c.moveT >= 1) {
          c.u = c.toU;
          c.v = c.toV;
          c.mode = 'idle';
          c.nextMove = c.perches ? randomRange(16, 34) : randomRange(1.8, 4.5);
        } else {
          c.u = c.fromU + (c.toU - c.fromU) * c.moveT;
          c.v = c.fromV + (c.toV - c.fromV) * c.moveT;
        }
      }
    }
  }

  private startCritterMove(c: Critter, forced?: { u: number; v: number }): void {
    let target: { u: number; v: number };
    if (forced) {
      target = forced;
    } else if (c.perches) {
      // Bird flies to the other perch
      const other = c.perches.find(p => Math.abs(p.u - c.u) > 0.02) ?? c.perches[0];
      target = other;
    } else if (c.zone) {
      target = { u: randomRange(c.zone.u0, c.zone.u1), v: randomRange(c.zone.v0, c.zone.v1) };
    } else {
      return;
    }
    c.fromU = c.u;
    c.fromV = c.v;
    c.toU = target.u;
    c.toV = target.v;
    c.moveT = 0;
    c.mode = 'moving';
    c.facing = target.u >= c.u ? 1 : -1;
  }

  private updateLanterns(dt: number): void {
    for (const l of this.lanterns) {
      l.phase += dt;
      // Damped pendulum + gentle ambient sway
      const accel = -l.angle * 9 - l.vel * 1.6;
      l.vel += accel * dt;
      l.angle += l.vel * dt;
      l.flash = Math.max(0, l.flash - dt * 1.4);
    }
  }

  private updateShootingStar(dt: number): void {
    const w = this.engine.getWidth();
    const h = this.engine.getHeight();
    if (this.shoot) {
      const s = this.shoot;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.trail -= dt;
      if (s.trail <= 0) {
        this.engine.getParticles().spawnSparkles(s.x, s.y, 1);
        s.trail = 0.07;
      }
      if (s.life <= 0 || s.x < -80 || s.x > w + 80 || s.y > h * 0.6) {
        this.shoot = null;
        this.nextShoot = randomRange(16, 34);
      }
    } else {
      this.nextShoot -= dt;
      if (this.nextShoot <= 0) {
        const fromLeft = Math.random() < 0.5;
        this.shoot = {
          x: fromLeft ? w * randomRange(0.05, 0.25) : w * randomRange(0.75, 0.95),
          y: -30,
          vx: (fromLeft ? 1 : -1) * w * randomRange(0.10, 0.16),
          vy: h * randomRange(0.07, 0.10),
          life: 5,
          trail: 0,
        };
      }
    }
  }

  render(rc: RenderContext): void {
    const { ctx, width, height } = rc;
    const assets = this.engine.getAssets();

    // 1. Background
    if (!assets.drawBackground(ctx, BG, width, height)) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0d0820');
      grad.addColorStop(0.4, '#1a1040');
      grad.addColorStop(0.7, '#2d1850');
      grad.addColorStop(1, '#3d2060');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Twinkling stars + drifting clouds in the sky
    this.drawSky(ctx, width, height);

    // 3. Shooting star
    if (this.shoot) {
      const angle = Math.atan2(this.shoot.vy, this.shoot.vx);
      drawGlow(ctx, this.shoot.x, this.shoot.y, 34, '255, 240, 190', 0.35);
      if (!assets.drawFit(ctx, 'shooting_star', this.shoot.x, this.shoot.y, 84, 0.95, angle + Math.PI * 0.25)) {
        ctx.fillStyle = 'rgba(255, 245, 200, 0.95)';
        ctx.beginPath();
        ctx.arc(this.shoot.x, this.shoot.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Doors (on the tree + cottages)
    for (const door of this.doors) this.drawDoor(ctx, door, width);

    // 5. Lanterns swinging from the canopy
    this.drawLanterns(ctx, width, height);

    // 6. High critters (owl, bird)
    for (const c of this.critters) {
      if (c.key === 'animal_owl' || c.key === 'animal_bird') this.drawCritter(ctx, c, width, height);
    }

    // 7. Glow flowers on the ground
    this.drawFlowers(ctx, width, height);

    // 8. Ground critters + kitten, depth-sorted so overlaps read correctly
    const ground: { y: number; draw: () => void }[] = [];
    for (const c of this.critters) {
      if (c.key !== 'animal_owl' && c.key !== 'animal_bird') {
        const p = this.toScreen(c.u, c.v);
        ground.push({ y: p.y, draw: () => this.drawCritter(ctx, c, width, height) });
      }
    }
    ground.push({ y: this.kitten.y, draw: () => this.kitten.render(ctx) });
    ground.sort((a, b) => a.y - b.y);
    for (const g of ground) g.draw();

    // 9. Floating texts
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

    // 10. Tap ripples
    for (const r of this.tapRipples) {
      ctx.strokeStyle = `rgba(255, 220, 150, ${r.life * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 73.41) % 1) * width;
      const sy = ((i * 31.17) % 1) * height * 0.38;
      const twinkle = 0.3 + Math.sin(this.time * 0.6 + i * 1.7) * 0.35;
      if (twinkle > 0.42) {
        assets.drawFit(ctx, 'star_tiny', sx, sy, 7 + twinkle * 7, twinkle * 0.7);
      }
    }
    for (let i = 0; i < 4; i++) {
      const seed = this.cloudSeeds[i];
      const cx = ((seed * (width + 340) + this.time * (5 + i * 2.4)) % (width + 340)) - 170;
      const cy = height * (0.08 + i * 0.055);
      assets.drawFit(ctx, i % 2 === 0 ? 'cloud_1' : 'cloud_2', cx, cy, width * 0.10, 0.22);
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D, door: RoomDoor, width: number): void {
    const assets = this.engine.getAssets();
    const glowA = 0.3 + Math.sin(door.glowPhase * 0.5) * 0.2;
    const bounce = Math.sin(door.bounceT * Math.PI) * 0.12;
    const size = door.size * (1 + bounce);

    if (door.playable) {
      drawGlow(ctx, door.x, door.y, size * 0.85, '110, 255, 160', glowA * 0.35);
    } else {
      drawGlow(ctx, door.x, door.y, size * 0.75, '150, 120, 255', glowA * 0.18);
    }

    if (!assets.drawFit(ctx, door.assetKey, door.x, door.y, size, door.playable ? 1 : 0.88)) {
      ctx.fillStyle = door.playable ? 'rgba(90, 200, 120, 0.7)' : 'rgba(110, 90, 160, 0.6)';
      ctx.beginPath();
      ctx.arc(door.x, door.y, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.font = `600 ${Math.max(13, width * 0.014)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(10, 5, 20, 0.85)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = door.playable ? 'rgba(170, 255, 195, 0.95)' : 'rgba(205, 190, 255, 0.62)';
    ctx.fillText(door.label, door.x, door.y + size * 0.62);
    if (!door.playable) {
      const sparkleAlpha = 0.35 + Math.sin(door.glowPhase * 1.5) * 0.2;
      ctx.font = `300 ${Math.max(9, width * 0.010)}px Georgia, serif`;
      ctx.fillStyle = `rgba(200, 180, 255, ${sparkleAlpha})`;
      ctx.fillText('✨ coming soon ✨', door.x, door.y + size * 0.62 + Math.max(13, width * 0.014));
    }
    ctx.restore();
  }

  private drawLanterns(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    const size = clamp(Math.min(width, height) * 0.065, 34, 58);
    for (const l of this.lanterns) {
      const pivot = this.toScreen(l.u, l.v);
      const sway = l.angle + Math.sin(l.phase * 0.8) * 0.04;
      const r = size * 0.46;
      const cx = pivot.x + Math.sin(sway) * r;
      const cy = pivot.y + Math.cos(sway) * r;
      const glow = 0.35 + Math.sin(l.phase * 1.1) * 0.15 + l.flash * 0.5;
      drawGlow(ctx, cx, cy, size * (0.9 + l.flash * 0.5), '255, 180, 80', glow * 0.5);
      if (!assets.drawFit(ctx, 'lantern', cx, cy, size, 0.95, sway)) {
        ctx.fillStyle = `rgba(255, 190, 90, ${0.5 + glow * 0.4})`;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawFlowers(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const assets = this.engine.getAssets();
    for (const f of this.flowers) {
      const p = this.toScreen(f.u, f.v);
      const ds = depthScaleFor(f.v);
      const size = clamp(Math.min(width, height) * 0.062, 32, 56) * ds;
      const pulse = 0.3 + Math.sin(f.phase * 0.8) * 0.25;
      const bounce = Math.sin(f.bounceT * Math.PI) * 0.22;
      drawGlow(ctx, p.x, p.y, size * (0.85 + pulse * 0.3 + bounce), '185, 130, 255', (pulse * 0.4 + bounce * 0.4) * 0.8);
      assets.drawFit(ctx, f.key, p.x, p.y - size * 0.1, size * (1 + bounce), 0.92);
    }
  }

  private drawCritter(ctx: CanvasRenderingContext2D, c: Critter, width: number, height: number): void {
    const assets = this.engine.getAssets();
    const p = this.toScreen(c.u, c.v);
    const ds = depthScaleFor(Math.max(c.v, 0.5));
    const size = Math.min(width, height) * c.size * ds;

    let yOff = 0;
    let rot = 0;
    if (c.mode === 'moving') {
      if (c.perches) {
        // Bird flight — arcing lift + wing wobble
        yOff = -Math.sin(c.moveT * Math.PI) * size * 2.2;
        rot = Math.sin(this.time * 26) * 0.14;
      } else if (c.hopHeight > 0) {
        yOff = -Math.sin(c.moveT * Math.PI) * size * c.hopHeight;
      }
    }
    // Tap reaction — happy bounce
    yOff -= Math.sin(c.reactT * Math.PI) * size * 0.3;
    const idleBob = c.mode === 'idle' ? Math.sin(this.time * 1.6 + c.u * 20) * size * 0.02 : 0;

    // Soft shadow on the ground (not for flying bird)
    if (!(c.perches && c.mode === 'moving')) {
      ctx.save();
      ctx.fillStyle = 'rgba(20, 10, 30, 0.14)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + size * 0.30, size * 0.30, size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!assets.drawFit(ctx, c.key, p.x, p.y + yOff + idleBob, size, 1, rot, c.facing === -1)) {
      ctx.fillStyle = 'rgba(220, 200, 190, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y + yOff, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private addFloatText(text: string, x: number, y: number, color: string): void {
    this.floatTexts.push({ text, x, y, life: 1.8, maxLife: 1.8, color });
  }

  handleTap(x: number, y: number): void {
    this.tapRipples.push({ x, y, r: 5, life: 0.5 });
    this.timeSinceUser = 0;
    this.nextStroll = randomRange(8, 13);

    // 1. The kitten itself — pet it!
    if (this.kitten.hitTest(x, y)) {
      this.kitten.pet();
      return;
    }
    const wasAsleep = this.kitten.sleeping;

    // 2. Catch a shooting star
    if (this.shoot && dist(x, y, this.shoot.x, this.shoot.y) < 72) {
      this.engine.getParticles().spawnStars(this.shoot.x, this.shoot.y, 10);
      this.engine.getParticles().spawnSparkles(this.shoot.x, this.shoot.y, 8);
      this.engine.getAudio().playSparkle();
      this.engine.getState().addStars(1);
      this.addFloatText('+1 dream seed', this.shoot.x, this.shoot.y, '#ffe9a8');
      this.shoot = null;
      this.nextShoot = randomRange(16, 30);
      return;
    }

    // 3. Doors
    for (const door of this.doors) {
      if (dist(x, y, door.x, door.y) < Math.max(48, door.size * 0.58)) {
        door.bounceT = 1;
        if (door.playable) {
          this.engine.getAudio().playPentatonicChime(2);
          const near = this.clampToWalkable(door.u, door.v);
          const target = this.toScreen(near.u, near.v);
          this.kitten.speed = 190;
          this.kitten.walkTo(target.x, target.y);
          window.setTimeout(() => this.engine.changeScene(door.name), 650);
        } else {
          this.engine.getAudio().playPop();
          this.engine.getParticles().spawnSparkles(door.x, door.y, 6);
          this.engine.showStoryboard([
            { text: `${door.label} is still sparkling to life... come back soon! ✨`, duration: 2.2 },
          ], () => {});
        }
        return;
      }
    }

    // 4. Animal friends
    for (const c of this.critters) {
      const p = this.toScreen(c.u, c.v);
      const size = Math.min(this.engine.getWidth(), this.engine.getHeight()) * c.size;
      if (dist(x, y, p.x, p.y) < Math.max(40, size * 0.62)) {
        c.reactT = 1;
        const audio = this.engine.getAudio();
        if (c.sound === 'squeak') audio.playSqueak();
        else if (c.sound === 'chirp') { audio.playChirp(); this.engine.getParticles().spawnNotes(p.x, p.y - size * 0.4, 2); }
        else audio.playHoot();
        this.engine.getParticles().spawnHearts(p.x, p.y - size * 0.4, 2);
        if (c.zone && c.mode === 'idle') {
          this.startCritterMove(c, {
            u: clamp(c.u + randomRange(-0.06, 0.06), c.zone.u0, c.zone.u1),
            v: clamp(c.v + randomRange(-0.03, 0.03), c.zone.v0, c.zone.v1),
          });
        }
        return;
      }
    }

    // 5. Lanterns — give them a push
    const lanternSize = clamp(Math.min(this.engine.getWidth(), this.engine.getHeight()) * 0.065, 34, 58);
    for (const l of this.lanterns) {
      const pivot = this.toScreen(l.u, l.v);
      const cx = pivot.x + Math.sin(l.angle) * lanternSize * 0.46;
      const cy = pivot.y + Math.cos(l.angle) * lanternSize * 0.46;
      if (dist(x, y, cx, cy) < Math.max(34, lanternSize * 0.7)) {
        l.vel += x < cx ? 2.4 : -2.4;
        l.flash = 1;
        this.engine.getAudio().playPentatonicChime(Math.floor(Math.random() * 5));
        this.engine.getParticles().spawnSparkles(cx, cy, 4);
        return;
      }
    }

    // 6. Glow flowers — each plays its note
    for (const f of this.flowers) {
      const p = this.toScreen(f.u, f.v);
      const size = clamp(Math.min(this.engine.getWidth(), this.engine.getHeight()) * 0.062, 32, 56);
      if (dist(x, y, p.x, p.y) < Math.max(32, size * 0.7)) {
        f.bounceT = 1;
        this.engine.getAudio().playPentatonicChime(f.note);
        this.engine.getParticles().spawnNotes(p.x, p.y - size * 0.5, 2, f.hue);
        return;
      }
    }

    // 7. Walk the kitten anywhere on the island — both levels are roamable
    const img = this.toImage(x, y);
    const vis = this.visibleURange();
    img.u = clamp(img.u, vis.min, vis.max);
    const cl = this.clampToWalkable(img.u, img.v);
    const target = this.toScreen(cl.u, cl.v);
    this.kitten.speed = 175;
    this.kitten.walkTo(target.x, target.y);
    if (!wasAsleep) this.engine.getAudio().playPop();
  }

  handleMove(_x: number, _y: number): void {}
}
