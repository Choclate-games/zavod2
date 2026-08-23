/**
 * CargoOrderGenerationSystem: Generates diverse cargo stacks per station level.
 * Defines physics attributes, mass, fragility and dimensions.
 */

import { CargoItemDef } from '../physics/PhysicsWorld';

export class CargoOrderGenerationSystem {
  public static generateOrder(level: number): CargoItemDef[] {
    const items: CargoItemDef[] = [];

    // Base item: Heavy TV or sturdy crate
    items.push({
      id: 'base_tv',
      name: 'Винтажный телевизор «Электрон-380»',
      type: 'tv',
      width: 0.58,
      height: 0.44,
      depth: 0.48,
      massKg: 18.0,
      isFragile: true,
      friction: 0.45,
      restitution: 0.05
    });

    // Level 1: 3 items
    if (level === 1) {
      items.push({
        id: 'crate_mid',
        name: 'Деревянный ящик с инструментами',
        type: 'crate',
        width: 0.52,
        height: 0.32,
        depth: 0.42,
        massKg: 8.5,
        isFragile: false,
        friction: 0.48,
        restitution: 0.1
      });

      items.push({
        id: 'pizza_top',
        name: 'Стопка коробок с пиццей (4 шт)',
        type: 'pizza_stack',
        width: 0.45,
        height: 0.28,
        depth: 0.45,
        massKg: 3.2,
        isFragile: false,
        friction: 0.38,
        restitution: 0.05
      });
      return items;
    }

    // Level 2 - 4: 4 - 5 items with Aquarium
    items.push({
      id: 'aquarium_mid',
      name: 'Хрустальный аквариум с золотой рыбкой',
      type: 'aquarium',
      width: 0.46,
      height: 0.38,
      depth: 0.38,
      massKg: 14.0,
      isFragile: true,
      friction: 0.42,
      restitution: 0.08
    });

    items.push({
      id: 'parcel_tier',
      name: 'Срочные экспресс-посылки',
      type: 'parcel',
      width: 0.42,
      height: 0.24,
      depth: 0.36,
      massKg: 4.5,
      isFragile: false,
      friction: 0.44,
      restitution: 0.1
    });

    if (level >= 3) {
      items.push({
        id: 'pizza_top_5',
        name: 'Фирменная пицца «Пепперони XXL»',
        type: 'pizza_stack',
        width: 0.48,
        height: 0.26,
        depth: 0.48,
        massKg: 3.8,
        isFragile: false,
        friction: 0.36,
        restitution: 0.05
      });
    }

    if (level >= 5) {
      items.push({
        id: 'porcelain_vase',
        name: 'Антикварная фарфоровая ваза',
        type: 'vase',
        width: 0.32,
        height: 0.42,
        depth: 0.32,
        massKg: 2.8,
        isFragile: true,
        friction: 0.32,
        restitution: 0.12
      });
    }

    return items;
  }
}
