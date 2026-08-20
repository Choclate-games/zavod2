import { AudioManager } from '../audio/AudioManager';

export interface Point2D {
  x: number;
  y: number;
}

interface SlicerTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  sliced: boolean;
}

interface EvidenceCard {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  isDragging: boolean;
}

export class Pixi2DMode {
  public subMode: 'spline' | 'slicer' | 'evidence' = 'spline';

  // 1. Catmull-Rom Spline Drawing
  public rawPoints: Point2D[] = [];
  public smoothedSpline: Point2D[] = [];
  public isDrawing = false;
  public unitProgress = 0;
  public unitIndex = 0;
  public unitPos: Point2D = { x: 0, y: 0 };
  public unitAngle = 0;

  // 2. Fruit Slicer Mode
  public bladePoints: { x: number; y: number; time: number }[] = [];
  public isSlicing = false;
  public targets: SlicerTarget[] = [];
  public sliceJuiceParticles: { x: number; y: number; vx: number; vy: number; color: string; life: number }[] = [];
  public comboCount = 0;
  private spawnTargetTimer = 0;

  // 3. Evidence Board
  public cards: EvidenceCard[] = [
    { id: '1', title: '🔍 Улика #1: Отпечатки шин', x: 120, y: 150, w: 160, h: 100, color: '#ecf0f1', isDragging: false },
    { id: '2', title: '📷 Улика #2: Снимок камеры', x: 420, y: 180, w: 160, h: 100, color: '#ecf0f1', isDragging: false },
    { id: '3', title: '🧩 Улика #3: Ключ-карта', x: 260, y: 380, w: 160, h: 100, color: '#ecf0f1', isDragging: false },
  ];
  public connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];
  private draggedCard: EvidenceCard | null = null;
  private dragOffset = { x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private audio: AudioManager
  ) {
    this.setupEvents();
  }

  private setupEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.subMode === 'spline') {
        this.isDrawing = true;
        this.rawPoints = [{ x, y }];
        this.smoothedSpline = [];
        this.unitIndex = 0;
      } else if (this.subMode === 'slicer') {
        this.isSlicing = true;
        this.bladePoints = [{ x, y, time: Date.now() }];
      } else if (this.subMode === 'evidence') {
        // Find clicked card
        for (let i = this.cards.length - 1; i >= 0; i--) {
          const c = this.cards[i];
          if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            this.draggedCard = c;
            c.isDragging = true;
            this.dragOffset.x = x - c.x;
            this.dragOffset.y = y - c.y;
            this.audio.playButtonClick();
            break;
          }
        }
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.subMode === 'spline' && this.isDrawing) {
        const last = this.rawPoints[this.rawPoints.length - 1];
        if (!last || Math.hypot(x - last.x, y - last.y) > 10) {
          this.rawPoints.push({ x, y });
          this.recalculateCatmullRomSpline();
        }
      } else if (this.subMode === 'slicer' && this.isSlicing) {
        this.bladePoints.push({ x, y, time: Date.now() });
        if (this.bladePoints.length > 25) this.bladePoints.shift();
        this.checkSliceHits(x, y);
      } else if (this.subMode === 'evidence' && this.draggedCard) {
        this.draggedCard.x = x - this.dragOffset.x;
        this.draggedCard.y = y - this.dragOffset.y;
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDrawing = false;
      this.isSlicing = false;
      if (this.draggedCard) {
        this.draggedCard.isDragging = false;
        this.draggedCard = null;
      }
    });
  }

  private recalculateCatmullRomSpline(): void {
    if (this.rawPoints.length < 2) {
      this.smoothedSpline = [...this.rawPoints];
      return;
    }

    const pts = this.rawPoints;
    const result: Point2D[] = [];
    const resolution = 8;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      for (let t = 0; t <= resolution; t++) {
        const f = t / resolution;
        const f2 = f * f;
        const f3 = f2 * f;

        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * f +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3);

        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * f +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3);

        result.push({ x, y });
      }
    }
    this.smoothedSpline = result;
  }

  private checkSliceHits(bx: number, by: number): void {
    this.targets.forEach((t) => {
      if (!t.sliced && Math.hypot(bx - t.x, by - t.y) < t.radius + 15) {
        t.sliced = true;
        this.comboCount++;
        this.audio.playSwordSlash();

        // Spawn juicy splash particles
        for (let p = 0; p < 18; p++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 120 + Math.random() * 240;
          this.sliceJuiceParticles.push({
            x: t.x,
            y: t.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: t.color,
            life: 0.6 + Math.random() * 0.4,
          });
        }
      }
    });
  }

  public updateAndRender(dt: number): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    if (this.subMode === 'spline') {
      // 1. Render Catmull-Rom Spline
      if (this.smoothedSpline.length > 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.smoothedSpline[0].x, this.smoothedSpline[0].y);
        for (let i = 1; i < this.smoothedSpline.length; i++) {
          this.ctx.lineTo(this.smoothedSpline[i].x, this.smoothedSpline[i].y);
        }
        this.ctx.strokeStyle = '#00cec9';
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Unit movement along spline
        if (this.unitIndex < this.smoothedSpline.length - 1) {
          this.unitIndex += Math.max(1, Math.round(dt * 90));
          if (this.unitIndex >= this.smoothedSpline.length - 1) {
            this.unitIndex = 0; // loop
          }
          const cur = this.smoothedSpline[this.unitIndex];
          const next = this.smoothedSpline[Math.min(this.unitIndex + 1, this.smoothedSpline.length - 1)];
          this.unitPos = cur;
          this.unitAngle = Math.atan2(next.y - cur.y, next.x - cur.x);
        }

        // Draw moving unit (Arrow vehicle)
        this.ctx.save();
        this.ctx.translate(this.unitPos.x, this.unitPos.y);
        this.ctx.rotate(this.unitAngle);
        this.ctx.fillStyle = '#f39c12';
        this.ctx.beginPath();
        this.ctx.moveTo(14, 0);
        this.ctx.lineTo(-12, -8);
        this.ctx.lineTo(-6, 0);
        this.ctx.lineTo(-12, 8);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      }

      // Draw instruction
      this.ctx.fillStyle = '#bdc3c7';
      this.ctx.font = '14px -apple-system, sans-serif';
      this.ctx.fillText('Зажмите ЛКМ и нарисуйте траекторию — юнит плавно поедет по сплайну Catmull-Rom', 20, h - 30);

    } else if (this.subMode === 'slicer') {
      // 2. Fruit Slicer & Blade Trail
      this.spawnTargetTimer += dt;
      if (this.spawnTargetTimer >= 0.8) {
        this.spawnTargetTimer = 0;
        const colors = ['#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
        this.targets.push({
          x: 100 + Math.random() * (w - 200),
          y: h + 20,
          vx: (Math.random() - 0.5) * 160,
          vy: -480 - Math.random() * 220,
          radius: 28,
          color: colors[Math.floor(Math.random() * colors.length)],
          sliced: false,
        });
      }

      // Update & Draw Targets
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        t.vy += 650 * dt; // gravity
        t.x += t.vx * dt;
        t.y += t.vy * dt;

        this.ctx.fillStyle = t.color;
        this.ctx.beginPath();
        this.ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        this.ctx.fill();

        if (t.y > h + 100) this.targets.splice(i, 1);
      }

      // Update & Draw Juice Particles
      for (let i = this.sliceJuiceParticles.length - 1; i >= 0; i--) {
        const p = this.sliceJuiceParticles[i];
        p.life -= dt;
        p.vy += 500 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4 * (p.life / 0.6), 0, Math.PI * 2);
        this.ctx.fill();

        if (p.life <= 0) this.sliceJuiceParticles.splice(i, 1);
      }

      // Draw Glowing Blade Trail
      const now = Date.now();
      for (let i = this.bladePoints.length - 1; i >= 0; i--) {
        if (now - this.bladePoints[i].time > 180) this.bladePoints.splice(i, 1);
      }

      if (this.bladePoints.length > 2) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.bladePoints[0].x, this.bladePoints[0].y);
        for (let i = 1; i < this.bladePoints.length; i++) {
          this.ctx.lineTo(this.bladePoints[i].x, this.bladePoints[i].y);
        }
        this.ctx.strokeStyle = '#00cec9';
        this.ctx.lineWidth = 9;
        this.ctx.lineCap = 'round';
        this.ctx.shadowBlur = 14;
        this.ctx.shadowColor = '#00cec9';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }

      // Combo Text
      this.ctx.fillStyle = '#ff771a';
      this.ctx.font = 'bold 22px monospace';
      this.ctx.fillText(`КОМБО РАЗРЕЗОВ: ${this.comboCount}`, 24, 70);

    } else if (this.subMode === 'evidence') {
      // 3. Evidence Board with Gravity Sagging Threads
      this.connections.forEach(([fromIdx, toIdx]) => {
        const c1 = this.cards[fromIdx];
        const c2 = this.cards[toIdx];
        const sx = c1.x + c1.w / 2;
        const sy = c1.y + 10;
        const ex = c2.x + c2.w / 2;
        const ey = c2.y + 10;

        const midX = (sx + ex) / 2;
        const dist = Math.hypot(ex - sx, ey - sy);
        const midY = (sy + ey) / 2 + Math.min(30, dist * 0.08);

        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.quadraticCurveTo(midX, midY, ex, ey);
        this.ctx.strokeStyle = '#c0392b';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      });

      // Draw Cards
      this.cards.forEach((c) => {
        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fillRect(c.x + 4, c.y + 4, c.w, c.h);

        // Body
        this.ctx.fillStyle = c.color;
        this.ctx.fillRect(c.x, c.y, c.w, c.h);

        // Border
        this.ctx.strokeStyle = c.isDragging ? '#e65c00' : '#7f8c8d';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(c.x, c.y, c.w, c.h);

        // Pushpin
        this.ctx.fillStyle = '#d63031';
        this.ctx.beginPath();
        this.ctx.arc(c.x + c.w / 2, c.y + 10, 7, 0, Math.PI * 2);
        this.ctx.fill();

        // Title
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.font = 'bold 12px -apple-system, sans-serif';
        this.ctx.fillText(c.title, c.x + 10, c.y + 40);
      });
    }
  }
}
