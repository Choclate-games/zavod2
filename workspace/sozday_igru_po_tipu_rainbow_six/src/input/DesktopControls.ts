import type { InputSnapshot } from "../core/Types";

export class DesktopControls {
  private canvas: HTMLCanvasElement;
  private isPointerLocked = false;

  private keys: Record<string, boolean> = {};
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private mouseLeftDown = 0;
  private mouseRightDown = 0;
  private leftJustPressed = false;
  private reloadJustPressed = false;
  private detonateJustPressed = false;
  private reconJustPressed = false;
  private interactJustPressed = false;
  private pauseJustPressed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
      }

      if (e.button === 0) {
        this.mouseLeftDown = 1;
        this.leftJustPressed = true;
      } else if (e.button === 2) {
        this.mouseRightDown = 1;
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (e.button === 0) this.mouseLeftDown = 0;
      if (e.button === 2) this.mouseRightDown = 0;
    });

    window.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      if (e.code === "KeyR") this.reloadJustPressed = true;
      if (e.code === "Space" || e.code === "KeyF") this.detonateJustPressed = true;
      if (e.code === "KeyT") this.reconJustPressed = true;
      if (e.code === "KeyE" && !this.isPointerLocked) this.interactJustPressed = true;
      if (e.code === "Escape" || e.code === "KeyP") this.pauseJustPressed = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }

  sample(out: InputSnapshot): void {
    // Movement WASD
    let moveX = 0;
    let moveZ = 0;

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) moveZ += 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) moveZ -= 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) moveX -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) moveX += 1;

    out.moveX += moveX;
    out.moveZ += moveZ;

    out.aimDeltaX += this.mouseDeltaX;
    out.aimDeltaY += this.mouseDeltaY;

    out.primaryFire = out.primaryFire || this.mouseLeftDown === 1 || !!this.keys["KeyJ"];
    out.primaryFireJustPressed = out.primaryFireJustPressed || this.leftJustPressed;

    out.shieldHold = out.shieldHold || this.mouseRightDown === 1 || !!this.keys["KeyK"];
    out.leanLeft = out.leanLeft || !!this.keys["KeyQ"];
    out.leanRight = out.leanRight || !!this.keys["KeyE"];

    out.reloadJustPressed = out.reloadJustPressed || this.reloadJustPressed;
    out.detonateJustPressed = out.detonateJustPressed || this.detonateJustPressed;
    out.reconToggleJustPressed = out.reconToggleJustPressed || this.reconJustPressed;
    out.interactJustPressed = out.interactJustPressed || this.interactJustPressed;
    out.pauseJustPressed = out.pauseJustPressed || this.pauseJustPressed;

    // Reset single-frame flags
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.leftJustPressed = false;
    this.reloadJustPressed = false;
    this.detonateJustPressed = false;
    this.reconJustPressed = false;
    this.interactJustPressed = false;
    this.pauseJustPressed = false;
  }

  reset(): void {
    this.keys = {};
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseLeftDown = 0;
    this.mouseRightDown = 0;
    this.leftJustPressed = false;
  }
}
