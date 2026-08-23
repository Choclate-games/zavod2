import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { BALANCE } from '../config/balance.js'
import { SCENE_COLORS } from '../rendering/PavilionScene.js'
import type { PhysicsWorld } from '../physics/PhysicsWorld.js'
import type { PavilionLayout } from '../rendering/PavilionScene.js'
import { raySphere } from './RayMath.js'

/**
 * Цепная декорация: фасады переходов из 2–4 звеньев с узлами-опорами.
 * Выстрел в узел запускает физическую цепь: импульс первого звена через
 * задержку передаётся соседним, геометрия падения зависит от направления.
 */

interface Panel {
  gateIndex: number
  slot: number
  mesh: THREE.Mesh
  body: RAPIER.RigidBody | null
  collider: RAPIER.Collider | null
  homeX: number
  homeY: number
  homeZ: number
  hx: number
  hy: number
  hz: number
  released: boolean
}

interface ChainTask {
  gateIndex: number
  slot: number
  delayS: number
}

interface Spotlight {
  chamberIndex: number
  pivot: THREE.Group
  fixtureMesh: THREE.Mesh
  light: THREE.SpotLight
  target: THREE.Object3D
  baseX: number
  baseZ: number
  body: RAPIER.RigidBody | null
  collider: RAPIER.Collider | null
  destroyed: boolean
}

const PANELS_PER_GATE = 3

export class GateSystem {
  private readonly panels: Panel[] = []
  private readonly nodes: { gateIndex: number; x: number; y: number; z: number; mesh: THREE.Mesh; broken: boolean }[] = []
  private readonly tasks: ChainTask[] = []
  private readonly spotlights: Spotlight[] = []

  private readonly panelGeometry = new THREE.BoxGeometry(2, 2, 2)
  private readonly nodeGeometry = new THREE.SphereGeometry(BALANCE.vystrelMontazh.nodeRadiusM, 10, 8)

  private readonly facadeMaterial: THREE.MeshStandardMaterial
  private readonly facadeAccentMaterial: THREE.MeshStandardMaterial
  private readonly nodeMaterialActive: THREE.MeshStandardMaterial
  private readonly nodeMaterialBroken: THREE.MeshStandardMaterial
  private readonly fixtureMaterial: THREE.MeshStandardMaterial

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    layout: PavilionLayout,
    private readonly onDestroyed: (kind: 'panel' | 'spotlight', x: number, y: number, z: number) => void,
    private readonly onChainCrack: () => void,
  ) {
    this.facadeMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.facade, roughness: 0.75, metalness: 0.08 })
    this.facadeAccentMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.facadePanel, roughness: 0.75, metalness: 0.08 })
    this.nodeMaterialActive = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.amberNode, roughness: 0.4, metalness: 0.2, emissive: 0x664200 })
    this.nodeMaterialBroken = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.9, metalness: 0 })
    this.fixtureMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.metalDark, roughness: 0.5, metalness: 0.35 })

    for (let k = 0; k < layout.gatePositionsZ.length; k++) {
      const gz = layout.gatePositionsZ[k]
      const panelW = 13 / PANELS_PER_GATE
      for (let s = 0; s < PANELS_PER_GATE; s++) {
        const px = -6.5 + panelW * (s + 0.5)
        const py = 2.5
        const hx = panelW / 2 - 0.03
        const mesh = new THREE.Mesh(this.panelGeometry, s === 1 ? this.facadeAccentMaterial : this.facadeMaterial)
        mesh.scale.set(hx, 2.5, 0.22)
        mesh.position.set(px, py, gz)
        scene.add(mesh)
        const collider = this.physics.createStaticBox(hx, 2.5, 0.22, px, py, gz)
        // Тело стоит за коллайдером: забираем его для перевода в динамику.
        const body = collider.parent()
        this.panels.push({
          gateIndex: k, slot: s, mesh, body, collider,
          homeX: px, homeY: py, homeZ: gz, hx, hy: 2.5, hz: 0.22,
          released: false,
        })
      }
      // Узел цепи у основания центральной панели.
      const nodeMesh = new THREE.Mesh(this.nodeGeometry, this.nodeMaterialActive)
      nodeMesh.position.set(6.5 - panelW / 2, 0.45, gz + 0.35)
      scene.add(nodeMesh)
      this.nodes.push({ gateIndex: k, x: nodeMesh.position.x, y: nodeMesh.position.y, z: nodeMesh.position.z, mesh: nodeMesh, broken: false })
    }

    // Прожекторы над палатами: их разрушение открывает расширенный обзор.
    for (let i = 0; i < layout.chamberCentersZ.length; i++) {
      const cz = layout.chamberCentersZ[i]
      const pivot = new THREE.Group()
      pivot.position.set(2.4, 7.7, cz)
      const fixtureMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 0.5, 10),
        this.fixtureMaterial,
      )
      fixtureMesh.rotation.x = Math.PI / 2
      pivot.add(fixtureMesh)

      const light = new THREE.SpotLight(SCENE_COLORS.blueLamp, 260, 26, (BALANCE.svetovoyBloking.coneAngleDeg * Math.PI) / 180, 0.55, 1.4)
      light.position.set(0, 0, 0)
      const target = new THREE.Object3D()
      target.position.set(-1.2, 0, -1.6)
      pivot.add(target)
      light.target = target
      pivot.add(light)
      scene.add(pivot)

      this.spotlights.push({
        chamberIndex: i, pivot, fixtureMesh, light, target,
        baseX: 2.4, baseZ: cz,
        body: null, collider: null,
        destroyed: false,
      })
    }
  }

  get allGatesOpen(): boolean {
    return this.panels.every((p) => p.released)
  }

  isGateOpen(gateIndex: number): boolean {
    return this.panels.filter((p) => p.gateIndex === gateIndex).every((p) => p.released)
  }

  /**
   * Поиск узла цепи или прожектора вдоль луча выстрела.
   * Возвращает дистанцию до цели и её описание либо null.
   */
  findHit(
    origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number,
  ): { kind: 'node' | 'spotlight'; gateIndex: number; chamberIndex: number; dist: number } | null {
    let best: { kind: 'node' | 'spotlight'; gateIndex: number; chamberIndex: number; dist: number } | null = null
    for (const node of this.nodes) {
      if (node.broken) continue
      const d = raySphere(origin, dir, node.x, node.y, node.z, BALANCE.vystrelMontazh.nodeRadiusM * 1.15)
      if (d >= 0 && d <= maxDist && (!best || d < best.dist)) {
        best = { kind: 'node', gateIndex: node.gateIndex, chamberIndex: -1, dist: d }
      }
    }
    for (const sp of this.spotlights) {
      if (sp.destroyed) continue
      const p = sp.pivot.position
      const d = raySphere(origin, dir, p.x, p.y, p.z, 0.45)
      if (d >= 0 && d <= maxDist && (!best || d < best.dist)) {
        best = { kind: 'spotlight', gateIndex: -1, chamberIndex: sp.chamberIndex, dist: d }
      }
    }
    return best
  }

  /** Выстрел в узел: первое звено получает импульс немедленно, соседи — с задержкой передачи силы. */
  breakNode(gateIndex: number, dirSign: number): void {
    this.onChainCrack()
    const impulse = BALANCE.tsepnayaDekoratsiya.impulseMs
    const node = this.nodes.find((n) => n.gateIndex === gateIndex)
    if (node) {
      node.broken = true
      node.mesh.material = this.nodeMaterialBroken
    }
    // Направление импульса определяет итоговую геометрию падения.
    this.releasePanel(gateIndex, 1, impulse * dirSign, 0)
    this.tasks.push({ gateIndex, slot: 0, delayS: BALANCE.tsepnayaDekoratsiya.forceDelayS })
    this.tasks.push({ gateIndex, slot: 2, delayS: BALANCE.tsepnayaDekoratsiya.forceDelayS * 1.4 })
  }

  destroySpotlight(chamberIndex: number, dirX: number): void {
    const sp = this.spotlights.find((s) => s.chamberIndex === chamberIndex)
    if (!sp || sp.destroyed) return
    sp.destroyed = true
    // Прожектор падает естественной гравитацией ~ время падения из баланса.
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(sp.baseX, 7.7, sp.baseZ)
      .setLinvel(dirX * 1.5, -0.5, 0)
      .setAngularDamping(0.4)
    const body = this.physics.raw.createRigidBody(bodyDesc)
    const collider = this.physics.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(0.42, 0.25, 0.42).setDensity(30),
      body,
    )
    void collider
    sp.body = body
    this.onDestroyed('spotlight', sp.baseX, 7.7, sp.baseZ)
  }

  private releasePanel(gateIndex: number, slot: number, velX: number, velZ: number): void {
    const panel = this.panels.find((p) => p.gateIndex === gateIndex && p.slot === slot)
    if (!panel || panel.released) return
    panel.released = true
    if (panel.body) {
      // Статичное тело снимается с мира явно, на его месте встаёт динамическое.
      this.physics.disposeBody(panel.body)
    }
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(panel.homeX, panel.homeY, panel.homeZ)
      .setLinvel(velX, -0.3, velZ)
      .setAngvel({ x: velX * 0.12, y: 0.05, z: 0 })
      .setLinearDamping(0.3)
      .setAngularDamping(0.7)
    const body = this.physics.raw.createRigidBody(desc)
    const collider = this.physics.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(panel.hx, panel.hy, panel.hz).setDensity(60),
      body,
    )
    void collider
    panel.body = body
    panel.collider = null
    this.onDestroyed('panel', panel.homeX, panel.homeY, panel.homeZ)
  }

  fixedUpdate(stepS: number): void {
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const task = this.tasks[i]
      task.delayS -= stepS
      if (task.delayS <= 0) {
        this.tasks.splice(i, 1)
        this.releasePanel(task.gateIndex, task.slot, BALANCE.tsepnayaDekoratsiya.impulseMs * 0.6, 0)
      }
    }
  }

  /** Синхронизация мешей ПОСЛЕ шага мира. */
  syncMeshes(): void {
    for (const panel of this.panels) {
      if (!panel.released || !panel.body) continue
      const t = panel.body.translation()
      const r = panel.body.rotation()
      panel.mesh.position.set(t.x, t.y, t.z)
      panel.mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
    for (const sp of this.spotlights) {
      if (!sp.destroyed || !sp.body) continue
      const t = sp.body.translation()
      const r = sp.body.rotation()
      sp.pivot.position.set(t.x, t.y, t.z)
      sp.pivot.quaternion.set(r.x, r.y, r.z, r.w)
      if (sp.light.visible && t.y < 6.4) {
        sp.light.visible = false
        sp.light.intensity = 0
      }
    }
  }

  /** Рестарт дубля: звенья телепортируются на места и засыпают. */
  resetAll(): void {
    this.tasks.length = 0
    for (const panel of this.panels) {
      if (panel.released && panel.body) {
        this.physics.disposeBody(panel.body)
      }
      // Пересоздаём статичный коллайдер на прежнем месте.
      panel.collider = this.physics.createStaticBox(panel.hx, panel.hy, panel.hz, panel.homeX, panel.homeY, panel.homeZ)
      panel.body = panel.collider.parent()
      panel.released = false
      panel.mesh.position.set(panel.homeX, panel.homeY, panel.homeZ)
      panel.mesh.quaternion.set(0, 0, 0, 1)
    }
    for (const node of this.nodes) {
      node.broken = false
      node.mesh.material = this.nodeMaterialActive
    }
    for (const sp of this.spotlights) {
      if (sp.destroyed && sp.body) this.physics.disposeBody(sp.body)
      sp.body = null
      sp.destroyed = false
      sp.pivot.position.set(sp.baseX, 7.7, sp.baseZ)
      sp.pivot.quaternion.set(0, 0, 0, 1)
      sp.light.visible = true
      sp.light.intensity = 260
    }
  }
}
