import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface AttackStep {
  name: string;
  windupTime: number;
  activeTime: number;
  recoveryTime: number;
  damage: number;
  knockback: number;
  hitStopMs: number;
}

export class MeleeMode {
  public group = new THREE.Group();
  public knight = new THREE.Group();
  public kSword = new THREE.Group();
  public kShield = new THREE.Group();

  // Enemy
  public orc = new THREE.Group();
  public orcBody: THREE.Mesh;
  public orcHead: THREE.Mesh;
  public orcWeapon: THREE.Mesh;
  public orcHp = 150;
  public maxOrcHp = 150;
  public isOrcStunned = false;
  public orcStunTimer = 0;
  public orcAttackTimer = 2.0;
  public isOrcAttacking = false;
  public isOrcRagdoll = false;
  public orcVelocity = new THREE.Vector3();

  // Combo state machine
  public comboIndex = 0;
  public state: 'IDLE' | 'WINDUP' | 'ACTIVE' | 'RECOVERY' | 'PARRYING' = 'IDLE';
  public stateTimer = 0;
  public isParryWindow = false;

  public comboChain: AttackStep[] = [
    { name: 'Slash Right', windupTime: 0.08, activeTime: 0.12, recoveryTime: 0.18, damage: 25, knockback: 4.0, hitStopMs: 40 },
    { name: 'Slash Left',  windupTime: 0.06, activeTime: 0.12, recoveryTime: 0.20, damage: 35, knockback: 6.0, hitStopMs: 50 },
    { name: 'Heavy Slam',  windupTime: 0.18, activeTime: 0.16, recoveryTime: 0.35, damage: 65, knockback: 16.0, hitStopMs: 80 },
  ];

  // Hit-Stop state
  private isHitFrozen = false;

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    // Build arena
    this.buildArena();

    // Build Knight
    this.buildKnight();
    this.group.add(this.knight);

    // Build Orc Enemy
    this.buildOrc();
    this.group.add(this.orc);
  }

  private buildArena(): void {
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7, metalness: 0.2 })
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Ring border
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(13.8, 0.25, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    this.group.add(ring);
  }

  private buildKnight(): void {
    // Torso
    const kBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.85, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.3, metalness: 0.6 })
    );
    kBody.position.y = 1.0;
    kBody.castShadow = true;

    // Head
    const kHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.2 })
    );
    kHead.position.y = 1.65;
    kHead.castShadow = true;

    // Helmet plume
    const plume = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.2, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c })
    );
    plume.position.set(0, 1.95, 0);
    kHead.add(plume);

    this.knight.add(kBody, kHead);

    // Procedural Sword
    const sBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.1, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xecf0f1, metalness: 0.95, roughness: 0.1 })
    );
    sBlade.position.y = 0.6;
    sBlade.castShadow = true;

    const sGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.05, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.8 })
    );
    sGuard.position.y = 0.08;

    const sGrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x3e2723 })
    );
    sGrip.position.y = -0.06;

    this.kSword.add(sBlade, sGuard, sGrip);
    this.kSword.position.set(0.45, 0.9, 0.35);
    this.knight.add(this.kSword);

    // Shield
    const shieldMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.75, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8, roughness: 0.3 })
    );
    shieldMesh.position.set(-0.45, 1.0, 0.2);
    this.kShield.add(shieldMesh);
    this.knight.add(this.kShield);
  }

  private buildOrc(): void {
    // Body
    this.orcBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.6 })
    );
    this.orcBody.position.y = 1.0;
    this.orcBody.castShadow = true;

    // Head
    this.orcHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1e8449, roughness: 0.5 })
    );
    this.orcHead.position.y = 2.0;
    this.orcHead.castShadow = true;

    // Club weapon
    this.orcWeapon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
    );
    this.orcWeapon.position.set(0.7, 1.1, 0.4);
    this.orcWeapon.rotation.z = -0.4;
    this.orcWeapon.castShadow = true;

    this.orc.add(this.orcBody, this.orcHead, this.orcWeapon);
    this.orc.position.set(0, 0, -3.8);
  }

  public requestAttack(): boolean {
    if (this.state === 'IDLE' || this.state === 'RECOVERY') {
      if (this.state === 'RECOVERY') {
        this.comboIndex = (this.comboIndex + 1) % this.comboChain.length;
      } else {
        this.comboIndex = 0;
      }
      this.state = 'WINDUP';
      this.stateTimer = this.comboChain[this.comboIndex].windupTime;

      this.audio.playSwordSlash();
      return true;
    }
    return false;
  }

  public requestParry(): boolean {
    if (this.state === 'IDLE') {
      this.state = 'PARRYING';
      this.stateTimer = 0.30;
      this.isParryWindow = true;

      // Raise shield & sword in guard stance
      this.kSword.rotation.x = Math.PI / 2;
      this.kShield.position.z = 0.5;
      return true;
    }
    return false;
  }

  private triggerHitOnOrc(step: AttackStep): void {
    if (this.isHitFrozen || this.isOrcRagdoll) return;

    this.orcHp = Math.max(0, this.orcHp - step.damage);

    // Hit-Stop Micro Freeze
    this.isHitFrozen = true;
    setTimeout(() => { this.isHitFrozen = false; }, step.hitStopMs);

    // Flash white
    (this.orcBody.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    (this.orcHead.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    setTimeout(() => {
      (this.orcBody.material as THREE.MeshStandardMaterial).color.setHex(0x27ae60);
      (this.orcHead.material as THREE.MeshStandardMaterial).color.setHex(0x1e8449);
    }, 70);

    // Knockback
    this.orcVelocity.z -= step.knockback;
    this.orcVelocity.y += step.knockback * 0.35;
    this.onCameraShake(step.hitStopMs > 60 ? 0.45 : 0.25);

    // Check death / ragdoll
    if (this.orcHp <= 0) {
      this.triggerOrcRagdoll();
    }
  }

  private triggerOrcRagdoll(): void {
    this.isOrcRagdoll = true;
    this.audio.playExplosion(0.6);
    this.onCameraShake(0.6);

    this.orcVelocity.set((Math.random() - 0.5) * 6, 8.0, -14.0);

    // Respawn after 3 seconds
    setTimeout(() => {
      this.isOrcRagdoll = false;
      this.orcHp = this.maxOrcHp;
      this.orc.position.set(0, 0, -3.8);
      this.orc.rotation.set(0, 0, 0);
      this.orcVelocity.set(0, 0, 0);
    }, 3000);
  }

  public update(dt: number): void {
    if (!this.group.visible || this.isHitFrozen) return;

    // 1. Combo State Machine
    if (this.state !== 'IDLE') {
      this.stateTimer -= dt;
      const currentStep = this.comboChain[this.comboIndex];

      switch (this.state) {
        case 'WINDUP':
          this.kSword.rotation.z = THREE.MathUtils.lerp(this.kSword.rotation.z, 1.4, 20.0 * dt);
          if (this.stateTimer <= 0) {
            this.state = 'ACTIVE';
            this.stateTimer = currentStep.activeTime;
            // Hit frame
            if (this.orc.position.distanceTo(this.knight.position) < 5.0) {
              this.triggerHitOnOrc(currentStep);
            }
          }
          break;

        case 'ACTIVE':
          const targetRot = this.comboIndex === 2 ? -2.2 : -1.6;
          this.kSword.rotation.z = THREE.MathUtils.lerp(this.kSword.rotation.z, targetRot, 32.0 * dt);
          if (this.stateTimer <= 0) {
            this.state = 'RECOVERY';
            this.stateTimer = currentStep.recoveryTime;
          }
          break;

        case 'RECOVERY':
          this.kSword.rotation.z = THREE.MathUtils.lerp(this.kSword.rotation.z, 0, 10.0 * dt);
          if (this.stateTimer <= 0) {
            this.state = 'IDLE';
            this.comboIndex = 0;
          }
          break;

        case 'PARRYING':
          if (this.stateTimer <= 0.12) this.isParryWindow = false;
          if (this.stateTimer <= 0) {
            this.state = 'IDLE';
            this.kSword.rotation.x = 0;
            this.kShield.position.z = 0.2;
          }
          break;
      }
    }

    // 2. Orc AI (Attack Loop & Stun)
    if (!this.isOrcRagdoll) {
      if (this.isOrcStunned) {
        this.orcStunTimer -= dt;
        this.orc.rotation.y += Math.sin(Date.now() * 0.02) * 0.02;
        if (this.orcStunTimer <= 0) {
          this.isOrcStunned = false;
          this.orcAttackTimer = 2.0;
        }
      } else {
        this.orcAttackTimer -= dt;
        // Telegraph attack with weapon raise
        if (this.orcAttackTimer < 0.6) {
          this.orcWeapon.rotation.x = -1.2;
          (this.orcBody.material as THREE.MeshStandardMaterial).color.setHex(0xe74c3c);
        }

        // Execute Orc swing
        if (this.orcAttackTimer <= 0) {
          this.orcAttackTimer = 2.2;
          this.orcWeapon.rotation.x = 0.8;
          (this.orcBody.material as THREE.MeshStandardMaterial).color.setHex(0x27ae60);

          if (this.isParryWindow) {
            // PERFECT PARRY SUCCESS!
            this.audio.playParryClang();
            this.onCameraShake(0.5);
            this.isOrcStunned = true;
            this.orcStunTimer = 2.2;
            this.orcVelocity.z -= 6.0;
          } else {
            // Player hit by orc
            this.audio.playSpartanKick();
            this.onCameraShake(0.35);
          }
        }
      }
    }

    // 3. Orc Ragdoll / Knockback Physics
    this.orcVelocity.y -= 22.0 * dt;
    this.orcVelocity.z *= Math.pow(0.88, dt * 60);
    this.orcVelocity.x *= Math.pow(0.88, dt * 60);

    this.orc.position.addScaledVector(this.orcVelocity, dt);

    if (this.isOrcRagdoll) {
      this.orc.rotation.x += 8.0 * dt;
      this.orc.rotation.z += 4.0 * dt;
    }

    if (this.orc.position.y <= 0) {
      this.orc.position.y = 0;
      this.orcVelocity.y = 0;
      if (!this.isOrcRagdoll && this.orc.position.z < -3.8) {
        this.orc.position.z = THREE.MathUtils.lerp(this.orc.position.z, -3.8, 3.0 * dt);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
