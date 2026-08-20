import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface FpsTarget {
  group: THREE.Group;
  mesh: THREE.Mesh;
  hp: number;
  maxHp: number;
  isBarrel: boolean;
  velocity: THREE.Vector3;
  exploded: boolean;
}

export class FpsMode {
  public group = new THREE.Group();
  public yawObject = new THREE.Object3D();
  public pitchObject = new THREE.Object3D();
  public camera: THREE.PerspectiveCamera;

  // Procedural weapon mesh and recoil
  public rifleMesh = new THREE.Group();
  private baseWeaponOffset = new THREE.Vector3(0.28, -0.25, -0.55);
  private recoilPos = new THREE.Vector3();
  private recoilRot = new THREE.Vector3();
  private targetRecoilPos = new THREE.Vector3();
  private targetRecoilRot = new THREE.Vector3();
  private muzzleFlash: THREE.PointLight;
  private muzzleFlashTimer = 0;

  // Spartan Kick
  public legMesh = new THREE.Group();
  public isKicking = false;
  private kickTimer = 0;
  private kickDuration = 0.38;

  // Movement & Bobbing
  public velocity = new THREE.Vector3();
  public moveForward = false;
  public moveBackward = false;
  public moveLeft = false;
  public moveRight = false;
  public isGrounded = true;
  private bobTimer = 0;

  // Targets and barrels
  public targets: FpsTarget[] = [];
  private damageNumbers: { el: HTMLElement; x: number; y: number; z: number; life: number }[] = [];

  constructor(
    private parentScene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.camera = camera;
    this.group.visible = false;
    this.parentScene.add(this.group);

    // Setup hierarchy
    this.yawObject.position.set(0, 1.7, 5);
    this.yawObject.add(this.pitchObject);
    this.group.add(this.yawObject);

    // Build procedural rifle
    this.buildProceduralRifle();
    this.pitchObject.add(this.rifleMesh);

    // Build procedural leg for kick
    this.buildProceduralLeg();
    this.pitchObject.add(this.legMesh);

    // Muzzle flash light
    this.muzzleFlash = new THREE.PointLight(0xffaa22, 0, 10);
    this.muzzleFlash.position.set(0, 0.02, -0.7);
    this.rifleMesh.add(this.muzzleFlash);

    // Build arena & targets
    this.buildTargetsAndArena();
  }

  private buildProceduralRifle(): void {
    const matBody = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.3, metalness: 0.8 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0xe65c00, roughness: 0.4, metalness: 0.2 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.7 });

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), matBody);
    receiver.castShadow = true;
    this.rifleMesh.add(receiver);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 12), matDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    this.rifleMesh.add(barrel);

    // Muzzle brake
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 12), matDark);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.02, -0.55);
    this.rifleMesh.add(muzzle);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.09), matAccent);
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = 0.18;
    this.rifleMesh.add(mag);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.14, 0.06), matDark);
    grip.position.set(0, -0.1, 0.12);
    grip.rotation.x = -0.35;
    this.rifleMesh.add(grip);

    // Holographic Sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.08), matDark);
    sight.position.set(0, 0.09, -0.05);
    this.rifleMesh.add(sight);

    this.rifleMesh.position.copy(this.baseWeaponOffset);
  }

  private buildProceduralLeg(): void {
    const matPants = new THREE.MeshStandardMaterial({ color: 0x2b3824, roughness: 0.8 });
    const matBoot = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.6 });

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), matPants);
    shin.position.set(0.18, -0.3, -0.4);
    shin.rotation.x = -Math.PI / 4;
    this.legMesh.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.28), matBoot);
    boot.position.set(0.18, -0.45, -0.65);
    this.legMesh.add(boot);

    this.legMesh.visible = false;
  }

  private buildTargetsAndArena(): void {
    // Ground platform
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.8, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Grid markings
    const grid = new THREE.GridHelper(60, 30, 0xe65c00, 0x3d4b56);
    grid.position.y = 0.01;
    this.group.add(grid);

    // Training Dummies (8 red humanoids)
    for (let i = 0; i < 6; i++) {
      const tGroup = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.45, 1.8, 12),
        new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4, metalness: 0.3 })
      );
      body.position.y = 0.9;
      body.castShadow = true;
      tGroup.add(body);

      // Head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xff7675, roughness: 0.3 })
      );
      head.position.y = 1.95;
      head.castShadow = true;
      tGroup.add(head);

      const angle = (i / 6) * Math.PI * 1.4 - Math.PI * 0.7;
      const dist = 10 + (i % 2) * 5;
      tGroup.position.set(Math.sin(angle) * dist, 0, -Math.cos(angle) * dist);

      this.group.add(tGroup);
      this.targets.push({
        group: tGroup,
        mesh: body,
        hp: 100,
        maxHp: 100,
        isBarrel: false,
        velocity: new THREE.Vector3(),
        exploded: false,
      });
    }

    // Explosive Barrels (4 red explosive barrels for chain reaction demo)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.3, metalness: 0.5 });
    const positions = [
      new THREE.Vector3(-4, 0, -12),
      new THREE.Vector3(-2.2, 0, -13),
      new THREE.Vector3(3.5, 0, -11),
      new THREE.Vector3(5.2, 0, -12.5),
    ];

    positions.forEach((pos) => {
      const bGroup = new THREE.Group();
      const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), barrelMat);
      bMesh.position.y = 0.6;
      bMesh.castShadow = true;
      bGroup.add(bMesh);

      // Warning stripe
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.51, 0.51, 0.25, 16),
        new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.4 })
      );
      stripe.position.y = 0.6;
      bGroup.add(stripe);

      bGroup.position.copy(pos);
      this.group.add(bGroup);

      this.targets.push({
        group: bGroup,
        mesh: bMesh,
        hp: 40,
        maxHp: 40,
        isBarrel: true,
        velocity: new THREE.Vector3(),
        exploded: false,
      });
    });
  }

  public shoot(): void {
    // 1. Procedural Audio
    this.audio.playGunshot(1.0, 1.0);

    // 2. Weapon Recoil Impulse
    this.targetRecoilPos.z += 0.09;
    this.targetRecoilPos.y += 0.03;
    this.targetRecoilRot.x += 0.16;
    this.targetRecoilRot.y += (Math.random() - 0.5) * 0.04;

    // 3. Muzzle Flash
    this.muzzleFlash.intensity = 4.0;
    this.muzzleFlashTimer = 0.05;

    // 4. Camera Shake
    this.onCameraShake(0.25);

    // 5. Raycast Hitscan
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const hitMeshes = this.targets.filter((t) => !t.exploded).map((t) => t.mesh);
    const intersects = raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const target = this.targets.find((t) => t.mesh === hit.object);
      if (target && !target.exploded) {
        const isHeadshot = !target.isBarrel && hit.point.y > 1.6;
        const damage = isHeadshot ? 80 : 35;
        target.hp -= damage;

        // Visual Hit flash
        (target.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
        setTimeout(() => {
          if (!target.exploded) {
            (target.mesh.material as THREE.MeshStandardMaterial).color.setHex(target.isBarrel ? 0xd63031 : 0xe74c3c);
          }
        }, 60);

        // Spawn floating damage text
        this.spawnDamageNumber(damage, hit.point, isHeadshot);

        // Impulse
        const shootDir = new THREE.Vector3();
        this.camera.getWorldDirection(shootDir);
        target.velocity.addScaledVector(shootDir, 4.0);
        target.velocity.y += 1.5;

        // Check death / explosion
        if (target.hp <= 0) {
          if (target.isBarrel) {
            this.triggerBarrelExplosion(target);
          } else {
            // Target knocked down
            target.velocity.addScaledVector(shootDir, 8.0);
            target.velocity.y += 4.0;
            target.hp = target.maxHp; // respawn reset
          }
        }
      }
    }
  }

  public triggerSpartanKick(): void {
    if (this.isKicking) return;
    this.isKicking = true;
    this.kickTimer = this.kickDuration;
    this.legMesh.visible = true;

    this.audio.playSpartanKick();
    this.onCameraShake(0.45);

    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);

    // Delayed hit frame
    setTimeout(() => {
      this.targets.forEach((t) => {
        if (!t.exploded) {
          const dist = this.yawObject.position.distanceTo(t.group.position);
          if (dist < 4.5) {
            t.velocity.addScaledVector(fwd, 24.0);
            t.velocity.y += 7.0;
            t.hp -= 50;
            this.spawnDamageNumber(50, t.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), false);
            if (t.isBarrel && t.hp <= 0) {
              this.triggerBarrelExplosion(t);
            }
          }
        }
      });
    }, 120);
  }

  private triggerBarrelExplosion(barrel: FpsTarget): void {
    if (barrel.exploded) return;
    barrel.exploded = true;
    barrel.group.visible = false;

    this.audio.playExplosion(1.2);
    this.onCameraShake(0.7);

    const epicenter = barrel.group.position.clone().setY(0.8);

    // Cascading chain reaction: find nearby barrels and targets
    this.targets.forEach((other) => {
      if (other !== barrel && !other.exploded) {
        const d = epicenter.distanceTo(other.group.position);
        if (d < 7.0) {
          const force = (1.0 - d / 7.0) * 22.0;
          const dir = other.group.position.clone().sub(epicenter).normalize();
          other.velocity.addScaledVector(dir, force);
          other.velocity.y += force * 0.5;

          const dmg = Math.round((1.0 - d / 7.0) * 90);
          other.hp -= dmg;
          this.spawnDamageNumber(dmg, other.group.position.clone().add(new THREE.Vector3(0, 1, 0)), false);

          if (other.isBarrel && other.hp <= 0) {
            // Fuse delay 120ms for chain reaction wave
            setTimeout(() => this.triggerBarrelExplosion(other), 120);
          }
        }
      }
    });

    // Respawn barrel after 4 seconds
    setTimeout(() => {
      barrel.exploded = false;
      barrel.group.visible = true;
      barrel.hp = barrel.maxHp;
      barrel.velocity.set(0, 0, 0);
    }, 4000);
  }

  private spawnDamageNumber(dmg: number, worldPos: THREE.Vector3, isCrit: boolean): void {
    const container = document.getElementById('damage-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = isCrit ? 'damage-popup crit' : 'damage-popup';
    el.textContent = (isCrit ? 'CRIT ' : '') + dmg;
    container.appendChild(el);

    this.damageNumbers.push({
      el,
      x: worldPos.x,
      y: worldPos.y + (Math.random() - 0.5) * 0.3,
      z: worldPos.z,
      life: 0.8,
    });
  }

  public update(dt: number): void {
    if (!this.group.visible) return;

    // 1. Movement Physics
    this.velocity.x -= this.velocity.x * 10.0 * dt;
    this.velocity.z -= this.velocity.z * 10.0 * dt;

    const moveVector = new THREE.Vector3();
    if (this.moveForward) moveVector.z -= 1;
    if (this.moveBackward) moveVector.z += 1;
    if (this.moveLeft) moveVector.x -= 1;
    if (this.moveRight) moveVector.x += 1;
    moveVector.normalize();

    if (moveVector.lengthSq() > 0.001) {
      moveVector.applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0));
      this.velocity.x += moveVector.x * 8.5 * 10.0 * dt;
      this.velocity.z += moveVector.z * 8.5 * 10.0 * dt;
    }

    this.yawObject.position.x += this.velocity.x * dt;
    this.yawObject.position.z += this.velocity.z * dt;

    const isMoving = Math.hypot(this.velocity.x, this.velocity.z) > 0.5;
    if (isMoving) {
      this.bobTimer += dt * 10.0;
    }

    // 2. Weapon Recoil & Bobbing springs
    this.targetRecoilPos.lerp(new THREE.Vector3(), 12.0 * dt);
    this.targetRecoilRot.lerp(new THREE.Vector3(), 12.0 * dt);

    this.recoilPos.lerp(this.targetRecoilPos, 24.0 * dt);
    this.recoilRot.lerp(this.targetRecoilRot, 24.0 * dt);

    let bobX = 0;
    let bobY = 0;
    if (isMoving) {
      bobX = Math.sin(this.bobTimer) * 0.018;
      bobY = Math.cos(this.bobTimer * 2) * 0.014;
    }

    this.rifleMesh.position.set(
      this.baseWeaponOffset.x + this.recoilPos.x + bobX,
      this.baseWeaponOffset.y + this.recoilPos.y + bobY,
      this.baseWeaponOffset.z + this.recoilPos.z
    );

    this.rifleMesh.rotation.set(
      this.recoilRot.x,
      this.recoilRot.y + (isMoving ? Math.sin(this.bobTimer) * 0.015 : 0),
      this.recoilRot.z
    );

    // Muzzle flash decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) this.muzzleFlash.intensity = 0;
    }

    // 3. Spartan Kick Animation
    if (this.isKicking) {
      this.kickTimer -= dt;
      const p = 1.0 - this.kickTimer / this.kickDuration;
      if (p < 0.35) {
        const t = p / 0.35;
        this.legMesh.position.set(0, 0.2 * t, -0.45 * t);
      } else if (p < 0.6) {
        this.legMesh.position.set(0, 0.2, -0.45);
      } else {
        const t = (p - 0.6) / 0.4;
        this.legMesh.position.set(0, 0.2 * (1 - t), -0.45 * (1 - t));
      }

      if (this.kickTimer <= 0) {
        this.isKicking = false;
        this.legMesh.visible = false;
      }
    }

    // 4. Update Target Physics (Knockback & Gravity)
    this.targets.forEach((t) => {
      if (!t.exploded) {
        t.velocity.y -= 18.0 * dt; // gravity
        t.velocity.x *= Math.pow(0.92, dt * 60);
        t.velocity.z *= Math.pow(0.92, dt * 60);

        t.group.position.addScaledVector(t.velocity, dt);

        if (t.group.position.y <= 0) {
          t.group.position.y = 0;
          t.velocity.y = 0;
        }
      }
    });

    // 5. Update Floating Damage Popups
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.life -= dt;
      d.y += dt * 1.5;

      const screenPos = new THREE.Vector3(d.x, d.y, d.z).project(this.camera);
      const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

      d.el.style.left = `${sx}px`;
      d.el.style.top = `${sy}px`;
      d.el.style.opacity = Math.max(0, d.life / 0.8).toString();

      if (d.life <= 0) {
        d.el.remove();
        this.damageNumbers.splice(i, 1);
      }
    }

    // Camera sync
    this.camera.position.copy(this.yawObject.position);
    this.camera.rotation.set(this.pitchObject.rotation.x, this.yawObject.rotation.y, 0, 'YXZ');
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
    const crosshair = document.getElementById('fps-crosshair');
    if (crosshair) crosshair.style.display = visible ? 'block' : 'none';
  }
}
