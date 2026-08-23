import * as THREE from 'three'
import type { BanquetHall } from '../entities/BanquetHall.ts'
import type { Stuntman } from '../entities/Stuntman.ts'

/**
 * Процедурные модели банкетного зала в стиле рококо: без внешних ассетов и
 * без серых кубов. Меши создаются один раз; в кадре — только запись трансформов
 * из физики в закэшированные объекты, без аллокаций.
 */
const COLORS = {
  tuxedo: 0x1c1c24,
  cream: 0xf7e7ce,
  cakeWhite: 0xfffdd0,
  crimson: 0x7b1113,
  gold: 0xd4af37,
  crystal: 0xa4d8e8,
}

type BodyLike = {
  translation(): { x: number; y: number; z: number }
  rotation(): { x: number; y: number; z: number; w: number }
}

interface SyncedMesh {
  mesh: THREE.Object3D
  body: BodyLike
}

export class HallRenderer {
  private readonly root = new THREE.Group()
  private readonly stuntmanSync = new Map<string, SyncedMesh>()
  private readonly chandelierSync: SyncedMesh[] = []
  private readonly tableSync: SyncedMesh[] = []
  private readonly tierSync: SyncedMesh[] = []
  private readonly cableMeshes: THREE.Mesh[] = []
  private readonly glassInstanced: THREE.InstancedMesh
  private readonly guestBodyInstanced: THREE.InstancedMesh
  private readonly guestHeadInstanced: THREE.InstancedMesh
  private pressureGauge: THREE.Mesh | null = null
  private launchBand: THREE.Mesh | null = null
  private readonly dummy = new THREE.Object3D()
  private readonly tmpQuat = new THREE.Quaternion()

  constructor(
    scene: THREE.Scene,
    private readonly hall: BanquetHall,
    private readonly stuntman: Stuntman,
  ) {
    scene.add(this.root)

    const goldMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.35, metalness: 0.4 })
    const creamMat = new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.9 })

    // Пол, ковровая дорожка, стены.
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.4, 40),
      new THREE.MeshStandardMaterial({ color: COLORS.tuxedo, roughness: 0.85 }),
    )
    floor.position.set(0, -0.2, -4)
    floor.receiveShadow = true
    this.root.add(floor)

    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.06, 36),
      new THREE.MeshStandardMaterial({ color: COLORS.crimson, roughness: 0.95 }),
    )
    carpet.position.set(0, 0.03, -4)
    carpet.receiveShadow = true
    this.root.add(carpet)

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 0.6), creamMat)
    wallBack.position.set(0, 6, -24.7)
    this.root.add(wallBack)
    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 12, 41), creamMat)
    wallLeft.position.set(-14.7, 6, -4)
    this.root.add(wallLeft)
    const wallRight = wallLeft.clone()
    wallRight.position.x = 14.7
    this.root.add(wallRight)

    // Витражные окна.
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd98a })
    for (let i = -1; i <= 1; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), windowMaterial)
      win.position.set(i * 4.6, 6, -24.35)
      this.root.add(win)
    }

    // Колонны с золотыми капителями.
    for (const sx of [-9, 9]) {
      for (const sz of [-16, -8, 2]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 12, 10), creamMat)
        col.position.set(sx, 6, sz)
        col.castShadow = true
        this.root.add(col)
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.4, 10), goldMat)
        cap.position.set(sx, 11.8, sz)
        this.root.add(cap)
      }
    }

    this.buildChandeliers(goldMat)
    this.buildCake(goldMat)
    this.buildTables(goldMat)

    // Пирамида бокалов шампанского — инстансы по числу физических бокалов.
    this.glassInstanced = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.06, 0.22, 8),
      new THREE.MeshStandardMaterial({
        color: COLORS.crystal, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8,
      }),
      Math.max(hall.glasses.length, 1),
    )
    this.glassInstanced.castShadow = true
    this.root.add(this.glassInstanced)

    // Гости: тёмные наряды и светлые лица — по инстансу на часть тела.
    this.guestBodyInstanced = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.22, 0.56, 4, 8),
      new THREE.MeshStandardMaterial({ color: COLORS.tuxedo, roughness: 0.9 }),
      Math.max(hall.guests.length, 1),
    )
    this.guestBodyInstanced.castShadow = true
    this.guestHeadInstanced = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.7 }),
      Math.max(hall.guests.length, 1),
    )
    this.root.add(this.guestBodyInstanced, this.guestHeadInstanced)

    this.buildCatapult(goldMat)
    this.buildStuntman()
    this.syncAll()
  }

  private buildChandeliers(goldMat: THREE.Material): void {
    const crystalMat = new THREE.MeshStandardMaterial({
      color: COLORS.crystal, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.85,
    })
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.6 })
    this.hall.chandeliers.forEach((chandelier) => {
      const group = new THREE.Group()
      // Хрустальные подвески — один InstancedMesh на люстру вместо 18 мешей.
      const crystals: Array<[number, number, number]> = []
      for (let ring = 0; ring < 3; ring++) {
        const radius = 0.95 - ring * 0.28
        const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 6, 18), goldMat)
        ringMesh.rotation.x = Math.PI / 2
        ringMesh.position.y = ring * 0.22
        group.add(ringMesh)
        const pendants = 8 - ring * 2
        for (let p = 0; p < pendants; p++) {
          const angle = (p / pendants) * Math.PI * 2
          crystals.push([Math.cos(angle) * radius, ring * 0.22 - 0.14, Math.sin(angle) * radius])
        }
      }
      const crystalInstanced = new THREE.InstancedMesh(
        new THREE.OctahedronGeometry(0.09),
        crystalMat,
        crystals.length,
      )
      for (let c = 0; c < crystals.length; c++) {
        const spot3 = crystals[c]
        if (!spot3) continue
        this.dummy.position.set(spot3[0], spot3[1], spot3[2])
        this.dummy.scale.setScalar(1)
        this.dummy.updateMatrix()
        crystalInstanced.setMatrixAt(c, this.dummy.matrix)
      }
      group.add(crystalInstanced)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), goldMat)
      stem.position.y = 0.6
      group.add(stem)
      group.traverse((obj) => { obj.castShadow = true })
      group.position.set(chandelier.anchor.x, chandelier.anchor.y - 1.6, chandelier.anchor.z)
      this.root.add(group)
      this.chandelierSync.push({ mesh: group, body: chandelier.body })

      // Трос подвеса — тонкий цилиндр от якоря до корпуса.
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), cableMat)
      cable.position.set(
        chandelier.anchor.x,
        chandelier.anchor.y - 1.6 + 0.8,
        chandelier.anchor.z,
      )
      this.root.add(cable)
      this.cableMeshes.push(cable)
    })
  }

  private buildCake(goldMat: THREE.Material): void {
    const tierMaterial = new THREE.MeshStandardMaterial({ color: COLORS.cakeWhite, roughness: 0.55 })
    const creamTrimMaterial = new THREE.MeshStandardMaterial({ color: 0xff9ec7, roughness: 0.5 })
    const figurineMaterial = goldMat
    this.hall.tiers.forEach((tier, index) => {
      const size = 1.5 - index * 0.24
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size / 2, 0.62, 20), tierMaterial)
      mesh.castShadow = true
      if (index === 4) {
        // Фигурки жениха и невесты на верхушке.
        for (const side of [-1, 1]) {
          const figurine = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 3, 6), figurineMaterial)
          figurine.position.set(side * 0.12, 0.42, 0)
          mesh.add(figurine)
        }
      }
      const trimGeo = new THREE.TorusGeometry(Math.max(size / 2 - 0.02, 0.05), 0.05, 6, 20)
      trimGeo.rotateX(Math.PI / 2)
      trimGeo.translate(0, -0.26, 0)
      mesh.add(new THREE.Mesh(trimGeo, creamTrimMaterial))
      this.root.add(mesh)
      this.tierSync.push({ mesh, body: tier.body })
    })
  }

  private buildTables(goldMat: THREE.Material): void {
    const tableTopMaterial = new THREE.MeshStandardMaterial({ color: COLORS.crimson, roughness: 0.9 })
    this.hall.tables.forEach((table) => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.8), tableTopMaterial)
      top.castShadow = true
      top.receiveShadow = true
      const rim = new THREE.Mesh(new THREE.BoxGeometry(3.34, 0.06, 1.94), goldMat)
      rim.position.y = -0.1
      top.add(rim)
      this.root.add(top)
      this.tableSync.push({ mesh: top, body: table.body })
    })
  }

  private buildCatapult(goldMat: THREE.Material): void {
    const catapult = new THREE.Group()
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 })
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 2.4), woodMat)
    base.position.y = 0.5
    base.castShadow = true
    catapult.add(base)
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.16, 12)
    for (const sx of [-0.85, 0.85]) {
      for (const sz of [-0.8, 0.8]) {
        const wheel = new THREE.Mesh(wheelGeo, woodMat)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(sx, 0.45, sz)
        catapult.add(wheel)
      }
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), goldMat)
      arm.position.set(side * 0.5, 1.6, 0.4)
      arm.rotation.x = -0.5
      catapult.add(arm)
    }
    // Манометр давления пружины — состояние выводится миром.
    this.pressureGauge = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.cream }),
    )
    this.pressureGauge.position.set(0.82, 1.1, 0.95)
    this.pressureGauge.rotation.y = -Math.PI / 2.6
    catapult.add(this.pressureGauge)
    // Лента рогатки — растягивается при натяжении.
    this.launchBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1, 6),
      new THREE.MeshStandardMaterial({ color: COLORS.crimson, roughness: 0.7 }),
    )
    this.launchBand.visible = false
    catapult.add(this.launchBand)
    catapult.position.set(0, 0, 8)
    this.root.add(catapult)
  }

  private buildStuntman(): void {
    // Смокинг: тёмный корпус и конечности, белая грудка, бабочка на шее.
    const suitMat = new THREE.MeshStandardMaterial({ color: COLORS.tuxedo, roughness: 0.7 })
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    const skinMat = new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.7 })
    const specs: Record<string, [number, number, number, THREE.Material]> = {
      pelvis: [0.18, 0.12, 0.12, suitMat],
      torso: [0.18, 0.22, 0.13, suitMat],
      head: [0.11, 0.12, 0.11, skinMat],
      armUpperL: [0.07, 0.16, 0.07, suitMat],
      armUpperR: [0.07, 0.16, 0.07, suitMat],
      armLowerL: [0.06, 0.15, 0.06, shirtMat],
      armLowerR: [0.06, 0.15, 0.06, shirtMat],
      thighL: [0.08, 0.19, 0.09, suitMat],
      thighR: [0.08, 0.19, 0.09, suitMat],
      shinL: [0.07, 0.18, 0.08, suitMat],
      shinR: [0.07, 0.18, 0.08, suitMat],
    }
    for (const [name, part] of this.stuntman.parts.entries()) {
      const spec = specs[name]
      if (!spec) continue
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec[0] * 2, spec[1] * 2, spec[2] * 2), spec[3])
      mesh.castShadow = true
      if (name === 'torso') {
        const chest = new THREE.Mesh(new THREE.BoxGeometry(spec[0], spec[1] * 1.6, 0.04), shirtMat)
        chest.position.z = spec[2]
        mesh.add(chest)
        const bowtie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.04), new THREE.MeshStandardMaterial({ color: COLORS.crimson }))
        bowtie.position.set(0, spec[1] * 0.8, spec[2])
        mesh.add(bowtie)
      }
      this.root.add(mesh)
      this.stuntmanSync.set(name, { mesh, body: part.body })
    }
  }

  setPressure(pullFraction: number): void {
    if (!this.pressureGauge) return
    // Давление читается поворотом стрелки-манометра на катапульте.
    this.pressureGauge.scale.setScalar(1 + pullFraction * 0.35)
    if (this.launchBand) this.launchBand.visible = pullFraction > 0.01
    if (this.launchBand && pullFraction > 0.01) {
      this.launchBand.scale.y = 0.5 + pullFraction * 2
    }
  }

  update(dtReal: number): void {
    void dtReal
    this.syncAll()
  }

  private syncAll(): void {
    for (const item of this.stuntmanSync.values()) this.applyBody(item)
    for (const item of this.chandelierSync) this.applyBody(item)
    for (const item of this.tableSync) this.applyBody(item)
    for (const item of this.tierSync) this.applyBody(item)

    // Тросы исчезают у сорванных люстр.
    this.hall.chandeliers.forEach((chandelier, index) => {
      const cable = this.cableMeshes[index]
      if (cable) cable.visible = !chandelier.snapped
    })

    this.syncGlasses()
    this.syncGuests()
  }

  private applyBody(item: SyncedMesh): void {
    const t = item.body.translation()
    const r = item.body.rotation()
    item.mesh.position.set(t.x, t.y, t.z)
    this.tmpQuat.set(r.x, r.y, r.z, r.w)
    item.mesh.quaternion.copy(this.tmpQuat)
  }

  private syncGlasses(): void {
    for (let i = 0; i < this.hall.glasses.length && i < this.glassInstanced.count; i++) {
      const glass = this.hall.glasses[i]
      if (!glass) break
      const t = glass.body.translation()
      const r = glass.body.rotation()
      this.dummy.position.set(t.x, t.y, t.z)
      this.dummy.quaternion.set(r.x, r.y, r.z, r.w)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.glassInstanced.setMatrixAt(i, this.dummy.matrix)
    }
    this.glassInstanced.instanceMatrix.needsUpdate = true
  }

  private syncGuests(): void {
    let visibleCount = 0
    for (let i = 0; i < this.hall.guests.length && i < this.guestBodyInstanced.count; i++) {
      const guest = this.hall.guests[i]
      if (!guest) break
      const t = guest.body.translation()
      const r = guest.body.rotation()
      this.dummy.position.set(t.x, t.y, t.z)
      this.dummy.quaternion.set(r.x, r.y, r.z, r.w)
      this.dummy.updateMatrix()
      this.guestBodyInstanced.setMatrixAt(i, this.dummy.matrix)
      this.dummy.position.set(t.x, t.y + 0.52, t.z)
      this.dummy.quaternion.set(r.x, r.y, r.z, r.w)
      this.dummy.updateMatrix()
      this.guestHeadInstanced.setMatrixAt(i, this.dummy.matrix)
      visibleCount++
    }
    this.guestBodyInstanced.count = visibleCount
    this.guestHeadInstanced.count = visibleCount
    this.guestBodyInstanced.instanceMatrix.needsUpdate = true
    this.guestHeadInstanced.instanceMatrix.needsUpdate = true
  }
}
