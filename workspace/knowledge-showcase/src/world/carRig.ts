import * as THREE from 'three';

/**
 * Процедурный low-poly болид. Никаких .gltf: вся геометрия — код.
 *
 * Колёса — дети кузова (CRITICAL_RULES §61). Здесь машина кинематическая, так
 * что вращение колёс декоративное; у физической машины углы читаются из
 * контроллера — см. knowledge/threejs/vehicle_wheel_rig.md §3.
 */
export function buildCarMesh(color: number, isPlayer: boolean): THREE.Group {
  const root = new THREE.Group();

  const body = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1e2126 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd3e0, transparent: true, opacity: 0.8 });

  const chassis = mesh(new THREE.BoxGeometry(1.9, 0.5, 4.2), body);
  chassis.position.y = 0.42;
  root.add(chassis);

  const nose = mesh(new THREE.BoxGeometry(1.7, 0.28, 1.1), body);
  nose.position.set(0, 0.28, 2.0);
  root.add(nose);

  const cabin = mesh(new THREE.BoxGeometry(1.5, 0.52, 1.7), body);
  cabin.position.set(0, 0.88, -0.25);
  root.add(cabin);

  const windshield = mesh(new THREE.BoxGeometry(1.42, 0.4, 0.12), glass);
  windshield.position.set(0, 0.92, 0.6);
  windshield.rotation.x = -0.34;
  root.add(windshield);

  const spoiler = mesh(new THREE.BoxGeometry(1.85, 0.1, 0.5), dark);
  spoiler.position.set(0, 0.98, -2.0);
  root.add(spoiler);
  for (const side of [-1, 1]) {
    const stand = mesh(new THREE.BoxGeometry(0.12, 0.32, 0.12), dark);
    stand.position.set(side * 0.7, 0.8, -1.98);
    root.add(stand);
  }

  const wheelGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  wheelGeom.rotateZ(Math.PI / 2);
  for (const [sx, sz] of [[-1, 1.4], [1, 1.4], [-1, -1.45], [1, -1.45]] as const) {
    const wheel = mesh(wheelGeom, dark);
    wheel.position.set(sx * 0.95, 0.42, sz);
    root.add(wheel);
  }

  // Игрока видно с первого взгляда: без этого в толпе одинаковых машин
  // игрок теряет свою на первом же повороте.
  if (isPlayer) {
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    marker.position.y = 2.3;
    marker.rotation.x = Math.PI;
    root.add(marker);
  }

  return root;
}

function mesh(geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
