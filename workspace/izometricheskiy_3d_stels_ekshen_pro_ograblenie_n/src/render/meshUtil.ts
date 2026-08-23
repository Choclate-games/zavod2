import * as THREE from 'three'

/** Слияние простых геометрий в один буфер: меньше мешей — меньше draw calls. */
export function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vertexCount = 0
  const prepared: THREE.BufferGeometry[] = []
  for (const geo of list) {
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo
    prepared.push(nonIndexed)
    vertexCount += nonIndexed.getAttribute('position').count
  }
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  let offset = 0
  for (const geo of prepared) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    positions.set(pos.array as Float32Array, offset)
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute | null
    if (nor) {
      normals.set(nor.array as Float32Array, offset)
    } else {
      normals.fill(0, offset, offset + pos.count * 3)
    }
    offset += pos.count * 3
  }
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  result.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return result
}
