import { SceneManager } from '../rendering/SceneManager.ts';
import { events } from '../core/EventBus.ts';

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

export class TouchControls {
  private container: HTMLElement;
  private sceneManager: SceneManager;

  private activePointers: Map<number, PointerState> = new Map();
  private initialPinchDist: number = 0;
  private isEnabled: boolean = true;

  private static readonly TAP_THRESHOLD_PX = 8;

  constructor(container: HTMLElement, sceneManager: SceneManager) {
    this.container = container;
    this.sceneManager = sceneManager;

    this.bindPointerEvents();
    this.bindWheelAndKeys();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.activePointers.clear();
    }
  }

  private bindPointerEvents(): void {
    this.container.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.isEnabled) return;
      this.container.setPointerCapture(e.pointerId);

      this.activePointers.set(e.pointerId, {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: false,
      });

      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDist = Math.hypot(pts[0].currentX - pts[1].currentX, pts[0].currentY - pts[1].currentY);
      }
    });

    this.container.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isEnabled) return;
      const state = this.activePointers.get(e.pointerId);
      if (!state) return;

      const prevX = state.currentX;
      const prevY = state.currentY;
      state.currentX = e.clientX;
      state.currentY = e.clientY;

      const totalDist = Math.hypot(state.currentX - state.startX, state.currentY - state.startY);
      if (totalDist > TouchControls.TAP_THRESHOLD_PX) {
        state.isDragging = true;
      }

      if (this.activePointers.size === 1 && state.isDragging) {
        // Single finger pan
        const dx = state.currentX - prevX;
        const dy = state.currentY - prevY;
        // Project screen delta into ground plane pan
        this.sceneManager.panCamera(-dx * 0.03, -dy * 0.03);
      } else if (this.activePointers.size === 2) {
        // Two fingers pinch zoom
        const pts = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(pts[0].currentX - pts[1].currentX, pts[0].currentY - pts[1].currentY);
        if (this.initialPinchDist > 0) {
          const delta = (this.initialPinchDist - currentDist) * 0.04;
          this.sceneManager.zoomCamera(delta);
          this.initialPinchDist = currentDist;
        }
      }

      // Also emit hover for cursor highlight if single pointer
      if (this.activePointers.size <= 1) {
        const hit = this.sceneManager.raycastGround(e.clientX, e.clientY);
        if (hit) {
          events.emit('ground:pointer_move', { x: hit.x, z: hit.z });
        }
      }
    });

    const handlePointerUp = (e: PointerEvent) => {
      const state = this.activePointers.get(e.pointerId);
      if (state) {
        if (!state.isDragging) {
          // Clean Tap
          const hit = this.sceneManager.raycastGround(state.startX, state.startY);
          if (hit) {
            events.emit('ground:pointer_tap', { x: hit.x, z: hit.z, screenX: state.startX, screenY: state.startY });
          }
        }
        this.activePointers.delete(e.pointerId);
      }
      if (this.activePointers.size < 2) {
        this.initialPinchDist = 0;
      }
    };

    this.container.addEventListener('pointerup', handlePointerUp);
    this.container.addEventListener('pointercancel', handlePointerUp);
    this.container.addEventListener('lostpointercapture', handlePointerUp);
  }

  private bindWheelAndKeys(): void {
    // Mouse wheel zoom
    window.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.isEnabled) return;
      this.sceneManager.zoomCamera(e.deltaY * 0.015);
    }, { passive: true });

    // Keyboard controls
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isEnabled) return;

      switch (e.key) {
        case '1':
          events.emit('input:select_tool', 'cannon');
          break;
        case '2':
          events.emit('input:select_tool', 'splasher');
          break;
        case '3':
          events.emit('input:select_tool', 'wall');
          break;
        case ' ':
          events.emit('input:toggle_wave_or_pause');
          break;
        case 'r':
        case 'R':
        case 'к':
        case 'К':
          events.emit('input:toggle_speed');
          break;
        case 'Escape':
          events.emit('input:cancel_selection');
          break;
        case 'w':
        case 'W':
        case 'ArrowUp':
          this.sceneManager.panCamera(0, -0.6);
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          this.sceneManager.panCamera(0, 0.6);
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          this.sceneManager.panCamera(-0.6, 0);
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          this.sceneManager.panCamera(0.6, 0);
          break;
      }
    });
  }
}
