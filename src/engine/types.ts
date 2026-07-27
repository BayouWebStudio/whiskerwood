export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dt: number;
  time: number;
}

export interface Scene {
  enter(): void;
  exit(): void;
  update(dt: number, time: number): void;
  render(rc: RenderContext): void;
  handleTap(x: number, y: number): void;
  handleMove(x: number, y: number): void;
}

export interface Vec2 {
  x: number;
  y: number;
}
