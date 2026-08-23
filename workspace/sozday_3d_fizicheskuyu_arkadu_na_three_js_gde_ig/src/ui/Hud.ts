/**
 * Hud: In-game HUD layout manager with 5 strict anchor zones.
 * Updates DOM only when values change.
 */

import { AnalogInclinometer } from './components/AnalogInclinometer';
import { EmergencyGripButton } from './components/EmergencyGripButton';
import { SpeedGauge } from './components/SpeedGauge';
import { TunnelProgressBar } from './components/TunnelProgressBar';

export class Hud {
  private element: HTMLElement;
  private speedGauge: SpeedGauge;
  private inclinometer: AnalogInclinometer;
  private progressBar: TunnelProgressBar;
  private gripButton: EmergencyGripButton;
  private toastEl: HTMLElement;

  private lastSpeed: number = -1;
  private lastTilt: number = -1;
  private lastDistance: number = -1;

  constructor(onGripClick: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'hud-layer';

    // Top-Left Anchor
    const topLeft = document.createElement('div');
    topLeft.className = 'hud-anchor-top-left';
    this.speedGauge = new SpeedGauge();
    topLeft.appendChild(this.speedGauge.getElement());
    this.element.appendChild(topLeft);

    // Top-Center Anchor
    const topCenter = document.createElement('div');
    topCenter.className = 'hud-anchor-top-center';
    this.inclinometer = new AnalogInclinometer();
    topCenter.appendChild(this.inclinometer.getElement());
    this.element.appendChild(topCenter);

    // Top-Right Anchor
    const topRight = document.createElement('div');
    topRight.className = 'hud-anchor-top-right';
    this.progressBar = new TunnelProgressBar();
    topRight.appendChild(this.progressBar.getElement());
    this.element.appendChild(topRight);

    // Bottom-Center Anchor
    const botCenter = document.createElement('div');
    botCenter.className = 'hud-anchor-bottom-center';
    const touchGuidance = document.createElement('div');
    touchGuidance.className = 'touch-guidance-arc';
    touchGuidance.textContent = '◄ Свайп для баланса ►';
    botCenter.appendChild(touchGuidance);
    this.element.appendChild(botCenter);

    // Bottom-Right Anchor
    const botRight = document.createElement('div');
    botRight.className = 'hud-anchor-bottom-right';
    this.gripButton = new EmergencyGripButton(onGripClick);
    botRight.appendChild(this.gripButton.getElement());
    this.element.appendChild(botRight);

    // Warning Toast element
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast-banner';
    this.toastEl.style.display = 'none';
    this.toastEl.textContent = 'ОПАСНЫЙ КРЕН!';
    this.element.appendChild(this.toastEl);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setSpeed(speedKmH: number): void {
    if (this.lastSpeed !== speedKmH) {
      this.lastSpeed = speedKmH;
      this.speedGauge.update(speedKmH);
    }
  }

  public setTilt(angleDeg: number, isCritical: boolean): void {
    if (Math.abs(this.lastTilt - angleDeg) >= 0.1) {
      this.lastTilt = angleDeg;
      this.inclinometer.update(angleDeg, isCritical);
      this.toastEl.style.display = isCritical ? 'block' : 'none';
    }
  }

  public setProgress(distanceM: number, timeLeftSec: number): void {
    if (this.lastDistance !== distanceM) {
      this.lastDistance = distanceM;
      this.progressBar.update(distanceM, timeLeftSec);
    }
  }

  public setGripCooldown(cooldown01: number, isReady: boolean): void {
    this.gripButton.update(cooldown01, isReady);
  }
}
