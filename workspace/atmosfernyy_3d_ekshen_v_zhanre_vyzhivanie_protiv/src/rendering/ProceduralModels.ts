import * as THREE from 'three'

/**
 * Процедурная геометрия острова и маяка: ни одного внешнего GLTF.
 * Силуэт читается издали: гранитная башня с латунным куполом, мокрый базальт,
 * рёбра утёсов. Материалы дешёвые (Lambert), metalness не используется.
 */
export function buildIsland(): THREE.Group {
  const island = new THREE.Group()

  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1e28 })
  const rockTop = new THREE.CylinderGeometry(26, 29, 5, 26, 2)
  jitterVertices(rockTop, 0.9, 7)
  const rockMesh = new THREE.Mesh(rockTop, rockMaterial)
  rockMesh.position.y = -2.5
    island.add(rockMesh)

  // Плато под башней чуть выше основного камня.
  const plateau = new THREE.CylinderGeometry(8, 11, 1.4, 18)
  jitterVertices(plateau, 0.35, 3)
  const plateauMesh = new THREE.Mesh(plateau, rockMaterial)
  plateauMesh.position.y = 0.6
    island.add(plateauMesh)

  // Рёбра утёсов: сплюснутые додекаэдры по кромке.
  const cragGeometry = new THREE.DodecahedronGeometry(3.2, 0)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.35
    const crag = new THREE.Mesh(cragGeometry, rockMaterial)
    crag.position.set(Math.cos(angle) * 25.5, -1.4, Math.sin(angle) * 25.5)
    crag.scale.set(1.4, 0.8 + (i % 3) * 0.35, 1.2)
    crag.rotation.y = angle
    island.add(crag)
  }

  return island
}

export interface LighthouseParts {
  group: THREE.Group
  /** Узел фонаря: луч и вращающаяся маска крепятся сюда. */
  lampHead: THREE.Group
}

export function buildLighthouse(): LighthouseParts {
  const group = new THREE.Group()
  const granite = new THREE.MeshLambertMaterial({ color: 0x2a2f3c })
  const graniteDark = new THREE.MeshLambertMaterial({ color: 0x20242f })
  const brass = new THREE.MeshLambertMaterial({ color: 0x8a6534, emissive: 0x241505 })

  const base = new THREE.CylinderGeometry(5.2, 6.4, 3.2, 20)
  const baseMesh = new THREE.Mesh(base, graniteDark)
  baseMesh.position.y = 1.6
  group.add(baseMesh)

  const shaft = new THREE.CylinderGeometry(3.1, 4.6, 12.5, 16)
  const shaftMesh = new THREE.Mesh(shaft, granite)
  shaftMesh.position.y = 9.2
    group.add(shaftMesh)

  // Тёмные пояса кладки.
  for (let i = 0; i < 3; i++) {
    const band = new THREE.CylinderGeometry(
      3.85 - i * 0.42,
      4.05 - i * 0.42,
      0.55,
      16,
    )
    const bandMesh = new THREE.Mesh(band, graniteDark)
    bandMesh.position.y = 5.6 + i * 3.6
    group.add(bandMesh)
  }

  const gallery = new THREE.CylinderGeometry(4.4, 4.4, 0.6, 20)
  const galleryMesh = new THREE.Mesh(gallery, graniteDark)
  galleryMesh.position.y = 15.75
  group.add(galleryMesh)

  const lampHead = new THREE.Group()
  lampHead.position.y = 15.9

  const lampRoom = new THREE.CylinderGeometry(2.1, 2.1, 2.6, 14)
  const lampRoomMesh = new THREE.Mesh(
    lampRoom,
    new THREE.MeshLambertMaterial({
      color: 0xffd98a,
      emissive: 0xcf9a3f,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
    }),
  )
  lampRoomMesh.position.y = 1.5
  lampHead.add(lampRoomMesh)

  const dome = new THREE.ConeGeometry(2.4, 1.8, 14)
  const domeMesh = new THREE.Mesh(dome, brass)
  domeMesh.position.y = 3.7
  lampHead.add(domeMesh)

  const finial = new THREE.SphereGeometry(0.32, 8, 6)
  const finialMesh = new THREE.Mesh(finial, brass)
  finialMesh.position.y = 4.8
  lampHead.add(finialMesh)

  group.add(lampHead)
  return { group, lampHead }
}

/** Детерминированное взволнование вершин: камень не должен выглядеть токарным. */
function jitterVertices(geometry: THREE.BufferGeometry, amplitude: number, seed: number): void {
  const position = geometry.attributes.position as THREE.BufferAttribute
  let state = seed * 1013
  for (let i = 0; i < position.count; i++) {
    state = (state * 16807) % 2147483647
    const noiseA = ((state / 2147483647) - 0.5) * amplitude
    state = (state * 16807) % 2147483647
    const noiseB = ((state / 2147483647) - 0.5) * amplitude
    state = (state * 16807) % 2147483647
    const noiseC = ((state / 2147483647) - 0.5) * amplitude
    position.setX(i, position.getX(i) + noiseA)
    position.setY(i, position.getY(i) + noiseB)
    position.setZ(i, position.getZ(i) + noiseC)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
}
