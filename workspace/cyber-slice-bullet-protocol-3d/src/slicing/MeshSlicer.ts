import * as THREE from 'three';

export interface SliceResult {
  success: boolean;
  upperMesh?: THREE.Mesh;
  lowerMesh?: THREE.Mesh;
  sliceCenterWorld?: THREE.Vector3;
}

export class MeshSlicer {
  private static moltenMaterial: THREE.MeshBasicMaterial | null = null;

  public static getMoltenMaterial(): THREE.MeshBasicMaterial {
    if (!MeshSlicer.moltenMaterial) {
      MeshSlicer.moltenMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: false,
        side: THREE.DoubleSide
      });
    }
    return MeshSlicer.moltenMaterial;
  }

  public static sliceMesh(
    mesh: THREE.Mesh,
    planePointWorld: THREE.Vector3,
    planeNormalWorld: THREE.Vector3,
    sliceColor: number = 0x00f3ff
  ): SliceResult {
    if (!mesh.geometry) {
      return { success: false };
    }

    // Ensure non-indexed geometry for simplicity and robustness of cutting
    const geometry = mesh.geometry.index 
      ? mesh.geometry.toNonIndexed() 
      : mesh.geometry.clone();

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | null;
    if (!posAttr || posAttr.count < 3) {
      geometry.dispose();
      return { success: false };
    }

    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;

    // Transform world plane to local mesh coordinates
    const invMatrix = mesh.matrixWorld.clone().invert();
    const localPoint = planePointWorld.clone().applyMatrix4(invMatrix);
    const localNormal = planeNormalWorld.clone().transformDirection(invMatrix).normalize();
    const planeConstant = -localNormal.dot(localPoint);

    // Buffers for upper and lower parts
    const upperPositions: number[] = [];
    const upperNormals: number[] = [];
    const upperUVs: number[] = [];

    const lowerPositions: number[] = [];
    const lowerNormals: number[] = [];
    const lowerUVs: number[] = [];

    // Intersection segments on the slice plane (for cap generation)
    const intersectionPoints: THREE.Vector3[] = [];

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();

    const nA = new THREE.Vector3(0, 1, 0);
    const nB = new THREE.Vector3(0, 1, 0);
    const nC = new THREE.Vector3(0, 1, 0);

    const uvA = new THREE.Vector2();
    const uvB = new THREE.Vector2();
    const uvC = new THREE.Vector2();

    const triangleCount = posAttr.count / 3;

    for (let i = 0; i < triangleCount; i++) {
      const idx0 = i * 3;
      const idx1 = i * 3 + 1;
      const idx2 = i * 3 + 2;

      vA.fromBufferAttribute(posAttr, idx0);
      vB.fromBufferAttribute(posAttr, idx1);
      vC.fromBufferAttribute(posAttr, idx2);

      if (normAttr) {
        nA.fromBufferAttribute(normAttr, idx0);
        nB.fromBufferAttribute(normAttr, idx1);
        nC.fromBufferAttribute(normAttr, idx2);
      }
      if (uvAttr) {
        uvA.fromBufferAttribute(uvAttr, idx0);
        uvB.fromBufferAttribute(uvAttr, idx1);
        uvC.fromBufferAttribute(uvAttr, idx2);
      }

      const distA = localNormal.dot(vA) + planeConstant;
      const distB = localNormal.dot(vB) + planeConstant;
      const distC = localNormal.dot(vC) + planeConstant;

      const sideA = distA >= 0;
      const sideB = distB >= 0;
      const sideC = distC >= 0;

      // Case 1: All on positive side
      if (sideA && sideB && sideC) {
        this.pushTriangle(upperPositions, upperNormals, upperUVs, vA, vB, vC, nA, nB, nC, uvA, uvB, uvC);
      }
      // Case 2: All on negative side
      else if (!sideA && !sideB && !sideC) {
        this.pushTriangle(lowerPositions, lowerNormals, lowerUVs, vA, vB, vC, nA, nB, nC, uvA, uvB, uvC);
      }
      // Case 3: Intersects plane (1 on one side, 2 on the other)
      else {
        let singleV: THREE.Vector3, singleN: THREE.Vector3, singleUV: THREE.Vector2, singleDist: number, singleSide: boolean;
        let pairV1: THREE.Vector3, pairN1: THREE.Vector3, pairUV1: THREE.Vector2, pairDist1: number;
        let pairV2: THREE.Vector3, pairN2: THREE.Vector3, pairUV2: THREE.Vector2, pairDist2: number;

        if (sideA !== sideB && sideA !== sideC) {
          singleV = vA; singleN = nA; singleUV = uvA; singleDist = distA; singleSide = sideA;
          pairV1 = vB; pairN1 = nB; pairUV1 = uvB; pairDist1 = distB;
          pairV2 = vC; pairN2 = nC; pairUV2 = uvC; pairDist2 = distC;
        } else if (sideB !== sideA && sideB !== sideC) {
          singleV = vB; singleN = nB; singleUV = uvB; singleDist = distB; singleSide = sideB;
          pairV1 = vC; pairN1 = nC; pairUV1 = uvC; pairDist1 = distC;
          pairV2 = vA; pairN2 = nA; pairUV2 = uvA; pairDist2 = distA;
        } else {
          singleV = vC; singleN = nC; singleUV = uvC; singleDist = distC; singleSide = sideC;
          pairV1 = vA; pairN1 = nA; pairUV1 = uvA; pairDist1 = distA;
          pairV2 = vB; pairN2 = nB; pairUV2 = uvB; pairDist2 = distB;
        }

        // Calculate intersection points
        const t1 = singleDist / (singleDist - pairDist1);
        const t2 = singleDist / (singleDist - pairDist2);

        const intV1 = new THREE.Vector3().lerpVectors(singleV, pairV1, t1);
        const intV2 = new THREE.Vector3().lerpVectors(singleV, pairV2, t2);

        const intN1 = new THREE.Vector3().lerpVectors(singleN, pairN1, t1).normalize();
        const intN2 = new THREE.Vector3().lerpVectors(singleN, pairN2, t2).normalize();

        const intUV1 = new THREE.Vector2().lerpVectors(singleUV, pairUV1, t1);
        const intUV2 = new THREE.Vector2().lerpVectors(singleUV, pairUV2, t2);

        // Store intersection segment for cap
        intersectionPoints.push(intV1, intV2);

        if (singleSide) {
          // Single on Upper (1 triangle), Pair on Lower (2 triangles)
          this.pushTriangle(upperPositions, upperNormals, upperUVs, singleV, intV1, intV2, singleN, intN1, intN2, singleUV, intUV1, intUV2);
          this.pushTriangle(lowerPositions, lowerNormals, lowerUVs, pairV1, pairV2, intV1, pairN1, pairN2, intN1, pairUV1, pairUV2, intUV1);
          this.pushTriangle(lowerPositions, lowerNormals, lowerUVs, pairV2, intV2, intV1, pairN2, intN2, intN1, pairUV2, intUV2, intUV1);
        } else {
          // Single on Lower (1 triangle), Pair on Upper (2 triangles)
          this.pushTriangle(lowerPositions, lowerNormals, lowerUVs, singleV, intV1, intV2, singleN, intN1, intN2, singleUV, intUV1, intUV2);
          this.pushTriangle(upperPositions, upperNormals, upperUVs, pairV1, pairV2, intV1, pairN1, pairN2, intN1, pairUV1, pairUV2, intUV1);
          this.pushTriangle(upperPositions, upperNormals, upperUVs, pairV2, intV2, intV1, pairN2, intN2, intN1, pairUV2, intUV2, intUV1);
        }
      }
    }

    geometry.dispose();

    if (upperPositions.length === 0 || lowerPositions.length === 0) {
      return { success: false };
    }

    // Build Cap Faces along cut surface
    let centerWorld = mesh.position.clone();
    if (intersectionPoints.length >= 2) {
      const centroid = new THREE.Vector3();
      for (const p of intersectionPoints) {
        centroid.add(p);
      }
      centroid.divideScalar(intersectionPoints.length);

      centerWorld = centroid.clone().applyMatrix4(mesh.matrixWorld);

      const capNormUpper = localNormal.clone().negate();
      const capNormLower = localNormal.clone();
      const capUV = new THREE.Vector2(0.5, 0.5);

      for (let j = 0; j < intersectionPoints.length; j += 2) {
        const p1 = intersectionPoints[j];
        const p2 = intersectionPoints[j + 1];

        // Upper Cap
        this.pushTriangle(
          upperPositions, upperNormals, upperUVs,
          centroid, p1, p2,
          capNormUpper, capNormUpper, capNormUpper,
          capUV, capUV, capUV
        );

        // Lower Cap (inverted winding)
        this.pushTriangle(
          lowerPositions, lowerNormals, lowerUVs,
          centroid, p2, p1,
          capNormLower, capNormLower, capNormLower,
          capUV, capUV, capUV
        );
      }
    }

    // Build Upper BufferGeometry
    const upperGeo = new THREE.BufferGeometry();
    upperGeo.setAttribute('position', new THREE.Float32BufferAttribute(upperPositions, 3));
    upperGeo.setAttribute('normal', new THREE.Float32BufferAttribute(upperNormals, 3));
    upperGeo.setAttribute('uv', new THREE.Float32BufferAttribute(upperUVs, 2));

    // Build Lower BufferGeometry
    const lowerGeo = new THREE.BufferGeometry();
    lowerGeo.setAttribute('position', new THREE.Float32BufferAttribute(lowerPositions, 3));
    lowerGeo.setAttribute('normal', new THREE.Float32BufferAttribute(lowerNormals, 3));
    lowerGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lowerUVs, 2));

    // Materials with neon slice edge
    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const clonedMat = origMat ? origMat.clone() : new THREE.MeshStandardMaterial({ color: 0x8899aa });

    // Neon emissive glow on slice
    if ('emissive' in clonedMat) {
      (clonedMat as THREE.MeshStandardMaterial).emissive.setHex(sliceColor);
      (clonedMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;
    }

    const upperMesh = new THREE.Mesh(upperGeo, clonedMat);
    const lowerMesh = new THREE.Mesh(lowerGeo, clonedMat.clone());

    upperMesh.position.copy(mesh.position);
    upperMesh.rotation.copy(mesh.rotation);
    upperMesh.scale.copy(mesh.scale);

    lowerMesh.position.copy(mesh.position);
    lowerMesh.rotation.copy(mesh.rotation);
    lowerMesh.scale.copy(mesh.scale);

    upperMesh.castShadow = true;
    lowerMesh.castShadow = true;

    return {
      success: true,
      upperMesh,
      lowerMesh,
      sliceCenterWorld: centerWorld
    };
  }

  private static pushTriangle(
    positions: number[],
    normals: number[],
    uvs: number[],
    v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3,
    n1: THREE.Vector3, n2: THREE.Vector3, n3: THREE.Vector3,
    uv1: THREE.Vector2, uv2: THREE.Vector2, uv3: THREE.Vector2
  ): void {
    positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
    normals.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n3.x, n3.y, n3.z);
    uvs.push(uv1.x, uv1.y, uv2.x, uv2.y, uv3.x, uv3.y);
  }
}
