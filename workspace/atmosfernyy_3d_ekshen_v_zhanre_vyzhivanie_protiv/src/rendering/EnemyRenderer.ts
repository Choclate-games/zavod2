import * as THREE from 'three'
import { ENEMY_CAPACITY, EnemyType, type EnemyManager } from '../entities/EnemyManager.js'

const TYPE_CAPACITY = [150, 40, 40, 1] as const

/**
 * Орда рисуется четырьмя InstancedMesh (по одному на тип) плюс отдельные
 * меши фосфорных глаз: силуэт во тьме читается по светящимся точкам.
 * Матрицы и цвета пишутся подряд, mesh.count выставляется в конце кадра.
 */
export class EnemyRenderer {
  private readonly bodies: THREE.InstancedMesh[] = []
  private readonly eyes: THREE.InstancedMesh[] = []
  private readonly matrix = new THREE.Matrix4()
  private readonly quaternion = new THREE.Quaternion()
  private readonly euler = new THREE.Euler()
  private readonly position = new THREE.Vector3()
  private readonly scale = new THREE.Vector3()
  private readonly color = new THREE.Color()

  constructor(parent: THREE.Object3D) {
    const eyeGeometry = new THREE.SphereGeometry(0.16, 6, 4)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x1ce8b5 })

    const crawlerGeometry = new THREE.ConeGeometry(0.75, 1.3, 7)
    const carapaceGeometry = new THREE.SphereGeometry(1.25, 9, 6)
    const mineGeometry = new THREE.IcosahedronGeometry(0.8, 0)
    const leviathanGeometry = new THREE.SphereGeometry(2.6, 10, 7)

    const bodyMaterials = [
      new THREE.MeshLambertMaterial({ color: 0x232a33 }),
      new THREE.MeshLambertMaterial({ color: 0x303844 }),
      new THREE.MeshBasicMaterial({ color: 0x0f4a3c }),
      new THREE.MeshLambertMaterial({ color: 0x1b2430 }),
    ]

    for (let type = 0; type < 4; type++) {
      const bodyMesh = new THREE.InstancedMesh(
        [crawlerGeometry, carapaceGeometry, mineGeometry, leviathanGeometry][type],
        bodyMaterials[type],
        TYPE_CAPACITY[type],
      )
      bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TYPE_CAPACITY[type] * 3), 3)
      bodyMesh.frustumCulled = false
      parent.add(bodyMesh)
      this.bodies.push(bodyMesh)

      if (TYPE_CAPACITY[type] === 1) {
        // Левиафан: три глаза в ряд рисуются одним инстансом большего размера.
        const eyeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), eyeMaterial.clone(), 3)
        eyeMesh.frustumCulled = false
        parent.add(eyeMesh)
        this.eyes.push(eyeMesh)
      } else {
        const eyeMesh = new THREE.InstancedMesh(eyeGeometry, eyeMaterial, TYPE_CAPACITY[type])
        eyeMesh.frustumCulled = false
        parent.add(eyeMesh)
        this.eyes.push(eyeMesh)
      }
    }
  }

  update(enemies: EnemyManager, time: number): void {
    for (let type = 0; type < 4; type++) {
      let written = 0
      const bodyMesh = this.bodies[type]
      const eyeMesh = this.eyes[type]
      const pulse = 0.72 + Math.sin(time * 5 + type) * 0.28
      for (let i = 0; i < ENEMY_CAPACITY; i++) {
        if (!enemies.alive[i]) continue
        if (enemies.type[i] !== type) continue
        if (written >= TYPE_CAPACITY[type]) break
        const x = enemies.posX[i]
        const z = enemies.posZ[i]
        const bob = Math.sin(enemies.animPhase[i]) * 0.14

        this.position.set(x, bob + this.bodyHeight(type, enemies.radius[i]), z)
        this.euler.set(0, enemies.yaw[i], 0)
        this.quaternion.setFromEuler(this.euler)
        const r = enemies.radius[i]
        this.scale.set(r / 0.75, r / 0.75, r / 0.75)
        if (type === EnemyType.Leviathan) this.scale.setScalar(1)
        if (type === EnemyType.Carapace) this.scale.y *= 0.72
        this.matrix.compose(this.position, this.quaternion, this.scale)
        bodyMesh.setMatrixAt(written, this.matrix)

        if (type === EnemyType.BioMine) {
          this.color.setRGB(0.08 * pulse + 0.05, 0.85 * pulse, 0.62 * pulse)
        } else if (type === EnemyType.Leviathan) {
          this.color.setRGB(0.12, 0.2 + pulse * 0.08, 0.26)
        } else {
          this.color.setRGB(0.13, 0.15, 0.18)
        }
        bodyMesh.setColorAt(written, this.color)

        // Глаза чуть выше корпуса со стороны движения.
        const eyeForward = r * 0.45
        this.position.set(
          x - Math.sin(enemies.yaw[i]) * -eyeForward,
          bob + this.eyeHeight(type),
          z - Math.cos(enemies.yaw[i]) * -eyeForward,
        )
        this.scale.setScalar(1)
        this.matrix.compose(this.position, this.quaternion, this.scale)
        if (type === EnemyType.Leviathan) {
          for (let e = 0; e < 3; e++) {
            const side = (e - 1) * 1.1
            this.position.x += Math.cos(enemies.yaw[i]) * side
            this.position.z += -Math.sin(enemies.yaw[i]) * side
            this.matrix.compose(this.position, this.quaternion, this.scale)
            eyeMesh.setMatrixAt(e, this.matrix)
          }
        } else {
          eyeMesh.setMatrixAt(written, this.matrix)
        }
        written += 1
      }
      bodyMesh.count = written
      eyeMesh.count = type === EnemyType.Leviathan ? (written > 0 ? 3 : 0) : written
      bodyMesh.instanceMatrix.needsUpdate = true
      eyeMesh.instanceMatrix.needsUpdate = true
      if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true
    }
  }

  reset(): void {
    for (let type = 0; type < 4; type++) {
      this.bodies[type].count = 0
      this.eyes[type].count = 0
    }
  }

  private bodyHeight(type: number, radius: number): number {
    switch (type) {
      case EnemyType.Crawler: return radius * 0.55
      case EnemyType.Carapace: return radius * 0.5
      case EnemyType.BioMine: return radius * 0.8
      default: return 1.6
    }
  }

  private eyeHeight(type: number): number {
    switch (type) {
      case EnemyType.Crawler: return 0.65
      case EnemyType.Carapace: return 0.55
      case EnemyType.BioMine: return 0.95
      default: return 2.6
    }
  }
}
