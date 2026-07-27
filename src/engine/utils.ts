export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function hsl(h: number, s: number, l: number, a: number = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// Seeded random for deterministic generation
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) | 0;
    return (this.state >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// Simple tween manager
export interface Tween {
  target: { [key: string]: number };
  props: { [key: string]: { from: number; to: number } };
  duration: number;
  elapsed: number;
  easing: (t: number) => number;
  onComplete?: () => void;
}

export function createTween(
  target: { [key: string]: number },
  props: { [key: string]: number },
  duration: number,
  easing: (t: number) => number = easeInOut,
  onComplete?: () => void
): Tween {
  const tween: Tween = {
    target,
    props: {},
    duration,
    elapsed: 0,
    easing,
    onComplete,
  };
  for (const key in props) {
    tween.props[key] = { from: target[key], to: props[key] };
  }
  return tween;
}

export function updateTween(tween: Tween, dt: number): boolean {
  tween.elapsed += dt;
  const t = Math.min(tween.elapsed / tween.duration, 1);
  const eased = tween.easing(t);
  for (const key in tween.props) {
    const p = tween.props[key];
    tween.target[key] = lerp(p.from, p.to, eased);
  }
  if (t >= 1) {
    if (tween.onComplete) tween.onComplete();
    return true;
  }
  return false;
}

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Soft radial glow — replaces ctx.filter='blur(...)' halos, which are slow
// and unsupported on older iPad Safari. `rgb` is "r, g, b".
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: string,
  alpha: number
): void {
  if (alpha <= 0 || radius <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Draw a soft watercolor-style blob
export function watercolorBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number = 0.15,
  irregularity: number = 0.3
): void {
  const points = 12;
  const angleStep = (Math.PI * 2) / points;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = i * angleStep;
    const r = radius * (1 + (Math.sin(angle * 3 + cx * 0.01) * irregularity));
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.quadraticCurveTo(cx + Math.cos(angle - angleStep / 2) * r * 0.9, cy + Math.sin(angle - angleStep / 2) * r * 0.9, x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.filter = 'blur(8px)';
  ctx.fill();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.restore();
}
