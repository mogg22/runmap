/**
 * Canvas 기반 파티클 시스템
 * 겹침 감지 시 해당 구간에서 글자 단위 폭발
 */

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.trails = [];       // 커서 트레일
    this.rafId = null;
    this.running = false;
  }

  // 겹침 구간 파티클 폭발
  explodeAt(x, y, text, color, count = 12) {
    const chars = text.split("");
    for (let i = 0; i < count; i++) {
      const char = chars[i % chars.length];
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        char,
        color,
        alpha: 1,
        size: 8 + Math.random() * 10,
        decay: 0.012 + Math.random() * 0.01,
        gravity: 0.12,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
      });
    }
  }

  // 대규모 겹침 폭발 (여러 지점에서 동시에)
  explodePath(points, runners, color) {
    const step = Math.max(1, Math.floor(points.length / 20));
    for (let i = 0; i < points.length; i += step) {
      const pt = points[i];
      const name = runners[Math.floor(Math.random() * runners.length)]?.name ?? "run";
      setTimeout(() => {
        this.explodeAt(pt.x, pt.y, name, color, 8);
      }, (i / step) * 60);
    }
  }

  // 커서 트레일 추가
  addTrail(x, y, zoom) {
    this.trails.push({
      x, y,
      alpha: 0.4,
      radius: 3 / zoom,
      decay: 0.025,
    });
    // 트레일 최대 80개 유지
    if (this.trails.length > 80) this.trails.shift();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._tick();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  _tick() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 트레일 렌더링
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${t.alpha})`;
      ctx.fill();
      t.alpha -= t.decay;
      if (t.alpha <= 0) this.trails.splice(i, 1);
    }

    // 파티클 렌더링
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.font = `${p.size}px "Pretendard", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.char, 0, 0);
      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.97;
      p.alpha -= p.decay;
      p.rotation += p.rotSpeed;

      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
  }
}
