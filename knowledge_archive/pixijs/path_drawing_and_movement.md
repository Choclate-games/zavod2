# PixiJS: Path Drawing (Catmull-Rom Splines) & Unit Movement

Эталонная реализация рисования траекторий жестом мыши/пальца, сглаживания кривыми Catmull-Rom и плавного движения юнитов (улиток, муравьев, машин, поездов) по нарисованному пути.

---

## 1. Сглаживание и рисование траекторий (`PathDrawer.ts`)

```typescript
import * as PIXI from 'pixi.js';

export interface Point2D {
    x: number;
    y: number;
}

export class PathDrawer {
    public rawPoints: Point2D[] = [];
    public smoothedSpline: Point2D[] = [];
    public isDrawing = false;
    private graphics: PIXI.Graphics;

    constructor(parentContainer: PIXI.Container) {
        this.graphics = new PIXI.Graphics();
        parentContainer.addChild(this.graphics);
    }

    public startPath(x: number, y: number) {
        this.isDrawing = true;
        this.rawPoints = [{ x, y }];
        this.smoothedSpline = [];
    }

    public addPoint(x: number, y: number) {
        if (!this.isDrawing) return;
        const last = this.rawPoints[this.rawPoints.length - 1];
        if (!last || Math.hypot(x - last.x, y - last.y) > 12) {
            this.rawPoints.push({ x, y });
            this.recalculateSpline();
            this.render();
        }
    }

    public endPath(): Point2D[] {
        this.isDrawing = false;
        this.recalculateSpline();
        this.render();
        return [...this.smoothedSpline];
    }

    /** Сглаживание точек алгоритмом Catmull-Rom Spline */
    private recalculateSpline() {
        if (this.rawPoints.length < 2) {
            this.smoothedSpline = [...this.rawPoints];
            return;
        }

        const pts = this.rawPoints;
        const result: Point2D[] = [];
        const resolution = 8; // Точек между узлами

        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = i > 0 ? pts[i - 1] : pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

            for (let t = 0; t <= resolution; t++) {
                const f = t / resolution;
                const f2 = f * f;
                const f3 = f2 * f;

                const x = 0.5 * ((2 * p1.x) +
                    (-p0.x + p2.x) * f +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3);

                const y = 0.5 * ((2 * p1.y) +
                    (-p0.y + p2.y) * f +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3);

                result.push({ x, y });
            }
        }
        this.smoothedSpline = result;
    }

    private render() {
        this.graphics.clear();
        if (this.smoothedSpline.length < 2) return;

        this.graphics.lineStyle(6, 0x00cec9, 0.85);
        this.graphics.moveTo(this.smoothedSpline[0].x, this.smoothedSpline[0].y);

        for (let i = 1; i < this.smoothedSpline.length; i++) {
            this.graphics.lineTo(this.smoothedSpline[i].x, this.smoothedSpline[i].y);
        }
    }
}
```

---

## 2. Контроллер движения юнита по сплайну (`PathFollower.ts`)

```typescript
import { Point2D } from './PathDrawer';

export class PathFollower {
    public path: Point2D[] = [];
    public currentIndex = 0;
    public position: Point2D = { x: 0, y: 0 };
    public rotation = 0;
    public speed = 120.0; // Пикселей в секунду
    public isFinished = true;

    public setPath(path: Point2D[]) {
        if (path.length === 0) return;
        this.path = path;
        this.currentIndex = 0;
        this.position = { ...path[0] };
        this.isFinished = false;
    }

    public update(dt: number): { x: number; y: number; angle: number } {
        if (this.isFinished || this.path.length === 0) {
            return { x: this.position.x, y: this.position.y, angle: this.rotation };
        }

        const target = this.path[this.currentIndex];
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 2.0) {
            this.rotation = Math.atan2(dy, dx);
            const step = Math.min(dist, this.speed * dt);
            this.position.x += (dx / dist) * step;
            this.position.y += (dy / dist) * step;
        } else {
            this.currentIndex++;
            if (this.currentIndex >= this.path.length) {
                this.isFinished = true;
            }
        }

        return { x: this.position.x, y: this.position.y, angle: this.rotation };
    }
}
```
