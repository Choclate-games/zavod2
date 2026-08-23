import * as THREE from 'three'

/**
 * Вьюмодель с двумя руками: наводка в отдельном узле, оружие с развалом.
 * Геометрия построена вдоль -Z (направление ствола совпадает с направлением взгляда).
 */
export class Viewmodel {
  readonly root = new THREE.Group()
  private readonly aimNode = new THREE.Group()

  constructor() {
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.85, metalness: 0 })
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x2e333d, roughness: 0.9, metalness: 0 })
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.45, metalness: 0.35 })
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.7, metalness: 0.05 })

    const box = new THREE.BoxGeometry(1, 1, 1)

    // Оружие: ствол, ложа, затвор — читаемый реквизит, а не серая пластина.
    const barrel = new THREE.Mesh(box, gunMaterial)
    barrel.scale.set(0.05, 0.05, 0.62)
    barrel.position.set(0, 0.02, -0.34)
    const stock = new THREE.Mesh(box, woodMaterial)
    stock.scale.set(0.07, 0.11, 0.3)
    stock.position.set(0, -0.03, 0.08)
    const receiver = new THREE.Mesh(box, gunMaterial)
    receiver.scale.set(0.08, 0.09, 0.22)
    receiver.position.set(0, 0.01, -0.05)
    this.aimNode.add(barrel, stock, receiver)

    // Хват на видимом борту: левая рука у цевья, правая у спускового крючка.
    const leftArm = new THREE.Mesh(box, sleeveMaterial)
    leftArm.scale.set(0.09, 0.09, 0.34)
    leftArm.position.set(-0.06, -0.06, -0.2)
    leftArm.rotation.x = 0.5
    const leftHand = new THREE.Mesh(box, skinMaterial)
    leftHand.scale.set(0.08, 0.08, 0.09)
    leftHand.position.set(-0.04, -0.01, -0.28)
    const rightArm = new THREE.Mesh(box, sleeveMaterial)
    rightArm.scale.set(0.09, 0.09, 0.3)
    rightArm.position.set(0.05, -0.1, 0.12)
    rightArm.rotation.x = 0.7
    const rightHand = new THREE.Mesh(box, skinMaterial)
    rightHand.scale.set(0.08, 0.08, 0.09)
    rightHand.position.set(0.02, -0.03, 0.0)
    this.aimNode.add(leftArm, leftHand, rightArm, rightHand)

    // Положение «от бедра» — своё у каждого состояния, позы интерполируются.
    this.root.add(this.aimNode)
    this.aimNode.position.set(0.16, -0.16, -0.32)
    this.aimNode.rotation.set(0.03, 0.06, 0.02)
  }

  /** Отдача и приближение интерполируются, не переключаются. */
  update(recoilPitch: number, zoomActive: boolean): void {
    const targetX = zoomActive ? 0.0 : 0.16
    const targetY = zoomActive ? -0.115 : -0.16
    const targetZ = zoomActive ? -0.26 : -0.32
    this.aimNode.position.x += (targetX - this.aimNode.position.x) * 0.2
    this.aimNode.position.y += (targetY - this.aimNode.position.y) * 0.2
    this.aimNode.position.z += (targetZ - this.aimNode.position.z) * 0.2
    this.aimNode.rotation.x = 0.03 + recoilPitch * 0.6
  }
}
