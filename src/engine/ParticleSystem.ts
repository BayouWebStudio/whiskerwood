// Particle system for fireflies, sparkles, drifting seeds, etc.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  glow: boolean;
  type: ParticleType;
  wobble: number;
  wobbleSpeed: number;
  baseX: number;
  baseY: number;
}

export type ParticleType = 'firefly' | 'sparkle' | 'seed' | 'petal' | 'dust' | 'star' | 'heart' | 'note' | 'puff';

export class ParticleSystem {
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;

  setBounds(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  spawn(p: Partial<Particle> & { x: number; y: number }): void {
    const particle: Particle = {
      x: p.x,
      y: p.y,
      vx: p.vx ?? 0,
      vy: p.vy ?? 0,
      size: p.size ?? 3,
      life: p.life ?? 5,
      maxLife: p.life ?? 5,
      color: p.color ?? 'rgba(255, 220, 100, 0.8)',
      glow: p.glow ?? true,
      type: p.type ?? 'firefly',
      wobble: p.wobble ?? Math.random() * Math.PI * 2,
      wobbleSpeed: p.wobbleSpeed ?? 0.02,
      baseX: p.x,
      baseY: p.y,
    };
    this.particles.push(particle);
  }

  spawnFireflies(count: number, width: number, height: number): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        size: 2 + Math.random() * 3,
        life: 999,
        maxLife: 999,
        color: `hsla(${50 + Math.random() * 20}, 90%, ${60 + Math.random() * 20}%, 0.8)`,
        glow: true,
        type: 'firefly',
        wobbleSpeed: 0.01 + Math.random() * 0.03,
      });
    }
  }

  spawnSparkles(x: number, y: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1 + Math.random() * 2;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        size: 2 + Math.random() * 3,
        life: 0.8 + Math.random() * 0.5,
        color: `hsla(${45 + Math.random() * 30}, 90%, 70%, 0.9)`,
        glow: true,
        type: 'sparkle',
      });
    }
  }

  spawnSeeds(x: number, y: number, count: number = 3): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.3 - Math.random() * 0.5,
        size: 3 + Math.random() * 2,
        life: 3 + Math.random() * 2,
        color: `hsla(${90 + Math.random() * 40}, 80%, 65%, 0.9)`,
        glow: true,
        type: 'seed',
        wobbleSpeed: 0.05,
      });
    }
  }

  spawnPetals(x: number, y: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.2 + Math.random() * 0.5,
        size: 4 + Math.random() * 4,
        life: 4 + Math.random() * 3,
        color: `hsla(${300 + Math.random() * 60}, 70%, 75%, 0.7)`,
        glow: false,
        type: 'petal',
        wobbleSpeed: 0.03,
      });
    }
  }

  // Little hearts floating up — kitten affection
  spawnHearts(x: number, y: number, count: number = 4): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.8 - Math.random() * 0.7,
        size: 5 + Math.random() * 4,
        life: 1.2 + Math.random() * 0.6,
        color: `hsla(${335 + Math.random() * 20}, 85%, ${68 + Math.random() * 10}%, 0.9)`,
        glow: false,
        type: 'heart',
        wobbleSpeed: 0.06,
      });
    }
  }

  // Soft dust puff at the kitten's feet on landing
  spawnDust(x: number, y: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // mostly sideways
      this.spawn({
        x: x + (Math.random() - 0.5) * 12,
        y,
        vx: Math.cos(angle) * (0.4 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1),
        vy: -0.1 - Math.random() * 0.25,
        size: 3 + Math.random() * 4,
        life: 0.45 + Math.random() * 0.25,
        color: 'hsla(38, 30%, 82%, 0.5)',
        glow: false,
        type: 'puff',
      });
    }
  }

  // Floating music notes
  spawnNotes(x: number, y: number, count: number = 2, hue?: number): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.9 - Math.random() * 0.6,
        size: 7 + Math.random() * 4,
        life: 1.6 + Math.random() * 0.8,
        color: `hsla(${hue ?? 45 + Math.random() * 260}, 80%, 75%, 0.95)`,
        glow: false,
        type: 'note',
        wobbleSpeed: 0.08,
      });
    }
  }

  spawnStars(x: number, y: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        life: 1.5 + Math.random(),
        color: `hsla(${200 + Math.random() * 60}, 90%, 80%, 0.9)`,
        glow: true,
        type: 'star',
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.type === 'firefly') {
        // Fireflies drift slowly with wobble
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.3;
        p.y += p.vy + Math.cos(p.wobble * 0.7) * 0.2;
        // Keep within bounds, wrap around
        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
        if (p.y < 0) p.y = this.height;
        if (p.y > this.height) p.y = 0;
        // Blinking
        p.life = 999;
      } else if (p.type === 'seed') {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.5;
        p.y += p.vy;
        p.vy += 0.01; // gentle gravity
      } else if (p.type === 'petal') {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.8;
        p.y += p.vy;
      } else if (p.type === 'heart' || p.type === 'note') {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble * 40) * 0.4;
        p.y += p.vy;
        p.vy *= 0.995; // ease as they rise
      } else if (p.type === 'puff') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.size += dt * 10; // dust expands as it fades
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.vx *= 0.98;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.type === 'firefly'
        ? 0.4 + Math.sin(p.wobble * 2) * 0.4
        : Math.min(1, p.life / p.maxLife);

      if (p.glow) {
        // Outer glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        gradient.addColorStop(0, p.color.replace(/[\d.]+\)$/, `${alpha * 0.5})`));
        gradient.addColorStop(0.5, p.color.replace(/[\d.]+\)$/, `${alpha * 0.15})`));
        gradient.addColorStop(1, p.color.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.type === 'heart') {
        // Two circles + a triangle make a heart
        const s = p.size;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(p.wobble * 30) * 0.2);
        ctx.beginPath();
        ctx.arc(-s * 0.32, -s * 0.25, s * 0.42, 0, Math.PI * 2);
        ctx.arc(s * 0.32, -s * 0.25, s * 0.42, 0, Math.PI * 2);
        ctx.moveTo(-s * 0.72, -s * 0.05);
        ctx.lineTo(0, s * 0.75);
        ctx.lineTo(s * 0.72, -s * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (p.type === 'note') {
        // Eighth note: head + stem + flag
        const s = p.size;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(p.wobble * 25) * 0.25);
        ctx.beginPath();
        ctx.ellipse(0, s * 0.5, s * 0.42, s * 0.32, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.5, s * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.38, s * 0.42);
        ctx.lineTo(s * 0.38, -s * 0.6);
        ctx.quadraticCurveTo(s * 0.9, -s * 0.45, s * 0.75, s * 0.05);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      if (p.type === 'star') {
        // Draw star shape
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 2) * i;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(angle) * p.size * 2, p.y + Math.sin(angle) * p.size * 2);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
  }
}
