import * as THREE from 'three'

/**
 * Сцена мокрого перекрёстка: холодная синяя мгла, янтарные окна, красные
 * сигнальные лампы, дождь. В меню камера медленно плывёт по дуге; в игре —
 * от первого лица. Геометрия переиспользуется, аллокаций в кадре нет.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly rain: THREE.Points
  private readonly rainVelocities: Float32Array
  private readonly packageMesh: THREE.Mesh
  private readonly playerRig = new THREE.Object3D()
  private menuCamera = true
  private menuAngle = 0

  // Палитра из DESIGN.md; сцена не интерфейс, но цвета те же роли держат.
  private static readonly SKY = 0x0b141d
  private static readonly ASPHALT = 0x152230
  private static readonly BRICK_A = 0x2a1f1e
  private static readonly BRICK_B = 0x241d22
  private static readonly AMBER = 0xf0a63a
  private static readonly DANGER = 0xd5433c

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(SceneManager.SKY)

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220)
    this.scene.fog = new THREE.Fog(SceneManager.SKY, 18, 120)
    this.scene.background = new THREE.Color(SceneManager.SKY)

    const hemi = new THREE.HemisphereLight(0x6f9ab8, SceneManager.ASPHALT, 0.9)
    this.scene.add(hemi)
    const amberLamp = new THREE.PointLight(SceneManager.AMBER, 60, 40)
    amberLamp.position.set(-8, 5, -10)
    this.scene.add(amberLamp)
    const redLamp = new THREE.PointLight(SceneManager.DANGER, 30, 26)
    redLamp.position.set(9, 4, 8)
    this.scene.add(redLamp)

    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshLambertMaterial({ color: SceneManager.ASPHALT }),
    )
    asphalt.rotation.x = -Math.PI / 2
    this.scene.add(asphalt)

    this.buildStreet(-14, 0)
    this.buildStreet(14, Math.PI / 2)
    this.buildVan()

    const glow = new THREE.MeshBasicMaterial({ color: 0xffd28a })
    this.packageMesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.35), glow)
    this.packageMesh.position.set(0.32, -0.55, -0.7)
    this.playerRig.add(this.packageMesh)
    this.playerRig.position.set(2, 1.7, 12)
    this.scene.add(this.playerRig)

    const rainCount = 900
    this.rainVelocities = new Float32Array(rainCount)
    const positions = new Float32Array(rainCount * 3)
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80
      positions[i * 3 + 1] = Math.random() * 30
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80
      this.rainVelocities[i] = 14 + Math.random() * 10
    }
    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.rain = new THREE.Points(
      rainGeometry,
      new THREE.PointsMaterial({ color: 0x8fa8bd, size: 0.08, transparent: true, opacity: 0.55 }),
    )
    this.rain.frustumCulled = false
    this.scene.add(this.rain)

    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  setMenuCamera(menu: boolean): void {
    this.menuCamera = menu
  }

  /** Движение игрока в плоскости земли; ось y ввода — вперёд. */
  movePlayer(x: number, forward: number, dt: number): void {
    if (this.menuCamera) return
    const yaw = this.camera.rotation.y
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    const speed = 4.4
    this.playerRig.position.x += (x * cos - forward * sin) * speed * dt
    this.playerRig.position.z += (-x * sin - forward * cos) * speed * dt
    this.playerRig.position.x = Math.max(-70, Math.min(70, this.playerRig.position.x))
    this.playerRig.position.z = Math.max(-70, Math.min(70, this.playerRig.position.z))
  }

  update(dt: number): void {
    if (this.menuCamera) {
      this.menuAngle += dt * 0.06
      const radius = 17
      this.camera.position.set(
        Math.sin(this.menuAngle) * radius,
        6.5 + Math.sin(this.menuAngle * 0.7) * 0.8,
        Math.cos(this.menuAngle) * radius + 4,
      )
      this.camera.lookAt(0, 2.2, -6)
    } else {
      this.camera.position.copy(this.playerRig.position)
      this.camera.rotation.set(0, this.camera.rotation.y, 0)
      this.packageMesh.rotation.y += dt * 0.8
    }
    const posAttr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute
    const array = posAttr.array as Float32Array
    for (let i = 0; i < this.rainVelocities.length; i++) {
      array[i * 3 + 1] -= this.rainVelocities[i] * dt
      if (array[i * 3 + 1] < 0) array[i * 3 + 1] = 30
    }
    posAttr.needsUpdate = true
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /** Пересчёт под аспект: вертикальный FOV держит горизонтальный обзор. */
  resize(): void {
    const width = window.innerWidth
    const height = Math.max(1, window.innerHeight)
    this.renderer.setSize(width, height, false)
    const aspect = width / height
    this.camera.aspect = aspect
    const baseFov = 72
    this.camera.fov = aspect < 1 ? Math.min(100, baseFov / aspect) : baseFov
    this.camera.updateProjectionMatrix()
  }

  /** Ряд домов с янтарными окнами вдоль улицы. */
  private buildStreet(offsetX: number, rotationY: number): void {
    const group = new THREE.Group()
    group.position.x = offsetX
    group.rotation.y = rotationY
    const wallMaterials = [
      new THREE.MeshLambertMaterial({ color: SceneManager.BRICK_A }),
      new THREE.MeshLambertMaterial({ color: SceneManager.BRICK_B }),
    ]
    const roof = new THREE.MeshLambertMaterial({ color: 0x10161d })
    const windowMaterial = new THREE.MeshBasicMaterial({ color: SceneManager.AMBER })
    const signMaterial = new THREE.MeshBasicMaterial({ color: SceneManager.DANGER })
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
    const windowGeometry = new THREE.PlaneGeometry(0.9, 1.3)
    for (let i = 0; i < 6; i++) {
      const height = 8 + ((i * 37) % 11)
      const depth = 9 + ((i * 13) % 5)
      const house = new THREE.Mesh(boxGeometry, wallMaterials[i % 2])
      house.scale.set(depth, height, 7)
      house.position.set(0, height / 2, -34 + i * 12)
      group.add(house)
      for (let row = 1; row * 3 < height - 1; row++) {
        const lit = new THREE.Mesh(windowGeometry, windowMaterial)
        lit.position.set(depth / 2 + 0.02, row * 3, -34 + i * 12)
        lit.rotation.y = Math.PI / 2
        group.add(lit)
        if ((row + i) % 3 === 0) {
          const dark = new THREE.Mesh(windowGeometry, signMaterial)
          dark.position.set(-depth / 2 - 0.02, row * 3, -34 + i * 12)
          dark.rotation.y = -Math.PI / 2
          group.add(dark)
        }
      }
      const cap = new THREE.Mesh(boxGeometry, roof)
      cap.scale.set(depth + 0.6, 0.5, 7.6)
      cap.position.set(0, height + 0.25, -34 + i * 12)
      group.add(cap)
    }
    this.scene.add(group)
  }

  /** Курьерский фургон на перекрёстке — опорная точка меню и сцены. */
  private buildVan(): void {
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x3a4754 })
    const box = new THREE.BoxGeometry(1, 1, 1)
    const body = new THREE.Mesh(box, bodyMaterial)
    body.scale.set(2.2, 1.8, 5)
    body.position.set(6, 1.15, 3)
    const cabin = new THREE.Mesh(box, bodyMaterial)
    cabin.scale.set(2.1, 1.3, 1.6)
    cabin.position.set(6, 1.05, 6)
    const headlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.25),
      new THREE.MeshBasicMaterial({ color: SceneManager.AMBER }),
    )
    headlight.position.set(6.6, 0.9, 6.81)
    headlight.rotation.y = Math.PI
    this.scene.add(body, cabin, headlight)
  }
}
