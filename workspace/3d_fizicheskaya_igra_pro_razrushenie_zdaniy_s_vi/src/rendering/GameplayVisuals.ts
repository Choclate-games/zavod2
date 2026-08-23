import * as THREE from 'three'
import { ARC_PREDICTOR } from '../core/balance'

const COLOR_CUT = 0x00e5ff
const COLOR_DANGER = 0xff1744
const COLOR_PERIMETER = 0x00e5ff

/**
 * Диегетические визуальные узлы прицеливания: лазер среза, дуга прогноза,
 * охранное кольцо периметра, голограмма заряда и сетка напряжения.
 */
export class GameplayVisuals {
  private readonly cutLine: THREE.Line
  private readonly arcLine: THREE.Line
  private readonly perimeter: THREE.LineLoop
  private readonly chargeMarker: THREE.Mesh
  private readonly highlight: THREE.LineSegments
  private readonly cutPositions = new Float32Array(6)

  constructor(scene: THREE.Scene) {
    const cutGeo = new THREE.BufferGeometry()
    cutGeo.setAttribute('position', new THREE.BufferAttribute(this.cutPositions, 3))
    this.cutLine = new THREE.Line(cutGeo, new THREE.LineBasicMaterial({ color: COLOR_CUT }))
    this.cutLine.visible = false
    this.cutLine.frustumCulled = false
    scene.add(this.cutLine)

    const arcGeo = new THREE.BufferGeometry()
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_PREDICTOR.SAMPLES * 3), 3))
    this.arcLine = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: COLOR_CUT }))
    this.arcLine.visible = false
    this.arcLine.frustumCulled = false
    scene.add(this.arcLine)

    const circlePoints: number[] = []
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      circlePoints.push(Math.cos(a), 0.05, Math.sin(a))
    }
    const perimGeo = new THREE.BufferGeometry()
    perimGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(circlePoints), 3))
    this.perimeter = new THREE.LineLoop(perimGeo, new THREE.LineBasicMaterial({ color: COLOR_PERIMETER, transparent: true, opacity: 0.4 }))
    this.perimeter.visible = false
    this.perimeter.frustumCulled = false
    scene.add(this.perimeter)

    this.chargeMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.MeshBasicMaterial({ color: COLOR_DANGER }),
    )
    this.chargeMarker.visible = false
    scene.add(this.chargeMarker)

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: COLOR_CUT, transparent: true, opacity: 0.75 }),
    )
    this.highlight.visible = false
    this.highlight.frustumCulled = false
    scene.add(this.highlight)
  }

  showPerimeter(radius: number): void {
    this.perimeter.scale.set(radius, 1, radius)
    this.perimeter.position.set(0, 0, 0)
    this.perimeter.visible = true
  }

  hidePerimeter(): void {
    this.perimeter.visible = false
  }

  setCutPreview(
    x: number, y: number, z: number,
    dirX: number, dirZ: number, lengthM: number, danger: boolean,
  ): void {
    const half = lengthM / 2
    this.cutPositions[0] = x - dirX * half
    this.cutPositions[1] = y
    this.cutPositions[2] = z - dirZ * half
    this.cutPositions[3] = x + dirX * half
    this.cutPositions[4] = y
    this.cutPositions[5] = z + dirZ * half
    ;(this.cutLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    const material = this.cutLine.material as THREE.LineBasicMaterial
    material.color.setHex(danger ? COLOR_DANGER : COLOR_CUT)
    this.cutLine.visible = true
  }

  hideCutPreview(): void {
    this.cutLine.visible = false
  }

  setArc(points: Float32Array, danger: boolean): void {
    const attribute = this.arcLine.geometry.getAttribute('position') as THREE.BufferAttribute
    ;(attribute.array as Float32Array).set(points)
    attribute.needsUpdate = true
    const material = this.arcLine.material as THREE.LineBasicMaterial
    material.color.setHex(danger ? COLOR_DANGER : COLOR_CUT)
    this.arcLine.visible = true
  }

  hideArc(): void {
    this.arcLine.visible = false
  }

  setChargeMarker(x: number, y: number, z: number, visible: boolean, time: number): void {
    this.chargeMarker.visible = visible
    if (!visible) return
    this.chargeMarker.position.set(x, y, z)
    this.chargeMarker.rotation.y = time * 2.2
    this.chargeMarker.position.y += Math.sin(time * 3) * 0.25
  }

  highlightBuilding(specX: number, specZ: number, w: number, h: number, d: number, on: boolean): void {
    this.highlight.visible = on
    if (!on) return
    this.highlight.scale.set(w + 0.6, h + 0.6, d + 0.6)
    this.highlight.position.set(specX, h / 2, specZ)
  }
}
