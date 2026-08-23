import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { FIRES } from '../core/MissionLayout'
import { readScenePalette, type ScenePalette } from './ScenePalette'

export type SceneMode = 'MENU' | 'FLIGHT'

/** Плоский снимок позы самолёта: ядро не знает про THREE. */
export interface FlightPose {
  altitudeM: number
  lateralM: number
  forwardM: number
  pitchDeg: number
  rollDeg: number
  speedKmh: number
}

const CAMERA_BACK_M = 24
const CAMERA_UP_M = 7

export class SceneManager {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly planeRig = new Group()
  private readonly propeller: Mesh
  private readonly fireMeshes: Mesh[] = []
  private readonly waterGeometry: PlaneGeometry
  private readonly waterBasePositions: Float32Array
  private readonly palette: ScenePalette

  private mode: SceneMode = 'MENU'
  private menuTime = 0
  private propellerSpeed = 4
  private readonly poseTarget: FlightPose = {
    altitudeM: 2,
    lateralM: 0,
    forwardM: 0,
    pitchDeg: 0,
    rollDeg: 0,
    speedKmh: 0,
  }
  private readonly cameraGoal = new Vector3()
  private readonly matrixHelper = new Matrix4()
  private readonly objectHelper = new Object3D()
  private readonly colorHelper = new Color()

  constructor(canvas: HTMLCanvasElement) {
    this.palette = readScenePalette()
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

    this.scene.background = new Color(this.palette.sky)
    this.scene.fog = new Fog(this.palette.fog, 120, 520)

    this.camera = new PerspectiveCamera(65, 1, 0.5, 900)
    this.camera.position.set(14, 5, 18)

    const sun = new DirectionalLight(this.palette.sun, 2.2)
    sun.position.set(-80, 90, -60)
    this.scene.add(sun)
    this.scene.add(new HemisphereLight(this.palette.sky, this.palette.sandstoneDark, 0.9))

    this.waterGeometry = new PlaneGeometry(700, 1400, 56, 112)
    this.waterBasePositions = Float32Array.from(this.waterGeometry.getAttribute('position').array)
    const water = new Mesh(
      this.waterGeometry,
      new MeshStandardMaterial({ color: this.palette.water, roughness: 0.25, metalness: 0.15 }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.z = -500
    this.scene.add(water)

    this.buildCanyon()

    for (let i = 0; i < FIRES.length; i++) {
      const fire = FIRES[i]
      if (!fire) continue
      const mesh = new Mesh(
        new ConeGeometry(9, 26, 8),
        new MeshStandardMaterial({
          color: this.palette.fire,
          emissive: this.palette.fire,
          emissiveIntensity: 1.6,
          roughness: 0.6,
        }),
      )
      mesh.position.set(fire.offsetX, 13, -fire.distanceM)
      this.scene.add(mesh)
      this.fireMeshes.push(mesh)
    }

    this.propeller = this.buildPlane()

    this.resize()
  }

  /** Вызывается из фиксированного шага логики; без аллокаций. */
  setFlightState(pose: FlightPose): void {
    this.poseTarget.altitudeM = pose.altitudeM
    this.poseTarget.lateralM = pose.lateralM
    this.poseTarget.forwardM = pose.forwardM
    this.poseTarget.pitchDeg = pose.pitchDeg
    this.poseTarget.rollDeg = pose.rollDeg
    this.poseTarget.speedKmh = pose.speedKmh
  }

  setMode(mode: SceneMode): void {
    this.mode = mode
    if (mode === 'MENU') {
      this.poseTarget.forwardM = 0
      this.poseTarget.lateralM = 0
      this.poseTarget.altitudeM = 1.6
    }
  }

  setFireExtinguished(index: number): void {
    const mesh = this.fireMeshes[index]
    if (mesh) mesh.visible = false
  }

  resetFires(): void {
    for (const mesh of this.fireMeshes) mesh.visible = true
  }

  update(dt: number): void {
    this.animateWater(dt)
    if (this.mode === 'MENU') {
      this.updateMenuPose(dt)
      this.propeller.rotation.z += dt * this.propellerSpeed
    } else {
      this.updateFlightPose()
      this.propeller.rotation.z += dt * (12 + this.poseTarget.speedKmh / 12)
    }
    this.renderer.render(this.scene, this.camera)
  }

  resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  private buildCanyon(): void {
    const ground = new Mesh(
      new PlaneGeometry(700, 1400),
      new MeshStandardMaterial({ color: this.palette.sandstoneDark, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -3, -500)
    this.scene.add(ground)

    const rockGeometry = new DodecahedronGeometry(16, 0)
    const rockCount = 72
    const rocks = new InstancedMesh(
      rockGeometry,
      new MeshStandardMaterial({ color: this.palette.sandstone, roughness: 0.95 }),
      rockCount,
    )
    let placed = 0
    for (let side = -1; side <= 1 && placed < rockCount; side += 2) {
      for (let i = 0; i < 36 && placed < rockCount; i++, placed++) {
        const z = -i * 42 + (side > 0 ? 21 : 0)
        const x = side * (34 + ((i * 13) % 22))
        const scale = 0.8 + ((i * 7) % 10) / 10
        this.objectHelper.position.set(x, scale * 10, z)
        this.objectHelper.scale.setScalar(scale)
        this.objectHelper.rotation.set(0, i * 0.7, 0)
        this.objectHelper.updateMatrix()
        rocks.setMatrixAt(placed, this.matrixHelper.copy(this.objectHelper.matrix))
        this.colorHelper.setHex(placed % 2 === 0 ? this.palette.sandstone : this.palette.sandstoneDark)
        rocks.setColorAt(placed, this.colorHelper)
      }
    }
    rocks.instanceMatrix.needsUpdate = true
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true
    this.scene.add(rocks)
  }

  private buildPlane(): Mesh {
    const bodyMaterial = new MeshStandardMaterial({
      color: this.palette.planeBody,
      roughness: 0.5,
      metalness: 0.2,
    })
    const wingMaterial = new MeshStandardMaterial({
      color: this.palette.planeWing,
      roughness: 0.6,
      metalness: 0.05,
    })

    const fuselage = new Mesh(new CapsuleGeometry(1.1, 5.5, 4, 10), bodyMaterial)
    fuselage.rotation.x = Math.PI / 2
    this.planeRig.add(fuselage)

    const wing = new Mesh(new BoxGeometry(11, 0.28, 2.4), wingMaterial)
    wing.position.y = 0.55
    this.planeRig.add(wing)

    const tailFin = new Mesh(new BoxGeometry(0.24, 1.9, 1.4), bodyMaterial)
    tailFin.position.set(0, 1.1, 2.9)
    this.planeRig.add(tailFin)

    const stabilizer = new Mesh(new BoxGeometry(4.4, 0.2, 1), wingMaterial)
    stabilizer.position.set(0, 0.35, 3)
    this.planeRig.add(stabilizer)

    for (const x of [-3.4, 3.4]) {
      const float = new Mesh(new BoxGeometry(0.85, 0.75, 4.6), bodyMaterial)
      float.position.set(x, -1.35, 0.2)
      this.planeRig.add(float)
    }

    const propeller = new Mesh(
      new BoxGeometry(0.18, 4.6, 0.32),
      new MeshStandardMaterial({ color: 0x22201e }),
    )
    propeller.geometry.translate(0, 2.3, 0)
    propeller.position.set(0, 0, -3.6)
    this.planeRig.add(propeller)

    this.scene.add(this.planeRig)
    return propeller
  }

  private updateMenuPose(dt: number): void {
    this.menuTime += dt
    const bob = Math.sin(this.menuTime * 1.4) * 0.22
    this.planeRig.position.set(Math.sin(this.menuTime * 0.4) * 0.8, 1.45 + bob, -40)
    this.planeRig.rotation.set(bob * 0.12, 0, Math.sin(this.menuTime * 0.9) * 0.06)

    const angle = this.menuTime * 0.12
    this.cameraGoal.set(
      this.planeRig.position.x + Math.sin(angle) * 15,
      4.2 + Math.sin(this.menuTime * 0.23) * 0.8,
      this.planeRig.position.z + Math.cos(angle) * 15,
    )
    this.camera.position.lerp(this.cameraGoal, 0.02)
    this.camera.lookAt(this.planeRig.position)
  }

  private updateFlightPose(): void {
    this.planeRig.position.set(
      this.poseTarget.lateralM,
      this.poseTarget.altitudeM + 1.45,
      -this.poseTarget.forwardM,
    )
    this.planeRig.rotation.set(
      degToRad(this.poseTarget.pitchDeg),
      0,
      degToRad(-this.poseTarget.rollDeg),
    )

    this.cameraGoal.set(
      this.planeRig.position.x * 0.6,
      this.planeRig.position.y + CAMERA_UP_M,
      this.planeRig.position.z + CAMERA_BACK_M,
    )
    this.camera.position.lerp(this.cameraGoal, 0.08)
    this.camera.lookAt(this.planeRig.position)
  }

  private animateWater(dt: number): void {
    const positions = this.waterGeometry.getAttribute('position')
    const base = this.waterBasePositions
    this.waterPhase += dt * 2.2
    const phase = this.waterPhase
    for (let i = 0; i < positions.count; i++) {
      const ix = i * 3
      const bx = base[ix] ?? 0
      const by = base[ix + 1] ?? 0
      // Сумма двух синусоид — та же модель волн, что пойдёт в физику глиссирования.
      positions.array[ix + 2] =
        Math.sin(bx * 0.09 + phase) * 0.28 + Math.cos(by * 0.07 - phase * 0.8) * 0.22
    }
    positions.needsUpdate = true
  }

  private waterPhase = 0
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}
