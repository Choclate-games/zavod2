import { Application, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { SwarmEngine } from '../core/SwarmEngine';
import { FlowFieldGrid } from '../core/FlowFieldGrid';
import { LivingStructureManager } from '../core/LivingStructureManager';
import { Nest } from '../entities/Nest';
import { Obstacle, ObstacleType } from '../entities/Obstacle';
import { BiomassNode } from '../entities/BiomassNode';
import { Team, Caste } from '../entities/AntTypes';
import { TextureFactory } from './TextureFactory';
import { VFXSystem } from './VFXSystem';

export class SceneManager {
  public app!: Application;
  public worldContainer!: Container;

  // Scene Graph Layers
  private backgroundLayer!: Container;
  private obstacleLayer!: Container;
  private biomassLayer!: Container;
  private structureLayer!: Container;
  private nestLayer!: Container;
  private pheromoneLayer!: Graphics;
  private swarmLayer!: Container;
  private vfxLayerContainer!: Container;

  public vfxSystem!: VFXSystem;

  // Swarm sprite pool (1200 pre-allocated sprites)
  private antSprites: Sprite[] = [];

  // Nest graphic objects
  private nestGraphics: Map<number, { container: Container; bg: Graphics; ring: Graphics; text: Text }> = new Map();

  // Obstacle graphics
  private obstacleGraphics: Map<number, { g: Graphics; text?: Text }> = new Map();

  // Biomass graphics
  private biomassGraphics: Map<number, { g: Graphics; text: Text }> = new Map();

  // Living structure graphics
  private bridgeGraphics!: Graphics;
  private sphereGraphics!: Graphics;

  // Camera
  public camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: 1.0,
    targetZoom: 1.0,
    minZoom: 0.65,
    maxZoom: 1.6
  };

  public isInitialized = false;

  constructor() {}

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application();

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    await this.app.init({
      canvas,
      resizeTo: window,
      autoDensity: true,
      resolution: dpr,
      backgroundColor: 0x0d140e,
      antialias: true
    });

    TextureFactory.generateAllTextures(this.app);

    // Root World Container
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Create Layers
    this.backgroundLayer = new Container();
    this.obstacleLayer = new Container();
    this.biomassLayer = new Container();
    this.structureLayer = new Container();
    this.nestLayer = new Container();
    this.pheromoneLayer = new Graphics();
    this.swarmLayer = new Container();
    this.vfxLayerContainer = new Container();

    this.bridgeGraphics = new Graphics();
    this.sphereGraphics = new Graphics();
    this.structureLayer.addChild(this.bridgeGraphics);
    this.structureLayer.addChild(this.sphereGraphics);

    this.worldContainer.addChild(this.backgroundLayer);
    this.worldContainer.addChild(this.obstacleLayer);
    this.worldContainer.addChild(this.biomassLayer);
    this.worldContainer.addChild(this.structureLayer);
    this.worldContainer.addChild(this.nestLayer);
    this.worldContainer.addChild(this.pheromoneLayer);
    this.worldContainer.addChild(this.swarmLayer);
    this.worldContainer.addChild(this.vfxLayerContainer);

    // Initialize VFX System
    this.vfxSystem = new VFXSystem(this.vfxLayerContainer);

    // Pre-allocate Ant Sprites Pool
    for (let i = 0; i < 1200; i++) {
      const sprite = new Sprite(TextureFactory.getAntTexture(Caste.WORKER, Team.PLAYER));
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.swarmLayer.addChild(sprite);
      this.antSprites.push(sprite);
    }

    this.isInitialized = true;
    window.addEventListener('resize', this.onResize);
  }

  public setupLevel(
    worldWidth: number,
    worldHeight: number,
    nests: Nest[],
    obstacles: Obstacle[],
    biomassNodes: BiomassNode[]
  ): void {
    // 1. Draw Organic Forest Background
    this.backgroundLayer.removeChildren();
    const bgG = new Graphics();

    // Deep soil / forest floor gradient base
    bgG.rect(0, 0, worldWidth, worldHeight);
    bgG.fill({ color: 0x111c13 });

    // Stylized moss patches and root veins
    const patchCount = Math.floor((worldWidth * worldHeight) / 25000);
    for (let i = 0; i < patchCount; i++) {
      const px = Math.random() * worldWidth;
      const py = Math.random() * worldHeight;
      const pr = 40 + Math.random() * 80;
      const color = Math.random() < 0.5 ? 0x172b1a : 0x1d3621;
      bgG.circle(px, py, pr);
      bgG.fill({ color, alpha: 0.7 });
    }

    // Outer boundary border
    bgG.rect(4, 4, worldWidth - 8, worldHeight - 8);
    bgG.stroke({ width: 8, color: 0x2d472c, alpha: 0.6 });

    this.backgroundLayer.addChild(bgG);

    // 2. Setup Nest Objects
    this.nestLayer.removeChildren();
    this.nestGraphics.clear();

    const textStyle = new TextStyle({
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#ffffff',
      stroke: { color: '#000000', width: 3 }
    });

    for (const nest of nests) {
      const nContainer = new Container();
      nContainer.position.set(nest.x, nest.y);

      const bg = new Graphics();
      const ring = new Graphics();
      const text = new Text({ text: `${Math.round(nest.garrison)}`, style: textStyle });
      text.anchor.set(0.5);

      nContainer.addChild(bg);
      nContainer.addChild(ring);
      nContainer.addChild(text);
      this.nestLayer.addChild(nContainer);

      this.nestGraphics.set(nest.id, { container: nContainer, bg, ring, text });
    }

    // 3. Setup Obstacles
    this.obstacleLayer.removeChildren();
    this.obstacleGraphics.clear();

    for (const obs of obstacles) {
      const g = new Graphics();
      let obsText: Text | undefined;

      if (obs.type === ObstacleType.DESTRUCTIBLE_WALL) {
        obsText = new Text({ text: `🛡️ ${Math.round(obs.hp)}`, style: textStyle });
        obsText.anchor.set(0.5);
        obsText.position.set(obs.x, obs.y);
        this.obstacleLayer.addChild(obsText);
      }

      this.obstacleLayer.addChild(g);
      this.obstacleGraphics.set(obs.id, { g, text: obsText });
    }

    // 4. Setup Biomass Nodes
    this.biomassLayer.removeChildren();
    this.biomassGraphics.clear();

    for (const node of biomassNodes) {
      const g = new Graphics();
      const bText = new Text({ text: `${Math.round(node.amount)} 🧬`, style: textStyle });
      bText.anchor.set(0.5);
      bText.position.set(node.x, node.y + node.radius + 12);

      this.biomassLayer.addChild(g);
      this.biomassLayer.addChild(bText);
      this.biomassGraphics.set(node.id, { g, text: bText });
    }

    // Center camera on Player HQ
    const playerHQ = nests.find((n) => n.team === Team.PLAYER && n.isHQ) || nests[0];
    if (playerHQ) {
      this.camera.targetX = playerHQ.x;
      this.camera.targetY = playerHQ.y;
      this.camera.x = playerHQ.x;
      this.camera.y = playerHQ.y;
    }
  }

  public renderScene(
    dt: number,
    swarm: SwarmEngine,
    flowGrid: FlowFieldGrid,
    structures: LivingStructureManager,
    nests: Nest[],
    obstacles: Obstacle[],
    biomassNodes: BiomassNode[]
  ): void {
    if (!this.isInitialized) return;

    // 1. Smooth Camera Lerp & Viewport Transform
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.1;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    this.vfxSystem.update(dt);

    const shakeX = this.vfxSystem.shakeOffsetX;
    const shakeY = this.vfxSystem.shakeOffsetY;

    this.worldContainer.scale.set(this.camera.zoom);
    this.worldContainer.position.set(
      screenW * 0.5 - this.camera.x * this.camera.zoom + shakeX,
      screenH * 0.5 - this.camera.y * this.camera.zoom + shakeY
    );

    // 2. Render Pheromone Trails
    this.pheromoneLayer.clear();
    const cellSize = flowGrid.cellSize;
    for (let i = 0; i < flowGrid.totalCells; i++) {
      const intensity = flowGrid.intensity[i];
      if (intensity > 0.05) {
        const c = i % flowGrid.cols;
        const r = Math.floor(i / flowGrid.cols);
        const px = (c + 0.5) * cellSize;
        const py = (r + 0.5) * cellSize;
        const dirX = flowGrid.dirX[i];
        const dirY = flowGrid.dirY[i];

        // Glowing dot
        this.pheromoneLayer.circle(px, py, cellSize * 0.5 * intensity);
        this.pheromoneLayer.fill({ color: 0x39ff14, alpha: intensity * 0.25 });

        // Vector directional arrow
        this.pheromoneLayer.moveTo(px, py);
        this.pheromoneLayer.lineTo(px + dirX * 12 * intensity, py + dirY * 12 * intensity);
        this.pheromoneLayer.stroke({ width: 2 * intensity, color: 0x76ff03, alpha: intensity * 0.6 });
      }
    }

    // 3. Render Nests
    for (const nest of nests) {
      const gObj = this.nestGraphics.get(nest.id);
      if (!gObj) continue;

      const { bg, ring, text } = gObj;
      bg.clear();
      ring.clear();

      let teamColor = 0xffd700; // Neutral
      if (nest.team === Team.PLAYER) teamColor = 0x39ff14;
      else if (nest.team === Team.ENEMY) teamColor = 0xff3355;

      const pulse = 1.0 + Math.sin(nest.pulseTimer) * 0.06;

      // Outer glow & mound
      bg.circle(0, 0, (nest.radius + 6) * pulse);
      bg.fill({ color: teamColor, alpha: 0.25 });

      bg.circle(0, 0, nest.radius);
      bg.fill({ color: 0x221810 });
      bg.stroke({ width: 3, color: teamColor });

      // Entrance tunnel
      bg.circle(0, 0, nest.radius * 0.45);
      bg.fill({ color: 0x090604 });

      // Capture progress ring
      if (nest.captureScore !== 0) {
        const angle = (Math.abs(nest.captureScore) / 100) * Math.PI * 2;
        const ringColor = nest.captureScore > 0 ? 0x39ff14 : 0xff3355;

        ring.arc(0, 0, nest.radius + 8, -Math.PI / 2, -Math.PI / 2 + angle);
        ring.stroke({ width: 4, color: ringColor, alpha: 0.85 });
      }

      text.text = `${Math.round(nest.garrison)}`;
      if (nest.hitTimer > 0) {
        bg.tint = 0xffffff;
      } else {
        bg.tint = 0xffffff;
      }
    }

    // 4. Render Obstacles
    for (const obs of obstacles) {
      const gObj = this.obstacleGraphics.get(obs.id);
      if (!gObj) continue;

      const { g, text } = gObj;
      g.clear();

      if (obs.isDestroyed) {
        if (text) text.visible = false;
        continue;
      }

      const left = obs.x - obs.width / 2;
      const top = obs.y - obs.height / 2;

      if (obs.type === ObstacleType.CHASM) {
        // Deep abyss hole
        g.rect(left, top, obs.width, obs.height);
        g.fill({ color: 0x050805 });
        g.stroke({ width: 3, color: 0x1f2e22 });
      } else if (obs.type === ObstacleType.RIVER) {
        // Flowing river
        g.rect(left, top, obs.width, obs.height);
        g.fill({ color: 0x0a3038, alpha: 0.85 });
        g.stroke({ width: 2, color: 0x00e5ff, alpha: 0.5 });
      } else if (obs.type === ObstacleType.DESTRUCTIBLE_WALL) {
        // Wooden / Stone Barricade
        const hpPercent = obs.hp / obs.maxHp;
        g.rect(left, top, obs.width, obs.height);
        g.fill({ color: 0x3d281a });
        g.stroke({ width: 3, color: 0x8a5835 });

        // Health meter bar above wall
        g.rect(left, top - 12, obs.width, 6);
        g.fill({ color: 0x111111 });
        g.rect(left, top - 12, obs.width * hpPercent, 6);
        g.fill({ color: hpPercent > 0.3 ? 0x2ecc40 : 0xff3355 });

        if (text) {
          text.text = `🛡️ ${Math.round(obs.hp)}`;
        }
      }
    }

    // 5. Render Biomass Nodes
    for (const node of biomassNodes) {
      const gObj = this.biomassGraphics.get(node.id);
      if (!gObj) continue;

      const { g, text } = gObj;
      g.clear();

      if (node.isDepleted) {
        text.visible = false;
        continue;
      }

      const pulse = 1.0 + Math.sin(node.pulseTimer) * 0.12;

      // Glowing crystal orb
      g.circle(node.x, node.y, (node.radius + 8) * pulse);
      g.fill({ color: 0x00e5ff, alpha: 0.25 });

      g.circle(node.x, node.y, node.radius);
      g.fill({ color: 0x00e5ff, alpha: 0.9 });
      g.stroke({ width: 2, color: 0xffffff });

      text.text = `${Math.round(node.amount)} 🧬`;
    }

    // 6. Render Living Structures (Bridges & Sphere)
    this.bridgeGraphics.clear();
    for (const [, bridge] of structures.bridges) {
      const nodes = bridge.nodes;
      if (nodes.length < 2) continue;

      // Draw chitinous bridge chain
      this.bridgeGraphics.moveTo(nodes[0].x, nodes[0].y);
      for (let i = 1; i < nodes.length; i++) {
        this.bridgeGraphics.lineTo(nodes[i].x, nodes[i].y);
      }

      const bridgeAlpha = bridge.isComplete ? 0.95 : 0.45;
      const bridgeColor = bridge.isComplete ? 0x39ff14 : 0xffaa00;

      this.bridgeGraphics.stroke({
        width: bridge.isComplete ? 14 : 6,
        color: bridgeColor,
        alpha: bridgeAlpha,
        cap: 'round',
        join: 'round'
      });

      // Individual link nodes
      for (const nd of nodes) {
        this.bridgeGraphics.circle(nd.x, nd.y, 4);
        this.bridgeGraphics.fill({ color: 0x112211 });
      }
    }

    this.sphereGraphics.clear();
    if (structures.isSphereActive) {
      const sc = structures.sphereCenter;
      this.sphereGraphics.circle(sc.x, sc.y, structures.sphereRadius * 1.1);
      this.sphereGraphics.stroke({ width: 3, color: 0x00e5ff, alpha: 0.7 });
    }

    // 7. Render Swarm Ants
    for (let i = 0; i < swarm.MAX_ANTS; i++) {
      const sprite = this.antSprites[i];
      if (swarm.active[i] === 1) {
        sprite.visible = true;
        sprite.position.set(swarm.posX[i], swarm.posY[i]);

        const vx = swarm.velX[i];
        const vy = swarm.velY[i];
        const angle = Math.atan2(vy, vx) + Math.PI / 2; // +90 deg because sprite points up
        sprite.rotation = angle;

        const caste = swarm.caste[i] as Caste;
        const team = swarm.team[i] as Team;
        sprite.texture = TextureFactory.getAntTexture(caste, team);
      } else {
        sprite.visible = false;
      }
    }
  }

  private onResize = (): void => {
    // Update --vp-h CSS variable for mobile browsers
    document.documentElement.style.setProperty('--vp-h', `${window.innerHeight}px`);
  };
}

export const sceneManager = new SceneManager();
