import * as THREE from 'three'
import { TIER_COLORS } from '../balance'
import type { EnemyKind } from '../entities/EntityManager'

export class ProceduralModels {
  readonly tierMaterials: THREE.MeshStandardMaterial[] = []
  readonly enemyMaterials: Record<EnemyKind, THREE.MeshStandardMaterial>
  readonly bodyGeometry = new THREE.SphereGeometry(1, 12, 8)
  readonly eyeGeometry = new THREE.SphereGeometry(0.16, 8, 6)
  readonly toothGeometry = new THREE.ConeGeometry(0.11, 0.32, 6)
  readonly mouthGeometry = new THREE.TorusGeometry(0.42, 0.09, 6, 16, Math.PI)

  constructor() {
    for (const color of TIER_COLORS) this.tierMaterials.push(new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.16, emissive: color, emissiveIntensity: 0.12 }))
    this.enemyMaterials = {
      skirmisher: new THREE.MeshStandardMaterial({ color: 0x8da8a0, roughness: 0.72, metalness: 0.08 }),
      leaper: new THREE.MeshStandardMaterial({ color: 0x55a6a2, roughness: 0.65, metalness: 0.12 }),
      rammer: new THREE.MeshStandardMaterial({ color: 0xb06a45, roughness: 0.58, metalness: 0.28 }),
      void_titan: new THREE.MeshStandardMaterial({ color: 0x9d6bff, roughness: 0.38, metalness: 0.22, emissive: 0x32186f, emissiveIntensity: 0.5 }),
    }
  }

  buildBlob(tier: number): THREE.Group {
    const group = new THREE.Group()
    const body = new THREE.Mesh(this.bodyGeometry, this.tierMaterials[Math.max(0, Math.min(4, tier - 1))])
    body.name = 'bio-body'
    group.add(body)
    const mouth = new THREE.Mesh(this.mouthGeometry, this.tierMaterials[Math.max(0, Math.min(4, tier - 1))])
    mouth.rotation.x = Math.PI / 2
    mouth.position.y = 0.13
    mouth.scale.set(1, 0.7, 1)
    group.add(mouth)
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xf2ffe7, emissive: 0x73ffca, emissiveIntensity: 0.8, roughness: 0.3 })
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeometry, eyeMaterial)
      eye.position.set(side * 0.28, 0.3, 0.34)
      group.add(eye)
    }
    const toothMaterial = new THREE.MeshStandardMaterial({ color: 0xffe7bd, roughness: 0.5, metalness: 0.05 })
    for (let index = 0; index < 3; index += 1) {
      const tooth = new THREE.Mesh(this.toothGeometry, toothMaterial)
      tooth.position.set((index - 1) * 0.2, 0.14, 0.45)
      tooth.rotation.x = Math.PI
      group.add(tooth)
    }
    return group
  }

  buildEnemy(kind: EnemyKind): THREE.Group {
    const group = new THREE.Group()
    const body = new THREE.Mesh(this.bodyGeometry, this.enemyMaterials[kind])
    body.scale.set(kind === 'void_titan' ? 1.8 : kind === 'rammer' ? 1.2 : 0.72, kind === 'leaper' ? 1.1 : 0.8, kind === 'void_titan' ? 1.8 : kind === 'rammer' ? 1.05 : 0.72)
    group.add(body)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a3d })
    const eye = new THREE.Mesh(this.eyeGeometry, eyeMaterial)
    eye.position.set(0, 0.25, 0.48)
    group.add(eye)
    if (kind === 'rammer' || kind === 'void_titan') {
      const horn = new THREE.Mesh(this.toothGeometry, eyeMaterial)
      horn.position.set(0, 0.56, 0)
      group.add(horn)
    }
    return group
  }
}
