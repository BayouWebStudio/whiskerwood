import { Scene, RenderContext } from './types';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { ParticleSystem } from './ParticleSystem';
import { Tween, updateTween } from './utils';
import { HubScene } from '../scenes/HubScene';
import { GreenhouseScene } from '../scenes/GreenhouseScene';
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
  private nextSceneName: SceneName | null = null;

  private running = false;
  private lastTime = 0;
  private rafId = 0;

  private tweens: Tween[] = [];
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

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

    this.setupCanvas();
    this.setupInput();
    this.setupScenes();

    window.addEventListener('resize', () => this.setupCanvas());
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
      onPointerDown: (x, y) => this.handlePointerDown(x, y),
    });
  }

  private setupScenes(): void {
    this.scenes.set('hub', new HubScene(this));
    this.scenes.set('greenhouse', new GreenhouseScene(this));
    this.scenes.set('potion-kitchen', new StubScene(this, 'potion-kitchen', 'Potion Kitchen'));
    this.scenes.set('observatory', new StubScene(this, 'observatory', 'Observatory'));
    this.scenes.set('story-library', new StubScene(this, 'story-library', 'Story Library'));
    this.scenes.set('music-garden', new StubScene(this, 'music-garden', 'Music Garden'));
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

  changeScene(name: SceneName): void {
    if (this.transitions.isActive()) return;
    this.nextSceneName = name;
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

  // Show storyboard narration for entering/exiting scenes
  showStoryboard(slides: { text: string; duration: number }[], onComplete: () => void): void {
    this.storyboard.show(slides, onComplete);
  }

  addTween(tween: Tween): void {
    this.tweens.push(tween);
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

  private handlePointerDown(x: number, y: number): void {
    // Hook for future use (drag, etc.)
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    // Start loading assets — show loading screen until done
    this.assets.preload(
      (loaded, total) => {
        // Progress callback
      },
      () => {
        // All assets loaded — start the game
        this.beginGame();
      }
    );

    // Start render loop immediately (shows loading screen)
    this.loop();
  }

  private beginGame(): void {
    // Start at hub
    const hub = this.scenes.get('hub')!;
    this.currentScene = hub;
    this.currentSceneName = 'hub';
    hub.enter();

    // Show intro storyboard
    this.showStoryboard([
      { text: 'Welcome to Whiskerwood...', duration: 3 },
      { text: 'A cozy, magical world where curiosity blooms.', duration: 3 },
      { text: 'Tap a room to explore. There is no rush, no wrong way, just gentle adventures.', duration: 4 },
    ], () => {
      // Storyboard done, game is interactive
    });
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
    // Update tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      if (updateTween(this.tweens[i], dt)) {
        this.tweens.splice(i, 1);
      }
    }

    this.transitions.update(dt);
    this.storyboard.update(dt);
    this.particles.update(dt);

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

    // Show loading screen if assets aren't loaded yet
    if (!this.assets.isLoaded()) {
      this.renderLoadingScreen();
      return;
    }

    if (this.currentScene) {
      this.currentScene.render(rc);
    }

    // Particles render on top of scene
    this.particles.render(this.ctx);

    // Storyboard overlay
    this.storyboard.render(this.ctx, this.cssWidth, this.cssHeight);

    // Transition overlay on very top
    this.transitions.render(this.ctx, this.cssWidth, this.cssHeight);
  }

  private renderLoadingScreen(): void {
    const { ctx, width: w, height: h } = { ctx: this.ctx, width: this.cssWidth, height: this.cssHeight };
    const progress = this.assets.getLoadProgress();
    const pct = progress.total > 0 ? progress.loaded / progress.total : 0;

    // Background
    ctx.fillStyle = '#1a1028';
    ctx.fillRect(0, 0, w, h);

    // Soft glowing circles
    const t = performance.now() / 1000;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.filter = 'blur(40px)';
    ctx.fillStyle = `hsl(${280 + Math.sin(t * 0.5) * 20}, 50%, 40%)`;
    ctx.beginPath();
    ctx.arc(w * 0.35, h * 0.4, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${320 + Math.sin(t * 0.3) * 20}, 50%, 40%)`;
    ctx.beginPath();
    ctx.arc(w * 0.65, h * 0.6, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${Math.min(w, h) * 0.05}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.9)';
    ctx.fillText('Whiskerwood', w / 2, h / 2 - 30);

    // Progress bar
    const barW = Math.min(w * 0.5, 300);
    const barH = 6;
    const barX = (w - barW) / 2;
    const barY = h / 2 + 20;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 180, 255, 0.8)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * pct, barH, 3);
    ctx.fill();

    // Loading text
    ctx.font = `300 ${Math.min(w, h) * 0.02}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.4)';
    ctx.fillText(`Loading magic... ${progress.loaded}/${progress.total}`, w / 2, h / 2 + 50);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
