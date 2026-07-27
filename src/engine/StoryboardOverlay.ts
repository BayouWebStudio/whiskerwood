// Storyboard overlay — shows text slides for narration/story moments

interface Slide {
  text: string;
  duration: number;
}

export class StoryboardOverlay {
  private slides: Slide[] = [];
  private currentIndex = 0;
  private active = false;
  private elapsed = 0;
  private alpha = 0;
  private onComplete: (() => void) | null = null;

  show(slides: Slide[], onComplete: () => void): void {
    this.slides = slides;
    this.currentIndex = 0;
    this.elapsed = 0;
    this.active = true;
    this.alpha = 0;
    this.onComplete = onComplete;
  }

  isActive(): boolean {
    return this.active;
  }

  handleTap(): void {
    if (!this.active) return;
    this.nextSlide();
  }

  private nextSlide(): void {
    this.currentIndex++;
    this.elapsed = 0;
    if (this.currentIndex >= this.slides.length) {
      this.active = false;
      this.alpha = 0;
      if (this.onComplete) {
        const cb = this.onComplete;
        this.onComplete = null;
        cb();
      }
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    // Fade in
    this.alpha = Math.min(1, this.alpha + dt * 2);
    // Auto-advance after duration
    if (this.elapsed >= this.slides[this.currentIndex].duration) {
      this.nextSlide();
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.active || this.currentIndex >= this.slides.length) return;

    const slide = this.slides[this.currentIndex];
    const fadeOut = slide.duration - this.elapsed < 0.5 ? Math.max(0, (slide.duration - this.elapsed) / 0.5) : 1;
    const a = this.alpha * fadeOut;

    // Semi-transparent overlay
    ctx.fillStyle = `rgba(15, 8, 25, ${a * 0.7})`;
    ctx.fillRect(0, 0, width, height);

    // Soft watercolor blobs behind text
    ctx.save();
    ctx.globalAlpha = a * 0.15;
    ctx.filter = 'blur(40px)';
    ctx.fillStyle = `hsl(${280 + Math.sin(this.elapsed * 0.5) * 20}, 50%, 40%)`;
    ctx.beginPath();
    ctx.arc(width * 0.3, height * 0.4, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${320 + Math.sin(this.elapsed * 0.3) * 20}, 50%, 40%)`;
    ctx.beginPath();
    ctx.arc(width * 0.7, height * 0.6, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // Text
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main text
    const fontSize = Math.min(width, height) * 0.04;
    ctx.font = `400 ${fontSize}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 245, 230, 0.95)';

    // Word wrap
    const maxWidth = width * 0.75;
    const words = slide.text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = fontSize * 1.5;
    const totalHeight = lines.length * lineHeight;
    const startY = height / 2 - totalHeight / 2 + lineHeight / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
    }

    // "tap to continue" hint
    if (this.elapsed > 1) {
      ctx.font = `300 ${fontSize * 0.4}px Georgia, serif`;
      ctx.fillStyle = `rgba(255, 245, 230, ${a * 0.4})`;
      ctx.fillText('tap to continue', width / 2, height - height * 0.1);
    }

    ctx.restore();
  }
}
