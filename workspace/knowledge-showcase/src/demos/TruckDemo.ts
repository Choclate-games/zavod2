import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { TruckController } from '../vehicle/TruckController';
import { LEVELS } from '../world/levels';

/**
 * Эталонная вкладка стенда: ЗиЛ-130 на честной физике Rapier3D.
 *
 * knowledge/threejs/rapier_vehicle_controller.md + vehicle_wheel_rig.md.
 * Порядок кадра тот же, что у всех: updateVehicle ДО world.step()
 * (CRITICAL_RULES §62), синхронизация мешей после шага.
 */
export class TruckDemo implements Demo {
  readonly id = 'truck';
  readonly title = ['🚚 ЗиЛ-130 (Rapier 3D)', '🚚 ZIL-130 (Rapier 3D)'] as const;
  readonly hint = [
    '<b>W</b>/<b>S</b> газ и тормоз · <b>A</b>/<b>D</b> руль · <b>Space</b> ручник (дрифт) · <b>R</b> восстановить',
    '<b>W</b>/<b>S</b> throttle and brake · <b>A</b>/<b>D</b> steer · <b>Space</b> handbrake (drift) · <b>R</b> recover',
  ] as const;
  readonly category = ['🚚 Физика и транспорт', '🚚 Physics & Vehicles'] as const;
  readonly tags = ['грузовик', 'зил-130', 'rapier3d', 'физика', 'колеса', 'подвеска', 'truck', 'physics', 'vehicle'] as const;

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;

  private ctx!: DemoContext;
  private physics!: PhysicsWorld;
  private sceneManager!: SceneManager;
  private road!: RoadGenerator;
  private truck!: TruckController;
  private statusTimer = 0;

  async init(ctx: DemoContext): Promise<void> {
    this.ctx = ctx;

    this.physics = new PhysicsWorld();
    await this.physics.initialize();

    // Общий рендерер стенда: второй WebGL-контекст в той же вкладке вытесняет первый.
    this.sceneManager = new SceneManager(ctx.renderer);
    this.sceneManager.initialize();
    this.sceneManager.onResize();
    this.scene = this.sceneManager.scene;
    this.camera = this.sceneManager.camera;

    this.road = new RoadGenerator();
    this.road.build(this.sceneManager, this.physics, LEVELS[0]);
    this.truck = new TruckController(this.physics, this.sceneManager, this.road);
    this.truck.build('zil');
    this.sceneManager.resetCamera(this.truck.position);
  }

  enter(): void {
    this.ctx.audio.startEngine();
  }

  exit(): void {
    this.ctx.audio.stopEngine();
  }

  fixedUpdate(dt: number): void {
    const input = this.ctx.input.vehicleSnapshot();
    // Контроллер ДО шага мира: иначе колёса на кадр отстают от кузова.
    this.truck.fixedUpdate(dt, input);
    this.physics.step();
  }

  update(dt: number, alpha: number): void {
    this.truck.render(alpha);
    const input = this.ctx.input.vehicleSnapshot();
    this.ctx.audio.updateEngineRPM(Math.abs(this.truck.speed) / 60, input.throttle);
    this.sceneManager.render(this.truck.position, this.truck.forward, this.truck.speed);

    this.statusTimer += dt;
    if (this.statusTimer > 0.12) {
      this.statusTimer = 0;
      this.ctx.setStatus(
        `Скорость <b>${Math.round(Math.abs(this.truck.speed))}</b> км/ч`
        + ` · грязь <b>${(this.truck.currentMudFactor * 100).toFixed(0)}%</b>`
        + ` · вода <b>${(this.truck.currentWaterFactor * 100).toFixed(0)}%</b>`,
      );
    }
  }

  resize(): void {
    this.sceneManager.onResize();
  }

  dispose(): void {
    this.sceneManager.clearGroup(this.sceneManager.roadGroup);
    this.sceneManager.clearGroup(this.sceneManager.decorationGroup);
  }
}
