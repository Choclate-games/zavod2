import * as THREE from 'three';
import { proceduralModels } from '../rendering/ProceduralModels';
import { audio } from '../audio/AudioManager';
import { particles } from '../rendering/ParticleSystem';
import { events } from '../core/EventBus';

export type C4State = 'IDLE' | 'ARMED' | 'DEFUSING' | 'DEFUSED' | 'DETONATED';

export class C4BombObjectiveSystem {
  public mesh: THREE.Group;
  public position = new THREE.Vector3(18, 0.6, -12);
  public state: C4State = 'IDLE';

  public timeRemaining = 35.0;
  public readonly initialTimer = 35.0;

  public defuseProgress = 0; // 0 to 1
  public defuseDuration = 5.0; // 5s with kit, 10s without
  public defusingEntityId: string | null = null;

  private beepTimer = 0;
  private ledMesh: THREE.Object3D | null = null;
  private ledBlinkTimer = 0;

  constructor() {
    this.mesh = proceduralModels.createC4Model();
    this.ledMesh = this.mesh.getObjectByName('c4_led') || null;
  }

  public arm(pos: THREE.Vector3, site: 'A' | 'B' = 'A'): void {
    this.position.copy(pos);
    this.mesh.position.copy(pos);
    this.state = 'ARMED';
    this.timeRemaining = this.initialTimer;
    this.defuseProgress = 0;
    this.defusingEntityId = null;
    this.beepTimer = 0;
    this.mesh.visible = true;
  }

  public startDefusing(entityId: string, hasKit: boolean): void {
    if (this.state !== 'ARMED') return;
    this.state = 'DEFUSING';
    this.defusingEntityId = entityId;
    this.defuseDuration = hasKit ? 5.0 : 10.0;
    this.defuseProgress = 0;
    audio.playC4DefuseStart();
  }

  public abortDefusing(): void {
    if (this.state === 'DEFUSING') {
      this.state = 'ARMED';
      this.defusingEntityId = null;
      this.defuseProgress = 0;
      audio.playC4DefuseAbort();
    }
  }

  public update(dt: number, onExplosion: () => void, onDefused: () => void): void {
    if (this.state === 'IDLE' || this.state === 'DEFUSED' || this.state === 'DETONATED') {
      return;
    }

    // Timer countdown
    this.timeRemaining -= dt;

    // Beeping rate calculation: 1Hz (at 35s) -> 8Hz (at < 5s)
    const urgency = 1 - Math.max(0, this.timeRemaining / this.initialTimer);
    const beepInterval = THREE.MathUtils.lerp(1.0, 0.12, Math.pow(urgency, 1.8));

    this.beepTimer += dt;
    if (this.beepTimer >= beepInterval) {
      this.beepTimer = 0;
      const beepPitch = THREE.MathUtils.lerp(900, 1800, urgency);
      audio.playC4Beep(beepPitch);

      // Flash LED diode
      if (this.ledMesh) {
        this.ledMesh.scale.setScalar(1.8);
        this.ledBlinkTimer = 0.08;
      }
    }

    if (this.ledBlinkTimer > 0) {
      this.ledBlinkTimer -= dt;
      if (this.ledBlinkTimer <= 0 && this.ledMesh) {
        this.ledMesh.scale.setScalar(1.0);
      }
    }

    // Handle Defusal progress
    if (this.state === 'DEFUSING') {
      this.defuseProgress += dt / this.defuseDuration;
      if (this.defuseProgress >= 1.0) {
        this.state = 'DEFUSED';
        this.defuseProgress = 1.0;
        onDefused();
        return;
      }
    }

    // Detonation Check
    if (this.timeRemaining <= 0) {
      this.state = 'DETONATED';
      this.timeRemaining = 0;
      audio.playC4Explosion();
      particles.spawnExplosion(this.position);
      onExplosion();
    }
  }
}

export const c4System = new C4BombObjectiveSystem();
