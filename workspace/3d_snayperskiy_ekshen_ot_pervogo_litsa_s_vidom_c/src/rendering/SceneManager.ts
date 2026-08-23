import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildWorld, buildRifleViewmodel, WORLD, type WorldGeometry } from './ProceduralModels.js'
import { TitanModel } from './TitanModel.js'
import { ParticleSystem } from './ParticleSystem.js'
import { BALANCE } from '../core/balance.js'

export type CameraMode = 'menu' | 'sniper' | 'bullet'

export interface AimResult {
  point: THREE.Vector3
  distance: number
  onGlacier: boolean
}

const CHUNK_COUNT = BALANCE.glacier.avalancheBodies

/** Сцена Three.js: каньон, свет, камеры трёх режимов, пул частиц и инстансы
 * глыб обвала. Инстансы синхронизируются ПОСЛЕ шага физики. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly titan = new TitanModel()
  readonly particles: ParticleSystem
  readonly chunkMesh: THREE.InstancedMesh

  private world: WorldGeometry
  private sun: THREE.DirectionalLight
  private rifle: { group: THREE.Group; bipod: THREE.Group; muzzleFlash: THREE.PointLight }
  private mode: CameraMode = 'menu'
  private menuTime = 0
  private corePulseTime = 0
  private flashIntensity = 0

  // переиспользуемые объекты — никаких аллокаций в кадре
  private tmpV = new THREE.Vector3()
  private tmpV2 = new THREE.Vector3()
  private tmpQ = new THREE.Quaternion()
  private tmpM = new THREE.Matrix4()
  private unitScale = new THREE.Vector3(1, 1, 1)
  private euler = new THREE.Euler()
  private raycaster = new THREE.Raycaster()
  private tracer: THREE.Mesh
  private glacierHomeX: number
  private glacierHomeY: number

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap

    const aspect = Math.max(0.4, window.innerWidth / Math.max(1, window.innerHeight))
    this.camera = new THREE.PerspectiveCamera(this.baseFov(aspect), aspect, 0.1, 1600)
    this.scene.add(this.camera)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const hemi = new THREE.HemisphereLight(0x88ccff, 0x223344, 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight(0xffaa55, 1.7)
    this.sun.position.set(-320, 130, -80)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    const shadowCam = this.sun.shadow.camera
    shadowCam.left = -260
    shadowCam.right = 260
    shadowCam.top = 220
    shadowCam.bottom = -220
    shadowCam.near = 10
    shadowCam.far = 900
    this.scene.add(this.sun)

    this.scene.fog = new THREE.FogExp2(0x9dbbd8, 0.00105)
    this.scene.background = this.makeSkyTexture()

    this.world = buildWorld()
    this.scene.add(this.world.root)

    this.titan.root.position.set(WORLD.titanStartX, 0, WORLD.titanPathZ)
    this.scene.add(this.titan.root)

    this.particles = new ParticleSystem(2200)
    for (const obj of this.particles.objects) this.scene.add(obj)

    const chunkGeo = new THREE.BoxGeometry(1, 1, 1)
    const chunkMat = new THREE.MeshStandardMaterial({ color: 0xbfe0f5, roughness: 0.45, metalness: 0.05, flatShading: true })
    this.chunkMesh = new THREE.InstancedMesh(chunkGeo, chunkMat, CHUNK_COUNT)
    this.chunkMesh.frustumCulled = false
    this.hideChunks()
    this.scene.add(this.chunkMesh)

    this.rifle = buildRifleViewmodel()
    this.rifle.group.visible = false
    this.camera.add(this.rifle.group)

    // трассер пули: тонкий брус, растягивается между прошлой и текущей точкой
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    this.tracer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), tracerMat)
    this.tracer.visible = false
    this.tracer.frustumCulled = false
    this.scene.add(this.tracer)

    this.glacierHomeX = this.world.glacierGroup.position.x
    this.glacierHomeY = this.world.glacierGroup.position.y

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  private makeSkyTexture(): THREE.CanvasTexture {
    const cnv = document.createElement('canvas')
    cnv.width = 16
    cnv.height = 256
    const ctx = cnv.getContext('2d')
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, '#274060')
      grad.addColorStop(0.55, '#7fa3c4')
      grad.addColorStop(0.78, '#d9b98a')
      grad.addColorStop(1, '#9dbbd8')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 16, 256)
    }
    const tex = new THREE.CanvasTexture(cnv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  baseFov(aspect: number): number {
    // в портрете вертикальный FOV растёт, чтобы горизонтальный обзор не сжимался
    if (aspect >= 1) return 65
    return Math.min(100, (65 / Math.max(0.5, aspect)) * 0.9)
  }

  resize(): void {
    const w = window.innerWidth
    const h = Math.max(1, window.innerHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
    this.rifle.group.visible = mode === 'sniper'
  }

  /** Поза камеры меню: медленный дрейф над карнизом, взгляд вдоль ущелья. */
  updateMenuCamera(dt: number): void {
    this.menuTime += dt * 0.12
    const x = 14 + Math.sin(this.menuTime * 0.7) * 10
    const y = 52 + Math.sin(this.menuTime * 0.45) * 3
    const z = WORLD.playerZ + 26 + Math.cos(this.menuTime * 0.6) * 6
    this.camera.position.set(x, y, z)
    this.camera.lookAt(-40, 18 + Math.sin(this.menuTime) * 4, -430)
    if (Math.abs(this.camera.fov - 60) > 0.01) {
      this.camera.fov = 60
      this.camera.updateProjectionMatrix()
    }
  }

  /** Поза стрелка: позиция на карнизе + yaw/pitch со sway/тряской, зум оптики. */
  setSniperPose(x: number, y: number, z: number, yaw: number, pitch: number, fovDeg: number): void {
    this.camera.position.set(x, y, z)
    this.euler.set(pitch, yaw, 0, 'YXZ')
    this.tmpQ.setFromEuler(this.euler)
    this.camera.quaternion.copy(this.tmpQ)
    if (Math.abs(this.camera.fov - fovDeg) > 0.01) {
      this.camera.fov = fovDeg
      this.camera.updateProjectionMatrix()
    }
  }

  /** Кинематографичная камера рапида: смотрит на пулю сбоку-сзади. */
  setBulletCamPose(bullet: THREE.Vector3, origin: THREE.Vector3): void {
    this.tmpV.copy(bullet).sub(origin).normalize().multiplyScalar(-16)
    this.camera.position.copy(bullet).add(this.tmpV)
    this.camera.position.y += 7
    this.camera.lookAt(bullet)
    if (Math.abs(this.camera.fov - 42) > 0.01) {
      this.camera.fov = 42
      this.camera.updateProjectionMatrix()
    }
  }

  get aimTargets(): THREE.Object3D[] {
    return this.world.aimTargets
  }

  get coreWorldPosition(): THREE.Vector3 {
    return this.world.coreMesh.getWorldPosition(this.tmpV)
  }

  /** Мировые координаты стрессового ядра в переданный вектор (без аллокаций). */
  corePosition(out: THREE.Vector3): THREE.Vector3 {
    return this.world.coreMesh.getWorldPosition(out)
  }

  /** Рейкаст прицела исключает только небо; первый пересечённый объект — цель. */
  raycastAim(origin: THREE.Vector3, dir: THREE.Vector3, outPoint: THREE.Vector3): AimResult | null {
    this.raycaster.set(origin, dir)
    this.raycaster.far = 1200
    const hits = this.raycaster.intersectObjects(this.world.aimTargets, false)
    const hit = hits[0]
    if (!hit) return null
    outPoint.copy(hit.point)
    let onGlacier = false
    let node: THREE.Object3D | null = hit.object
    while (node) {
      if (node === this.world.glacierGroup) {
        onGlacier = true
        break
      }
      node = node.parent
    }
    return { point: outPoint, distance: hit.distance, onGlacier }
  }

  pulseCore(dt: number): void {
    this.corePulseTime += dt
    const mesh = this.world.coreMesh as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
    mesh.material.emissiveIntensity = 2.2 + Math.sin(this.corePulseTime * 5.2) * 0.8
  }

  flashCore(): void {
    const mesh = this.world.coreMesh as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
    mesh.material.emissiveIntensity = 9
    this.flashIntensity = 9
  }

  fractureGlacier(): void {
    this.world.glacierGroup.visible = false
  }

  restoreGlacier(): void {
    this.world.glacierGroup.visible = true
    this.hideChunks()
  }

  hideChunks(): void {
    for (let i = 0; i < CHUNK_COUNT; i++) {
      this.tmpM.makeScale(0.0001, 0.0001, 0.0001)
      this.chunkMesh.setMatrixAt(i, this.tmpM)
    }
    this.chunkMesh.instanceMatrix.needsUpdate = true
  }

  setChunkTransform(index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
    this.tmpV.set(x, y, z)
    this.tmpQ.identity()
    this.unitScale.set(sx, sy, sz)
    this.tmpM.compose(this.tmpV, this.tmpQ, this.unitScale)
    this.chunkMesh.setMatrixAt(index, this.tmpM)
  }

  commitChunks(): void {
    this.chunkMesh.instanceMatrix.needsUpdate = true
  }

  setBipodVisible(visible: boolean): void {
    this.rifle.bipod.visible = visible
  }

  /** Расстановка ледника под конкретный перевал. */
  placeGlacier(x: number, y: number): void {
    const group = this.world.glacierGroup
    group.position.x = x
    group.position.y = y
  }

  resetGlacier(): void {
    const group = this.world.glacierGroup
    group.position.x = this.glacierHomeX
    group.position.y = this.glacierHomeY
    group.visible = true
    this.hideChunks()
  }

  get glacierX(): number {
    return this.world.glacierGroup.position.x
  }

  get glacierY(): number {
    return this.world.glacierGroup.position.y + 1 // ядро поднято над центром плиты
  }

  get glacierFaceZ(): number {
    return this.world.glacierGroup.position.z + 7.6
  }

  showTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = this.tmpV2.copy(to).sub(from)
    const length = Math.max(0.1, dir.length())
    this.tracer.visible = true
    this.tracer.position.copy(from).addScaledVector(dir, 0.5)
    this.tracer.scale.set(1, 1, length)
    this.tracer.lookAt(to)
  }

  hideTracer(): void {
    this.tracer.visible = false
  }

  muzzleFlash(power: number): void {
    this.flashIntensity = Math.max(this.flashIntensity, power)
    this.rifle.muzzleFlash.intensity = this.flashIntensity * 60
  }

  updateFlagsAndEffects(dt: number, windX: number): void {
    for (const flag of this.world.flags) {
      flag.cloth.rotation.y = windX >= 0 ? -Math.PI / 2 : Math.PI / 2
      flag.cloth.rotation.z = Math.min(1.25, Math.abs(windX) * 0.09) * (windX >= 0 ? 1 : -1)
      flag.cloth.scale.x = 0.55 + Math.min(0.45, Math.abs(windX) * 0.05)
    }
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 26)
      this.rifle.muzzleFlash.intensity = this.mode === 'sniper' ? this.flashIntensity * 60 : 0
    }
  }

  applyQuality(level: number): void {
    const ratios = [0.72, 1, Math.min(window.devicePixelRatio, 1.75)]
    this.renderer.setPixelRatio(ratios[level] ?? 1)
    this.renderer.shadowMap.enabled = level >= 1
    this.sun.castShadow = level >= 1
    this.particles.setSnowDensity([0.36, 0.65, 1][level] ?? 1)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}
