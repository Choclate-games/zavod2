import type { InputSnapshot } from "../core/Types";
import { DesktopControls } from "./DesktopControls";
import { TouchControls } from "./TouchControls";

export class InputManager {
  private desktop: DesktopControls;
  public touch: TouchControls;
  private isTouchDevice = false;

  private currentSnapshot: InputSnapshot = {
    moveX: 0,
    moveZ: 0,
    aimDeltaX: 0,
    aimDeltaY: 0,
    primaryFire: false,
    primaryFireJustPressed: false,
    shieldHold: false,
    leanLeft: false,
    leanRight: false,
    reloadJustPressed: false,
    detonateJustPressed: false,
    reconToggleJustPressed: false,
    interactJustPressed: false,
    pauseJustPressed: false,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.desktop = new DesktopControls(canvas);
    this.touch = new TouchControls();

    const urlParams = new URLSearchParams(window.location.search);
    const touchFlag = urlParams.get("touch");

    if (touchFlag === "1") {
      this.isTouchDevice = true;
    } else if (touchFlag === "0") {
      this.isTouchDevice = false;
    } else {
      this.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    }

    window.addEventListener("blur", () => this.reset());
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.reset();
    });
  }

  sample(): InputSnapshot {
    // Reset snapshot values
    this.currentSnapshot.moveX = 0;
    this.currentSnapshot.moveZ = 0;
    this.currentSnapshot.aimDeltaX = 0;
    this.currentSnapshot.aimDeltaY = 0;
    this.currentSnapshot.primaryFire = false;
    this.currentSnapshot.primaryFireJustPressed = false;
    this.currentSnapshot.shieldHold = false;
    this.currentSnapshot.leanLeft = false;
    this.currentSnapshot.leanRight = false;
    this.currentSnapshot.reloadJustPressed = false;
    this.currentSnapshot.detonateJustPressed = false;
    this.currentSnapshot.reconToggleJustPressed = false;
    this.currentSnapshot.interactJustPressed = false;
    this.currentSnapshot.pauseJustPressed = false;

    // Sample desktop inputs
    this.desktop.sample(this.currentSnapshot);

    // Sample touch inputs
    this.touch.sample(this.currentSnapshot);

    // Clamp planar movement vector length to 1.0
    const len = Math.sqrt(
      this.currentSnapshot.moveX * this.currentSnapshot.moveX +
        this.currentSnapshot.moveZ * this.currentSnapshot.moveZ
    );
    if (len > 1.0) {
      this.currentSnapshot.moveX /= len;
      this.currentSnapshot.moveZ /= len;
    }

    return this.currentSnapshot;
  }

  showTouchControls(): void {
    if (this.isTouchDevice) {
      this.touch.show();
    }
  }

  hideTouchControls(): void {
    this.touch.hide();
  }

  reset(): void {
    this.desktop.reset();
    this.touch.reset();
  }
}
