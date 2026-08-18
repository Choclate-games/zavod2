import { Application, Graphics, Texture } from 'pixi.js';
import { Caste, Team } from '../entities/AntTypes';

export class TextureFactory {
  private static antTextures: Map<string, Texture> = new Map();
  private static vfxTextures: Map<string, Texture> = new Map();

  public static generateAllTextures(app: Application): void {
    // Generate Ant Textures for each (Caste + Team) combination
    const castes = [Caste.WORKER, Caste.SOLDIER, Caste.BOMBER, Caste.TITAN];
    const teams = [Team.PLAYER, Team.ENEMY, Team.NEUTRAL];

    for (const c of castes) {
      for (const t of teams) {
        const key = `ant_${c}_${t}`;
        const tex = TextureFactory.createAntTexture(app, c, t);
        TextureFactory.antTextures.set(key, tex);
      }
    }

    // Generate VFX textures
    TextureFactory.vfxTextures.set('spark', TextureFactory.createSparkTexture(app));
    TextureFactory.vfxTextures.set('acid', TextureFactory.createAcidTexture(app));
    TextureFactory.vfxTextures.set('smoke', TextureFactory.createSmokeTexture(app));
    TextureFactory.vfxTextures.set('biomass', TextureFactory.createBiomassTexture(app));
  }

  public static getAntTexture(caste: Caste, team: Team): Texture {
    const key = `ant_${caste}_${team}`;
    return TextureFactory.antTextures.get(key) || Texture.WHITE;
  }

  public static getVFXTexture(name: string): Texture {
    return TextureFactory.vfxTextures.get(name) || Texture.WHITE;
  }

  private static createAntTexture(app: Application, caste: Caste, team: Team): Texture {
    const g = new Graphics();
    const size = caste === Caste.TITAN ? 36 : (caste === Caste.SOLDIER ? 24 : 18);
    const half = size / 2;

    // Determine colors
    let abdomenColor = 0x39ff14;
    if (team === Team.ENEMY) {
      abdomenColor = 0xff3355;
    } else if (team === Team.NEUTRAL) {
      abdomenColor = 0xffd700;
    } else {
      if (caste === Caste.WORKER) abdomenColor = 0x39ff14;
      else if (caste === Caste.SOLDIER) abdomenColor = 0x00e5ff;
      else if (caste === Caste.BOMBER) abdomenColor = 0xffaa00;
      else if (caste === Caste.TITAN) abdomenColor = 0xcc44ff;
    }

    const headColor = team === Team.PLAYER ? 0x1f381f : (team === Team.ENEMY ? 0x381f25 : 0x2e2b1b);
    const chitinDark = 0x111612;

    // Legs (3 pairs)
    g.stroke({ width: 1.5, color: 0x223322 });
    g.moveTo(half - 2, half - 5).lineTo(half - 8, half - 7);
    g.moveTo(half - 2, half).lineTo(half - 9, half);
    g.moveTo(half - 2, half + 5).lineTo(half - 8, half + 7);

    g.moveTo(half + 2, half - 5).lineTo(half + 8, half - 7);
    g.moveTo(half + 2, half).lineTo(half + 9, half);
    g.moveTo(half + 2, half + 5).lineTo(half + 8, half + 7);

    // Abdomen (back bulb)
    g.fill({ color: abdomenColor });
    if (caste === Caste.BOMBER) {
      // Big round explosive sac
      g.ellipse(half, half + size * 0.28, size * 0.28, size * 0.32);
    } else {
      g.ellipse(half, half + size * 0.25, size * 0.18, size * 0.26);
    }

    // Thorax (middle segment)
    g.fill({ color: chitinDark });
    g.ellipse(half, half, size * 0.14, size * 0.18);

    // Head (front)
    g.fill({ color: headColor });
    g.ellipse(half, half - size * 0.25, size * 0.16, size * 0.16);

    // Mandibles (large on soldier/titan)
    if (caste === Caste.SOLDIER || caste === Caste.TITAN) {
      g.stroke({ width: 2, color: 0xffffff });
      g.moveTo(half - 3, half - size * 0.3).lineTo(half - 5, half - size * 0.45);
      g.moveTo(half + 3, half - size * 0.3).lineTo(half + 5, half - size * 0.45);
    }

    return app.renderer.generateTexture({ target: g });
  }

  private static createSparkTexture(app: Application): Texture {
    const g = new Graphics();
    g.fill({ color: 0xffffaa });
    g.circle(8, 8, 5);
    return app.renderer.generateTexture({ target: g });
  }

  private static createAcidTexture(app: Application): Texture {
    const g = new Graphics();
    g.fill({ color: 0x76ff03 });
    g.circle(12, 12, 10);
    return app.renderer.generateTexture({ target: g });
  }

  private static createSmokeTexture(app: Application): Texture {
    const g = new Graphics();
    g.fill({ color: 0x445544, alpha: 0.6 });
    g.circle(16, 16, 14);
    return app.renderer.generateTexture({ target: g });
  }

  private static createBiomassTexture(app: Application): Texture {
    const g = new Graphics();
    g.fill({ color: 0x00e5ff });
    g.poly([16, 4, 26, 16, 16, 28, 6, 16]);
    return app.renderer.generateTexture({ target: g });
  }
}
