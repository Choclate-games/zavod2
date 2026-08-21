import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld, WHEEL_RAY_GROUPS } from '../physics/PhysicsWorld';
import { ProceduralModels, VehicleVisualRig } from '../rendering/ProceduralModels';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { TireTracksManager } from '../rendering/TireTracksManager';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { EventBus } from '../core/EventBus';

export interface VehicleControls {
  throttle: number; // 0..1
  brake: number;    // 0..1
  steer: number;    // -1..1
  handbrake: boolean;
  nitro: boolean;
}

export class PlayerVehicle {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, 1);

  body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private visualRig: VehicleVisualRig | null = null;

  // Car Stats
  hp = 100;
  maxHp = 100;
  shield = 50;
  maxShield = 50;
  speedKmH = 0;
  slipAngleDeg = 0;
  isDrifting = false;
  driftMultiplier = 1.0;

  // Nitro Rage System
  nitroRage = 0; // 0..100
  isNitroActive = false;
  nitroTimer = 0;
  isInvulnerable = false;
  invulnerabilityTimer = 0;

  // Autocannon timer
  private cannonTimer = 0;
  private napalmTimer = 0;
  private teslaTimer = 0;

  private steerAngle = 0;
  private wheelSpinAngle = 0;

  private config = {
    wheelRadius: 0.36,
    suspensionRestLength: 0.28,
    suspensionStiffness: 85.0,
    frictionSlip: 3.2,
    baseEngineForce: 4600.0,
    maxSpeedMs: 55.0, // ~198 km/h
    nitroSpeedMs: 40.0, // ~144 km/h boost
  };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly tracks: TireTracksManager
  ) {
    scene.add(this.root);
  }

  build(carIndex = 0, neonColor = 0x00f0ff): void {
    if (this.visualRig) {
      this.root.remove(this.visualRig.root);
    }

    if (carIndex === 1) {
      this.visualRig = ProceduralModels.createDriftCoupe(neonColor);
      this.config.frictionSlip = 3.6;
      this.config.baseEngineForce = 4400.0;
    } else if (carIndex === 2) {
      this.visualRig = ProceduralModels.createRaidTruck(neonColor);
      this.config.frictionSlip = 3.0;
      this.config.baseEngineForce = 5200.0;
    } else {
      this.visualRig = ProceduralModels.createMuscleCar(neonColor);
      this.config.frictionSlip = 3.2;
      this.config.baseEngineForce = 4800.0;
    }

    this.root.add(this.visualRig.root);

    const startPos = new THREE.Vector3(0, 0.8, 0);
    this.position.copy(startPos);

    if (!this.body) {
      this.body = this.physics.createChassis(startPos, { x: 0.95, y: 0.45, z: 2.1 });
      this.vehicle = this.physics.createVehicleController(this.body);

      this.vehicle.indexUpAxis = 1;
      this.vehicle.setIndexForwardAxis = 2;

      const direction = { x: 0, y: -1, z: 0 };
      const axle = { x: -1, y: 0, z: 0 };

      const wheelPositions = [
        { x: -0.92, y: 0.05, z: 1.25 },
        { x: 0.92,  y: 0.05, z: 1.25 },
        { x: -0.92, y: 0.05, z: -1.25 },
        { x: 0.92,  y: 0.05, z: -1.25 },
      ];

      for (let i = 0; i < 4; i++) {
        const w = wheelPositions[i];
        this.vehicle.addWheel(w, direction, axle, this.config.suspensionRestLength, this.config.wheelRadius);
        this.vehicle.setWheelSuspensionStiffness(i, this.config.suspensionStiffness);
        this.vehicle.setWheelSuspensionCompression(i, 4.2);
        this.vehicle.setWheelSuspensionRelaxation(i, 6.0);
        this.vehicle.setWheelMaxSuspensionTravel(i, 0.25);
        this.vehicle.setWheelMaxSuspensionForce(i, 42000.0);
        this.vehicle.setWheelFrictionSlip(i, this.config.frictionSlip);
        this.vehicle.setWheelSideFrictionStiffness(i, 1.8);
      }
    } else {
      this.body.setTranslation({ x: 0, y: 0.8, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  takeDamage(amount: number, impactVector?: THREE.Vector3): void {
    if (this.isInvulnerable || this.isNitroActive) return;

    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }

    if (amount > 0) {
      this.hp = Math.max(0, this.hp - amount);
      SoundSynthesizer.get().playImpactCrash(1.2);
      ParticleSystem.get().emitDriftSparks(this.position);
    }

    if (impactVector && this.body) {
      this.body.applyImpulse({
        x: impactVector.x * 3000,
        y: 1500,
        z: impactVector.z * 3000,
      }, true);
    }

    if (this.hp <= 0) {
      EventBus.get().emit('player:destroyed');
    }
  }

  heal(hpAmount: number, shieldAmount = 0): void {
    this.hp = Math.min(this.maxHp, this.hp + hpAmount);
    this.shield = Math.min(this.maxShield, this.shield + shieldAmount);
  }

  triggerNitro(): boolean {
    if (this.nitroRage < 100 || this.isNitroActive || !this.body) return false;

    this.nitroRage = 0;
    this.isNitroActive = true;
    this.nitroTimer = 1.85;
    this.isInvulnerable = true;
    this.invulnerabilityTimer = 1.85;

    // Apply explosive forward impulse
    const impulse = this.forward.clone().multiplyScalar(45000);
    this.body.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);

    SoundSynthesizer.get().playNitroBurst();
    ParticleSystem.get().emitShockwave(this.position, 6.5);
    EventBus.get().emit('player:nitro_burst');
    return true;
  }

  fixedUpdate(dt: number, input: VehicleControls): void {
    if (!this.vehicle || !this.body) return;

    // Trigger Nitro on button press
    if (input.nitro) {
      this.triggerNitro();
    }

    // Nitro Timer
    if (this.isNitroActive) {
      this.nitroTimer -= dt;
      if (this.nitroTimer <= 0) {
        this.isNitroActive = false;
      }
    }
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= dt;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // Steering
    const targetSteer = input.steer * -0.52;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 8.0 * dt);
    this.vehicle.setWheelSteering(0, this.steerAngle);
    this.vehicle.setWheelSteering(1, this.steerAngle);

    // Engine throttle / brake / handbrake
    const curSpeed = this.vehicle.currentVehicleSpeed();
    const turboLvl = UpgradeSystem.get().getModuleLevel('turbo_charger');
    const engineForceBonus = 1.0 + turboLvl * 0.15;
    const force = (this.config.baseEngineForce * engineForceBonus) * (this.isNitroActive ? 2.4 : 1.0);

    for (let i = 0; i < 4; i++) {
      if (input.throttle > 0) {
        this.vehicle.setWheelEngineForce(i, input.throttle * force);
        this.vehicle.setWheelBrake(i, 0);
      } else if (input.brake > 0) {
        if (curSpeed > 0.5) {
          this.vehicle.setWheelBrake(i, input.brake * 50.0);
          this.vehicle.setWheelEngineForce(i, 0);
        } else {
          this.vehicle.setWheelEngineForce(i, -input.brake * (force * 0.4));
          this.vehicle.setWheelBrake(i, 0);
        }
      } else if (input.handbrake) {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 95.0);
        // Reduce rear friction for sweet drift initiation
        if (i >= 2) {
          this.vehicle.setWheelFrictionSlip(i, 1.2);
        }
      } else {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 0.5);
        this.vehicle.setWheelFrictionSlip(i, this.config.frictionSlip);
      }
    }

    // Raycast wheels update
    this.vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);
  }

  postStep(dt: number, input: VehicleControls): void {
    if (!this.body || !this.vehicle) return;

    const t = this.body.translation();
    const r = this.body.rotation();

    this.position.set(t.x, t.y, t.z);
    this.root.position.copy(this.position);
    this.root.quaternion.set(r.x, r.y, r.z, r.w);

    const v = this.body.linvel();
    this.velocity.set(v.x, v.y, v.z);

    // Forward direction
    this.forward.set(0, 0, 1).applyQuaternion(this.root.quaternion);

    // Calculate Speed (km/h)
    this.speedKmH = this.velocity.length() * 3.6;

    // Calculate Slip Angle
    const horizontalVel = new THREE.Vector3(v.x, 0, v.z);
    if (horizontalVel.lengthSq() > 1.0) {
      horizontalVel.normalize();
      const dot = THREE.MathUtils.clamp(this.forward.dot(horizontalVel), -1, 1);
      this.slipAngleDeg = Math.acos(dot) * (180 / Math.PI);
    } else {
      this.slipAngleDeg = 0;
    }

    // Drift Dynamics & Nitro Generation
    this.isDrifting = this.speedKmH > 28.0 && this.slipAngleDeg >= 22.5 && this.slipAngleDeg <= 75.0;

    if (this.isDrifting) {
      const angleRatio = (this.slipAngleDeg - 22.5) / (75.0 - 22.5);
      this.driftMultiplier = 1.0 + angleRatio * 2.2;

      const turboBonus = 1.0 + UpgradeSystem.get().getModuleLevel('turbo_charger') * 0.25;
      const rageGain = 18.5 * this.driftMultiplier * turboBonus * dt;
      this.nitroRage = Math.min(100.0, this.nitroRage + rageGain);

      // VFX: Smoke & Sparks from rear wheels
      const wLPos = this.position.clone().add(new THREE.Vector3(-0.9, 0.1, -1.25).applyQuaternion(this.root.quaternion));
      const wRPos = this.position.clone().add(new THREE.Vector3(0.9, 0.1, -1.25).applyQuaternion(this.root.quaternion));

      ParticleSystem.get().emitTireSmoke(wLPos, this.forward);
      ParticleSystem.get().emitTireSmoke(wRPos, this.forward);
      if (this.slipAngleDeg > 40.0) {
        ParticleSystem.get().emitDriftSparks(wLPos);
        ParticleSystem.get().emitDriftSparks(wRPos);
      }

      // Tire skidmark ribbons
      this.tracks.addTrackSegment(0, wLPos, this.forward, 0.32, 0.85);
      this.tracks.addTrackSegment(1, wRPos, this.forward, 0.32, 0.85);

      // Audio Squeal
      SoundSynthesizer.get().setDriftIntensity(0.8 + angleRatio * 0.4, this.slipAngleDeg);
    } else {
      this.driftMultiplier = 1.0;
      this.tracks.breakTrack(0);
      this.tracks.breakTrack(1);
      SoundSynthesizer.get().stopDriftSqueal();
    }

    // Audio Engine Sound
    const speedRatio = Math.min(1.0, this.speedKmH / 180.0);
    SoundSynthesizer.get().updateEngineRPM(speedRatio, input.throttle);

    // Nitro Exhaust VFX
    if (this.isNitroActive && this.visualRig) {
      this.visualRig.exhaustPipes.forEach(pipe => {
        const pipePos = this.position.clone().add(pipe.clone().applyQuaternion(this.root.quaternion));
        ParticleSystem.get().emitNitroFlame(pipePos, this.forward);
      });
    }

    // Animate Visual Wheels
    if (this.visualRig) {
      const curSpeedMs = this.velocity.length();
      this.wheelSpinAngle += (curSpeedMs * 3.0) * dt;
      this.visualRig.wheelFlSpin.rotation.x = this.wheelSpinAngle;
      this.visualRig.wheelFrSpin.rotation.x = this.wheelSpinAngle;
      this.visualRig.wheelRlSpin.rotation.x = this.wheelSpinAngle;
      this.visualRig.wheelRrSpin.rotation.x = this.wheelSpinAngle;
    }

    // Active Kinetic Modules Update
    this.updateKineticModules(dt);
  }

  private updateKineticModules(dt: number): void {
    // 1. Napalm Trail Module
    const napalmLvl = UpgradeSystem.get().getModuleLevel('napalm_trail');
    if (napalmLvl > 0 && (this.isDrifting || this.isNitroActive)) {
      this.napalmTimer += dt;
      if (this.napalmTimer > 0.15) {
        this.napalmTimer = 0;
        const trailPos = this.position.clone().add(new THREE.Vector3(0, 0, -2.2).applyQuaternion(this.root.quaternion));
        ParticleSystem.get().emitNapalmPatch(trailPos);
        EventBus.get().emit('player:napalm_dropped', { position: trailPos, radius: 3.5, damage: 15 * napalmLvl });
      }
    }

    // 2. Rooftop Autocannon
    const cannonLvl = UpgradeSystem.get().getModuleLevel('autocannon');
    if (cannonLvl > 0) {
      this.cannonTimer += dt;
      const fireInterval = Math.max(0.2, 0.65 - cannonLvl * 0.08);
      if (this.cannonTimer >= fireInterval) {
        this.cannonTimer = 0;
        EventBus.get().emit('player:autocannon_fire', {
          origin: this.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          damage: 18 * cannonLvl,
        });
      }
    }

    // 3. Tesla EMP
    const teslaLvl = UpgradeSystem.get().getModuleLevel('tesla_emp');
    if (teslaLvl > 0) {
      this.teslaTimer += dt;
      if (this.teslaTimer >= 4.0 - teslaLvl * 0.4) {
        this.teslaTimer = 0;
        ParticleSystem.get().emitShockwave(this.position, 8.0);
        EventBus.get().emit('player:tesla_discharge', {
          position: this.position,
          radius: 8.5,
          damage: 40 * teslaLvl,
        });
      }
    }
  }

  reset(carIndex = 0, neonColor = 0x00f0ff): void {
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.nitroRage = 0;
    this.isNitroActive = false;
    this.isInvulnerable = false;
    this.build(carIndex, neonColor);
  }
}
