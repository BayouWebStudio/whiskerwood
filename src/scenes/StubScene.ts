// StubScene — Placeholder for rooms that aren't built yet
// Shows a beautiful "coming soon" with sparkle effects and the room name

import { Scene, RenderContext } from '../engine/types';
import { GameEngine } from '../engine/GameEngine';
import { dist, drawGlow } from '../engine/utils';

export class StubScene implements Scene {
  private engine: GameEngine;
  private sceneName: string;
  private label: string;
  private time = 0;
  private ambientSpawned = false;
  private exitButton: { x: number; y: number; r: number } = { x: 0, y: 0, r: 30 };

  constructor(engine: GameEngine, sceneName: string, label: string) {
    this.engine = engine;
    this.sceneName = sceneName;
    this.label = label;
  }

  layout(): void {
    this.exitButton = { x: Math.max(44, this.engine.getWidth() * 0.05), y: Math.max(46, this.engine.getHeight() * 0.075), r: 28 };
  }

  enter(): void {
    this.layout();
    if (!this.ambientSpawned) {
      this.engine.getParticles().spawnFireflies(15, this.engine.getWidth(), this.engine.getHeight());
      this.ambientSpawned = true;
    }

    // Full narration only the first time we peek in
    const state = this.engine.getState();
    if (!state.hasVisited(this.sceneName)) {
      state.markVisited(this.sceneName);
      this.engine.showStoryboard([
        { text: `${this.label}...`, duration: 2.5 },
        { text: 'This room is still sparkling to life. Come back soon to explore!', duration: 3 },
      ], () => {});
    }
  }

  exit(): void {
    this.ambientSpawned = false;
    this.engine.getParticles().clear();
  }

  update(dt: number, time: number): void {
    this.time = time;

    // Spawn occasional sparkles
    if (Math.random() < 0.05) {
      const x = Math.random() * this.engine.getWidth();
      const y = Math.random() * this.engine.getHeight();
      this.engine.getParticles().spawnSparkles(x, y, 3);
    }
  }

  render(rc: RenderContext): void {
    const { ctx, width, height } = rc;
    const assets = this.engine.getAssets();

    // Try background image for this room
    const bgKey = `stub_${this.sceneName}`;
    if (!assets.drawBackground(ctx, bgKey, width, height)) {
      // Fallback gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1a0a2a');
      grad.addColorStop(0.5, '#2a1a3a');
      grad.addColorStop(1, '#1a0a2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Dark overlay so text is readable on top of background
    ctx.fillStyle = 'rgba(15, 8, 25, 0.5)';
    ctx.fillRect(0, 0, width, height);
    const pulse = 0.3 + Math.sin(this.time * 0.5) * 0.2;
    drawGlow(ctx, width * 0.5, height * 0.5, 190, '180, 150, 255', pulse * 0.14);
    drawGlow(ctx, width * 0.3, height * 0.3, 130, '255, 200, 150', pulse * 0.08);

    // Room name
    ctx.font = `400 ${Math.min(width, height) * 0.06}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(220, 200, 255, 0.9)';
    ctx.fillText(this.label, width / 2, height / 2 - 20);

    // Coming soon text
    const twinkle = 0.5 + Math.sin(this.time * 2) * 0.3;
    ctx.font = `300 ${Math.min(width, height) * 0.025}px Georgia, serif`;
    ctx.fillStyle = `rgba(200, 180, 255, ${twinkle * 0.6})`;
    ctx.fillText('✨ coming soon ✨', width / 2, height / 2 + 30);

    // Exit button
    this.drawExitButton(ctx);
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

  handleTap(x: number, y: number): void {
    if (dist(x, y, this.exitButton.x, this.exitButton.y) < this.exitButton.r) {
      this.engine.getAudio().playPop();
      this.engine.changeScene('hub');
      return;
    }
    // Sparkle on tap
    this.engine.getParticles().spawnSparkles(x, y, 5);
    this.engine.getAudio().playPentatonicChime(Math.floor(Math.random() * 5));
  }

  handleMove(x: number, y: number): void {}
}
