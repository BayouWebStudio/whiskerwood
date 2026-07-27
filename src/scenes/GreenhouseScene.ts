// GreenhouseScene — Plant seeds, grow magical flowers, collect glowing seeds.
// Soil plots are anchored to the watercolor art (image space); UI lives in
// screen space. No wrong choices, all positive feedback.

import { Scene, RenderContext } from '../engine/types';
import { GameEngine } from '../engine/GameEngine';
import { Kitten } from '../entities/Kitten';
import { PlantData } from '../engine/GameState';
import { clamp, dist, drawGlow } from '../engine/utils';

const BG = 'greenhouse_bg';

// Plot anchors on the painted floor (image space, row-major)
const PLOT_ANCHORS: { u: number; v: number }[] = [
  { u: 0.40, v: 0.70 }, { u: 0.53, v: 0.70 }, { u: 0.66, v: 0.70 },
  { u: 0.36, v: 0.90 }, { u: 0.51, v: 0.90 }, { u: 0.66, v: 0.90 },
];

// Where the kitten may wander (image space)
const WALK = { u0: 0.24, v0: 0.62, u1: 0.96, v1: 0.95 };

interface SoilPlot {
  index: number;
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
  private waterParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private ambientSpawned = false;
  private exitButton = { x: 0, y: 0, r: 30 };
  private waterButton = { x: 0, y: 0, r: 32 };
  private waterMode = false;
  private tapRipples: { x: number; y: number; r: number; life: number }[] = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.kitten = new Kitten(0, 0, engine.getState().kitten, engine);
  }

  private toScreen(u: number, v: number): { x: number; y: number } {
    return this.engine.getAssets().anchor(BG, u, v, this.engine.getWidth(), this.engine.getHeight());
  }

  private toImage(x: number, y: number): { u: number; v: number } {
    return this.engine.getAssets().toImage(BG, x, y, this.engine.getWidth(), this.engine.getHeight());
  }

  layout(): void {
    const w = this.engine.getWidth();
    const h = this.engine.getHeight();

    const plotW = clamp(Math.min(w, h) * 0.15, 80, 150);
    for (const plot of this.plots) {
      const a = PLOT_ANCHORS[plot.index];
      const p = this.toScreen(a.u, a.v);
      plot.x = p.x;
      plot.y = p.y;
      plot.w = plotW * (a.v > 0.8 ? 1.12 : 0.95); // front row slightly bigger
      plot.h = plot.w * 0.42;
      if (plot.plant) {
        plot.plant.x = p.x;
        plot.plant.y = p.y;
      }
    }

    // Screen-space UI
    const px = Math.max(52, w * 0.055);
    this.seedPackets.forEach((sp, i) => {
      sp.x = px;
      sp.y = h * (0.30 + i * 0.15);
    });
    this.exitButton = { x: Math.max(44, w * 0.05), y: Math.max(46, h * 0.075), r: 28 };
    this.waterButton = { x: w - Math.max(52, w * 0.055), y: h * 0.78, r: 34 };

    this.kitten.baseSize = clamp(Math.min(w, h) * 0.19, 105, 180);
  }

  enter(): void {
    const state = this.engine.getState();

    // Build plots
    this.plots = PLOT_ANCHORS.map((_, i) => ({
      index: i, x: 0, y: 0, w: 0, h: 0, plant: null, moisture: 0,
    }));

    // Attach saved plants by stable plot index
    for (const plant of state.greenhousePlants) {
      const plot = this.plots[plant.plotIndex ?? -1];
      if (plot && !plot.plant) {
        plot.plant = plant;
        plot.moisture = plant.watered ? 0.5 : 0.2;
      }
    }

    // Plants kept growing while we were away (as the storyboard promises)
    const last = state.greenhouseLastVisit;
    if (last > 0) {
      const awaySec = Math.min((Date.now() - last) / 1000, 60 * 60 * 24);
      for (const plot of this.plots) {
        if (plot.plant && plot.plant.watered && plot.plant.growthStage < 4) {
          const bonus = awaySec * 0.02; // half the watered in-scene rate
          plot.plant.growthStage = Math.min(4, plot.plant.growthStage + bonus);
          state.updateGreenhousePlant(plot.plant.id, { growthStage: plot.plant.growthStage });
        }
      }
    }
    state.setGreenhouseLastVisit(Date.now());

    // Seed packets
    this.seedPackets = [
      { x: 0, y: 0, type: 'flower', color: '#e87bc7', label: 'Flower', selected: false, bounce: 0 },
      { x: 0, y: 0, type: 'mushroom', color: '#d47a5a', label: 'Mushroom', selected: false, bounce: 0 },
      { x: 0, y: 0, type: 'vine', color: '#7ac78f', label: 'Vine', selected: false, bounce: 0 },
    ];
    this.selectedSeed = null;
    this.waterMode = false;

    this.layout();

    // Kitten pads in from the doorway
    const start = this.toScreen(0.62, 0.86);
    this.kitten.x = start.x;
    this.kitten.y = start.y;
    this.kitten.targetX = start.x;
    this.kitten.targetY = start.y;

    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(10, this.engine.getWidth(), this.engine.getHeight());
      this.ambientSpawned = true;
    }

    // Full instructions only the first time — short welcome after
    if (!state.hasVisited('greenhouse')) {
      state.markVisited('greenhouse');
      this.engine.showStoryboard([
        { text: 'Welcome to the Greenhouse, where magical seeds become glowing flowers.', duration: 3.5 },
        { text: 'Tap a seed packet, then tap a soil bed to plant it.', duration: 3.2 },
        { text: 'Tap the watering can, then water your plants to help them grow.', duration: 3.2 },
        { text: 'Your plants keep growing even while you are away. There is no wrong way here.', duration: 3.5 },
      ], () => {});
    } else {
      this.engine.showStoryboard([
        { text: 'Welcome back to the Greenhouse 🌱', duration: 1.6 },
      ], () => {});
    }
  }

  exit(): void {
    this.ambientSpawned = false;
    this.engine.getParticles().clear();
    this.engine.getState().setGreenhouseLastVisit(Date.now());
    this.engine.getState().flush();
  }

  update(dt: number, time: number): void {
    this.time = time;

    const kImg = this.toImage(this.kitten.x, this.kitten.y);
    this.kitten.depthScale = 0.8 + clamp((kImg.v - 0.62) / (0.95 - 0.62), 0, 1) * 0.25;
    this.kitten.update(dt);

    for (const plot of this.plots) {
      if (plot.plant) {
        // Growth — needs water
        if (plot.moisture > 0.1 && plot.plant.growthStage < 4) {
          plot.plant.growthStage = Math.min(4, plot.plant.growthStage + dt * 0.08);
          this.engine.getState().updateGreenhousePlant(plot.plant.id, { growthStage: plot.plant.growthStage });
        }

        // Moisture evaporates slowly
        plot.moisture = Math.max(0, plot.moisture - dt * 0.02);

        // First full bloom
        if (plot.plant.growthStage >= 4 && !plot.plant.glowing) {
          plot.plant.glowing = true;
          this.engine.getState().updateGreenhousePlant(plot.plant.id, { glowing: true });
          this.engine.getParticles().spawnSparkles(plot.x, plot.y - plot.h, 8);
          this.engine.getAudio().playSparkle();
          this.spawnFloatingText('A flower blooms!', plot.x, plot.y - plot.h * 1.5, '#e8d4f5');
          this.kitten.beHappy();
        }

        // Glowing plants occasionally drop dream seeds
        if (plot.plant.glowing && Math.random() < 0.004) {
          this.engine.getParticles().spawnSeeds(plot.x, plot.y - plot.h, 2);
          this.engine.getState().addStars(1);
          this.spawnFloatingText('+1 dream seed', plot.x, plot.y - plot.h * 1.5, '#a8f5c8');
        }
      }
    }

    for (const sp of this.seedPackets) {
      if (sp.selected) sp.bounce += dt * 4;
      else sp.bounce = 0;
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 30;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    for (let i = this.waterParticles.length - 1; i >= 0; i--) {
      const wp = this.waterParticles[i];
      wp.x += wp.vx * dt * 60;
      wp.y += wp.vy * dt * 60;
      wp.vy += dt * 5;
      wp.life -= dt;
      if (wp.life <= 0) this.waterParticles.splice(i, 1);
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

    // The watercolor greenhouse painting IS the scene — no code-drawn
    // furniture fighting it.
    if (!assets.drawBackground(ctx, BG, width, height)) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1a2a1a');
      grad.addColorStop(0.5, '#2a3a2a');
      grad.addColorStop(1, '#2a3a2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Depth-sort plots and kitten so the cat can walk between the rows
    const drawables: { y: number; draw: () => void }[] = [];
    for (const plot of this.plots) {
      drawables.push({ y: plot.y, draw: () => this.drawPlot(ctx, plot) });
    }
    drawables.push({ y: this.kitten.y, draw: () => this.kitten.render(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Water droplets
    for (const wp of this.waterParticles) {
      ctx.fillStyle = `rgba(150, 200, 255, ${wp.life * 0.8})`;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
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

    // UI
    for (const sp of this.seedPackets) this.drawSeedPacket(ctx, sp);
    this.drawExitButton(ctx);
    this.drawWaterButton(ctx);

    if (this.waterMode) {
      ctx.save();
      ctx.font = '400 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(170, 225, 255, 0.9)';
      ctx.shadowColor = 'rgba(15, 8, 25, 0.7)';
      ctx.shadowBlur = 6;
      ctx.fillText('💧 Tap a soil bed to water it', width * 0.5, height * 0.10);
      ctx.restore();
    } else if (this.selectedSeed) {
      ctx.save();
      ctx.font = '400 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(190, 255, 200, 0.9)';
      ctx.shadowColor = 'rgba(15, 8, 25, 0.7)';
      ctx.shadowBlur = 6;
      ctx.fillText('🌱 Tap a soil bed to plant your seed', width * 0.5, height * 0.10);
      ctx.restore();
    }

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
    const scale = sp.selected ? 1.12 : 1;
    const x = sp.x;
    const y = sp.y + bounceY;
    const size = 62 * scale;

    if (sp.selected) {
      drawGlow(ctx, x, y, size * 0.9, '200, 180, 255', 0.4);
    }

    if (!assets.drawFit(ctx, `seed_${sp.type}`, x, y, size, sp.selected ? 1 : 0.85)) {
      // Fallback: simple card
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = sp.selected ? '#4a3a5a' : '#3a2a3a';
      ctx.beginPath();
      ctx.roundRect(-24, -30, 48, 60, 6);
      ctx.fill();
      ctx.strokeStyle = sp.selected ? '#8a7aaa' : '#6a5a7a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(0, -5, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.font = '500 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = sp.selected ? 'rgba(255, 250, 235, 0.95)' : 'rgba(230, 215, 235, 0.75)';
    ctx.shadowColor = 'rgba(15, 8, 25, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(sp.label, x, y + size * 0.62 + 8);
    ctx.restore();
  }

  private drawPlot(ctx: CanvasRenderingContext2D, plot: SoilPlot): void {
    const assets = this.engine.getAssets();
    const { x, y, w } = plot;

    // Soil bed sprite (falls back to a soft rounded bed)
    if (!assets.drawFit(ctx, 'soil_plot', x, y, w, 1)) {
      ctx.fillStyle = plot.moisture > 0.3 ? '#3a2a1a' : '#4a3a2a';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - plot.h / 2, w, plot.h, 8);
      ctx.fill();
    }

    // Moist soil darkens
    if (plot.moisture > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, plot.moisture * 0.4);
      ctx.fillStyle = '#1e2c40';
      ctx.beginPath();
      ctx.ellipse(x, y + plot.h * 0.05, w * 0.34, plot.h * 0.30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Planting hint
    if (!plot.plant && this.selectedSeed) {
      const pulse = 0.5 + Math.sin(this.time * 2.5) * 0.35;
      drawGlow(ctx, x, y, w * 0.55, '200, 255, 200', pulse * 0.35);
      ctx.strokeStyle = `rgba(210, 255, 210, ${pulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.42, plot.h * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Watering hint
    if (plot.plant && this.waterMode && plot.moisture < 0.4) {
      const pulse = 0.5 + Math.sin(this.time * 2.5) * 0.35;
      drawGlow(ctx, x, y - plot.h, w * 0.4, '150, 210, 255', pulse * 0.4);
    }

    if (plot.plant) {
      this.drawPlant(ctx, plot.plant, plot);
    }
  }

  private drawPlant(ctx: CanvasRenderingContext2D, plant: PlantData, plot: SoilPlot): void {
    const assets = this.engine.getAssets();
    const stage = plant.growthStage;
    const cx = plot.x;
    const cy = plot.y;

    const stageIdx = Math.min(4, Math.max(1, Math.ceil(stage)));
    const assetKey = `${plant.type}_stage${stageIdx}`;
    const swayOffset = Math.sin(this.time * 1.5 + cx * 0.01) * 2;
    // Young plants are small; each stage grows the sprite
    const plantSize = plot.w * (0.35 + stageIdx * 0.17);

    if (plant.glowing) {
      const rgb = plant.type === 'flower' ? '255, 200, 220' :
                  plant.type === 'mushroom' ? '255, 200, 100' : '120, 255, 150';
      const pulse = 0.25 + Math.sin(this.time * 1.8 + plot.index) * 0.1;
      drawGlow(ctx, cx + swayOffset, cy - plantSize * 0.45, plantSize * 0.7, rgb, pulse);
    }

    const img = assets.get(assetKey);
    if (img) {
      const s = plantSize / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.save();
      ctx.globalAlpha = 0.95;
      // Anchored at the soil line, swaying gently
      ctx.drawImage(img, cx - w / 2 + swayOffset, cy + plot.h * 0.1 - h, w, h);
      ctx.restore();
      return;
    }

    // Fallback: minimal code-drawn plant
    ctx.strokeStyle = '#5aa54a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + swayOffset, cy - 10 - stage * 8);
    ctx.stroke();
    if (stage >= 3) {
      ctx.fillStyle = plant.color;
      ctx.beginPath();
      ctx.arc(cx + swayOffset, cy - 10 - stage * 8, 4 + stage, 0, Math.PI * 2);
      ctx.fill();
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

  private drawWaterButton(ctx: CanvasRenderingContext2D): void {
    const assets = this.engine.getAssets();
    const { x, y, r } = this.waterButton;

    if (this.waterMode) {
      drawGlow(ctx, x, y, r + 14, '100, 200, 255', 0.35);
    }

    if (assets.drawFit(ctx, 'btn_water', x, y, r * 2, this.waterMode ? 1 : 0.75)) {
      ctx.save();
      ctx.font = '400 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.waterMode ? 'rgba(150, 210, 255, 0.95)' : 'rgba(150, 180, 210, 0.7)';
      ctx.shadowColor = 'rgba(15, 8, 25, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText('Water', x, y + r + 14);
      ctx.restore();
      return;
    }

    ctx.save();
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
    ctx.font = '400 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Water', x, y + r + 15);
    ctx.restore();
  }

  private spawnFloatingText(text: string, x: number, y: number, color: string): void {
    this.floatingTexts.push({ text, x, y, life: 2, maxLife: 2, color });
  }

  handleTap(x: number, y: number): void {
    this.tapRipples.push({ x, y, r: 5, life: 0.5 });

    // Pet the kitten
    if (this.kitten.hitTest(x, y)) {
      this.kitten.pet();
      return;
    }

    // Exit
    if (dist(x, y, this.exitButton.x, this.exitButton.y) < this.exitButton.r + 8) {
      this.engine.getAudio().playPop();
      this.engine.changeScene('hub');
      return;
    }

    // Water toggle
    if (dist(x, y, this.waterButton.x, this.waterButton.y) < this.waterButton.r + 8) {
      this.waterMode = !this.waterMode;
      this.engine.getAudio().playPop();
      if (this.waterMode) {
        this.selectedSeed = null;
        for (const sp of this.seedPackets) sp.selected = false;
      }
      return;
    }

    // Seed packets
    for (const sp of this.seedPackets) {
      if (dist(x, y, sp.x, sp.y) < 36) {
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

    // Soil plots
    for (const plot of this.plots) {
      const hitW = plot.w * 0.62;
      const hitH = Math.max(plot.h, plot.w * 0.5);
      if (x > plot.x - hitW && x < plot.x + hitW && y > plot.y - hitH && y < plot.y + hitH * 0.7) {
        this.handlePlotTap(plot);
        return;
      }
    }

    // Walk the kitten
    const img = this.toImage(x, y);
    const target = this.toScreen(clamp(img.u, WALK.u0, WALK.u1), clamp(img.v, WALK.v0, WALK.v1));
    this.kitten.speed = 165;
    this.kitten.walkTo(target.x, target.y);
    this.engine.getAudio().playPop();
  }

  private handlePlotTap(plot: SoilPlot): void {
    const state = this.engine.getState();
    if (this.waterMode && plot.plant) {
      plot.moisture = 1;
      plot.plant.watered = true;
      plot.plant.lastWatered = Date.now();
      state.updateGreenhousePlant(plot.plant.id, { watered: true, lastWatered: plot.plant.lastWatered });
      this.engine.getAudio().playPentatonicChime(3);
      this.spawnWaterParticles(plot.x, plot.y);
      this.spawnFloatingText('✨ Growing!', plot.x, plot.y - plot.h * 1.5, '#aaccff');
      this.kitten.beHappy();
      this.engine.getParticles().spawnSparkles(plot.x, plot.y - plot.h, 4);
    } else if (this.selectedSeed && !plot.plant) {
      const seedPacket = this.seedPackets.find(sp => sp.type === this.selectedSeed);
      const plant: PlantData = {
        id: `plant_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        type: this.selectedSeed!,
        growthStage: 0,
        plotIndex: plot.index,
        x: plot.x,
        y: plot.y,
        color: seedPacket?.color || '#e87bc7',
        glowing: false,
        watered: false,
        lastWatered: 0,
      };
      plot.plant = plant;
      plot.moisture = 0.3;
      state.addGreenhousePlant(plant);
      this.engine.getAudio().playPop();
      this.spawnFloatingText('Planted!', plot.x, plot.y - plot.h * 1.5, '#aaffaa');
      this.kitten.beHappy();
      this.engine.getParticles().spawnSparkles(plot.x, plot.y, 3);
    } else if (plot.plant && plot.plant.glowing) {
      this.engine.getParticles().spawnSeeds(plot.x, plot.y - plot.h, 3);
      state.addStars(1);
      this.spawnFloatingText('+1 dream seed', plot.x, plot.y - plot.h * 1.5, '#a8f5c8');
      this.engine.getAudio().playPentatonicChime(4);
      this.kitten.beHappy();
    } else if (plot.plant) {
      this.kitten.beHappy();
      this.engine.getAudio().playPentatonicChime(0);
      this.engine.getParticles().spawnSparkles(plot.x, plot.y - plot.h, 3);
      this.spawnFloatingText('So cozy!', plot.x, plot.y - plot.h * 1.5, '#ffd4a8');
    }
  }

  private spawnWaterParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.waterParticles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y - 40,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 2,
        life: 1,
      });
    }
  }

  handleMove(_x: number, _y: number): void {}
}
