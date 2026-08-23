import * as THREE from 'three'
import { balance } from '../data/balance'

/**
 * Сцена Three.js: закатный свет высокогорья, градиентное окружение для
 * отражений на хроме и льду, адаптивное качество. Тюнинг начинается с
 * оптимистичного максимума и ступенями спускается под нагрузку, затем
 * медленно возвращается — без раскачки.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private readonly sun: THREE.DirectionalLight

  private qualityTiers: number[]
  private tier = 0
  private frameAccum = 0
  private frameCount = 0
  private cooldown = 2
  private basePixelRatio: number

  constructor(canvasParent: HTMLElement) {
    const isMobileTier = Math.min(window.devicePixelRatio, 2) > 1 && window.innerWidth < 900
    this.basePixelRatio = Math.min(window.devicePixelRatio, isMobileTier ? 1.5 : 2)
    this.qualityTiers = [1, 0.8, 0.6, 0.45]

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobileTier,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(this.basePixelRatio)
    this.renderer.setSize(canvasParent.clientWidth, canvasParent.clientHeight)
    canvasParent.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    // фон задан цветом неба: иначе контровой закат превращается в чёрный кадр
    this.scene.background = new THREE.Color('#1c2541')
    this.scene.fog = new THREE.Fog('#1c2541', 160, 720)

    this.camera = new THREE.PerspectiveCamera(55, canvasParent.clientWidth / canvasParent.clientHeight, 0.3, 2200)

    const hemi = new THREE.HemisphereLight('#3a7ca5', '#1c2541', 0.85)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight('#ff8c42', 2.4)
    this.sun.position.set(-120, 60, -40)
    this.sun.castShadow = !isMobileTier
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(1024, 1024)
      this.sun.shadow.camera.near = 10
      this.sun.shadow.camera.far = 400
    }
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.scene.environment = this.makeEnvironment()
  }

  /** Градиент заката как equirect-текстура окружения: ни одного файла. */
  private makeEnvironment(): THREE.Texture {
    const width = 64
    const height = 32
    const data = new Uint8Array(width * height * 4)
    const top = new THREE.Color('#12203a')
    const mid = new THREE.Color('#ff8c42')
    const bottom = new THREE.Color('#3a7ca5')
    const color = new THREE.Color()
    for (let y = 0; y < height; y++) {
      const t = y / (height - 1)
      if (t < 0.55) color.copy(top).lerp(mid, t / 0.55)
      else color.copy(mid).lerp(bottom, (t - 0.55) / 0.45)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        data[i] = Math.round(color.r * 255)
        data[i + 1] = Math.round(color.g * 255)
        data[i + 2] = Math.round(color.b * 255)
        data[i + 3] = 255
      }
    }
    const texture = new THREE.DataTexture(data, width, height)
    texture.mapping = THREE.EquirectangularReflectionMapping
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    // вертикальный FOV пересчитан под аспект: портрет не схлопывается в трубу
    const portraitFactor = this.camera.aspect < 1 ? 1.25 : 1
    this.camera.fov = 55 * portraitFactor
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.sun.target.position.set(0, 0, 0)
  }

  get drawScale(): number {
    return this.qualityTiers[this.tier]
  }

  /**
   * Замер кадра от цикла: усредняем за окно ~1 с и решаем шаг качества.
   * Порог берётся из бюджета производительности, гистерезис не даёт качеству
   * скакать между уровнями.
   */
  sampleFrame(dt: number): void {
    this.frameAccum += dt
    this.frameCount++
    this.cooldown -= dt
    if (this.frameAccum < 1) return
    const avg = this.frameAccum / Math.max(1, this.frameCount)
    this.frameAccum = 0
    this.frameCount = 0
    if (this.cooldown > 0) return
    const budget = 1 / balance.target_fps
    if (avg > budget * 1.35 && this.tier < this.qualityTiers.length - 1) {
      this.tier++
      this.applyTier()
      this.cooldown = 3
    } else if (avg < budget * 0.8 && this.tier > 0) {
      this.tier--
      this.applyTier()
      this.cooldown = 5
    }
  }

  private applyTier(): void {
    this.renderer.setPixelRatio(this.basePixelRatio * this.qualityTiers[this.tier])
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}
