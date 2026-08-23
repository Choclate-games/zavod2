import * as THREE from 'three'
import { BAL } from '../config/balance.js'

/**
 * Ортографическая изометрическая камера (азимут 45°, возвышение ~35.26°),
 * сцена со светом, адаптивное качество: масштаб рендера стартует оптимистично
 * и ступенчато снижается при просадках FPS, затем поднимается обратно.
 */

const QUALITY_STEPS = [1, 0.85, 0.7]
const UPSAMPLE_AFTER_FRAMES = 180

export class Renderer3D {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.OrthographicCamera
  private viewHeight = 26
  private qualityIndex = 0
  private frameAccum = 0
  private frameCount = 0
  private slowFrames = 0
  private fastFrames = 0
  private canvasHost: HTMLElement

  constructor(host: HTMLElement, deviceType: 'desktop' | 'tablet' | 'mobile') {
    this.canvasHost = host
    this.renderer = new THREE.WebGLRenderer({
      antialias: deviceType === 'desktop',
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x171233)
    this.renderer.domElement.className = 'game-canvas'
    host.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x171233, 55, 110)
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 220)
    const dir = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(70)
    this.camera.position.copy(dir)
    this.camera.lookAt(0, 0, 0)

    const hemi = new THREE.HemisphereLight(0xbfa9ff, 0x2a1f45, 1.15)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffe2a8, 1.6)
    sun.position.set(24, 40, -18)
    this.scene.add(sun)
    const rim = new THREE.DirectionalLight(0x5ad7e8, 0.55)
    rim.position.set(-30, 18, 26)
    this.scene.add(rim)

    window.addEventListener('resize', () => this.resize())
    this.resize()
    void deviceType
  }

  get drawScale(): number {
    return QUALITY_STEPS[this.qualityIndex]
  }

  resize(): void {
    const w = Math.max(1, this.canvasHost.clientWidth)
    const h = Math.max(1, this.canvasHost.clientHeight)
    const aspect = w / h
    const halfH = this.viewHeight / 2
    const halfW = halfH * aspect
    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.updateProjectionMatrix()
    const pixelRatio = Math.min(window.devicePixelRatio, aspect < 1 ? 1.5 : 2)
    this.renderer.setPixelRatio(pixelRatio * QUALITY_STEPS[this.qualityIndex])
    this.renderer.setSize(w, h, false)
  }

  /** Измеритель кадров для адаптивного качества: сходится, не скачет. */
  sampleFrame(frameDt: number): void {
    if (frameDt <= 0) return
    this.frameAccum += frameDt
    this.frameCount++
    if (this.frameCount < BAL.targetFps) return
    const avgFps = this.frameCount / this.frameAccum
    this.frameAccum = 0
    this.frameCount = 0
    let changed = false
    if (avgFps < 48 && this.qualityIndex < QUALITY_STEPS.length - 1) {
      this.slowFrames++
      this.fastFrames = 0
      if (this.slowFrames >= 2) {
        this.qualityIndex++
        this.slowFrames = 0
        changed = true
      }
    } else if (avgFps > 57 && this.qualityIndex > 0) {
      this.fastFrames++
      this.slowFrames = 0
      if (this.fastFrames >= UPSAMPLE_AFTER_FRAMES / BAL.targetFps + 4) {
        this.qualityIndex--
        this.fastFrames = 0
        changed = true
      }
    } else {
      this.slowFrames = 0
      this.fastFrames = 0
    }
    if (changed) this.resize()
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}
