# PixiJS: Drag & Drop Cards, Elastic Connecting Strings & Evidence Board

Эталонная реализация интерактивной детективной доски улик, перетаскивания карточек пальцем/мышью и натяжения красных шерстяных нитей между уликами на PixiJS.

---

## 1. Интерактивная карточка улики (`EvidenceCard.ts`)

```typescript
import * as PIXI from 'pixi.js';

export class EvidenceCard extends PIXI.Container {
    public id: string;
    public titleText: string;
    private background: PIXI.Graphics;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };

    constructor(id: string, title: string, x: number, y: number) {
        super();
        this.id = id;
        this.titleText = title;
        this.position.set(x, y);

        this.background = new PIXI.Graphics();
        this.drawCard(0xffffff, 0x333333);
        this.addChild(this.background);

        const text = new PIXI.Text(title, {
            fontSize: 14,
            fontWeight: 'bold',
            fill: 0x222222,
            wordWrap: true,
            wordWrapWidth: 120
        });
        text.position.set(10, 10);
        this.addChild(text);

        // Булавка вверху
        const pin = new PIXI.Graphics();
        pin.beginFill(0xd63031);
        pin.drawCircle(70, 4, 6);
        pin.endFill();
        this.addChild(pin);

        this.interactive = true;
        this.buttonMode = true;
        this.setupDragEvents();
    }

    private drawCard(bgColor: number, shadowColor: number) {
        this.background.clear();
        // Тень
        this.background.beginFill(shadowColor, 0.2);
        this.background.drawRoundedRect(4, 4, 140, 100, 8);
        this.background.endFill();

        // Тело карточки
        this.background.beginFill(bgColor);
        this.background.lineStyle(2, 0xdcdde1);
        this.background.drawRoundedRect(0, 0, 140, 100, 8);
        this.background.endFill();
    }

    private setupDragEvents() {
        this.on('pointerdown', (e: PIXI.InteractionEvent) => {
            this.isDragging = true;
            const parentPos = e.data.getLocalPosition(this.parent);
            this.dragOffset.x = this.x - parentPos.x;
            this.dragOffset.y = this.y - parentPos.y;
            this.alpha = 0.85;
            this.scale.set(1.05);
        });

        this.on('pointerup', () => this.stopDrag());
        this.on('pointerupoutside', () => this.stopDrag());

        this.on('pointermove', (e: PIXI.InteractionEvent) => {
            if (!this.isDragging) return;
            const parentPos = e.data.getLocalPosition(this.parent);
            this.position.set(parentPos.x + this.dragOffset.x, parentPos.y + this.dragOffset.y);
        });
    }

    private stopDrag() {
        this.isDragging = false;
        this.alpha = 1.0;
        this.scale.set(1.0);
    }
}
```

---

## 2. Натягивающиеся нити между карточками (`ConnectingThreads.ts`)

```typescript
import * as PIXI from 'pixi.js';
import { EvidenceCard } from './EvidenceCard';

export interface Connection {
    from: EvidenceCard;
    to: EvidenceCard;
}

export class ConnectingThreads {
    public connections: Connection[] = [];
    private graphics: PIXI.Graphics;

    constructor(parentContainer: PIXI.Container) {
        this.graphics = new PIXI.Graphics();
        parentContainer.addChildAt(this.graphics, 0); // Рисуем под карточками
    }

    public addConnection(from: EvidenceCard, to: EvidenceCard) {
        this.connections.push({ from, to });
    }

    public update() {
        this.graphics.clear();

        for (const conn of this.connections) {
            const startX = conn.from.x + 70; // Координаты булавки
            const startY = conn.from.y + 4;
            const endX = conn.to.x + 70;
            const endY = conn.to.y + 4;

            // Расчет провисания нити (Sagging) под гравитацией
            const midX = (startX + endX) / 2;
            const dist = Math.hypot(endX - startX, endY - startY);
            const midY = (startY + endY) / 2 + Math.min(25, dist * 0.08);

            this.graphics.lineStyle(3, 0xc0392b, 0.9);
            this.graphics.moveTo(startX, startY);
            this.graphics.quadraticCurveTo(midX, midY, endX, endY);
        }
    }
}
```
