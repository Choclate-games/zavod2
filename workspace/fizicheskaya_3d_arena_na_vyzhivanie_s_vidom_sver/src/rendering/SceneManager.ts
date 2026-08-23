import * as THREE from 'three'
import type { EntityManager } from '../entities/EntityManager'
import type { IceArenaFracturingSystem, IcePlate } from '../systems/IceArenaFracturingSystem'
import { buildAurora, buildIcePlateGeometry, buildIcebergs, buildOcean, buildTubeView } from './ProceduralModels'
import { ParticleSystem } from './ParticleSystem'
import { DRIFT, ICE, PERFORMANCE } from '../core/Balance'

/**
 * Сцена Three.js: арктический закат, льдина из 16 призм, океан и тюбинги.
 * Порядок кадра: физика уже отшагала — меши синхронизируются здесь.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly particles: ParticleSystem

  private readonly tubeViews: THREE.Group[] = []
  private readonly tubeRims: THREE.Mesh[] = []
  private readonly plateMeshes: THREE.Mesh[] = []
  private readonly aurora: THREE.Group
  private readonly ocean: THREE.Mesh
  private readonly canvas: HTMLCanvasElement
  private readonly menuCamPos = new THREE.Vector3()

  private camTargetX = 0
  private camTargetZ = 0
  private menuOrbit = 0
  private shake = 0
  private qualityTier = 2
  private frameCostAccum = 0
  private frameCount = 0
  private lowStreak = 0
  private highStreak = 0

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'game-canvas'
    container.appendChild(this.canvas)

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight)
    this.renderer.shadowMap.enabled = false

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2a4d69)
    this.scene.fog = new THREE.Fog(0x2a4d69, 60, 190)

    this.camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      400,
    )
    this.camera.position.set(0, 12, 18)
    this.camera.lookAt(0, 0, 0)

    // Низкое закатное солнце + холодная подсветка снизу от воды.
    const sun = new THREE.DirectionalLight(0xffc98a, 1.35)
    sun.position.set(-40, 26, -30)
    this.scene.add(sun)
    this.scene.add(new THREE.HemisphereLight(0xa8e6f0, 0x0b2545, 0.85))
    this.scene.add(new THREE.AmbientLight(0x40506a, 0.5))

    this.ocean = buildOcean(220)
    this.ocean.position.y = -0.15
    this.scene.add(this.ocean)

    this.aurora = buildAurora()
    this.scene.add(this.aurora)
    this.scene.add(buildIcebergs())

    this.particles = new ParticleSystem(this.scene)

    window.addEventListener('resize', this.handleResize)
    document.addEventListener('fullscreenchange', this.handleResize)
  }

  /** Геометрия арены под конкретную систему плит (создаётся один раз за матч). */
  buildArena(plates: IcePlate[]): void {
    for (let i = 0; i < this.plateMeshes.length; i++) {
      this.scene.remove(this.plateMeshes[i])
      this.plateMeshes[i].geometry.dispose()
    }
    this.plateMeshes.length = 0
    const innerGeometry = buildIcePlateGeometry(
      0.001,
      ICE.arenaRadius / 2 + 0.3,
      (Math.PI * 2) / ICE.outerSegments,
      ICE.plateThickness,
    )
    const outerGeometry = buildIcePlateGeometry(
      ICE.arenaRadius / 2 - 0.3,
      ICE.arenaRadius,
      (Math.PI * 2) / ICE.outerSegments,
      ICE.plateThickness,
    )
    const innerMaterial = new THREE.MeshStandardMaterial({ color: 0xa8e6f0, roughness: 0.32, metalness: 0.04, flatShading: true })
    const outerMaterial = new THREE.MeshStandardMaterial({ color: 0x7fd4e8, roughness: 0.45, flatShading: true })
    for (let i = 0; i < plates.length; i++) {
      const mesh = new THREE.Mesh(plates[i].ring === 0 ? innerGeometry : outerGeometry, plates[i].ring === 0 ? innerMaterial : outerMaterial)
      this.scene.add(mesh)
      this.plateMeshes.push(mesh)
    }
  }

  buildTubes(entities: EntityManager): void {
    for (let i = 0; i < this.tubeViews.length; i++) {
      this.scene.remove(this.tubeViews[i])
    }
    this.tubeViews.length = 0
    this.tubeRims.length = 0
    for (let i = 0; i < entities.tubes.length; i++) {
      const view = buildTubeView(entities.tubes[i].colorIndex)
      this.scene.add(view.group)
      this.tubeViews.push(view.group)
      this.tubeRims.push(view.rim)
    }
  }

  /** Вызов ПОСЛЕ world.step(): кадр рисует текущее состояние мира. */
  syncAfterPhysics(entities: EntityManager, arena: IceArenaFracturingSystem, dt: number): void {
    for (let i = 0; i < entities.tubes.length && i < this.tubeViews.length; i++) {
      const tube = entities.tubes[i]
      const view = this.tubeViews[i]
      if (!tube.body) continue
      const t = tube.body.translation()
      view.position.set(t.x, t.y - tube.radiusM * 0.72, t.z)
      view.rotation.y = tube.heading
      view.visible = tube.alive || t.y > -1.4
      view.scale.setScalar(tube.radiusM / 0.6)
      if (i < this.tubeRims.length) {
        const rim = this.tubeRims[i]
        const edgeDanger = Math.hypot(t.x, t.z) > ICE.arenaRadius * 0.82
        rim.visible = tube.alive && (tube.boosting || edgeDanger)
        ;(rim.material as THREE.MeshBasicMaterial).color.setHex(tube.boosting && !edgeDanger ? 0x00f5d4 : 0xe63946)
      }
      if (tube.alive) {
        // Снежный шлейф заноса.
        if (tube.drifting && tube.sprayIntensity > 0.05 && Math.random() < dt * DRIFT.snowSprayParticleRate * tube.sprayIntensity) {
          const backX = t.x - Math.sin(tube.heading) * 0.7
          const backZ = t.z - Math.cos(tube.heading) * 0.7
          this.particles.spawnCone(true, backX, 0.25, backZ, -Math.sin(tube.heading), 0.55, -Math.cos(tube.heading), 2, 3.4, 0.9, 0.55, 0.16, 9.8, 0.92, 0.96, 1.0)
        }
        // Пламя форсажа из сопла на корме.
        if (tube.boosting && Math.random() < 0.85) {
          const backX = t.x - Math.sin(tube.heading) * 1.05
          const backZ = t.z - Math.cos(tube.heading) * 1.05
          this.particles.spawnCone(false, backX, 0.3, backZ, -Math.sin(tube.heading), 0.12, -Math.cos(tube.heading), 2, 6.5, 0.28, 0.3, 0.13, -1.5, 1.0, 0.62, 0.18)
        }
      }
    }

    for (let i = 0; i < arena.plates.length && i < this.plateMeshes.length; i++) {
      const plate = arena.plates[i]
      const mesh = this.plateMeshes[i]
      mesh.position.copy(plate.body.translation() as unknown as THREE.Vector3)
      mesh.quaternion.copy(plate.body.rotation() as unknown as THREE.Quaternion)
    }

    this.particles.update(dt)
  }

  /** Камера следует за игроком; в меню лениво кружит по арене. */
  updateCamera(playerX: number, playerZ: number, playerBoosting: boolean, inMenu: boolean, dt: number): void {
    if (inMenu) {
      this.menuOrbit += dt * 0.22
      const radius = 13
      this.camTargetX = Math.sin(this.menuOrbit) * radius
      this.camTargetZ = Math.cos(this.menuOrbit) * radius
      this.menuCamPos.set(this.camTargetX, 7.5, this.camTargetZ)
      this.camera.position.lerp(this.menuCamPos, 0.03)
      this.camera.lookAt(0, 0.6, 0)
      return
    }
    const followDistance = playerBoosting ? 17 : 14
    const desiredY = playerBoosting ? 12.5 : 11
    const k = Math.min(1, dt * 3.2)
    this.camera.position.x += (playerX * 0.86 - this.camera.position.x) * k
    this.camera.position.z += (playerZ * 0.86 + followDistance * 0.72 - this.camera.position.z) * k
    this.camera.position.y += (desiredY - this.camera.position.y) * k
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.8
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5
      this.shake = Math.max(0, this.shake - dt * 2.4)
    }
    this.camera.lookAt(playerX * 0.86, 0.4, playerZ * 0.86)
    const targetFov = playerBoosting ? 58 : 52
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * k
      this.camera.updateProjectionMatrix()
    }
  }

  triggerShake(intensity: number): void {
    this.shake = Math.max(this.shake, intensity * 1.4)
  }

  /** Адаптивное качество: стартует оптимистично и ступенчато сходится. */
  adaptQuality(frameDtMs: number): void {
    this.frameCostAccum += frameDtMs
    this.frameCount++
    if (this.frameCount < 90) return
    const average = this.frameCostAccum / this.frameCount
    this.frameCostAccum = 0
    this.frameCount = 0
    if (average > 24) {
      this.lowStreak++
      this.highStreak = 0
    } else if (average < 14) {
      this.highStreak++
      this.lowStreak = 0
    }
    if (this.lowStreak >= 3 && this.qualityTier > 0) {
      this.qualityTier--
      this.applyQualityTier()
      this.lowStreak = 0
    } else if (this.highStreak >= 6 && this.qualityTier < 2) {
      this.qualityTier++
      this.applyQualityTier()
      this.highStreak = 0
    }
  }

  get qualityLevel(): number {
    return this.qualityTier
  }

  private applyQualityTier(): void {
    const ratio = this.qualityTier === 2 ? 1.5 : this.qualityTier === 1 ? 1.1 : 0.85
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio))
    this.aurora.visible = this.qualityTier >= 1
  }

  render(timeSec: number): void {
    // Океан дышит суммой синусоид, сияние медленно плывёт.
    this.ocean.position.y = -0.15 + Math.sin(timeSec * 0.8) * 0.07 + Math.sin(timeSec * 0.37) * 0.04
    this.aurora.position.x = Math.sin(timeSec * 0.11) * 14
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    document.removeEventListener('fullscreenchange', this.handleResize)
    this.renderer.dispose()
  }

  private handleResize = (): void => {
    const parent = this.canvas.parentElement
    const width = parent?.clientWidth || window.innerWidth
    const height = parent?.clientHeight || window.innerHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  get drawCallBudget(): number {
    return PERFORMANCE.maxDrawCalls
  }
}
