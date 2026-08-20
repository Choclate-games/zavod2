import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

interface DroneBoid {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mesh: THREE.Mesh;
}

interface SurvivorEnemy {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  hp: number;
  speed: number;
  active: boolean;
}

interface XPGem {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  active: boolean;
}

export class SwarmSurvivorMode {
  public group = new THREE.Group();

  // Boids Swarm (120 drones)
  public drones: DroneBoid[] = [];
  public targetPoint = new THREE.Vector3(0, 3, 0);

  // Survivor Hero & Orbital Weapons
  public hero: THREE.Group;
  public heroPos = new THREE.Vector3(0, 0, 0);
  public orbitBlades: THREE.Mesh[] = [];
  public orbitRadius = 2.4;
  public orbitAngle = 0;

  // Enemies & XP
  public enemies: SurvivorEnemy[] = [];
  public xpGems: XPGem[] = [];
  public playerXP = 0;
  public playerLevel = 1;
  private spawnTimer = 0;

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildArena();
    this.buildHero();
    this.buildDroneSwarm();
    this.buildEnemiesAndGems();
  }

  private buildArena(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x182026, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    const grid = new THREE.GridHelper(50, 25, 0x00cec9, 0x2d3436);
    grid.position.y = 0.01;
    this.group.add(grid);
  }

  private buildHero(): void {
    this.hero = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x00cec9, roughness: 0.3, metalness: 0.8 })
    );
    body.position.y = 0.6;
    body.castShadow = true;
    this.hero.add(body);

    // Orbital Blades (3 rotating energy shields)
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0xf1c40f,
      emissiveIntensity: 0.8,
    });

    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.8), bladeMat);
      blade.castShadow = true;
      this.hero.add(blade);
      this.orbitBlades.push(blade);
    }

    this.group.add(this.hero);
  }

  private buildDroneSwarm(): void {
    const droneGeom = new THREE.ConeGeometry(0.18, 0.5, 6);
    droneGeom.rotateX(Math.PI / 2);
    const droneMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.3, metalness: 0.7 });

    for (let i = 0; i < 100; i++) {
      const mesh = new THREE.Mesh(droneGeom, droneMat);
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        1.5 + Math.random() * 4.0,
        (Math.random() - 0.5) * 20
      );
      const vel = new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
      mesh.position.copy(pos);
      this.group.add(mesh);

      this.drones.push({ pos, vel, mesh });
    }
  }

  private buildEnemiesAndGems(): void {
    const eGeom = new THREE.SphereGeometry(0.4, 8, 8);
    const eMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 });

    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(eGeom, eMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.enemies.push({
        mesh,
        pos: new THREE.Vector3(),
        hp: 20,
        speed: 3.5,
        active: false,
      });
    }

    const gemGeom = new THREE.OctahedronGeometry(0.2, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      emissive: 0x2ecc71,
      emissiveIntensity: 0.8,
    });

    for (let i = 0; i < 30; i++) {
      const gMesh = new THREE.Mesh(gemGeom, gemMat);
      gMesh.visible = false;
      this.group.add(gMesh);
      this.xpGems.push({ mesh: gMesh, pos: new THREE.Vector3(), active: false });
    }
  }

  private spawnEnemy(): void {
    const inactive = this.enemies.find((e) => !e.active);
    if (!inactive) return;

    inactive.active = true;
    inactive.mesh.visible = true;
    inactive.hp = 20;

    const angle = Math.random() * Math.PI * 2;
    const dist = 18.0;
    inactive.pos.set(
      this.heroPos.x + Math.sin(angle) * dist,
      0.4,
      this.heroPos.z + Math.cos(angle) * dist
    );
    inactive.mesh.position.copy(inactive.pos);
  }

  public showUpgradeModal(): void {
    this.audio.playLevelUp();
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'flex';
  }

  public choosePerk(perkName: string): void {
    this.audio.playButtonClick();
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'none';

    if (perkName === 'blades') {
      this.orbitRadius += 0.8;
    } else if (perkName === 'speed') {
      // increase drone speed
    }
  }

  public update(dt: number, moveInput: { x: number; z: number }): void {
    if (!this.group.visible) return;

    // 1. Hero Movement
    this.heroPos.x += moveInput.x * 7.5 * dt;
    this.heroPos.z += moveInput.z * 7.5 * dt;
    this.hero.position.copy(this.heroPos);

    // 2. Orbital Blades Rotation & Collision with Enemies
    this.orbitAngle += 4.5 * dt;
    for (let i = 0; i < this.orbitBlades.length; i++) {
      const b = this.orbitBlades[i];
      const ang = this.orbitAngle + (i / this.orbitBlades.length) * Math.PI * 2;
      b.position.set(Math.sin(ang) * this.orbitRadius, 0.6, Math.cos(ang) * this.orbitRadius);
      b.rotation.y = ang + Math.PI / 2;

      // Check collision with enemies
      const worldBladePos = new THREE.Vector3();
      b.getWorldPosition(worldBladePos);

      this.enemies.forEach((e) => {
        if (e.active && worldBladePos.distanceTo(e.pos) < 1.2) {
          e.hp -= 20;
          this.audio.playLaser();
          this.onCameraShake(0.15);

          if (e.hp <= 0) {
            e.active = false;
            e.mesh.visible = false;

            // Spawn XP Gem
            const gem = this.xpGems.find((g) => !g.active);
            if (gem) {
              gem.active = true;
              gem.mesh.visible = true;
              gem.pos.copy(e.pos).setY(0.3);
              gem.mesh.position.copy(gem.pos);
            }
          }
        }
      });
    }

    // 3. Enemies Spawning & Chase Hero
    this.spawnTimer += dt;
    if (this.spawnTimer >= 0.7) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    this.enemies.forEach((e) => {
      if (!e.active) return;
      const dir = this.heroPos.clone().sub(e.pos).normalize();
      e.pos.addScaledVector(dir, e.speed * dt);
      e.mesh.position.copy(e.pos);
    });

    // 4. XP Gem Magnet & Level Up
    this.xpGems.forEach((g) => {
      if (!g.active) return;
      g.mesh.rotation.y += 3.0 * dt;
      const dist = this.heroPos.distanceTo(g.pos);
      if (dist < 4.5) {
        // Magnet attraction
        const toHero = this.heroPos.clone().sub(g.pos).normalize();
        g.pos.addScaledVector(toHero, 12.0 * dt);
        g.mesh.position.copy(g.pos);

        if (dist < 0.8) {
          g.active = false;
          g.mesh.visible = false;
          this.audio.playCoinPickup();
          this.playerXP += 25;
          if (this.playerXP >= 100) {
            this.playerXP = 0;
            this.playerLevel++;
            this.showUpgradeModal();
          }
        }
      }
    });

    // 5. Boids 3-Rule Swarm AI (Separation, Alignment, Cohesion, Target Chase)
    const count = this.drones.length;
    this.targetPoint.set(
      this.heroPos.x + Math.sin(Date.now() * 0.002) * 5,
      3.0 + Math.sin(Date.now() * 0.003) * 1.5,
      this.heroPos.z + Math.cos(Date.now() * 0.002) * 5
    );

    for (let i = 0; i < count; i++) {
      const d = this.drones[i];
      let sepX = 0, sepZ = 0;
      let alignX = 0, alignZ = 0;
      let cohX = 0, cohZ = 0;
      let neighbors = 0;

      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const o = this.drones[j];
        const dx = d.pos.x - o.pos.x;
        const dz = d.pos.z - o.pos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < 16.0 && distSq > 0.001) {
          // Separation
          sepX += dx / distSq;
          sepZ += dz / distSq;

          // Alignment
          alignX += o.vel.x;
          alignZ += o.vel.z;

          // Cohesion
          cohX += o.pos.x;
          cohZ += o.pos.z;

          neighbors++;
        }
      }

      if (neighbors > 0) {
        alignX /= neighbors;
        alignZ /= neighbors;
        cohX = (cohX / neighbors - d.pos.x) * 0.08;
        cohZ = (cohZ / neighbors - d.pos.z) * 0.08;
      }

      // Target attraction
      const tarX = (this.targetPoint.x - d.pos.x) * 0.15;
      const tarZ = (this.targetPoint.z - d.pos.z) * 0.15;

      d.vel.x += (sepX * 1.2 + alignX * 0.2 + cohX + tarX) * dt * 8.0;
      d.vel.z += (sepZ * 1.2 + alignZ * 0.2 + cohZ + tarZ) * dt * 8.0;

      // Speed limit
      const speed = Math.hypot(d.vel.x, d.vel.z);
      if (speed > 12.0) {
        d.vel.x = (d.vel.x / speed) * 12.0;
        d.vel.z = (d.vel.z / speed) * 12.0;
      }

      d.pos.x += d.vel.x * dt;
      d.pos.z += d.vel.z * dt;
      d.pos.y = 2.0 + Math.sin(i + Date.now() * 0.003) * 1.2;

      d.mesh.position.copy(d.pos);
      d.mesh.rotation.y = Math.atan2(d.vel.x, d.vel.z);
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
