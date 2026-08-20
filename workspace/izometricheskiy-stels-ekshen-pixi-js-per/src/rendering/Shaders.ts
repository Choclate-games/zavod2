/**
 * Visual effects, Lighting Mask and Palette definitions for PixiJS
 */

export const Palette = {
  nightSky: 0x090e07,
  forestGround: 0x141f12,
  groundPath: 0x1e2b1b,
  grassLight: 0x384d2f,
  birchTrunk: 0xd8dfd2,
  birchBarkDark: 0x2e3b29,
  pineNeedles: 0x1b301c,
  bushGreen: 0x2a4425,
  bushDark: 0x192b16,
  torchWood: 0x4a3728,
  torchFlameCore: 0xfff3cd,
  torchFlameOuter: 0xf2b134,
  torchLightRgb: 'rgba(242, 177, 52, 0.45)',
  saltWhite: 0xffffff,
  saltGlowRgb: 'rgba(255, 255, 255, 0.65)',
  wispBlueCore: 0xe0f7fa,
  wispBlueOuter: 0x29b6f6,
  wispLightRgb: 'rgba(41, 182, 246, 0.55)',
  leshyWood: 0x3e2723,
  leshyEyes: 0xff5722,
  leshyGlowRgb: 'rgba(255, 87, 34, 0.6)',
  playerCloak: 0x2e482b,
  playerSkin: 0xffcc80,
  playerLanternCore: 0xfff9c4,
  herbGreen: 0x76ff03,
  coinGold: 0xffd54f,
} as const;

export interface LightSource {
  x: number; // Screen X
  y: number; // Screen Y
  radius: number;
  color: string;
  intensity: number;
  flickerSpeed?: number;
}
