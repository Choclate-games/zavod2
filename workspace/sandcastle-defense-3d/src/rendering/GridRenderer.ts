import * as THREE from 'three';
import { GridManager, CELL_SIZE } from '../game/grid/GridManager.ts';

export class GridRenderer {
  private scene: THREE.Scene;
  private gridManager: GridManager;

  public groundMesh: THREE.Mesh;
  public cursorMesh: THREE.Mesh;
  public rangeIndicator: THREE.Mesh;

  public flowArrowsGroup: THREE.Group;
  public showFlowArrows: boolean = false;

  private cursorMatValid: THREE.MeshBasicMaterial;
  private cursorMatInvalid: THREE.MeshBasicMaterial;
  private cursorMatSelected: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, gridManager: GridManager) {
    this.scene = scene;
    this.gridManager = gridManager;

    // Ground Sand Plane
    const totalW = gridManager.width * CELL_SIZE;
    const totalH = gridManager.height * CELL_SIZE;

    const groundGeo = new THREE.PlaneGeometry(totalW, totalH, gridManager.width, gridManager.height);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMat = new THREE.MeshLambertMaterial({
      color: 0xF7D070,
    });

    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Subtle Grid lines
    const gridHelper = new THREE.GridHelper(
      Math.max(totalW, totalH),
      Math.max(gridManager.width, gridManager.height),
      0xD8A752,
      0xE8C165
    );
    gridHelper.position.y = 0.005;
    this.scene.add(gridHelper);

    // Hover Cursor Quad
    const cursorGeo = new THREE.PlaneGeometry(CELL_SIZE * 0.95, CELL_SIZE * 0.95);
    cursorGeo.rotateX(-Math.PI / 2);

    this.cursorMatValid = new THREE.MeshBasicMaterial({
      color: 0x2ED573,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.cursorMatInvalid = new THREE.MeshBasicMaterial({
      color: 0xFF4757,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.cursorMatSelected = new THREE.MeshBasicMaterial({
      color: 0x1E90FF,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    this.cursorMesh = new THREE.Mesh(cursorGeo, this.cursorMatValid);
    this.cursorMesh.position.y = 0.015;
    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);

    // Range Ring Indicator
    const rangeGeo = new THREE.RingGeometry(0.1, 1.0, 32);
    rangeGeo.rotateX(-Math.PI / 2);
    const rangeMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rangeIndicator = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeIndicator.position.y = 0.02;
    this.rangeIndicator.visible = false;
    this.scene.add(this.rangeIndicator);

    // Flow Arrows Group
    this.flowArrowsGroup = new THREE.Group();
    this.flowArrowsGroup.position.y = 0.02;
    this.flowArrowsGroup.visible = false;
    this.scene.add(this.flowArrowsGroup);

    this.rebuildFlowArrows();
  }

  public setCursor(cellX: number, cellZ: number, state: 'valid' | 'invalid' | 'selected'): void {
    if (!this.gridManager.isInBounds(cellX, cellZ)) {
      this.cursorMesh.visible = false;
      return;
    }

    const world = this.gridManager.cellToWorld(cellX, cellZ);
    this.cursorMesh.position.set(world.x, 0.015, world.z);
    this.cursorMesh.visible = true;

    if (state === 'valid') {
      this.cursorMesh.material = this.cursorMatValid;
    } else if (state === 'invalid') {
      this.cursorMesh.material = this.cursorMatInvalid;
    } else {
      this.cursorMesh.material = this.cursorMatSelected;
    }
  }

  public hideCursor(): void {
    this.cursorMesh.visible = false;
  }

  public showRange(worldX: number, worldZ: number, range: number): void {
    this.rangeIndicator.position.set(worldX, 0.02, worldZ);
    this.rangeIndicator.scale.set(range, range, range);
    this.rangeIndicator.visible = true;
  }

  public hideRange(): void {
    this.rangeIndicator.visible = false;
  }

  public toggleFlowArrows(): boolean {
    this.showFlowArrows = !this.showFlowArrows;
    this.flowArrowsGroup.visible = this.showFlowArrows;
    if (this.showFlowArrows) {
      this.updateFlowArrows();
    }
    return this.showFlowArrows;
  }

  public rebuildFlowArrows(): void {
    while (this.flowArrowsGroup.children.length > 0) {
      this.flowArrowsGroup.remove(this.flowArrowsGroup.children[0]);
    }

    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x167D73, transparent: true, opacity: 0.6 });
    const arrowGeo = new THREE.ConeGeometry(0.12, 0.35, 3);
    arrowGeo.rotateX(Math.PI / 2);

    for (let cz = 0; cz < this.gridManager.height; cz++) {
      for (let cx = 0; cx < this.gridManager.width; cx++) {
        const world = this.gridManager.cellToWorld(cx, cz);
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.set(world.x, 0, world.z);
        arrow.name = `arrow_${cx}_${cz}`;
        this.flowArrowsGroup.add(arrow);
      }
    }
    this.updateFlowArrows();
  }

  public updateFlowArrows(): void {
    const solver = this.gridManager.flowSolver;

    for (let cz = 0; cz < this.gridManager.height; cz++) {
      for (let cx = 0; cx < this.gridManager.width; cx++) {
        const arrow = this.flowArrowsGroup.getObjectByName(`arrow_${cx}_${cz}`) as THREE.Mesh;
        if (!arrow) continue;

        const idx = solver.getIndex(cx, cz);
        const fx = solver.flowX[idx];
        const fz = solver.flowZ[idx];
        const isWalkable = this.gridManager.grid[idx] === 0 || this.gridManager.grid[idx] === 4;

        if (isWalkable && (fx !== 0 || fz !== 0)) {
          arrow.visible = true;
          arrow.rotation.y = Math.atan2(fx, fz);
        } else {
          arrow.visible = false;
        }
      }
    }
  }
}
