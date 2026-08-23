import * as THREE from 'three';
import { GAME_BALANCE, WEAPON_LADDER, WeaponDef } from '../config/balance';
import { physicsWorld } from '../physics/PhysicsWorld';
import { sceneManager } from '../rendering/SceneManager';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { particleSystem } from '../rendering/ParticleSystem';
import { audioManager } from '../audio/AudioManager';
import { eventBus } from '../core/EventBus';
import { InputSnapshot } from '../input/InputManager';

export class Player {
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public yaw: number = 0;
  public pitch: number = 0;

  public health: number = 100;
  public readonly maxHealth: number = 100;
  public isGrounded: boolean = true;

  // Weapon ladder progression
  public ladderRank: number = 1; // 1 to 12
  public currentWeapon: WeaponDef = WEAPON_LADDER[0];
  public ammo: number = WEAPON_LADDER[0].magazineCapacity;
  public fireTimer: number = 0;
  public morphTimer: number = 0;

  // Movement & Combat Slide
  public isSliding: boolean = false;
  public slideTimer: number = 0;
  public slideCooldown: number = 0;
  public slideDirection: THREE.Vector3 = new THREE.Vector3();

  // Vault & Climbing
  public isVaulting: boolean = false;
  public vaultTimer: number = 0;
  public vaultStartPos: THREE.Vector3 = new THREE.Vector3();
  public vaultTargetPos: THREE.Vector3 = new THREE.Vector3();

  // Killstreak UAV
  public killstreakCount: number = 0;
  public isUavActive: boolean = false;
  public uavTimer: number = 0;
  public uavPulseTimer: number = 0;

  // Stagger slowdown on taking damage
  public staggerTimer: number = 0;

  // 3D Visuals & Viewmodel
  public weaponHolder: THREE.Group = new THREE.Group();
  public armsModel: THREE.Group | null = null;
  public currentWeaponMesh: THREE.Group | null = null;

  // Weapon recoil offsets
  private recoilPitch: number = 0;
  private recoilOffsetZ: number = 0;

  constructor() {
    this.setupViewmodel();
    this.setRank(1);
  }

  private setupViewmodel(): void {
    this.weaponHolder.name = 'player_viewmodel_holder';
    this.armsModel = ProceduralModels.createFirstPersonArms();
    this.weaponHolder.add(this.armsModel);
    sceneManager.camera.add(this.weaponHolder);
    sceneManager.scene.add(sceneManager.camera);
  }

  public setRank(rank: number): void {
    this.ladderRank = Math.max(1, Math.min(GAME_BALANCE.ladder_tier_count, rank));
    this.currentWeapon = WEAPON_LADDER[this.ladderRank - 1];
    this.ammo = this.currentWeapon.magazineCapacity;
    this.morphTimer = GAME_BALANCE.morph_transition_duration; // 0.08s instant morph

    // Swap 3D Weapon Model
    if (this.currentWeaponMesh) {
      this.weaponHolder.remove(this.currentWeaponMesh);
    }
    this.currentWeaponMesh = ProceduralModels.createWeaponModel(this.currentWeapon.id);
    this.currentWeaponMesh.position.set(0.16, -0.16, -0.32);
    this.weaponHolder.add(this.currentWeaponMesh);

    audioManager.playWeaponMorph(this.ladderRank);
    eventBus.emit('WEAPON_CHANGED', this.currentWeapon);
    eventBus.emit('PLAYER_AMMO_CHANGED', { current: this.ammo, max: this.currentWeapon.magazineCapacity });
  }

  public respawn(spawnPos: THREE.Vector3): void {
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.isSliding = false;
    this.isVaulting = false;
    this.killstreakCount = 0;
    this.ammo = this.currentWeapon.magazineCapacity;
    eventBus.emit('PLAYER_HEALTH_CHANGED', { current: this.health, max: this.maxHealth });
    eventBus.emit('KILLSTREAK_UPDATED', { streak: this.killstreakCount, uavActive: this.isUavActive });
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.staggerTimer = GAME_BALANCE.stagger_slowdown_duration;
    eventBus.emit('PLAYER_HEALTH_CHANGED', { current: this.health, max: this.maxHealth });

    if (this.health <= 0) {
      eventBus.emit('PLAYER_KILLED', { by: 'Enemy Operator' });
    }
  }

  public update(input: InputSnapshot, dt: number, getEnemies: () => any[]): void {
    // 1. Look orientation (Yaw & Pitch)
    this.yaw -= input.lookDeltaX;
    this.pitch -= input.lookDeltaY;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

    // 2. Timers
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.slideCooldown > 0) this.slideCooldown -= dt;
    if (this.staggerTimer > 0) this.staggerTimer -= dt;

    // Recoil recovery
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, dt * 15.0);
    this.recoilOffsetZ = THREE.MathUtils.lerp(this.recoilOffsetZ, 0, dt * 20.0);

    // 3. Vault climbing logic
    if (this.isVaulting) {
      this.vaultTimer -= dt;
      const t = 1.0 - Math.max(0, this.vaultTimer / GAME_BALANCE.vault_animation_duration);
      this.position.lerpVectors(this.vaultStartPos, this.vaultTargetPos, t);
      if (this.vaultTimer <= 0) {
        this.isVaulting = false;
        this.position.copy(this.vaultTargetPos);
        this.velocity.set(0, 0, 0);
      }
      this.updateCamera(dt, input.isAiming);
      return;
    }

    // 4. Movement Physics & Slide
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wishDir = new THREE.Vector3()
      .addScaledVector(forward, -input.moveZ)
      .addScaledVector(right, input.moveX);

    const isMoving = wishDir.lengthSq() > 0.01;
    if (isMoving) wishDir.normalize();

    // Check Vault input
    if (input.jumpPressed && this.isGrounded) {
      const ledge = physicsWorld.checkLedge(this.position, forward);
      if (ledge.canVault) {
        this.isVaulting = true;
        this.vaultTimer = GAME_BALANCE.vault_animation_duration;
        this.vaultStartPos.copy(this.position);
        this.vaultTargetPos.copy(ledge.targetPos);
        audioManager.playVault();
        return;
      }
    }

    // Check Slide activation
    if (
      this.isGrounded &&
      input.slidePressed &&
      isMoving &&
      input.isSprinting &&
      !this.isSliding &&
      this.slideCooldown <= 0
    ) {
      this.isSliding = true;
      this.slideTimer = GAME_BALANCE.slide_duration;
      this.slideCooldown = GAME_BALANCE.slide_duration + GAME_BALANCE.slide_cooldown;
      this.slideDirection.copy(wishDir);
      audioManager.playSlide();
    }

    // Calculate current speed
    let speed = GAME_BALANCE.base_speed;
    if (this.staggerTimer > 0) {
      speed *= GAME_BALANCE.stagger_penalty; // 30% stagger slowdown
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      const slideProgress = Math.max(0, this.slideTimer / GAME_BALANCE.slide_duration);
      speed = GAME_BALANCE.slide_speed * (0.4 + 0.6 * slideProgress);
      this.velocity.x = this.slideDirection.x * speed;
      this.velocity.z = this.slideDirection.z * speed;

      // Slide sparks
      particleSystem.emitSlideSparks(this.position.clone().addScaledVector(forward, 0.4));

      if (this.slideTimer <= 0 || (input.jumpPressed && this.isGrounded)) {
        this.isSliding = false;
      }
    } else {
      if (input.isSprinting && isMoving) {
        speed *= 1.25;
      }
      this.velocity.x = wishDir.x * speed;
      this.velocity.z = wishDir.z * speed;
    }

    // Jump
    if (input.jumpPressed && this.isGrounded && !this.isSliding) {
      this.velocity.y = GAME_BALANCE.jump_speed;
      this.isGrounded = false;
    }

    // Gravity
    if (!this.isGrounded) {
      this.velocity.y -= GAME_BALANCE.gravity * dt;
    }

    // Physics step
    const currentHeight = this.isSliding ? GAME_BALANCE.hitbox_height_slide : GAME_BALANCE.hitbox_height_stand;
    const col = physicsWorld.moveCharacter(this.position, this.velocity, 0.45, currentHeight, dt);
    this.isGrounded = col.grounded;

    // 5. Shooting logic
    const canShoot = this.currentWeapon.isAutomatic ? input.isFiring : input.fireJustPressed;
    if (canShoot && this.fireTimer <= 0 && this.ammo > 0) {
      this.shoot(getEnemies(), input.isAiming);
    }

    // 6. Killstreak UAV activation
    if (input.uavPressed && this.killstreakCount >= GAME_BALANCE.killstreak_cost && !this.isUavActive) {
      this.activateUav();
    }

    if (this.isUavActive) {
      this.uavTimer -= dt;
      this.uavPulseTimer -= dt;
      if (this.uavPulseTimer <= 0) {
        this.uavPulseTimer = GAME_BALANCE.radar_pulse_interval;
        audioManager.playUavSonar();
      }
      if (this.uavTimer <= 0) {
        this.isUavActive = false;
        eventBus.emit('UAV_EXPIRED');
      }
    }

    // 7. Update camera & viewmodel
    this.updateCamera(dt, input.isAiming);
  }

  private shoot(enemies: any[], isAiming: boolean): void {
    this.fireTimer = 1.0 / this.currentWeapon.fireRate;
    this.ammo--;
    eventBus.emit('PLAYER_AMMO_CHANGED', { current: this.ammo, max: this.currentWeapon.magazineCapacity });

    // Audio & Recoil
    audioManager.playShoot(this.currentWeapon.id);
    this.recoilPitch += this.currentWeapon.recoilVertical;
    this.recoilOffsetZ += 0.04;

    // Camera shoot ray
    const cameraPos = sceneManager.camera.position.clone();
    const aimDir = new THREE.Vector3();
    sceneManager.camera.getWorldDirection(aimDir);

    // Spread calculation
    let spread = this.currentWeapon.spread;
    if (isAiming) spread *= 0.35;
    if (this.isSliding) spread *= (1.0 + GAME_BALANCE.slide_spread_penalty);

    const pelletCount = this.currentWeapon.pelletCount ?? 1;

    for (let p = 0; p < pelletCount; p++) {
      const shotDir = aimDir.clone();
      if (spread > 0) {
        shotDir.x += (Math.random() - 0.5) * spread;
        shotDir.y += (Math.random() - 0.5) * spread;
        shotDir.z += (Math.random() - 0.5) * spread;
        shotDir.normalize();
      }

      // Muzzle Flash
      const muzzlePos = cameraPos.clone().addScaledVector(shotDir, 0.6).add(new THREE.Vector3(0.08, -0.08, 0));
      particleSystem.emitMuzzleFlash(muzzlePos, shotDir);

      // Raycast vs Level obstacles
      const wallHit = physicsWorld.raycast(cameraPos, shotDir, this.currentWeapon.range);

      // Check vs Enemies
      let hitEnemy: any = null;
      let hitHeadshot = false;
      let closestDist = wallHit.hit ? wallHit.distance : this.currentWeapon.range;

      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        const enemyHit = enemy.checkHit(cameraPos, shotDir, closestDist);
        if (enemyHit.hit && enemyHit.distance < closestDist) {
          closestDist = enemyHit.distance;
          hitEnemy = enemy;
          hitHeadshot = enemyHit.isHeadshot;
        }
      }

      if (hitEnemy) {
        const multiplier = hitHeadshot ? GAME_BALANCE.headshot_damage_multiplier : GAME_BALANCE.torso_damage_multiplier;
        const damage = this.currentWeapon.damage * multiplier;
        const killed = hitEnemy.takeDamage(damage, hitHeadshot);

        audioManager.playHitmarker(hitHeadshot);
        particleSystem.emitBlood(hitEnemy.position.clone().setY(hitHeadshot ? hitEnemy.position.y + 1.6 : hitEnemy.position.y + 1.1));

        eventBus.emit('ENEMY_HIT', {
          headshot: hitHeadshot,
          damage,
          x: hitEnemy.position.x,
          y: hitEnemy.position.y,
          z: hitEnemy.position.z
        });

        if (killed) {
          this.onFragScored(hitHeadshot);
        }
      } else if (wallHit.hit) {
        particleSystem.emitSparks(wallHit.point, wallHit.normal, 8);
      }

      // RPG Explosion splash
      if (this.currentWeapon.id === 'rpg7' && (hitEnemy || wallHit.hit)) {
        const blastCenter = hitEnemy ? hitEnemy.position : wallHit.point;
        particleSystem.emitExplosion(blastCenter);
        for (const enemy of enemies) {
          if (!enemy.isAlive) continue;
          const d = enemy.position.distanceTo(blastCenter);
          if (d <= (this.currentWeapon.splashRadius ?? 3.5)) {
            const splashDmg = this.currentWeapon.damage * (1.0 - d / (this.currentWeapon.splashRadius ?? 3.5));
            if (enemy.takeDamage(splashDmg, false)) {
              this.onFragScored(false);
            }
          }
        }
      }
    }
  }

  public onFragScored(headshot: boolean): void {
    this.killstreakCount++;
    eventBus.emit('KILLSTREAK_UPDATED', { streak: this.killstreakCount, uavActive: this.isUavActive });

    eventBus.emit('ENEMY_KILLED', {
      rank: this.ladderRank,
      headshot,
      weaponName: this.currentWeapon.name
    });

    // Instant Gun Ladder Morph (0.08s) -> Next weapon
    if (this.ladderRank < GAME_BALANCE.ladder_tier_count) {
      this.setRank(this.ladderRank + 1);
    } else {
      // Final 12th weapon frag
      this.ammo = this.currentWeapon.magazineCapacity;
      eventBus.emit('PLAYER_AMMO_CHANGED', { current: this.ammo, max: this.currentWeapon.magazineCapacity });
    }
  }

  private activateUav(): void {
    this.isUavActive = true;
    this.uavTimer = GAME_BALANCE.uav_active_duration;
    this.uavPulseTimer = 0.1;
    audioManager.playUavSonar();
    eventBus.emit('UAV_ACTIVATED', { duration: GAME_BALANCE.uav_active_duration });
    eventBus.emit('KILLSTREAK_UPDATED', { streak: this.killstreakCount, uavActive: true });
  }

  private updateCamera(dt: number, isAiming: boolean): void {
    const eyeHeight = this.isSliding ? GAME_BALANCE.camera_height_slide : GAME_BALANCE.camera_height_stand;
    sceneManager.camera.position.set(this.position.x, this.position.y + eyeHeight, this.position.z);

    const totalPitch = this.pitch + this.recoilPitch;
    sceneManager.camera.rotation.set(totalPitch, this.yaw, this.isSliding ? 0.06 : 0, 'YXZ');

    // FOV management
    if (isAiming) {
      sceneManager.setTargetFov(GAME_BALANCE.fov_aim);
    } else if (this.isSliding) {
      sceneManager.setTargetFov(GAME_BALANCE.fov_slide);
    } else {
      sceneManager.setTargetFov(GAME_BALANCE.fov_default);
    }

    // Viewmodel position and ADS alignment
    if (this.currentWeaponMesh) {
      const targetZ = (isAiming ? -0.22 : -0.32) + this.recoilOffsetZ;
      const targetX = isAiming ? 0.0 : 0.16;
      const targetY = isAiming ? -0.1 : -0.16;

      this.currentWeaponMesh.position.x = THREE.MathUtils.lerp(this.currentWeaponMesh.position.x, targetX, dt * 20);
      this.currentWeaponMesh.position.y = THREE.MathUtils.lerp(this.currentWeaponMesh.position.y, targetY, dt * 20);
      this.currentWeaponMesh.position.z = THREE.MathUtils.lerp(this.currentWeaponMesh.position.z, targetZ, dt * 25);
    }
  }
}