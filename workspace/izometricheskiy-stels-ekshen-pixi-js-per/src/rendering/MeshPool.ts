/**
 * Texture Generation & Particle / Sprite Pooling for PixiJS v8
 */

import * as PIXI from 'pixi.js';
import { Palette } from './Shaders';

export interface Particle {
  sprite: PIXI.Sprite;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scaleStart: number;
  scaleEnd: number;
  alphaStart: number;
  alphaEnd: number;
  tint: number;
}

export class SpriteFactory {
  private static textures = new Map<string, PIXI.Texture>();

  static async generateAllTextures(app: PIXI.Application): Promise<void> {
    if (this.textures.size > 0) return;

    // 1. Particle Glow Dot
    const gParticle = new PIXI.Graphics();
    gParticle.circle(16, 16, 14);
    gParticle.fill({ color: 0xffffff });
    this.textures.set('particle', app.renderer.generateTexture(gParticle));

    // 2. Player (Ranger / Wanderer with cloak & dagger)
    const gPlayer = new PIXI.Graphics();
    // Shadow
    gPlayer.ellipse(24, 42, 16, 8);
    gPlayer.fill({ color: 0x000000, alpha: 0.4 });
    // Cloak Body
    gPlayer.roundRect(14, 18, 20, 24, 6);
    gPlayer.fill({ color: Palette.playerCloak });
    // Head / Hood
    gPlayer.circle(24, 16, 10);
    gPlayer.fill({ color: 0x1e331c });
    // Face shadow
    gPlayer.circle(24, 17, 7);
    gPlayer.fill({ color: Palette.playerSkin });
    // Glowing Eyes
    gPlayer.circle(22, 16, 1.5);
    gPlayer.circle(26, 16, 1.5);
    gPlayer.fill({ color: 0xffeb3b });
    // Dagger
    gPlayer.rect(34, 24, 4, 14);
    gPlayer.fill({ color: 0xdce775 });
    // Lantern in left hand
    gPlayer.circle(12, 28, 5);
    gPlayer.fill({ color: 0xfff9c4 });
    gPlayer.circle(12, 28, 8);
    gPlayer.stroke({ color: 0xf2b134, width: 2, alpha: 0.6 });
    this.textures.set('player', app.renderer.generateTexture(gPlayer));

    // 3. Wisp (Блуждающий огонёк)
    const gWisp = new PIXI.Graphics();
    // Soft outer aura
    gWisp.circle(20, 20, 18);
    gWisp.fill({ color: Palette.wispBlueOuter, alpha: 0.35 });
    // Mid core
    gWisp.circle(20, 20, 12);
    gWisp.fill({ color: Palette.wispBlueOuter, alpha: 0.7 });
    // Bright white core
    gWisp.circle(20, 20, 6);
    gWisp.fill({ color: Palette.wispBlueCore, alpha: 1 });
    this.textures.set('wisp', app.renderer.generateTexture(gWisp));

    // 4. Shadow Wolf / Forest Stalker
    const gWolf = new PIXI.Graphics();
    // Shadow
    gWolf.ellipse(26, 38, 20, 9);
    gWolf.fill({ color: 0x000000, alpha: 0.4 });
    // Beast body
    gWolf.ellipse(26, 24, 18, 12);
    gWolf.fill({ color: 0x1a2119 });
    // Head with snout
    gWolf.poly([16, 12, 34, 12, 40, 22, 30, 28, 12, 22]);
    gWolf.fill({ color: 0x111710 });
    // Glowing red menacing eyes
    gWolf.circle(26, 15, 2.5);
    gWolf.circle(34, 15, 2.5);
    gWolf.fill({ color: 0xff1744 });
    this.textures.set('wolf', app.renderer.generateTexture(gWolf));

    // 5. Leshy (Boss - Ancient Forest Guardian)
    const gLeshy = new PIXI.Graphics();
    // Shadow
    gLeshy.ellipse(48, 86, 38, 16);
    gLeshy.fill({ color: 0x000000, alpha: 0.5 });
    // Tree Trunk Body
    gLeshy.roundRect(30, 32, 36, 52, 10);
    gLeshy.fill({ color: Palette.leshyWood });
    // Bark Texture Lines
    gLeshy.rect(36, 40, 4, 38);
    gLeshy.rect(46, 44, 4, 32);
    gLeshy.rect(56, 38, 4, 40);
    gLeshy.fill({ color: 0x271913 });
    // Foliage Shoulders & Beard
    gLeshy.circle(48, 28, 22);
    gLeshy.fill({ color: 0x1b3819 });
    // Antlers / Branch Horns
    gLeshy.poly([48, 20, 30, 6, 20, 10, 32, 2, 44, 14]);
    gLeshy.poly([48, 20, 66, 6, 76, 10, 64, 2, 52, 14]);
    gLeshy.fill({ color: 0x4e342e });
    // Burning Amber Eyes
    gLeshy.circle(40, 26, 4);
    gLeshy.circle(56, 26, 4);
    gLeshy.fill({ color: Palette.leshyEyes });
    this.textures.set('leshy', app.renderer.generateTexture(gLeshy));

    // 6. Birch Tree
    const gBirch = new PIXI.Graphics();
    // Shadow
    gBirch.ellipse(32, 90, 24, 10);
    gBirch.fill({ color: 0x000000, alpha: 0.35 });
    // Trunk
    gBirch.roundRect(26, 40, 12, 52, 4);
    gBirch.fill({ color: Palette.birchTrunk });
    // Birch bark marks
    gBirch.rect(26, 48, 6, 2);
    gBirch.rect(32, 60, 6, 3);
    gBirch.rect(26, 74, 8, 2);
    gBirch.fill({ color: Palette.birchBarkDark });
    // Foliage layers
    gBirch.circle(32, 38, 26);
    gBirch.fill({ color: 0x4a7c36 });
    gBirch.circle(24, 28, 20);
    gBirch.circle(40, 28, 20);
    gBirch.fill({ color: 0x689f38 });
    gBirch.circle(32, 18, 16);
    gBirch.fill({ color: 0x8bc34a });
    this.textures.set('tree_birch', app.renderer.generateTexture(gBirch));

    // 7. Pine Tree
    const gPine = new PIXI.Graphics();
    // Shadow
    gPine.ellipse(32, 92, 26, 12);
    gPine.fill({ color: 0x000000, alpha: 0.35 });
    // Trunk
    gPine.rect(28, 65, 8, 28);
    gPine.fill({ color: 0x3e2723 });
    // Pine Tiers
    gPine.poly([32, 48, 8, 76, 56, 76]);
    gPine.fill({ color: 0x142817 });
    gPine.poly([32, 30, 14, 56, 50, 56]);
    gPine.fill({ color: 0x1d3a21 });
    gPine.poly([32, 12, 20, 36, 44, 36]);
    gPine.fill({ color: 0x2e5633 });
    this.textures.set('tree_pine', app.renderer.generateTexture(gPine));

    // 8. Hiding Bush
    const gBush = new PIXI.Graphics();
    // Shadow
    gBush.ellipse(28, 30, 24, 10);
    gBush.fill({ color: 0x000000, alpha: 0.3 });
    // Bush cluster
    gBush.circle(18, 20, 14);
    gBush.circle(38, 20, 14);
    gBush.circle(28, 14, 16);
    gBush.fill({ color: Palette.bushGreen });
    // Highlight leaves
    gBush.circle(24, 12, 10);
    gBush.circle(32, 16, 9);
    gBush.fill({ color: 0x3d6836 });
    // Berries
    gBush.circle(16, 16, 2.5);
    gBush.circle(34, 14, 2.5);
    gBush.circle(26, 22, 2.5);
    gBush.fill({ color: 0xff3d00 });
    this.textures.set('bush', app.renderer.generateTexture(gBush));

    // 9. Birch Torch Stand
    const gTorch = new PIXI.Graphics();
    // Post
    gTorch.rect(13, 14, 6, 26);
    gTorch.fill({ color: Palette.torchWood });
    // Birch wrap
    gTorch.rect(12, 12, 8, 8);
    gTorch.fill({ color: Palette.birchTrunk });
    // Flame
    gTorch.poly([16, 12, 10, 4, 16, -2, 22, 4]);
    gTorch.fill({ color: Palette.torchFlameOuter });
    gTorch.poly([16, 10, 12, 4, 16, 0, 20, 4]);
    gTorch.fill({ color: Palette.torchFlameCore });
    this.textures.set('torch', app.renderer.generateTexture(gTorch));

    // 10. Sacred Salt Rune / Circle
    const gSalt = new PIXI.Graphics();
    gSalt.circle(48, 48, 44);
    gSalt.stroke({ color: Palette.saltWhite, width: 3, alpha: 0.9 });
    gSalt.circle(48, 48, 36);
    gSalt.stroke({ color: Palette.saltWhite, width: 1.5, alpha: 0.5 });
    // Star / Pentacle lines
    for (let i = 0; i < 5; i++) {
      const a1 = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const a2 = ((i + 1) * 4 * Math.PI) / 5 - Math.PI / 2;
      gSalt.moveTo(48 + Math.cos(a1) * 36, 48 + Math.sin(a1) * 36);
      gSalt.lineTo(48 + Math.cos(a2) * 36, 48 + Math.sin(a2) * 36);
    }
    gSalt.stroke({ color: Palette.saltWhite, width: 2, alpha: 0.8 });
    this.textures.set('salt_circle', app.renderer.generateTexture(gSalt));

    // 11. Herb (Fern / Ingredient)
    const gHerb = new PIXI.Graphics();
    gHerb.circle(12, 12, 10);
    gHerb.fill({ color: 0x76ff03, alpha: 0.3 });
    gHerb.poly([12, 4, 8, 12, 12, 20, 16, 12]);
    gHerb.fill({ color: 0x64dd17 });
    gHerb.circle(12, 12, 3);
    gHerb.fill({ color: 0xffea00 });
    this.textures.set('herb', app.renderer.generateTexture(gHerb));

    // 12. Soul Coin
    const gCoin = new PIXI.Graphics();
    gCoin.circle(10, 10, 8);
    gCoin.fill({ color: Palette.coinGold });
    gCoin.circle(10, 10, 5);
    gCoin.fill({ color: 0xfff3cd });
    this.textures.set('coin', app.renderer.generateTexture(gCoin));

    // 13. Slash Attack Wave Arc
    const gSlash = new PIXI.Graphics();
    gSlash.arc(28, 28, 22, -Math.PI / 3, Math.PI / 3);
    gSlash.stroke({ color: 0xfff9c4, width: 4, alpha: 0.9 });
    this.textures.set('slash', app.renderer.generateTexture(gSlash));
  }

  static getTexture(key: string): PIXI.Texture {
    return this.textures.get(key) || PIXI.Texture.WHITE;
  }
}

export class ParticlePool {
  private particles: Particle[] = [];
  private container: PIXI.Container;
  private texture: PIXI.Texture;

  constructor(parent: PIXI.Container, texture: PIXI.Texture, poolSize = 300) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
    this.texture = texture;

    for (let i = 0; i < poolSize; i++) {
      const sprite = new PIXI.Sprite(this.texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);

      this.particles.push({
        sprite,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        scaleStart: 1,
        scaleEnd: 0,
        alphaStart: 1,
        alphaEnd: 0,
        tint: 0xffffff,
      });
    }
  }

  emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    maxLife: number,
    scaleStart: number,
    scaleEnd: number,
    alphaStart: number,
    alphaEnd: number,
    tint: number
  ): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = maxLife;
        p.maxLife = maxLife;
        p.scaleStart = scaleStart;
        p.scaleEnd = scaleEnd;
        p.alphaStart = alphaStart;
        p.alphaEnd = alphaEnd;
        p.tint = tint;

        p.sprite.tint = tint;
        p.sprite.scale.set(scaleStart);
        p.sprite.alpha = alphaStart;
        p.sprite.position.set(x, y);
        p.sprite.visible = true;
        return;
      }
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          p.sprite.visible = false;
          continue;
        }

        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;

        const progress = 1 - p.life / p.maxLife;
        const currentScale = p.scaleStart + (p.scaleEnd - p.scaleStart) * progress;
        const currentAlpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * progress;

        p.sprite.position.set(p.x, p.y);
        p.sprite.scale.set(currentScale);
        p.sprite.alpha = Math.max(0, Math.min(1, currentAlpha));
      }
    }
  }

  clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
      this.particles[i].sprite.visible = false;
    }
  }
}
