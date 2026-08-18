import { FlowFieldGrid } from '../core/FlowFieldGrid';
import { SceneManager } from '../rendering/SceneManager';
import { Caste } from '../entities/AntTypes';
import { eventBus } from '../core/EventBus';

interface ActivePointer {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  isDrawing: boolean;
}

export class TouchController {
  private canvas: HTMLCanvasElement;
  private flowGrid: FlowFieldGrid;
  private scene: SceneManager;

  public activeCaste: Caste = Caste.WORKER;
  private activePointers: Map<number, ActivePointer> = new Map();

  // Pinch Zoom state
  private pinchStartDist = 0;
  private pinchStartZoom = 1.0;

  // Energy & Drawing constraints
  public pheromoneEnergy = 100;
  public maxPheromoneEnergy = 100;

  public isEnabled = true;

  constructor(canvas: HTMLCanvasElement, flowGrid: FlowFieldGrid, scene: SceneManager) {
    this.canvas = canvas;
    this.flowGrid = flowGrid;
    this.scene = scene;

    this.setupPointerEvents();
    this.setupKeyboardEvents();
  }

  public setActiveCaste(caste: Caste): void {
    this.activeCaste = caste;
    eventBus.emit('caste:selected', { caste });
  }

  public update(dt: number): void {
    // Regenerate pheromone energy
    if (this.pheromoneEnergy < this.maxPheromoneEnergy) {
      this.pheromoneEnergy = Math.min(this.maxPheromoneEnergy, this.pheromoneEnergy + 20 * dt);
    }
  }

  private setupPointerEvents(): void {
    const el = this.canvas;

    // Prevent context menu
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
      if (!this.isEnabled) return;
      el.setPointerCapture(e.pointerId);

      const worldPos = this.screenToWorld(e.clientX, e.clientY);

      this.activePointers.set(e.pointerId, {
        id: e.pointerId,
        startX: worldPos.x,
        startY: worldPos.y,
        lastX: worldPos.x,
        lastY: worldPos.y,
        isDrawing: e.button === 0 // Left click / single touch draws
      });

      if (this.activePointers.size === 2) {
        // Start Pinch Zoom
        const ptrs = Array.from(this.activePointers.values());
        this.pinchStartDist = Math.hypot(ptrs[0].lastX - ptrs[1].lastX, ptrs[0].lastY - ptrs[1].lastY);
        this.pinchStartZoom = this.scene.camera.targetZoom;
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.isEnabled) return;
      const ptr = this.activePointers.get(e.pointerId);
      if (!ptr) return;

      const worldPos = this.screenToWorld(e.clientX, e.clientY);

      if (this.activePointers.size === 2) {
        // Two-finger Pinch Zooming
        ptr.lastX = worldPos.x;
        ptr.lastY = worldPos.y;

        const ptrs = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(ptrs[0].lastX - ptrs[1].lastX, ptrs[0].lastY - ptrs[1].lastY);
        if (this.pinchStartDist > 10) {
          const ratio = currentDist / this.pinchStartDist;
          this.scene.camera.targetZoom = Math.max(
            this.scene.camera.minZoom,
            Math.min(this.scene.camera.maxZoom, this.pinchStartZoom * ratio)
          );
        }
      } else if (ptr.isDrawing && this.pheromoneEnergy > 0) {
        // Single finger / Left-click Drawing Flow Field Pheromones
        const dist = Math.hypot(worldPos.x - ptr.lastX, worldPos.y - ptr.lastY);
        if (dist > 8) {
          const casteMask = 1 << this.activeCaste;
          this.flowGrid.addStroke(ptr.lastX, ptr.lastY, worldPos.x, worldPos.y, 48, casteMask, 1.0);

          this.pheromoneEnergy = Math.max(0, this.pheromoneEnergy - dist * 0.08);
          eventBus.emit('audio:play_sfx', { name: 'pheromone_draw', volume: 0.15 });

          ptr.lastX = worldPos.x;
          ptr.lastY = worldPos.y;
        }
      } else if (e.buttons === 2 || e.buttons === 4) {
        // Right click / Middle click Camera Pan
        const dx = (worldPos.x - ptr.lastX);
        const dy = (worldPos.y - ptr.lastY);
        this.scene.camera.targetX -= dx;
        this.scene.camera.targetY -= dy;
        ptr.lastX = worldPos.x;
        ptr.lastY = worldPos.y;
      }
    });

    const endHandler = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };

    el.addEventListener('pointerup', endHandler);
    el.addEventListener('pointercancel', endHandler);
  }

  private setupKeyboardEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;

      switch (e.code) {
        case 'Digit1':
        case 'KeyQ':
          this.setActiveCaste(Caste.WORKER);
          break;
        case 'Digit2':
        case 'KeyW':
          this.setActiveCaste(Caste.SOLDIER);
          break;
        case 'Digit3':
        case 'KeyE':
          this.setActiveCaste(Caste.BOMBER);
          break;
        case 'Space':
          e.preventDefault();
          eventBus.emit('swarm:sphere', { active: true });
          break;
        case 'KeyR':
          this.flowGrid.clear();
          eventBus.emit('swarm:disperse');
          break;
        case 'Escape':
        case 'KeyP':
          eventBus.emit('game:state_changed', { state: 'PAUSE' });
          break;
      }
    });
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const screenW = this.canvas.clientWidth;
    const screenH = this.canvas.clientHeight;
    const zoom = this.scene.camera.zoom || 1.0;

    const worldX = (screenX - screenW * 0.5) / zoom + this.scene.camera.x;
    const worldY = (screenY - screenH * 0.5) / zoom + this.scene.camera.y;

    return { x: worldX, y: worldY };
  }
}
