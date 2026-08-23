import * as THREE from 'three'
import { BALANCE } from '../config/balance.js'
import { SCENE_COLORS } from '../rendering/PavilionScene.js'
import type { PavilionLayout } from '../rendering/PavilionScene.js'
import type { GateSystem } from './GateSystem.js'
import type { SaboteurSystem } from './SaboteurSystem.js'
import type { AudioManager } from '../audio/AudioManager.js'

/**
 * Режиссёр маршрута: павильонные точки, световой блокинг входов,
 * таймер дубля и условия победы/провала.
 */

interface PendingEntry {
  chamberIndex: number
  delayS: number
  warnedEarly: boolean
  warnedLate: boolean
}

export class DirectorSystem {
  private elapsedS = 0
  private pointsDone = 0
  private readonly visitedChambers = new Set<number>()
  private readonly pendingEntries: PendingEntry[] = []

  marksTaken = 0
  chargesArmed = 0
  saboteursNeutralized = 0

  private finished = false

  /** Колбэки наполняет Game. */
  onFinish: ((win: boolean, reasonKey: 'fail_ammo' | 'fail_charges' | 'fail_hits' | 'fail_time' | null) => void) | null = null
  onProgressChanged: (() => void) | null = null

  private readonly lampMeshes: THREE.Mesh[] = []
  private readonly lampMaterialCalm: THREE.MeshStandardMaterial
  private readonly lampMaterialEarly: THREE.MeshStandardMaterial
  private readonly lampMaterialLate: THREE.MeshStandardMaterial

  constructor(
    private readonly layout: PavilionLayout,
    private readonly gates: GateSystem,
    private readonly saboteurs: SaboteurSystem,
    private readonly audio: AudioManager,
    scene: THREE.Scene,
  ) {
    this.lampMaterialCalm = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.blueLamp, emissive: SCENE_COLORS.blueLamp })
    this.lampMaterialEarly = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.amberNode, emissive: SCENE_COLORS.amberNode })
    this.lampMaterialLate = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.redLamp, emissive: SCENE_COLORS.redLamp })
    const lampGeometry = new THREE.SphereGeometry(0.12, 8, 6)
    for (const door of layout.spawnDoors) {
      const lamp = new THREE.Mesh(lampGeometry, this.lampMaterialCalm)
      lamp.position.set(door.x + 0.3, 3.2, door.z)
      scene.add(lamp)
      this.lampMeshes.push(lamp)
    }
  }

  get secondsLeft(): number {
    return Math.max(0, BALANCE.session.timeLimitS - this.elapsedS)
  }

  get pointsVisited(): number {
    return this.pointsDone
  }

  reset(): void {
    this.elapsedS = 0
    this.pointsDone = 0
    this.visitedChambers.clear()
    this.pendingEntries.length = 0
    this.marksTaken = 0
    this.chargesArmed = 0
    this.saboteursNeutralized = 0
    this.finished = false
    for (const lamp of this.lampMeshes) lamp.material = this.lampMaterialCalm
  }

  registerKill(): void {
    this.saboteursNeutralized++
  }

  registerPlayerHit(): boolean {
    this.marksTaken++
    if (this.marksTaken >= BALANCE.session.maxPlayerHits) {
      this.finish(false, 'fail_hits')
      return true
    }
    return false
  }

  registerCharge(): void {
    this.chargesArmed++
    this.audio.playChargeArmed()
    if (this.chargesArmed >= BALANCE.session.maxCharges) this.finish(false, 'fail_charges')
  }

  fixedUpdate(stepS: number, playerZ: number, playerX: number): void {
    if (this.finished) return
    this.elapsedS += stepS
    if (this.elapsedS >= BALANCE.session.timeLimitS) {
      this.finish(false, 'fail_time')
      return
    }

    // Павильонные точки: первое посещение центра палаты.
    for (let i = 0; i < this.layout.chamberCentersZ.length; i++) {
      const cz = this.layout.chamberCentersZ[i]
      if (!this.visitedChambers.has(i) && Math.abs(playerZ - cz) < 5) {
        this.visitedChambers.add(i)
        this.pointsDone++
        this.queueEntriesForChamber(i)
        if (this.onProgressChanged) this.onProgressChanged()
      }
    }

    // Световой блокинг: раннее и позднее предупреждение перед входом саботажника.
    for (let i = this.pendingEntries.length - 1; i >= 0; i--) {
      const entry = this.pendingEntries[i]
      entry.delayS -= stepS
      const doorIndex = entry.chamberIndex
      const lamp = this.lampMeshes[doorIndex]
      if (!entry.warnedEarly && entry.delayS <= BALANCE.svetovoyBloking.earlyWarningS) {
        entry.warnedEarly = true
        lamp.material = this.lampMaterialEarly
        this.audio.playWarnEarly()
      }
      if (!entry.warnedLate && entry.delayS <= BALANCE.svetovoyBloking.lateWarningS) {
        entry.warnedLate = true
        lamp.material = this.lampMaterialLate
        this.audio.playWarnLate()
      }
      if (entry.delayS <= 0) {
        this.pendingEntries.splice(i, 1)
        const door = this.layout.spawnDoors[doorIndex]
        const station = this.layout.pyroStations[entry.chamberIndex]
        this.saboteurs.spawn(door.x + 1, door.z, station)
        // Лампа гаснет в спокойный синий после входа.
        setTimeoutSafe(() => {
          if (lamp.material !== this.lampMaterialCalm) lamp.material = this.lampMaterialCalm
        }, 1500)
      }
    }

    void playerX
    this.checkVictory(playerZ)
  }

  private queueEntriesForChamber(chamberIndex: number): void {
    // Расписание входов: палата 0 — один саботажник, палаты 1–2 — по два
    // со сдвигом второго входа, финальная — один на пик напряжения.
    const count = chamberIndex === 0 || chamberIndex === 3 ? 1 : 2
    let baseDelay = 3.2
    for (let n = 0; n < count; n++) {
      this.pendingEntries.push({
        chamberIndex,
        delayS: baseDelay,
        warnedEarly: false,
        warnedLate: false,
      })
      baseDelay += BALANCE.svetovoyBloking.secondEntryDelayS * 4
    }
  }

  private checkVictory(playerZ: number): void {
    if (this.finished) return
    const reachedMark = playerZ <= this.layout.directorMarkZ + 1.2
    if (!reachedMark) return
    if (
      this.pointsDone >= BALANCE.session.pointsTotal &&
      this.saboteursNeutralized >= BALANCE.session.saboteursTotal &&
      this.gates.allGatesOpen
    ) {
      this.finish(true, null)
    }
  }

  private finish(win: boolean, reasonKey: 'fail_ammo' | 'fail_charges' | 'fail_hits' | 'fail_time' | null): void {
    if (this.finished) return
    this.finished = true
    if (this.onFinish) this.onFinish(win, reasonKey)
  }

  /** Подсказка режиссёра: что сейчас главное. */
  objectiveKey(aliveSaboteursNearby: boolean): string {
    if (aliveSaboteursNearby) return 'objective_stop_saboteur'
    if (this.nextGateIndex() >= 0) return 'objective_open_gate'
    if (this.pointsDone < BALANCE.session.pointsTotal) return 'objective_move_on'
    return 'objective_finish'
  }

  hasPendingEntries(): boolean {
    return this.pendingEntries.length > 0
  }

  private nextGateIndex(): number {
    for (let k = 0; k < 3; k++) {
      if (!this.gates.isGateOpen(k)) return k
    }
    return -1
  }
}

function setTimeoutSafe(cb: () => void, delayMs: number): void {
  setTimeout(() => {
    try {
      cb()
    } catch {
      /* сцена уже разобрана */
    }
  }, delayMs)
}
