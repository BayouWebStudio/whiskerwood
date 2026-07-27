import { Scene, RenderContext } from './types';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { ParticleSystem } from './ParticleSystem';
import { Tween, updateTween, dist, drawGlow } from './utils';
import { HubScene } from '../scenes/HubScene';
import { GreenhouseScene } from '../scenes/GreenhouseScene';
import { MusicGardenScene } from '../scenes/MusicGardenScene';
import { StubScene } from '../scenes/StubScene';
import { TransitionOverlay } from './TransitionOverlay';
import { StoryboardOverlay } from './StoryboardOverlay';
import { GameState } from './GameState';
import { AssetLoader } from './AssetLoader';

export type SceneName = 'hub' | 'greenhouse' | 'potion-kitchen' | 'observatory' | 'story-library' | 'music-garden' | 'forest-trail' | 'bedroom';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private audio: AudioManager;
  private particles: ParticleSystem;
  private transitions: TransitionOverlay;
  private storyboard: StoryboardOverlay;
  private state: GameState;
  private assets: AssetLoader;

  private scenes: Map<SceneName, Scene> = new Map();
  private currentScene: Scene | null = null;
  private currentSceneName: SceneName | null = null;

  private running = false;
  private lastTime = 0;
  private rafId = 0;

  private tweens: Tween[] = [];
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  // Global HUD (dream-seed counter + mute) shown on every scene
  private hudStars = 0;
  private hudPop = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.audio = new AudioManager();
    this.particles = new ParticleSystem();
    this.input = new InputManager(canvas);
    this.transitions = new TransitionOverlay();
    this.storyboard = new StoryboardOverlay();
    this.state = new GameState();
    this.assets = new AssetLoader();

    this.audio.setMuted(this.state.muted);
    this.hudStars = this.state.totalStars;

    this.setupCanvas();
    this.setupInput();
    this.setupScenes();

    window.addEventListener('resize', () => {
      this.setupCanvas();
      this.currentScene?.layout?.();
    });
  }

  private setupCanvas(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssWidth = window.innerWidth;
    this.cssHeight = window.innerHeight;
    this.canvas.width = this.cssWidth * this.dpr;
    this.canvas.height = this.cssHeight * this.dpr;
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.particles.setBounds(this.cssWidth, this.cssHeight);
  }

  private setupInput(): void {
    this.input.setCallbacks({
      onTap: (x, y) => this.handleTap(x, y),
      onMove: (x, y) => this.handleMove(x, y),
      onPointerDown: () => {},
    });
  }

  private setupScenes(): void {
    this.scenes.set('hub', new HubScene(this));
    this.scenes.set('greenhouse', new GreenhouseScene(this));
    this.scenes.set('music-garden', new MusicGardenScene(this));
    this.scenes.set('potion-kitchen', new StubScene(this, 'potion-kitchen', 'Potion Kitchen'));
    this.scenes.set('observatory', new StubScene(this, 'observatory', 'Observatory'));
    this.scenes.set('story-library', new StubScene(this, 'story-library', 'Story Library'));
    this.scenes.set('forest-trail', new StubScene(this, 'forest-trail', 'Forest Trail'));
    this.scenes.set('bedroom', new StubScene(this, 'bedroom', 'Bedroom'));
  }

  // Public accessors for scenes
  getAudio(): AudioManager { return this.audio; }
  getParticles(): ParticleSystem { return this.particles; }
  getState(): GameState { return this.state; }
  getStoryboard(): StoryboardOverlay { return this.storyboard; }
  getAssets(): AssetLoader { return this.assets; }
  getWidth(): number { return this.cssWidth; }
  getHeight(): number { return this.cssHeight; }
  getCurrentSceneName(): SceneName | null { return this.currentSceneName; }
  getSceneInstance(name: SceneName): Scene | undefined { return this.scenes.get(name); }
  isTransitioning(): boolean { return this.transitions.isActive(); }

  changeScene(name: SceneName): void {
    if (this.transitions.isActive()) return;
    if (this.currentSceneName === name) return;
    this.audio.playWhoosh();
    this.transitions.startFadeOut(() => {
      if (this.currentScene) this.currentScene.exit();
      const scene = this.scenes.get(name);
      if (scene) {
        this.currentScene = scene;
        this.currentSceneName = name;
        scene.enter();
      }
      this.transitions.startFadeIn();
    });
  }

  showStoryboard(slides: { text: string; duration: number }[], onComplete: () => void): void {
    this.storyboard.show(slides, onComplete);
  }

  addTween(tween: Tween): void {
    this.tweens.push(tween);
  }

  // --- HUD ---

  private muteBtnPos(): { x: number; y: number; r: number } {
    return { x: this.cssWidth - 40, y: 42, r: 21 };
  }

  private renderHud(): void {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const mute = this.muteBtnPos();

    // Mute toggle
    ctx.save();
    ctx.fillStyle = 'rgba(25, 15, 40, 0.45)';
    ctx.beginPath();
    ctx.arc(mute.x, mute.y, mute.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.state.muted ? '🔇' : '🔊', mute.x, mute.y + 1);
    ctx.restore();

    // Dream-seed counter with a happy pop when it grows
    const pop = Math.sin(Math.min(1, this.hudPop) * Math.PI);
    const iconX = w - 92;
    const iconY = 42;
    if (pop > 0.01) {
      drawGlow(ctx, iconX, iconY, 34 + pop * 14, '255, 230, 140', pop * 0.5);
    }
    if (!this.assets.drawFit(ctx, 'star_counter', iconX, iconY, 40 * (1 + pop * 0.35), 0.95)) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 220, 120, 0.9)';
      ctx.font = '22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦', iconX, iconY);
      ctx.restore();
    }
    ctx.save();
    ctx.font = '600 17px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 235, 180, 0.95)';
    ctx.shadowColor = 'rgba(15, 8, 25, 0.8)';
    ctx.shadowBlur = 5;
    ctx.fillText(`${this.state.totalStars}`, iconX - 26, iconY + 1);
    ctx.restore();
  }

  private hudHandleTap(x: number, y: number): boolean {
    const mute = this.muteBtnPos();
    if (dist(x, y, mute.x, mute.y) < mute.r + 8) {
      const next = !this.state.muted;
      this.state.setMuted(next);
      this.audio.setMuted(next);
      if (!next) this.audio.playPop();
      return true;
    }
    return false;
  }

  private handleTap(x: number, y: number): void {
    // Resume audio on first interaction
    this.audio.init();
    this.audio.resume();
    this.audio.startAmbient();

    // Storyboard takes priority
    if (this.storyboard.isActive()) {
      this.storyboard.handleTap();
      return;
    }

    // Global HUD
    if (this.hudHandleTap(x, y)) return;

    // Transitions block input
    if (this.transitions.isActive()) return;

    if (this.currentScene) {
      this.currentScene.handleTap(x, y);
    }
  }

  private handleMove(x: number, y: number): void {
    if (this.currentScene && !this.transitions.isActive()) {
      this.currentScene.handleMove(x, y);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    // Phase 1 (critical assets) gates the loading screen; the rest of the
    // art streams in the background and pops in when ready.
    this.assets.preload(undefined, () => this.beginGame());

    // Render loop starts immediately to show the loading screen
    this.loop();
  }

  private beginGame(): void {
    // Test hooks for automated screenshots: ?test skips narration,
    // ?scene=music-garden jumps straight to a room.
    const params = new URLSearchParams(window.location.search);
    if (params.has('test')) {
      this.state.setFirstVisitDone();
      (['greenhouse', 'music-garden', 'potion-kitchen', 'observatory', 'story-library', 'forest-trail', 'bedroom'] as const)
        .forEach(r => this.state.markVisited(r));
    }

    const hub = this.scenes.get('hub')!;
    this.currentScene = hub;
    this.currentSceneName = 'hub';
    hub.enter();

    const jump = params.get('scene') as SceneName | null;
    if (jump && jump !== 'hub' && this.scenes.has(jump)) {
      // Instant jump (no fade) so automated screenshots land on the room
      hub.exit();
      const scene = this.scenes.get(jump)!;
      this.currentScene = scene;
      this.currentSceneName = jump;
      scene.enter();
      return;
    }

    // One intro, only on the very first play
    if (this.state.firstVisit) {
      this.showStoryboard([
        { text: 'Welcome to Whiskerwood...', duration: 3 },
        { text: 'This magical tree castle is your home, and this little kitten is your friend.', duration: 3.4 },
        { text: 'Tap anywhere to walk. Tap your kitten to say hello. Tap a doorway to explore.', duration: 4 },
        { text: 'There is no rush and no wrong way — just gentle adventures.', duration: 3.2 },
      ], () => {
        this.state.setFirstVisitDone();
      });
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt, now / 1000);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number, time: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      if (updateTween(this.tweens[i], dt)) {
        this.tweens.splice(i, 1);
      }
    }

    this.transitions.update(dt);
    this.storyboard.update(dt);
    this.particles.update(dt);

    // HUD pop when the dream-seed count grows
    if (this.state.totalStars !== this.hudStars) {
      if (this.state.totalStars > this.hudStars) this.hudPop = 1;
      this.hudStars = this.state.totalStars;
    }
    this.hudPop = Math.max(0, this.hudPop - dt * 1.8);

    if (this.currentScene) {
      this.currentScene.update(dt, time);
    }
  }

  private render(): void {
    const rc: RenderContext = {
      ctx: this.ctx,
      width: this.cssWidth,
      height: this.cssHeight,
      dt: 0,
      time: performance.now() / 1000,
    };

    // Clear with base background
    this.ctx.fillStyle = '#1a1028';
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    if (!this.assets.isLoaded()) {
      this.renderLoadingScreen();
      return;
    }

    if (this.currentScene) {
      this.currentScene.render(rc);
    }

    this.particles.render(this.ctx);

    this.renderHud();

    this.storyboard.render(this.ctx, this.cssWidth, this.cssHeight);

    this.transitions.render(this.ctx, this.cssWidth, this.cssHeight);
  }

  private renderLoadingScreen(): void {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    const progress = this.assets.getLoadProgress();
    const pct = progress.total > 0 ? progress.loaded / progress.total : 0;

    ctx.fillStyle = '#1a1028';
    ctx.fillRect(0, 0, w, h);

    // Soft glowing blobs (radial gradients — no canvas filters)
    const t = performance.now() / 1000;
    drawGlow(ctx, w * 0.35, h * 0.4, 160, '120, 80, 180', 0.13 + Math.sin(t * 0.5) * 0.04);
    drawGlow(ctx, w * 0.65, h * 0.6, 140, '180, 80, 150', 0.12 + Math.sin(t * 0.3 + 2) * 0.04);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bouncing paw
    const bounce = Math.abs(Math.sin(t * 2.4)) * 14;
    ctx.font = `${Math.min(w, h) * 0.06}px system-ui, sans-serif`;
    ctx.fillText('🐾', w / 2, h / 2 - 78 - bounce);

    ctx.font = `400 ${Math.min(w, h) * 0.05}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.9)';
    ctx.fillText('Whiskerwood', w / 2, h / 2 - 22);

    const barW = Math.min(w * 0.5, 300);
    const barH = 6;
    const barX = (w - barW) / 2;
    const barY = h / 2 + 24;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 180, 255, 0.8)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barH, barW * pct), barH, 3);
    ctx.fill();

    ctx.font = `300 ${Math.min(w, h) * 0.02}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.4)';
    ctx.fillText(`Loading magic... ${progress.loaded}/${progress.total}`, w / 2, h / 2 + 54);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
