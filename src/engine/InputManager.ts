export class InputManager {
  private canvas: HTMLCanvasElement;
  private onTap: ((x: number, y: number) => void) | null = null;
  private onMove: ((x: number, y: number) => void) | null = null;
  private onPointerDown: ((x: number, y: number) => void) | null = null;

  // For tap vs drag detection
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private isDown = false;
  private moveThreshold = 10;
  private timeThreshold = 300;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  setCallbacks(callbacks: {
    onTap?: (x: number, y: number) => void;
    onMove?: (x: number, y: number) => void;
    onPointerDown?: (x: number, y: number) => void;
  }): void {
    this.onTap = callbacks.onTap ?? null;
    this.onMove = callbacks.onMove ?? null;
    this.onPointerDown = callbacks.onPointerDown ?? null;
  }

  private getPos(e: PointerEvent): { x: number; y: number } {
    // CSS pixels — the whole engine works in CSS px (the canvas backing store
    // is DPR-scaled separately). Multiplying by canvas.width/rect.width here
    // offset every tap by the devicePixelRatio on retina screens.
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const pos = this.getPos(e);
      this.downX = pos.x;
      this.downY = pos.y;
      this.downTime = Date.now();
      this.isDown = true;
      if (this.onPointerDown) this.onPointerDown(pos.x, pos.y);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const pos = this.getPos(e);
      if (this.onMove) this.onMove(pos.x, pos.y);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (!this.isDown) return;
      this.isDown = false;
      const pos = this.getPos(e);
      const dx = pos.x - this.downX;
      const dy = pos.y - this.downY;
      const dt = Date.now() - this.downTime;
      if (Math.abs(dx) < this.moveThreshold && Math.abs(dy) < this.moveThreshold && dt < this.timeThreshold) {
        if (this.onTap) this.onTap(pos.x, pos.y);
      }
    });

    this.canvas.addEventListener('pointercancel', () => {
      this.isDown = false;
    });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
