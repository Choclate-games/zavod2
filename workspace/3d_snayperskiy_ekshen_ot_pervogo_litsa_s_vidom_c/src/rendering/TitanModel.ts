import * as THREE from 'three'

const ICE = 0x9fc8e8
const ICE_DARK = 0x5f86ab

/** Процедурный ледяной титан: низкополигональный голем из переиспользованной
 * геометрии, анимация ходьбы поворотами групп (никаких подмен мешей). */
export class TitanModel {
  readonly root = new THREE.Group()
  walkPhase = 0
  private legLeftPivot = new THREE.Group()
  private legRightPivot = new THREE.Group()
  private armLeftPivot = new THREE.Group()
  private armRightPivot = new THREE.Group()
  private torso = new THREE.Group()
  private eyes: THREE.Mesh
  private materials: THREE.MeshStandardMaterial[] = []
  private geometries: THREE.BufferGeometry[] = []
  private buried = false

  constructor() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1)
    this.geometries.push(boxGeo)
    const matBody = new THREE.MeshStandardMaterial({ color: ICE, roughness: 0.7, metalness: 0.05, flatShading: true })
    const matDark = new THREE.MeshStandardMaterial({ color: ICE_DARK, roughness: 0.85, metalness: 0.05, flatShading: true })
    const matEye = new THREE.MeshStandardMaterial({
      color: 0x3a86ff,
      emissive: 0x3a86ff,
      emissiveIntensity: 2.4,
      roughness: 0.4,
      metalness: 0,
    })
    this.materials.push(matBody, matDark, matEye)

    const part = (sx: number, sy: number, sz: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(boxGeo, mat)
      mesh.scale.set(sx, sy, sz)
      mesh.castShadow = true
      return mesh
    }

    const torsoMesh = part(11, 14, 6, matBody)
    torsoMesh.position.y = 2
    const pelvis = part(8, 4, 5, matDark)
    pelvis.position.y = -7
    const head = part(4.5, 5, 4.5, matBody)
    head.position.y = 11.5
    this.eyes = new THREE.Mesh(boxGeo, matEye)
    this.eyes.scale.set(3.6, 0.7, 0.6)
    this.eyes.position.set(0, 12, 2.1)

    this.torso.add(torsoMesh, head, this.eyes, pelvis)
    this.torso.position.y = 17
    this.root.add(this.torso)

    const limb = (pivot: THREE.Group, x: number, y: number, len: number, thick: number, mat: THREE.Material) => {
      pivot.position.set(x, y, 0)
      const upper = part(thick, len, thick, mat)
      upper.position.y = -len / 2
      pivot.add(upper)
      this.root.add(pivot)
    }
    limb(this.armLeftPivot, -7.4, 22, 12, 3.2, matDark)
    limb(this.armRightPivot, 7.4, 22, 12, 3.2, matDark)
    limb(this.legLeftPivot, -3.4, 10, 10, 3.8, matBody)
    limb(this.legRightPivot, 3.4, 10, 10, 3.8, matBody)
  }

  place(x: number, z: number): void {
    this.root.position.x = x
    this.root.position.z = z
  }

  /** Фаза шага 0..1 и признак движения; ноги и руки качаются в противофазе. */
  animate(phase: number, moving: boolean): void {
    if (this.buried) return
    const swing = moving ? Math.sin(phase * Math.PI * 2) * 0.55 : 0
    this.legLeftPivot.rotation.z = swing
    this.legRightPivot.rotation.z = -swing
    this.armLeftPivot.rotation.z = -swing * 0.7
    this.armRightPivot.rotation.z = swing * 0.7
    this.torso.rotation.z = Math.sin(phase * Math.PI * 2 * 2) * 0.03
    this.root.position.y = moving ? Math.abs(Math.sin(phase * Math.PI * 2)) * 0.8 : 0
  }

  /** Прогресс погребения 0..1: проседание, крен и уход под лавину. */
  bury(progress: number): void {
    if (!this.buried && progress > 0) this.buried = true
    const p = Math.min(1, Math.max(0, progress))
    this.root.position.y = -p * 26
    this.root.rotation.z = p * 1.15
    this.root.rotation.x = p * 0.35
    this.materials[2].emissiveIntensity = 2.4 * (1 - p)
  }

  setEyesVisible(visible: boolean): void {
    this.eyes.visible = visible
  }
}
