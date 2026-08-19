import { Texture } from 'pixi.js';

export class TextureGenerator {
  private static textures: Map<string, Texture> = new Map();

  public static init(): void {
    this.createDrillTextures();
    this.createBlockTextures();
    this.createEnemyTextures();
    this.createBossTextures();
    this.createDropTextures();
    this.createProjectileTextures();
    this.createVfxTextures();
  }

  public static get(name: string): Texture {
    const tex = this.textures.get(name);
    if (!tex) {
      console.warn(`Texture "${name}" not found! Using fallback.`);
      return Texture.WHITE;
    }
    return tex;
  }

  private static register(name: string, canvas: HTMLCanvasElement): void {
    const tex = Texture.from(canvas);
    this.textures.set(name, tex);
  }

  private static createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return [canvas, ctx];
  }

  // --- DRILL CHASSIS & CUTTERS ---

  private static createDrillTextures(): void {
    // 1. Drill Chassis (Heavy Mecha Body) - 64x80
    {
      const [canvas, ctx] = this.createCanvas(64, 80);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(32, 72, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Caterpillar tracks / Side boosters
      ctx.fillStyle = '#1e2430';
      ctx.fillRect(4, 16, 10, 48);
      ctx.fillRect(50, 16, 10, 48);

      ctx.fillStyle = '#111520';
      for (let y = 18; y < 64; y += 6) {
        ctx.fillRect(4, y, 10, 2);
        ctx.fillRect(50, y, 10, 2);
      }

      // Heavy Main Hull
      ctx.fillStyle = '#d49b19'; // Golden Dieselpunk yellow
      ctx.beginPath();
      ctx.moveTo(16, 12);
      ctx.lineTo(48, 12);
      ctx.lineTo(52, 60);
      ctx.lineTo(40, 72);
      ctx.lineTo(24, 72);
      ctx.lineTo(12, 60);
      ctx.closePath();
      ctx.fill();

      // Dark armored core panels
      ctx.fillStyle = '#222938';
      ctx.fillRect(20, 22, 24, 32);

      // Glowing Cockpit / Reactor Core
      const grad = ctx.createRadialGradient(32, 36, 2, 32, 36, 10);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#00f0ff');
      grad.addColorStop(1, 'rgba(0, 150, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 36, 10, 0, Math.PI * 2);
      ctx.fill();

      // Headlight projectors
      ctx.fillStyle = '#fffae0';
      ctx.fillRect(16, 62, 8, 4);
      ctx.fillRect(40, 62, 8, 4);

      // Rivets / Industrial bolts
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(18, 16, 2, 2);
      ctx.fillRect(44, 16, 2, 2);
      ctx.fillRect(18, 54, 2, 2);
      ctx.fillRect(44, 54, 2, 2);

      this.register('drill_body', canvas);
    }

    // 2. Rotary Cutter / Saw Blade (Rotates at bottom) - 48x48
    {
      const [canvas, ctx] = this.createCanvas(48, 48);
      const cx = 24, cy = 24, r = 20;

      ctx.fillStyle = '#8f9fb3';
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const dist = i % 2 === 0 ? r : r * 0.65;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Sharp Diamond Edges
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center Hub
      ctx.fillStyle = '#222a38';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      this.register('drill_blade', canvas);
    }
  }

  // --- BLOCK TEXTURES (48x48) ---

  private static createBlockTextures(): void {
    const blockTypes = [
      { id: 'block_basalt', bg: '#2b2320', border: '#443834', crack: '#181210' },
      { id: 'block_granite', bg: '#3e4452', border: '#5b6478', crack: '#232833' },
      { id: 'block_obsidian', bg: '#171926', border: '#2f344d', crack: '#0a0c14' },
      { id: 'block_ore_gold', bg: '#2b2320', border: '#f0c430', vein: '#f0c430' },
      { id: 'block_ore_crystal', bg: '#171926', border: '#00f0ff', vein: '#00f0ff' },
      { id: 'block_tnt', bg: '#8b1222', border: '#ff2a4b', text: 'TNT' },
      { id: 'block_magma', bg: '#4a1506', border: '#ff4d00', vein: '#ff6600' },
      { id: 'block_cryo', bg: '#1a364a', border: '#4dd2ff', vein: '#80e5ff' },
    ];

    for (const b of blockTypes) {
      const [canvas, ctx] = this.createCanvas(48, 48);

      // Base fill
      ctx.fillStyle = b.bg;
      ctx.fillRect(0, 0, 48, 48);

      // 3D Bevel Border
      ctx.fillStyle = b.border;
      ctx.fillRect(0, 0, 48, 3);
      ctx.fillRect(0, 0, 3, 48);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 45, 48, 3);
      ctx.fillRect(45, 0, 3, 48);

      // Texture details / ore veins
      if (b.vein) {
        ctx.fillStyle = b.vein;
        // Draw mineral crystals
        ctx.beginPath();
        ctx.moveTo(14, 18);
        ctx.lineTo(22, 10);
        ctx.lineTo(28, 16);
        ctx.lineTo(20, 24);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(26, 32);
        ctx.lineTo(36, 24);
        ctx.lineTo(40, 34);
        ctx.lineTo(30, 40);
        ctx.closePath();
        ctx.fill();

        // Shiny glint
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20, 13, 3, 3);
        ctx.fillRect(32, 28, 2, 2);
      } else if (b.text) {
        // TNT box styling
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TNT', 24, 24);

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(6, 6, 36, 36);
      } else {
        // Natural rock grain & cracks
        ctx.fillStyle = b.crack || '#111';
        ctx.fillRect(10, 14, 16, 2);
        ctx.fillRect(24, 16, 2, 10);
        ctx.fillRect(20, 32, 18, 2);
        ctx.fillRect(8, 30, 2, 8);
      }

      this.register(b.id, canvas);
    }
  }

  // --- ENEMY TEXTURES ---

  private static createEnemyTextures(): void {
    // 1. Cave Crawler / Spider (36x36)
    {
      const [canvas, ctx] = this.createCanvas(36, 36);
      // Legs
      ctx.strokeStyle = '#4a5d3f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 4 pairs of bent legs
      ctx.moveTo(18, 18); ctx.lineTo(4, 6); ctx.lineTo(2, 14);
      ctx.moveTo(18, 18); ctx.lineTo(32, 6); ctx.lineTo(34, 14);
      ctx.moveTo(18, 18); ctx.lineTo(4, 30); ctx.lineTo(2, 22);
      ctx.moveTo(18, 18); ctx.lineTo(32, 30); ctx.lineTo(34, 22);
      ctx.stroke();

      // Body abdomen
      ctx.fillStyle = '#2d3d24';
      ctx.beginPath();
      ctx.ellipse(18, 20, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head & glowing red eyes
      ctx.fillStyle = '#1c2815';
      ctx.beginPath();
      ctx.arc(18, 11, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff1a40';
      ctx.fillRect(15, 9, 2, 2);
      ctx.fillRect(19, 9, 2, 2);

      this.register('enemy_crawler', canvas);
    }

    // 2. Rock Armored Beetle (42x42)
    {
      const [canvas, ctx] = this.createCanvas(42, 42);
      // Heavy Shell
      ctx.fillStyle = '#59443b';
      ctx.beginPath();
      ctx.arc(21, 22, 14, 0, Math.PI * 2);
      ctx.fill();

      // Carapace seam & armor ridges
      ctx.strokeStyle = '#2b1f1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(21, 8); ctx.lineTo(21, 36);
      ctx.stroke();

      // Mandibles / Horns
      ctx.fillStyle = '#d49b19';
      ctx.beginPath();
      ctx.moveTo(16, 10); ctx.lineTo(12, 2); ctx.lineTo(17, 6);
      ctx.moveTo(26, 10); ctx.lineTo(30, 2); ctx.lineTo(25, 6);
      ctx.fill();

      // Glowing Amber Eyes
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(16, 12, 3, 3);
      ctx.fillRect(23, 12, 3, 3);

      this.register('enemy_beetle', canvas);
    }

    // 3. Bio-Sporer / Acid Spitter (38x38)
    {
      const [canvas, ctx] = this.createCanvas(38, 38);
      // Pulsing Bio Sac
      const grad = ctx.createRadialGradient(19, 19, 2, 19, 19, 14);
      grad.addColorStop(0, '#73ff00');
      grad.addColorStop(0.7, '#2f8000');
      grad.addColorStop(1, '#0e3300');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(19, 19, 14, 0, Math.PI * 2);
      ctx.fill();

      // Spore pods
      ctx.fillStyle = '#a6ff4d';
      ctx.beginPath();
      ctx.arc(14, 15, 4, 0, Math.PI * 2);
      ctx.arc(24, 16, 3, 0, Math.PI * 2);
      ctx.arc(18, 23, 4, 0, Math.PI * 2);
      ctx.fill();

      this.register('enemy_sporer', canvas);
    }
  }

  // --- TITAN BOSS TEXTURES ---

  private static createBossTextures(): void {
    // 1. Obsidian Golem Head / Core (80x80)
    {
      const [canvas, ctx] = this.createCanvas(80, 80);
      ctx.fillStyle = '#181b29';
      ctx.beginPath();
      ctx.moveTo(20, 10); ctx.lineTo(60, 10);
      ctx.lineTo(72, 40); ctx.lineTo(50, 72);
      ctx.lineTo(30, 72); ctx.lineTo(8, 40);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ff1a40';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Magma Cracks
      ctx.fillStyle = '#ff4d00';
      ctx.fillRect(24, 28, 32, 6);
      ctx.fillRect(34, 34, 12, 16);

      // Glowing Titan Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(26, 30, 6, 3);
      ctx.fillRect(48, 30, 6, 3);

      this.register('boss_golem', canvas);
    }

    // 2. Magma Worm Segment (60x60)
    {
      const [canvas, ctx] = this.createCanvas(60, 60);
      const grad = ctx.createRadialGradient(30, 30, 5, 30, 30, 26);
      grad.addColorStop(0, '#ffe680');
      grad.addColorStop(0.4, '#ff5500');
      grad.addColorStop(0.8, '#6b1200');
      grad.addColorStop(1, '#240600');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(30, 30, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffa200';
      ctx.lineWidth = 2;
      ctx.stroke();

      this.register('boss_worm_segment', canvas);
    }
  }

  // --- DROP ITEMS (24x24) ---

  private static createDropTextures(): void {
    // 1. Dark Matter Energy Crystal (24x24)
    {
      const [canvas, ctx] = this.createCanvas(24, 24);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(12, 2); ctx.lineTo(20, 9);
      ctx.lineTo(12, 22); ctx.lineTo(4, 9);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(12, 5); ctx.lineTo(16, 9); ctx.lineTo(12, 16); ctx.lineTo(10, 9);
      ctx.fill();

      this.register('drop_crystal', canvas);
    }

    // 2. Gold / Ore Nugget (24x24)
    {
      const [canvas, ctx] = this.createCanvas(24, 24);
      ctx.fillStyle = '#f0c430';
      ctx.beginPath();
      ctx.arc(12, 12, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff4a3';
      ctx.fillRect(8, 8, 4, 4);

      this.register('drop_ore', canvas);
    }

    // 3. Nanite Repair Pack (24x24)
    {
      const [canvas, ctx] = this.createCanvas(24, 24);
      ctx.fillStyle = '#1e283d';
      ctx.fillRect(3, 3, 18, 18);
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, 18, 18);

      // Green Cross
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(10, 6, 4, 12);
      ctx.fillRect(6, 10, 12, 4);

      this.register('drop_heal', canvas);
    }
  }

  // --- PROJECTILES ---

  private static createProjectileTextures(): void {
    // 1. Plasma Laser Bolt (8x24)
    {
      const [canvas, ctx] = this.createCanvas(8, 24);
      const grad = ctx.createLinearGradient(0, 0, 0, 24);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#00f0ff');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(1, 0, 6, 24);
      this.register('proj_plasma', canvas);
    }

    // 2. Acid Spit (12x12)
    {
      const [canvas, ctx] = this.createCanvas(12, 12);
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.arc(6, 6, 5, 0, Math.PI * 2);
      ctx.fill();
      this.register('proj_acid', canvas);
    }
  }

  // --- PARTICLES & VFX ---

  private static createVfxTextures(): void {
    // 1. Glowing Spark (8x8)
    {
      const [canvas, ctx] = this.createCanvas(8, 8);
      const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#ffaa00');
      grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 8);
      this.register('fx_spark', canvas);
    }

    // 2. Rock Debris Chunk (10x10)
    {
      const [canvas, ctx] = this.createCanvas(10, 10);
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.moveTo(2, 1); ctx.lineTo(8, 2); ctx.lineTo(9, 7); ctx.lineTo(5, 9); ctx.lineTo(1, 6);
      ctx.closePath();
      ctx.fill();
      this.register('fx_debris', canvas);
    }

    // 3. Shockwave Ring (64x64)
    {
      const [canvas, ctx] = this.createCanvas(64, 64);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.stroke();
      this.register('fx_shockwave', canvas);
    }

    // 4. Smoke Puff (24x24)
    {
      const [canvas, ctx] = this.createCanvas(24, 24);
      const grad = ctx.createRadialGradient(12, 12, 2, 12, 12, 11);
      grad.addColorStop(0, 'rgba(150, 150, 150, 0.8)');
      grad.addColorStop(1, 'rgba(50, 50, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(12, 12, 11, 0, Math.PI * 2);
      ctx.fill();
      this.register('fx_smoke', canvas);
    }
  }
}
