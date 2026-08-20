import { EventBus } from '../core/EventBus';
import type { InputSnapshot } from '../input/InputManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { GAME_CONFIG, type MailState, type RouteState, type SnailRole, type SnailState } from '../game/config';
import type { GameEvents } from '../game/GameEvents';

export interface ColonyStats {
  day: number;
  dew: number;
  nectar: number;
  trust: number;
  humidity: number;
  delivered: number;
  totalMails: number;
  deliveredMails: number;
}

export class ColonySystem {
  public readonly snails: SnailState[] = [];
  public readonly mails: MailState[] = [];
  public readonly routes: RouteState[] = [];
  private readonly physics: PhysicsWorld;
  private readonly eventBus: EventBus<GameEvents>;
  private day = 1;
  private dew = 64;
  private nectar = 36;
  private trust = 0;
  private humidity = 0.78;
  private delivered = 0;
  private routeId = 1;
  private mailId = 1;
  private snailId = 1;
  private dayTimer = 0;
  private predatorPressure = 1;

  public constructor(physics: PhysicsWorld, eventBus: EventBus<GameEvents>) {
    this.physics = physics;
    this.eventBus = eventBus;
    this.createMails();
    this.addSnail('courier', -0.8, 0.2);
    this.addSnail('courier', 0.8, 0.2);
    this.addSnail('gatherer', 0, 0.9);
    this.addSnail('guard', 0, -0.9);
  }

  public setInitialSave(day: number, dew: number, nectar: number, trust: number, delivered: number): void {
    this.day = day;
    this.dew = dew;
    this.nectar = nectar;
    this.trust = trust;
    this.delivered = delivered;
  }

  public setPredatorPressure(value: number): void { this.predatorPressure = value; }

  public update(deltaSeconds: number, input: InputSnapshot): void {
    this.dayTimer += deltaSeconds;
    if (this.dayTimer >= 120) {
      this.dayTimer -= 120;
      this.day += 1;
      this.createMails();
      this.eventBus.emit('toast', { message: `Начался день ${this.day}` });
    }
    this.humidity = Math.max(GAME_CONFIG.hydrationFloor, this.humidity - GAME_CONFIG.drynessRate * deltaSeconds * 0.25);
    this.dew = Math.max(0, this.dew - deltaSeconds * 0.025);
    if (input.hydratePressed) this.hydrate();
    if (input.guardPressed) this.promoteGuard();
    let guardCount = 0;
    for (const snail of this.snails) if (snail.role === 'guard') guardCount += 1;
    for (const snail of this.snails) this.updateSnail(snail, deltaSeconds);
    this.nectar = Math.min(120, this.nectar + this.gathererCount() * deltaSeconds * 0.07);
    this.physics.step();
    void guardCount;
  }

  public createRoute(startX: number, startZ: number, endX: number, endZ: number): RouteState | null {
    const rawLength = Math.hypot(endX - startX, endZ - startZ);
    if (rawLength < 3) return null;
    const length = Math.min(65, Math.max(18, rawLength));
    const cost = Math.ceil(length / 6);
    if (this.dew < cost) {
      this.eventBus.emit('toast', { message: 'Недостаточно росы для тропы' });
      return null;
    }
    const flowerIndex = this.closestFlower(startX, startZ);
    const route: RouteState = { id: this.routeId++, startX, startZ, endX, endZ, length, pheromone: 1, flowerIndex };
    this.routes.push(route);
    this.dew -= cost;
    this.eventBus.emit('route:created', { length, cost });
    this.eventBus.emit('toast', { message: `Тропа готова · расход ${cost} росы` });
    return route;
  }

  public rotateRole(snailId: number): void {
    const snail = this.snails.find((item) => item.id === snailId);
    if (!snail) return;
    const next: SnailRole = snail.role === 'courier' ? 'gatherer' : snail.role === 'gatherer' ? 'guard' : 'courier';
    snail.role = next;
    snail.mailId = -1;
    snail.routeId = -1;
    this.eventBus.emit('toast', { message: `Роль изменена: ${this.roleName(next)}` });
  }

  public getStats(target: ColonyStats): void {
    target.day = this.day;
    target.dew = this.dew;
    target.nectar = this.nectar;
    target.trust = this.trust;
    target.humidity = this.humidity;
    target.delivered = this.delivered;
    target.totalMails = this.mails.length;
    let deliveredMails = 0;
    for (const mail of this.mails) if (mail.delivered) deliveredMails += 1;
    target.deliveredMails = deliveredMails;
  }

  public getSave(): { day: number; dew: number; nectar: number; trust: number; delivered: number } {
    return { day: this.day, dew: this.dew, nectar: this.nectar, trust: this.trust, delivered: this.delivered };
  }

  private updateSnail(snail: SnailState, deltaSeconds: number): void {
    if (snail.role !== 'courier') {
      const drift = Math.sin((snail.id + this.dayTimer) * 0.7) * 0.16;
      this.physics.moveKinematic(snail.bodyHandle, snail.x + drift * deltaSeconds, snail.z);
      return;
    }
    if (snail.mailId < 0 || snail.routeId < 0) this.assignMail(snail);
    const route = this.routes.find((item) => item.id === snail.routeId);
    const mail = this.mails.find((item) => item.id === snail.mailId);
    if (!route || !mail || mail.delivered || mail.failed || route.pheromone < 0.2) {
      snail.mailId = -1;
      snail.routeId = -1;
      return;
    }
    route.pheromone = Math.max(0, route.pheromone - GAME_CONFIG.pheromoneDecay * deltaSeconds);
    mail.secondsLeft = Math.max(0, mail.secondsLeft - deltaSeconds);
    const speed = GAME_CONFIG.courierSpeed * (0.55 + this.humidity * 0.45) * (this.snailCountAt(route.endX, route.endZ) > GAME_CONFIG.nodeCapacity ? 0.65 : 1);
    snail.progress += speed * deltaSeconds / route.length;
    const fromX = snail.returning ? route.startX : route.endX;
    const fromZ = snail.returning ? route.startZ : route.endZ;
    const toX = snail.returning ? route.endX : route.startX;
    const toZ = snail.returning ? route.endZ : route.startZ;
    snail.x = fromX + (toX - fromX) * snail.progress;
    snail.z = fromZ + (toZ - fromZ) * snail.progress;
    this.physics.moveKinematic(snail.bodyHandle, snail.x, snail.z);
    if (snail.progress < 1) return;
    snail.progress = 0;
    if (!snail.returning) {
      const dryness = Math.max(0.004, (1 - this.humidity) * 0.025);
      const failureRisk = route.length * dryness * GAME_CONFIG.mailFragility * this.predatorPressure;
      if (failureRisk > 0.65 || mail.secondsLeft <= 0 || mail.durability <= 0) {
        mail.failed = true;
        this.trust = Math.max(0, this.trust - 1);
        this.eventBus.emit('mail:failed', { reason: failureRisk > 0.65 ? 'тропа пересохла' : 'время вышло' });
      } else {
        mail.delivered = true;
        this.delivered += 1;
        this.trust += 2;
        this.nectar += 3;
        this.eventBus.emit('mail:delivered', { reward: 2 });
      }
      snail.returning = true;
    } else {
      snail.returning = false;
      snail.mailId = -1;
      snail.routeId = -1;
    }
  }

  private assignMail(snail: SnailState): void {
    for (const mail of this.mails) {
      if (mail.delivered || mail.failed) continue;
      const route = this.routes.find((item) => item.flowerIndex === mail.flowerIndex && item.pheromone >= 0.2);
      if (!route) continue;
      snail.mailId = mail.id;
      snail.routeId = route.id;
      snail.progress = 0;
      snail.returning = false;
      return;
    }
  }

  private createMails(): void {
    this.mails.length = 0;
    for (let index = 0; index < 4; index += 1) this.mails.push({ id: this.mailId++, flowerIndex: index, secondsLeft: 70 - index * 5, durability: 35, delivered: false, failed: false });
  }

  private addSnail(role: SnailRole, x: number, z: number): void {
    this.snails.push({ id: this.snailId, x, z, role, routeId: -1, mailId: -1, progress: 0, returning: false, bodyHandle: this.physics.createSnailBody(x, z) });
    this.snailId += 1;
  }

  private hydrate(): void {
    if (this.dew < 6) {
      this.eventBus.emit('toast', { message: 'Роса закончилась' });
      return;
    }
    this.dew -= 6;
    this.humidity = Math.min(1, this.humidity + 0.18);
    this.eventBus.emit('toast', { message: 'Сад увлажнён на 18%' });
  }

  private promoteGuard(): void {
    const snail = this.snails.find((item) => item.role === 'gatherer');
    if (snail) { snail.role = 'guard'; this.eventBus.emit('toast', { message: 'Сборщик занял пост тревоги' }); }
  }

  private gathererCount(): number {
    let count = 0;
    for (const snail of this.snails) if (snail.role === 'gatherer') count += 1;
    return count;
  }

  private snailCountAt(x: number, z: number): number {
    let count = 0;
    for (const snail of this.snails) if (Math.hypot(snail.x - x, snail.z - z) < 1.2) count += 1;
    return count;
  }

  private closestFlower(x: number, z: number): number {
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < GAME_CONFIG.flowers.length; index += 1) {
      const flower = GAME_CONFIG.flowers[index];
      const currentDistance = Math.hypot(x - flower.x, z - flower.z);
      if (currentDistance < distance) { closest = index; distance = currentDistance; }
    }
    return closest;
  }

  private roleName(role: SnailRole): string { return role === 'courier' ? 'курьер' : role === 'gatherer' ? 'сборщик' : 'страж'; }
}
