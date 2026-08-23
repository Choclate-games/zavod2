import * as THREE from 'three'

/**
 * Процедурная геометрия арктической сцены. Никаких внешних GLTF:
 * вся графика собирается кодом. Геометрии и материалы создаются один раз
 * и переиспользуются между экземплярами.
 */
export const TUBE_COLORS: ReadonlyArray<number> = [
  0xff6b35, 0x9ef01a, 0x7b2ff7, 0xf72585, 0x00f5d4, 0xffd166, 0x4cc9f0, 0xc9184a,
]

export const ICE_TOP_COLOR = 0xa8e6f0
const PI2 = Math.PI * 2

/** Надувной тюбинг: тор + неоновый обод + пилот. Собирается в одну группу. */
export function buildTubeView(colorIndex: number): { group: THREE.Group; rim: THREE.Mesh } {
  const group = new THREE.Group()
  const color = TUBE_COLORS[colorIndex % TUBE_COLORS.length]

  const tireGeometry = new THREE.TorusGeometry(0.62, 0.26, 12, 24)
  const tireMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 })
  const tire = new THREE.Mesh(tireGeometry, tireMaterial)
  tire.rotation.x = Math.PI / 2
  group.add(tire)

  const rimMaterial = new THREE.MeshBasicMaterial({ color })
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.055, 8, 28), rimMaterial)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.18
  group.add(rim)

  const pilotBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.3, 6, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  )
  pilotBody.position.y = 0.34
  group.add(pilotBody)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf1faee, roughness: 0.7 }),
  )
  head.position.y = 0.72
  group.add(head)

  return { group, rim }
}

/**
 * Призма-сектор кольца льдины: верх в y=0, низ на глубину height.
 * Внутреннее кольцо — сектор от центра (innerR=0).
 */
export function buildIcePlateGeometry(innerR: number, outerR: number, sectorAngle: number, height: number): THREE.BufferGeometry {
  const steps = 6
  const positions: number[] = []
  const indices: number[] = []

  for (let s = 0; s <= steps; s++) {
    const angle = sectorAngle * (s / steps) - sectorAngle / 2
    const sinA = Math.sin(angle)
    const cosA = Math.cos(angle)
    // верх внутренний, верх внешний, низ внутренний, низ внешний
    positions.push(sinA * innerR, 0, cosA * innerR)
    positions.push(sinA * outerR, 0, cosA * outerR)
    positions.push(sinA * innerR, -height, cosA * innerR)
    positions.push(sinA * outerR, -height, cosA * outerR)
  }
  const row = 4
  for (let s = 0; s < steps; s++) {
    const b = s * row
    // Верхняя грань.
    indices.push(b + 1, b, b + row, b + 1, b + row, b + row + 1)
    // Нижняя грань.
    indices.push(b + 2, b + 3, b + row + 2, b + row + 2, b + 3, b + row + 3)
    // Внутренняя стенка.
    indices.push(b, b + 2, b + row + 2, b, b + row + 2, b + row)
    // Внешняя стенка.
    indices.push(b + 3, b + 1, b + row + 1, b + 3, b + row + 1, b + row + 3)
  }
  // Торцевые стенки сектора.
  const last = steps * row
  indices.push(0, 1, 2, 2, 1, 3)
  indices.push(last, last + 2, last + 1, last + 1, last + 2, last + 3)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Океан: большой круг с лёгким смещением вершин под волны. */
export function buildOcean(radius: number): THREE.Mesh {
  const segments = 48
  const geometry = new THREE.CircleGeometry(radius, segments, 0, PI2)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.MeshStandardMaterial({
    color: 0x0b2545,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.94,
  })
  return new THREE.Mesh(geometry, material)
}

/** Северное сияние: полупрозрачные изогнутые плоскости в небе. */
export function buildAurora(): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color: 0x00f5d4,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const secondMaterial = new THREE.MeshBasicMaterial({
    color: 0x7b2ff7,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(160, 30, 24, 6), i === 1 ? secondMaterial : material)
    plane.position.set((i - 1) * 40, 34 + i * 8, -90 - i * 12)
    plane.rotation.z = (i - 1) * 0.18
    group.add(plane)
  }
  return group
}

/** Далёкие торосы по горизонту — силуэты ледников. */
export function buildIcebergs(): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: 0xbfe8f5, roughness: 0.9, flatShading: true })
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * PI2 + 0.3
    const distance = 95 + ((i * 37) % 40)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9 + ((i * 13) % 8), 14 + ((i * 7) % 12), 5), material)
    cone.position.set(Math.sin(angle) * distance, 1, Math.cos(angle) * distance)
    cone.rotation.y = i
    group.add(cone)
  }
  return group
}
