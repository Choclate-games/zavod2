import * as THREE from 'three'
import { BALANCE } from './balanceConfig'
import { SoldierState } from '../types'
import { events } from '../core/EventBus'

export class SquadAIController {
  private static instance: SquadAIController
  private squad: SoldierState[] = []
  private squadMeshGroup = new THREE.Group()
  private soldierMeshes: THREE.Group[] = []
  private strobeLights: THREE.MeshBasicMaterial[] = []

  // Route waypoints across 3 sectors to the Extraction LZ
  private waypoints = [
    new THREE.Vector3(-180, 0, 0),
    new THREE.Vector3(-110, 0, 0),
    new THREE.Vector3(-40, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(50, 0, 10),
    new THREE.Vector3(120, 0, 20),
    new THREE.Vector3(190, 0, 0) // LZ Extraction point
  ]
  private currentWaypointIndex = 0
  private strobeTimer = 0

  public static getInstance(): SquadAIController {
    if (!SquadAIController.instance) {
      SquadAIController.instance = new SquadAIController()
    }
    return SquadAIController.instance
  }

  public init(parent: THREE.Object3D): void {
    this.createSoldierMeshes()
    parent.add(this.squadMeshGroup)
    this.reset()

    events.on('EXPLOSION_DETONATED', (data: { caliber: string; impact: { x: number; y: number; z: number }; radius: number; damage: number }) => {
      this.checkExplosionDamage(data.impact, data.radius, data.damage, data.caliber)
    })
  }

  private createSoldierMeshes(): void {
    this.squadMeshGroup.clear()
    this.soldierMeshes = []
    this.strobeLights = []

    const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.2, 4, 8)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      emissive: 0x999999,
      emissiveIntensity: 0.8
    })

    const strobeGeo = new THREE.SphereGeometry(0.25, 8, 8)

    for (let i = 0; i < BALANCE.squad.soldierCount; i++) {
      const soldierGroup = new THREE.Group()
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.y = 1.1
      soldierGroup.add(body)

      // IR Strobe on helmet
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const strobe = new THREE.Mesh(strobeGeo, strobeMat)
      strobe.position.set(0, 2.0, 0)
      soldierGroup.add(strobe)

      this.strobeLights.push(strobeMat)
      this.soldierMeshes.push(soldierGroup)
      this.squadMeshGroup.add(soldierGroup)
    }
  }

  public reset(): void {
    this.squad = []
    this.currentWaypointIndex = 0

    const startPos = this.waypoints[0]
    for (let i = 0; i < BALANCE.squad.soldierCount; i++) {
      const offsetX = (i % 2) * 2 - 1
      const offsetZ = Math.floor(i / 2) * 2 - 1
      this.squad.push({
        id: i + 1,
        position: { x: startPos.x + offsetX, y: 0, z: startPos.z + offsetZ },
        health: BALANCE.squad.soldierMaxHealth,
        maxHealth: BALANCE.squad.soldierMaxHealth,
        isAlive: true,
        isEvacuated: false
      })
    }
    this.updateMeshPositions()
  }

  public getSquadState(): SoldierState[] {
    return this.squad
  }

  public getLivingCount(): number {
    return this.squad.filter((s) => s.isAlive).length
  }

  public getCenterPosition(): THREE.Vector3 {
    const center = new THREE.Vector3()
    let count = 0
    for (const s of this.squad) {
      if (s.isAlive) {
        center.x += s.position.x
        center.y += s.position.y
        center.z += s.position.z
        count++
      }
    }
    if (count > 0) {
      center.divideScalar(count)
    }
    return center
  }

  public reviveAll(): void {
    for (const s of this.squad) {
      s.isAlive = true
      s.health = s.maxHealth
    }
    this.updateMeshPositions()
    events.emit('SQUAD_REVIVED', true)
  }

  public update(dt: number, isUnderFire: boolean): void {
    // 1. Strobe beacon pulsation (2.0 Hz)
    this.strobeTimer += dt
    const strobeState = Math.sin(this.strobeTimer * Math.PI * 2 * BALANCE.squad.strobeFrequencyHz) > 0
    for (const mat of this.strobeLights) {
      mat.color.setHex(strobeState ? 0xffffff : 0x111111)
    }

    // 2. March along route waypoints
    const speed = isUnderFire ? BALANCE.squad.sprintSpeed : BALANCE.squad.marchSpeed
    if (this.currentWaypointIndex < this.waypoints.length - 1) {
      const targetWaypoint = this.waypoints[this.currentWaypointIndex + 1]
      const center = this.getCenterPosition()
      const dir = new THREE.Vector3().subVectors(targetWaypoint, center)
      const dist = dir.length()

      if (dist < 4.0) {
        this.currentWaypointIndex++
        if (this.currentWaypointIndex >= this.waypoints.length - 1) {
          // Reached LZ extraction zone!
          events.emit('SQUAD_REACHED_LZ', true)
        }
      } else {
        dir.normalize().multiplyScalar(speed * dt)
        for (let i = 0; i < this.squad.length; i++) {
          const s = this.squad[i]
          if (s.isAlive) {
            s.position.x += dir.x
            s.position.z += dir.z
          }
        }
      }
    }

    this.updateMeshPositions()
  }

  private updateMeshPositions(): void {
    for (let i = 0; i < this.squad.length; i++) {
      const s = this.squad[i]
      const mesh = this.soldierMeshes[i]
      if (mesh) {
        mesh.visible = s.isAlive
        mesh.position.set(s.position.x, 0, s.position.z)
      }
    }
  }

  public checkDangerCloseWarning(aimPos: THREE.Vector3, caliber: string): { isDanger: boolean; distance: number } {
    let minDistance = 999
    const center = this.getCenterPosition()
    const dist = aimPos.distanceTo(center)
    if (dist < minDistance) minDistance = dist

    const dangerThreshold = caliber === '105mm' ? BALANCE.howitzer.dangerRadius : BALANCE.bofors.dangerRadius
    const isDanger = dist <= dangerThreshold && this.getLivingCount() > 0

    return { isDanger, distance: minDistance }
  }

  private checkExplosionDamage(impact: { x: number; y: number; z: number }, radius: number, damage: number, caliber: string): void {
    let friendlyFireCount = 0

    for (const s of this.squad) {
      if (!s.isAlive) continue
      const dx = s.position.x - impact.x
      const dz = s.position.z - impact.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < radius) {
        const falloff = Math.max(0, 1 - Math.pow(dist / radius, 1.5))
        const actualDmg = damage * falloff
        s.health = Math.max(0, s.health - actualDmg)

        if (s.health <= 0) {
          s.isAlive = false
          if (caliber === '105mm' || caliber === '40mm') {
            friendlyFireCount++
          }
        }
      }
    }

    this.updateMeshPositions()

    if (friendlyFireCount > 0) {
      events.emit('FRIENDLY_FIRE_INCIDENT', { killedCount: friendlyFireCount })
    } else if (this.getLivingCount() === 0) {
      events.emit('SQUAD_KIA_INCIDENT', true)
    }
  }
}

export const squadAI = SquadAIController.getInstance()
