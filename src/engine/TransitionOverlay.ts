// Fade transition between scenes

export class TransitionOverlay {
  private alpha = 0;
  private targetAlpha = 0;
  private fadingOut = false;
  private fadingIn = false;
  private onFadeOutComplete: (() => void) | null = null;
  private duration = 0.6;

  isActive(): boolean {
    return this.fadingOut || this.fadingIn;
  }

  startFadeOut(callback: () => void): void {
    this.fadingOut = true;
    this.fadingIn = false;
    this.targetAlpha = 1;
    this.onFadeOutComplete = callback;
  }

  startFadeIn(): void {
    this.fadingIn = true;
    this.fadingOut = false;
    this.targetAlpha = 0;
  }

  update(dt: number): void {
    const speed = 1 / this.duration;
    if (this.fadingOut) {
      this.alpha = Math.min(1, this.alpha + dt * speed);
      if (this.alpha >= 1) {
        this.fadingOut = false;
        if (this.onFadeOutComplete) {
          const cb = this.onFadeOutComplete;
          this.onFadeOutComplete = null;
          cb();
        }
      }
    } else if (this.fadingIn) {
      this.alpha = Math.max(0, this.alpha - dt * speed);
      if (this.alpha <= 0) {
        this.fadingIn = false;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.alpha > 0) {
      ctx.fillStyle = `rgba(15, 8, 25, ${this.alpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }
}
