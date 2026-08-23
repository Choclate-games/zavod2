import * as THREE from 'three'
import { BALANCE, TIER_COLORS } from '../balance'
import type { BlobEntity, EnemyEntity } from '../entities/EntityManager'
import { ProceduralModels } from './ProceduralModels'
import { ParticleSystem } from './ParticleSystem'

type RingPulse = { mesh: THREE.Mesh; life: number; maxRadius: number }

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  private readonly models = new ProceduralModels()
  private readonly blobVisuals: THREE.Group[] = []
  private readonly enemyVisuals: THREE.Group[] = []
  private readonly rings: RingPulse[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly hit = new THREE.Vector3()
  private readonly particles: ParticleSystem
  private cameraShake = 0
  private cameraBaseFov = 50
  private arenaRadius = BALANCE.initialArenaDiameter / 2
  private readonly arenaSegments: THREE.Mesh[] = []
  private readonly menuTitan: THREE.Group
  private readonly aimLine: THREE.Line
  private readonly aimPositions = new Float32Array(6)

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setClearColor(0x090d13, 1)
    this.scene.fog = new THREE.Fog(0x090d13, 20, 48)
    this.camera.position.set(0, 18, 15)
    this.camera.lookAt(0, 0, 0)
    this.cameraBaseFov = this.camera.fov
    this.setupLights()
    this.buildArena()
    this.particles = new ParticleSystem(this.scene)
    const aimGeometry = new THREE.BufferGeometry()
    aimGeometry.setAttribute('position', new THREE.BufferAttribute(this.aimPositions, 3))
    this.aimLine = new THREE.Line(aimGeometry, new THREE.LineBasicMaterial({ color: 0x39e6a1, transparent: true, opacity: 0.78 }))
    this.aimLine.visible = false
    this.aimLine.position.y = 0.22
    this.scene.add(this.aimLine)
    this.menuTitan = this.models.buildBlob(4)
    this.menuTitan.position.set(0, 0.7, 0)
    this.menuTitan.visible = true
    this.scene.add(this.menuTitan)
    for (let index = 0; index < 12; index += 1) {
      const visual = this.models.buildBlob(1)
      visual.visible = false
      this.scene.add(visual)
      this.blobVisuals.push(visual)
    }
    for (let index = 0; index < BALANCE.maxEnemies; index += 1) {
      const visual = this.models.buildEnemy('skirmisher')
      visual.visible = false
      this.scene.add(visual)
      this.enemyVisuals.push(visual)
    }
    const ringGeometry = new THREE.TorusGeometry(1, 0.045, 6, 32)
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x39e6a1, transparent: true, opacity: 0.8 })
    for (let index = 0; index < 8; index += 1) {
      const mesh = new THREE.Mesh(ringGeometry, ringMaterial)
      mesh.rotation.x = Math.PI / 2
      mesh.visible = false
      this.scene.add(mesh)
      this.rings.push({ mesh, life: 0, maxRadius: 1 })
    }
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  private setupLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x6cdbb4, 0x1a1010, 1.9))
    const magma = new THREE.PointLight(0xff5a3d, 22, 35, 2)
    magma.position.set(-7, 4, 7)
    this.scene.add(magma)
    const rim = new THREE.DirectionalLight(0xb6d9ff, 2.5)
    rim.position.set(7, 12, -8)
    this.scene.add(rim)
  }

  private buildArena(): void {
    const magma = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.3, 48), new THREE.MeshBasicMaterial({ color: 0x531b16 }))
    magma.position.y = -1.15
    this.scene.add(magma)
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.55, 48), new THREE.MeshStandardMaterial({ color: 0x273237, roughness: 0.9, metalness: 0.1 }))
    floor.position.y = -0.25
    this.scene.add(floor)
    const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a3d, transparent: true, opacity: 0.75 })
    const seamGeometry = new THREE.BoxGeometry(0.06, 0.03, 11)
    for (let index = 0; index < 8; index += 1) {
      const seam = new THREE.Mesh(seamGeometry, seamMaterial)
      seam.rotation.y = (index * Math.PI) / 8
      seam.position.y = 0.04
      this.scene.add(seam)
    }
    const segmentGeometry = new THREE.BoxGeometry(2.7, 0.9, 1.1)
    const segmentMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4548, roughness: 0.95, metalness: 0.05 })
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2
      const segment = new THREE.Mesh(segmentGeometry, segmentMaterial)
      segment.position.set(Math.cos(angle) * 11.8, 0.2, Math.sin(angle) * 11.8)
      segment.rotation.y = -angle
      this.scene.add(segment)
      this.arenaSegments.push(segment)
    }
  }

  resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth)
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  screenToArena(clientX: number, clientY: number): { x: number; z: number } {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    this.raycaster.ray.intersectPlane(this.ground, this.hit)
    return { x: this.hit.x, z: this.hit.z }
  }

  sync(blobs: BlobEntity[], enemies: EnemyEntity[], dt: number): void {
    let anyBlob = false
    this.menuTitan.visible = true
    this.menuTitan.rotation.y += dt * 0.35
    for (const visual of this.blobVisuals) visual.visible = false
    for (const blob of blobs) {
      if (!blob.active) continue
      anyBlob = true
      const visual = this.blobVisuals[blob.slot]
      visual.visible = true
      visual.position.set(blob.x, 0.55, blob.z)
      const scale = blob.tier * 0.2 + 0.8
      visual.scale.setScalar(scale)
      visual.scale.y *= blob.ramTime > 0 ? 1.15 : 1
      visual.children[0].scale.setScalar(0.8 + blob.tier * 0.1)
      if (blob.selected) visual.scale.multiplyScalar(1.08)
      const body = visual.children[0] as THREE.Mesh
      body.material = this.models.tierMaterials[blob.tier - 1]
    }
    this.menuTitan.visible = !anyBlob
    for (const visual of this.enemyVisuals) visual.visible = false
    for (const enemy of enemies) {
      if (!enemy.active) continue
      const visual = this.enemyVisuals[enemy.slot - 12]
      visual.visible = true
      visual.position.set(enemy.x, 0.45 + Math.sin(enemy.phase) * 0.08, enemy.z)
      visual.rotation.y += dt * 1.5
      visual.scale.setScalar(enemy.kind === 'void_titan' ? 1.1 : enemy.kind === 'rammer' ? 0.95 : 0.75)
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue
      ring.life -= dt
      const progress = 1 - ring.life / 0.42
      ring.mesh.scale.setScalar(0.6 + progress * ring.maxRadius)
      ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ring.life / 0.42)
      if (ring.life <= 0) ring.mesh.visible = false
    }
    this.particles.update(dt)
    if (this.cameraShake > 0) {
      this.cameraShake -= dt
      const wobble = Math.max(0, this.cameraShake) * 0.08
      this.camera.position.x = Math.sin(this.cameraShake * 41) * wobble
      this.camera.position.z = 15 + Math.cos(this.cameraShake * 37) * wobble
      this.camera.fov = this.cameraBaseFov - wobble * 2
      this.camera.lookAt(0, 0, 0)
    } else {
      this.camera.position.x = 0
      this.camera.position.z = 15
      this.camera.fov += (this.cameraBaseFov - this.camera.fov) * 0.12
    }
  }

  setArenaRadius(radius: number): void {
    this.arenaRadius = radius
    const ratio = radius / (BALANCE.initialArenaDiameter / 2)
    for (const segment of this.arenaSegments) segment.scale.setScalar(Math.max(0.65, ratio))
  }

  triggerShockwave(x: number, z: number, radius: number): void {
    for (const ring of this.rings) {
      if (ring.life > 0) continue
      ring.life = 0.42
      ring.maxRadius = radius
      ring.mesh.position.set(x, 0.12, z)
      ring.mesh.visible = true
      break
    }
    this.particles.burst(x, z, Math.min(4, radius * 0.5))
    this.cameraShake = 0.25
  }

  setAim(startX: number, startZ: number, currentX: number, currentZ: number): void {
    this.aimPositions[0] = startX
    this.aimPositions[1] = 0
    this.aimPositions[2] = startZ
    this.aimPositions[3] = currentX
    this.aimPositions[4] = 0
    this.aimPositions[5] = currentZ
    const position = this.aimLine.geometry.getAttribute('position') as THREE.BufferAttribute
    position.needsUpdate = true
    this.aimLine.visible = true
  }

  clearAim(): void { this.aimLine.visible = false }

  render(): void { this.renderer.render(this.scene, this.camera) }
}
