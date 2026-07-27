// GreenhouseScene — Plant seeds, grow magical flowers, collect glowing seeds
// Watering can, seed packets, flower beds, no wrong recipes, all positive feedback

import { Scene, RenderContext } from '../engine/types';
import { GameEngine } from '../engine/GameEngine';
import { Kitten } from '../entities/Kitten';
import { PlantData } from '../engine/GameState';
import { lerp, clamp, dist, randomInt, pick, hsl, easeOutBack } from '../engine/utils';

interface SoilPlot {
  x: number;
  y: number;
  w: number;
  h: number;
  plant: PlantData | null;
  moisture: number; // 0-1
}

interface SeedPacket {
  x: number;
  y: number;
  type: PlantData['type'];
  color: string;
  label: string;
  selected: boolean;
  bounce: number;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

export class GreenhouseScene implements Scene {
  private engine: GameEngine;
  private kitten: Kitten;
  private time = 0;
  private plots: SoilPlot[] = [];
  private seedPackets: SeedPacket[] = [];
  private selectedSeed: PlantData['type'] | null = null;
  private floatingTexts: FloatingText[] = [];
  private waterCan: { x: number; y: number; active: boolean; angle: number };
  private waterParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private ambientSpawned = false;
  private bgGradient: CanvasGradient | null = null;
  private exitButton: { x: number; y: number; r: number };
  private waterButton: { x: number; y: number; r: number; active: boolean };
  private waterMode: boolean = false;
  private tapRipples: { x: number; y: number; r: number; life: number }[] = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.kitten = new Kitten(0, 0, engine.getState().kitten, engine);
    this.waterCan = { x: 0, y: 0, active: false, angle: 0 };
    this.exitButton = { x: 0, y: 0, r: 30 };
    this.waterButton = { x: 0, y: 0, r: 30, active: false };
  }

  enter(): void {
    const w = this.engine.getWidth();
    const h = this.engine.getHeight();

    // Place kitten at entrance
    this.kitten.x = w * 0.5;
    this.kitten.y = h * 0.85;
    this.kitten.targetX = w * 0.5;
    this.kitten.targetY = h * 0.85;
    this.kitten.scale = 0.9;

    // Create soil plots — 2 rows of 3
    this.plots = [];
    const plotW = w * 0.12;
    const plotH = h * 0.08;
    const startX = w * 0.25;
    const startY = h * 0.38;
    const spacingX = w * 0.18;
    const spacingY = h * 0.18;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        this.plots.push({
          x: startX + col * spacingX,
          y: startY + row * spacingY,
          w: plotW,
          h: plotH,
          plant: null,
          moisture: 0,
        });
      }
    }

    // Load saved plants
    const savedPlants = this.engine.getState().greenhousePlants;
    for (const plant of savedPlants) {
      const plot = this.plots.find(p => p.x === plant.x && p.y === plant.y);
      if (plot) {
        plot.plant = plant;
        plot.moisture = plant.watered ? 0.5 : 0.2;
      }
    }

    // Create seed packets
    this.seedPackets = [
      { x: w * 0.08, y: h * 0.25, type: 'flower', color: '#e87bc7', label: 'Flower', selected: false, bounce: 0 },
      { x: w * 0.08, y: h * 0.38, type: 'mushroom', color: '#d47a5a', label: 'Mushroom', selected: false, bounce: 0 },
      { x: w * 0.08, y: h * 0.51, type: 'vine', color: '#7ac78f', label: 'Vine', selected: false, bounce: 0 },
    ];

    // Buttons
    this.exitButton = { x: w * 0.05, y: h * 0.08, r: 25 };
    this.waterButton = { x: w * 0.95, y: h * 0.08, r: 25, active: false };

    // Fireflies for ambiance
    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(12, w, h);
      this.ambientSpawned = true;
    }

    // Entry storyboard
    this.engine.showStoryboard([
      { text: 'Welcome to the Greenhouse, a place where magical seeds become glowing flowers.', duration: 3.5 },
      { text: 'Tap a seed packet, then tap a soil plot to plant.', duration: 3.5 },
      { text: 'Tap the watering can button to water your plants and watch them grow.', duration: 3.5 },
      { text: 'Collect the glowing seeds they drop. There is no wrong way here.', duration: 3.5 },
    ], () => {});
  }

  exit(): void {
    this.ambientSpawned = false;
    this.engine.getParticles().clear();
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.kitten.update(dt);

    // Update plots — plants grow
    for (const plot of this.plots) {
      if (plot.plant) {
        // Growth logic — needs water to grow
        if (plot.moisture > 0.1 && plot.plant.growthStage < 4) {
          plot.plant.growthStage = Math.min(4, plot.plant.growthStage + dt * 0.08);
          this.engine.getState().updateGreenhousePlant(plot.plant.id, { growthStage: plot.plant.growthStage });
        }

        // Moisture evaporates
        plot.moisture = Math.max(0, plot.moisture - dt * 0.02);

        // Glowing flowers drop seeds occasionally
        if (plot.plant.growthStage >= 4 && !plot.plant.glowing) {
          plot.plant.glowing = true;
          this.engine.getState().updateGreenhousePlant(plot.plant.id, { glowing: true });
          // Sparkle effect
          this.engine.getParticles().spawnSparkles(plot.x, plot.y - plot.h * 0.5, 8);
          this.engine.getAudio().playSparkle();
          this.spawnFloatingText('A flower blooms!', plot.x, plot.y - plot.h, '#e8d4f5');
        }

        // Drop seeds from glowing plants
        if (plot.plant.glowing && Math.random() < 0.005) {
          this.engine.getParticles().spawnSeeds(plot.x, plot.y - plot.h * 0.5, 2);
          this.engine.getState().addStars(1);
          this.spawnFloatingText('+1 dream seed', plot.x, plot.y - plot.h, '#a8f5c8');
        }
      }

      // Wither if dry for too long (but never dies — just stops growing, no fail state)
    }

    // Update seed packet bounce
    for (const sp of this.seedPackets) {
      if (sp.selected) sp.bounce += dt * 4;
      else sp.bounce = 0;
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 30;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Update water particles
    for (let i = this.waterParticles.length - 1; i >= 0; i--) {
      const wp = this.waterParticles[i];
      wp.x += wp.vx * dt * 60;
      wp.y += wp.vy * dt * 60;
      wp.vy += dt * 5;
      wp.life -= dt;
      if (wp.life <= 0) this.waterParticles.splice(i, 1);
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
    const assets = this.engine.getAssets();

    // Background image
    if (!assets.drawBackground(ctx, 'greenhouse_bg', width, height)) {
      if (!this.bgGradient) {
        this.bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        this.bgGradient.addColorStop(0, '#1a2a1a');
        this.bgGradient.addColorStop(0.3, '#2a3a2a');
        this.bgGradient.addColorStop(0.6, '#3a4a3a');
        this.bgGradient.addColorStop(1, '#2a3a2a');
      }
      ctx.fillStyle = this.bgGradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Glass roof beams
    ctx.strokeStyle = 'rgba(200, 220, 180, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = (width / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height * 0.3);
      ctx.stroke();
    }
    // Roof curve
    ctx.beginPath();
    ctx.moveTo(0, height * 0.15);
    ctx.quadraticCurveTo(width * 0.5, height * 0.05, width, height * 0.15);
    ctx.stroke();

    // Windows with soft light
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.filter = 'blur(20px)';
    ctx.fillStyle = '#ffdd80';
    ctx.beginPath();
    ctx.ellipse(width * 0.3, height * 0.1, 80, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffaa80';
    ctx.beginPath();
    ctx.ellipse(width * 0.7, height * 0.1, 70, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // Wooden shelves/table
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath();
    ctx.roundRect(width * 0.18, height * 0.32, width * 0.72, height * 0.42, 10);
    ctx.fill();

    // Shelf top edge
    ctx.fillStyle = '#6a5a4a';
    ctx.beginPath();
    ctx.roundRect(width * 0.18, height * 0.32, width * 0.72, 8, 10);
    ctx.fill();

    // Seed packet shelf (left side)
    ctx.fillStyle = '#4a3a2a';
    ctx.beginPath();
    ctx.roundRect(width * 0.03, height * 0.15, width * 0.1, height * 0.5, 8);
    ctx.fill();

    // Seed packets
    for (const sp of this.seedPackets) {
      this.drawSeedPacket(ctx, sp);
    }

    // Soil plots
    for (const plot of this.plots) {
      this.drawPlot(ctx, plot);
    }

    // Water particles
    for (const wp of this.waterParticles) {
      ctx.fillStyle = `rgba(150, 200, 255, ${wp.life * 0.8})`;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Kitten
    this.kitten.render(ctx);

    // Floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life / ft.maxLife);
      ctx.font = `500 ${16}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Exit button (top left)
    this.drawExitButton(ctx);

    // Water button (top right)
    this.drawWaterButton(ctx);

    // Water mode indicator
    if (this.waterMode) {
      ctx.save();
      ctx.font = '400 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(150, 220, 255, 0.8)';
      ctx.fillText('💧 Tap a plot to water it', width * 0.5, height * 0.12);
      ctx.restore();
    }

    // Star count
    this.drawStarCount(ctx, width, height);

    // Tap ripples
    for (const r of this.tapRipples) {
      ctx.strokeStyle = `rgba(255, 220, 150, ${r.life * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawSeedPacket(ctx: CanvasRenderingContext2D, sp: SeedPacket): void {
    const assets = this.engine.getAssets();
    const bounceY = sp.selected ? Math.sin(sp.bounce) * 4 : 0;
    const scale = sp.selected ? 1.1 : 1;
    const x = sp.x;
    const y = sp.y + bounceY;

    // Try image asset first
    const assetKey = `seed_${sp.type}`;
    const img = assets.get(assetKey);
    if (img) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const imgScale = 60 / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * imgScale;
      const h = img.naturalHeight * imgScale;
      ctx.globalAlpha = sp.selected ? 1 : 0.8;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      // Selection glow
      if (sp.selected) {
        ctx.globalAlpha = 0.3;
        ctx.filter = 'blur(10px)';
        ctx.fillStyle = '#8a7aaa';
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = 'none';
      }
      ctx.restore();
      return;
    }

    // Fallback: code-drawn packet
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Packet background
    ctx.fillStyle = sp.selected ? '#4a3a5a' : '#3a2a3a';
    ctx.beginPath();
    ctx.roundRect(-25, -30, 50, 60, 6);
    ctx.fill();

    // Packet border
    ctx.strokeStyle = sp.selected ? '#8a7aaa' : '#6a5a7a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Seed icon
    ctx.fillStyle = sp.color;
    if (sp.type === 'flower') {
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 6, Math.sin(angle) * 6 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (sp.type === 'mushroom') {
      ctx.beginPath();
      ctx.arc(0, -5, 8, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-5, -5, 10, 10);
    } else if (sp.type === 'vine') {
      ctx.lineWidth = 3;
      ctx.strokeStyle = sp.color;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(-10, 0, 0, -10);
      ctx.quadraticCurveTo(10, 0, 0, -10);
      ctx.stroke();
    }

    // Label
    ctx.font = '400 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = sp.selected ? '#ddd' : '#aa9aba';
    ctx.fillText(sp.label, 0, 25);

    ctx.restore();
  }

  private drawPlot(ctx: CanvasRenderingContext2D, plot: SoilPlot): void {
    const { x, y, w, h } = plot;

    // Soil
    const moistureColor = plot.moisture > 0.3 ? '#3a2a1a' : '#4a3a2a';
    ctx.fillStyle = moistureColor;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
    ctx.fill();

    // Soil texture
    ctx.fillStyle = 'rgba(60, 40, 20, 0.3)';
    for (let i = 0; i < 6; i++) {
      const sx = x - w / 2 + Math.random() * w;
      const sy = y - h / 2 + Math.random() * h;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Empty plot hint
    if (!plot.plant && this.selectedSeed) {
      const pulse = 0.5 + Math.sin(this.time * 2) * 0.3;
      ctx.strokeStyle = `rgba(200, 255, 200, ${pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Plant
    if (plot.plant) {
      this.drawPlant(ctx, plot.plant, plot);
    }
  }

  private drawPlant(ctx: CanvasRenderingContext2D, plant: PlantData, plot: SoilPlot): void {
    const assets = this.engine.getAssets();
    const stage = plant.growthStage;
    const cx = plot.x;
    const cy = plot.y;

    // Determine which stage sprite to use (1-4)
    const stageIdx = Math.min(4, Math.max(1, Math.ceil(stage)));
    const assetKey = `${plant.type}_stage${stageIdx}`;
    const img = assets.get(assetKey);

    if (img) {
      // Draw plant sprite centered on plot, growing from bottom
      const swayOffset = Math.sin(this.time * 1.5 + cx * 0.01) * 2;
      const scale = (plot.h * 1.5) / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;

      ctx.save();
      ctx.globalAlpha = 0.9;

      // Glow for fully grown plants
      if (plant.glowing) {
        ctx.save();
        const glowColor = plant.type === 'flower' ? 'rgba(255, 200, 220, 0.2)' :
                          plant.type === 'mushroom' ? 'rgba(255, 200, 100, 0.2)' :
                          'rgba(120, 255, 150, 0.2)';
        ctx.fillStyle = glowColor;
        ctx.filter = 'blur(15px)';
        ctx.beginPath();
        ctx.arc(cx + swayOffset, cy - h * 0.3, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }

      // Draw the plant sprite, anchored at bottom-center
      ctx.drawImage(img, cx - w / 2 + swayOffset, cy - h, w, h);
      ctx.restore();
      return;
    }

    // Fallback: code-drawn plant (original procedural rendering)
    if (stage < 1) {
      // Seed/sprout
      ctx.fillStyle = '#7a5a3a';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      if (stage > 0.3) {
        ctx.strokeStyle = '#7ac75a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 8 * stage);
        ctx.stroke();
      }
    } else if (stage < 2) {
      // Small sprout
      ctx.strokeStyle = '#7ac75a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 15);
      ctx.stroke();
      // Leaves
      ctx.fillStyle = '#7ac75a';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 10, 5, 3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 6, cy - 10, 5, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage < 3) {
      // Growing plant
      ctx.strokeStyle = '#5aa54a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 25);
      ctx.stroke();
      // Leaves
      ctx.fillStyle = '#7ac75a';
      ctx.beginPath();
      ctx.ellipse(cx - 8, cy - 15, 7, 4, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 8, cy - 20, 7, 4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage < 4) {
      // Budding
      ctx.strokeStyle = '#5aa54a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 35);
      ctx.stroke();
      // Leaves
      ctx.fillStyle = '#7ac75a';
      ctx.beginPath();
      ctx.ellipse(cx - 10, cy - 20, 8, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 10, cy - 25, 8, 5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Bud
      ctx.fillStyle = plant.color;
      ctx.beginPath();
      ctx.arc(cx, cy - 35, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Full bloom — drawing by type
      const swayOffset = Math.sin(this.time * 1.5 + cx * 0.01) * 2;

      if (plant.type === 'flower') {
        // Stem
        ctx.strokeStyle = '#5aa54a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + swayOffset, cy - 20, cx + swayOffset, cy - 40);
        ctx.stroke();

        // Leaves
        ctx.fillStyle = '#7ac75a';
        ctx.beginPath();
        ctx.ellipse(cx - 10, cy - 22, 8, 5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 10, cy - 28, 8, 5, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Flower head
        const fx = cx + swayOffset;
        const fy = cy - 40;

        if (plant.glowing) {
          ctx.save();
          ctx.fillStyle = plant.color.replace(')', ', 0.3)').replace('rgb', 'rgba');
          ctx.filter = 'blur(15px)';
          ctx.beginPath();
          ctx.arc(fx, fy, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.filter = 'none';
          ctx.restore();
        }

        ctx.fillStyle = plant.color;
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6 + this.time * 0.1;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(angle) * 8, fy + Math.sin(angle) * 8, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(fx, fy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (plant.type === 'mushroom') {
        // Stem
        ctx.fillStyle = '#e8d8c8';
        ctx.fillRect(cx - 4, cy - 20, 8, 20);

        // Cap
        const mx = cx + swayOffset * 0.5;
        ctx.fillStyle = plant.color;
        ctx.beginPath();
        ctx.arc(mx, cy - 20, 14, Math.PI, 0);
        ctx.fill();

        // Spots
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(mx - 5, cy - 25, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mx + 4, cy - 22, 2, 0, Math.PI * 2);
        ctx.fill();

        if (plant.glowing) {
          ctx.save();
          ctx.fillStyle = `rgba(255, 200, 100, 0.2)`;
          ctx.filter = 'blur(15px)';
          ctx.beginPath();
          ctx.arc(mx, cy - 20, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.filter = 'none';
          ctx.restore();
        }
      } else if (plant.type === 'vine') {
        // Trailing vine
        ctx.strokeStyle = '#5aa54a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx - 15 + swayOffset, cy - 20, cx - 10 + swayOffset, cy - 35);
        ctx.quadraticCurveTo(cx + 5 + swayOffset, cy - 45, cx + 15 + swayOffset, cy - 30);
        ctx.stroke();

        // Leaves along vine
        ctx.fillStyle = '#7ac75a';
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          const vx = cx + (swayOffset * 0.5) - 15 * Math.sin(t * Math.PI) + 15 * t;
          const vy = cy - 35 * (1 - t) - 5;
          ctx.beginPath();
          ctx.ellipse(vx, vy, 6, 4, t * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (plant.glowing) {
          ctx.save();
          ctx.fillStyle = `rgba(120, 255, 150, 0.2)`;
          ctx.filter = 'blur(15px)';
          ctx.beginPath();
          ctx.arc(cx + swayOffset, cy - 30, 25, 0, Math.PI * 2);
          ctx.fill();
          ctx.filter = 'none';
          ctx.restore();
        }
      }
    }
  }

  private drawExitButton(ctx: CanvasRenderingContext2D): void {
    const assets = this.engine.getAssets();
    const { x, y, r } = this.exitButton;

    // Try image asset
    const img = assets.get('btn_home');
    if (img) {
      const scale = (r * 2) / Math.max(img.naturalWidth, img.naturalHeight);
      assets.draw(ctx, 'btn_home', x, y, scale, 0.85);
      // Label
      ctx.font = '400 10px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200, 180, 220, 0.6)';
      ctx.fillText('Home', x, y + r + 15);
      return;
    }

    // Fallback code-drawn
    ctx.save();
    ctx.fillStyle = 'rgba(200, 180, 255, 0.1)';
    ctx.filter = 'blur(10px)';
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
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

  private drawWaterButton(ctx: CanvasRenderingContext2D): void {
    const assets = this.engine.getAssets();
    const { x, y, r } = this.waterButton;

    // Try image asset
    const img = assets.get('btn_water');
    if (img) {
      const scale = (r * 2) / Math.max(img.naturalWidth, img.naturalHeight);
      const alpha = this.waterMode ? 1 : 0.7;
      assets.draw(ctx, 'btn_water', x, y, scale, alpha);
      // Active glow
      if (this.waterMode) {
        ctx.save();
        ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
        ctx.filter = 'blur(15px)';
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }
      ctx.font = '400 10px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.waterMode ? 'rgba(138, 202, 255, 0.9)' : 'rgba(106, 138, 170, 0.6)';
      ctx.fillText('Water', x, y + r + 15);
      return;
    }

    // Fallback code-drawn
    ctx.save();
    ctx.fillStyle = this.waterMode ? 'rgba(100, 200, 255, 0.3)' : 'rgba(100, 200, 255, 0.1)';
    ctx.filter = 'blur(10px)';
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.fillStyle = this.waterMode ? '#2a4a6a' : '#2a3a4a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.waterMode ? '#6aaaff' : '#4a6a8a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8acaff';
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 8, 16, 12, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 5);
    ctx.lineTo(x + 12, y - 10);
    ctx.lineTo(x + 12, y - 8);
    ctx.lineTo(x + 6, y - 3);
    ctx.fill();
    ctx.strokeStyle = '#8acaff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 2, y - 10, 5, Math.PI, 0);
    ctx.stroke();
    ctx.font = '400 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.waterMode ? '#8acaff' : '#6a8aaa';
    ctx.fillText('Water', x, y + r + 15);
    ctx.restore();
  }

  private drawStarCount(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const stars = this.engine.getState().totalStars;
    ctx.save();
    ctx.font = '400 14px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 220, 150, 0.8)';
    ctx.fillText(`✦ ${stars} dream seeds`, width - 20, height * 0.08 + 4);
    ctx.restore();
  }

  private spawnFloatingText(text: string, x: number, y: number, color: string): void {
    this.floatingTexts.push({ text, x, y, life: 2, maxLife: 2, color });
  }

  handleTap(x: number, y: number): void {
    // Ripple
    this.tapRipples.push({ x, y, r: 5, life: 0.5 });

    // Exit button
    if (dist(x, y, this.exitButton.x, this.exitButton.y) < this.exitButton.r) {
      this.engine.getAudio().playPop();
      this.engine.showStoryboard([
        { text: 'Leaving the Greenhouse...', duration: 2 },
        { text: 'Your plants will keep growing while you are away.', duration: 2.5 },
      ], () => {
        this.engine.changeScene('hub');
      });
      return;
    }

    // Water button
    if (dist(x, y, this.waterButton.x, this.waterButton.y) < this.waterButton.r) {
      this.waterMode = !this.waterMode;
      this.engine.getAudio().playPop();
      this.waterButton.active = this.waterMode;
      if (this.waterMode) {
        this.selectedSeed = null;
        for (const sp of this.seedPackets) sp.selected = false;
      }
      return;
    }

    // Seed packet selection
    for (const sp of this.seedPackets) {
      if (dist(x, y, sp.x, sp.y) < 30) {
        if (sp.selected) {
          sp.selected = false;
          this.selectedSeed = null;
        } else {
          for (const s of this.seedPackets) s.selected = false;
          sp.selected = true;
          this.selectedSeed = sp.type;
          this.waterMode = false;
          this.engine.getAudio().playPentatonicChime(1);
        }
        return;
      }
    }

    // Plot interaction
    for (const plot of this.plots) {
      if (x > plot.x - plot.w / 2 && x < plot.x + plot.w / 2 && y > plot.y - plot.h / 2 && y < plot.y + plot.h / 2) {
        if (this.waterMode && plot.plant) {
          // Water the plant
          plot.moisture = 1;
          plot.plant.watered = true;
          plot.plant.lastWatered = Date.now();
          this.engine.getState().updateGreenhousePlant(plot.plant.id, { watered: true, lastWatered: plot.plant.lastWatered });
          this.engine.getAudio().playPentatonicChime(3);
          this.spawnWaterParticles(plot.x, plot.y);
          this.spawnFloatingText('✨ Growing!', plot.x, plot.y - plot.h, '#aaccff');
          this.kitten.beHappy();
          this.engine.getParticles().spawnSparkles(plot.x, plot.y - plot.h * 0.5, 4);
        } else if (this.selectedSeed && !plot.plant) {
          // Plant a seed
          const seedPacket = this.seedPackets.find(sp => sp.type === this.selectedSeed);
          const plant: PlantData = {
            id: `plant_${Date.now()}_${Math.random()}`,
            type: this.selectedSeed!,
            growthStage: 0,
            x: plot.x,
            y: plot.y,
            color: seedPacket?.color || '#e87bc7',
            glowing: false,
            watered: false,
            lastWatered: 0,
          };
          plot.plant = plant;
          plot.moisture = 0.3;
          this.engine.getState().addGreenhousePlant(plant);
          this.engine.getAudio().playPop();
          this.spawnFloatingText('Planted!', plot.x, plot.y - plot.h, '#aaffaa');
          this.kitten.beHappy();
          this.engine.getParticles().spawnSparkles(plot.x, plot.y, 3);
        } else if (plot.plant && plot.plant.glowing) {
          // Collect seeds from glowing plant
          this.engine.getParticles().spawnSeeds(plot.x, plot.y - plot.h * 0.5, 3);
          this.engine.getState().addStars(1);
          this.spawnFloatingText('+1 dream seed', plot.x, plot.y - plot.h, '#a8f5c8');
          this.engine.getAudio().playPentatonicChime(4);
          this.kitten.beHappy();
        } else if (plot.plant) {
          // Tap on existing plant — pet it
          this.kitten.beHappy();
          this.engine.getAudio().playPentatonicChime(0);
          this.engine.getParticles().spawnSparkles(plot.x, plot.y - 20, 3);
          this.spawnFloatingText('So cozy!', plot.x, plot.y - plot.h, '#ffd4a8');
        }
        return;
      }
    }

    // Walk kitten to tap
    this.kitten.walkTo(clamp(x, this.engine.getWidth() * 0.15, this.engine.getWidth() * 0.9), clamp(y, this.engine.getHeight() * 0.3, this.engine.getHeight() * 0.85));
    this.engine.getAudio().playPop();
  }

  private spawnWaterParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.waterParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 30,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 2,
        life: 1,
      });
    }
  }

  handleMove(x: number, y: number): void {
    // Could implement hover effects
  }
}
