import { EventBus } from "../core/EventBus";

export class ReconSystem {
  private eventBus: EventBus;
  public isReconActive = false;
  public reconTimeRemaining = 6.0;
  public readonly maxReconTime = 6.0;
  public taggedThreats: Set<string> = new Set();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  toggleRecon(): boolean {
    if (this.reconTimeRemaining <= 0) return false;
    this.isReconActive = !this.isReconActive;
    this.eventBus.emit("recon:toggled", { active: this.isReconActive });
    return this.isReconActive;
  }

  setRecon(active: boolean): void {
    if (active && this.reconTimeRemaining <= 0) return;
    this.isReconActive = active;
    this.eventBus.emit("recon:toggled", { active: this.isReconActive });
  }

  update(realDt: number): void {
    if (this.isReconActive) {
      this.reconTimeRemaining -= realDt;
      if (this.reconTimeRemaining <= 0) {
        this.reconTimeRemaining = 0;
        this.setRecon(false);
      }
    }
  }

  tagThreat(id: string): void {
    this.taggedThreats.add(id);
  }

  reset(): void {
    this.isReconActive = false;
    this.reconTimeRemaining = this.maxReconTime;
    this.taggedThreats.clear();
  }
}
