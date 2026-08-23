import * as THREE from 'three'
import type { LensSystem } from '../systems/LensSystem.js'

const CONE_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const CONE_FRAGMENT = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  // Затухание по длине конуса и по краям: дешёвый объёмный свет без post-processing.
  float along = pow(1.0 - vUv.y, 1.6);
  gl_FragColor = vec4(uColor, along * uIntensity);
}
`

const LAMP_HEIGHT = 16.2
const BEAM_PITCH = (32 * Math.PI) / 180
const GROUND_HIT_DISTANCE = 24

/**
 * Конус прожектора: аддитивная оболочка + SpotLight для освещения геометрии.
 * Геометрия собрана вдоль +Z и целится поворотом группы (правило lookAt).
 */
export class BeamRenderer {
  readonly pivot: THREE.Group
  private readonly shellMaterial: THREE.ShaderMaterial
  private readonly spot: THREE.SpotLight
  private readonly spotTarget: THREE.Object3D
  private readonly glow: THREE.PointLight
  private readonly patch: THREE.Mesh
  private readonly patchMaterial: THREE.MeshBasicMaterial

  constructor(parent: THREE.Object3D) {
    this.pivot = new THREE.Group()
    this.pivot.position.y = LAMP_HEIGHT
    parent.add(this.pivot)

    const length = 32
    const coneGeometry = new THREE.ConeGeometry(1, 1, 26, 1, true)
    coneGeometry.translate(0, -0.5, 0)
    coneGeometry.rotateX(-Math.PI / 2)
    this.shellMaterial = new THREE.ShaderMaterial({
      vertexShader: CONE_VERTEX,
      fragmentShader: CONE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(0xffdf9e) },
        uIntensity: { value: 0.34 },
      },
    })
    this.shell = new THREE.Mesh(coneGeometry, this.shellMaterial)
    this.shell.scale.set(6, 6, length)
    this.shell.frustumCulled = false
    this.pivot.add(this.shell)

    this.spotTarget = new THREE.Object3D()
    this.spotTarget.position.set(0, 0, 1)
    this.pivot.add(this.spotTarget)

    this.spot = new THREE.SpotLight(0xffd98a, 900, 46, 0.5, 0.55, 1.2)
    this.spot.target = this.spotTarget
    this.pivot.add(this.spot)

    this.glow = new THREE.PointLight(0xffc46a, 60, 18, 1.8)
    this.glow.position.y = 0.5
    this.pivot.add(this.glow)

    // Пятно на камнях: эллипс, сжатый наклоном луча.
    this.patchMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe3a8,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.patch = new THREE.Mesh(new THREE.CircleGeometry(1, 22), this.patchMaterial)
    this.patch.rotation.x = -Math.PI / 2
    this.patch.position.y = 0.15
    this.patch.frustumCulled = false
    parent.add(this.patch)
  }

  private shell!: THREE.Mesh

  update(lens: LensSystem): void {
    // yaw определён как atan2(z, x): переводим в поворот группы вокруг Y.
    this.pivot.rotation.y = Math.PI / 2 - lens.yaw
    this.pivot.rotation.x = BEAM_PITCH

    const halfAngle = lens.angleRad * 0.5
    const baseRadius = Math.tan(halfAngle) * 30
    this.shell.scale.set(baseRadius, baseRadius, 30)
    this.spot.angle = halfAngle
    this.spot.intensity = lens.isFocus ? 1500 : 800
    this.shellMaterial.uniforms.uIntensity.value = lens.overheated ? 0.06 : lens.isFocus ? 0.5 : 0.34

    const hitX = Math.cos(lens.yaw) * GROUND_HIT_DISTANCE
    const hitZ = Math.sin(lens.yaw) * GROUND_HIT_DISTANCE
    this.patch.position.x = hitX
    this.patch.position.z = hitZ
    const spread = lens.isFocus ? 1.6 : 7.5
    this.patch.scale.set(spread, spread * 1.35, 1)
    this.patch.rotation.z = -lens.yaw
    this.patchMaterial.opacity = lens.overheated ? 0.03 : lens.isFocus ? 0.28 : 0.14
  }

  /** В меню лампа мерно вращается сама. */
  sweepMenu(time: number): void {
    this.pivot.rotation.y = time * 0.45
    this.pivot.rotation.x = BEAM_PITCH
    this.shell.scale.set(3.2, 3.2, 30)
    this.shellMaterial.uniforms.uIntensity.value = 0.3
    this.spot.angle = 0.28
    const angle = time * 0.45
    const hitX = Math.sin(angle) * GROUND_HIT_DISTANCE
    const hitZ = Math.cos(angle) * GROUND_HIT_DISTANCE
    this.patch.position.x = hitX
    this.patch.position.z = hitZ
    this.patch.scale.set(3.4, 4.6, 1)
    this.patchMaterial.opacity = 0.12
  }
}
