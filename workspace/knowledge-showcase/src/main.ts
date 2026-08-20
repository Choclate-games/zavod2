import './styles.css';
import { ShowcaseApp } from './showcase';

let app: ShowcaseApp | null = null;
let currentLang: 'ru' | 'en' = 'ru';

const TRANSLATIONS = {
  ru: {
    title: '⚡ Factory Knowledge Showcase',
    truckTab: '🚚 ЗиЛ-130 (Rapier 3D)',
    fpsTab: '🔫 FPS & Пинок',
    meleeTab: '⚔️ Слэшер & Парирование',
    physicsTab: '🧲 Трос, Время & Дэш',
    fluidTab: '🌊 Вода & Разрушения',
    swarmTab: '🐦 Рой & Выживание',
    gridTab: '🏗️ Сетка & База',
    stealthTab: '👁️ Стелс & Конусы',
    modelsTab: '🎨 3D Showroom',
    pixiTab: '👆 2D Сплайны & Доска',
    vfxTab: '✨ VFX & Шейдеры',
    soundTab: '🔊 Синтезатор & Ритм',

    truckHud: '<div style="font-weight:bold; color:#e67e22; margin-bottom:4px;">🚚 ЗиЛ-130: Честная физика Rapier 3D (WASM)</div><div>Управление: <kbd>W</kbd>/<kbd>S</kbd> Газ / Тормоз, <kbd>A</kbd>/<kbd>D</kbd> Руль, <kbd>Space</kbd> Ручник (Дрифт)</div><div>Динамическая лучевая подвеска, крен рамы, следы шин на грунте, брызги воды, синтез мотора.</div>',
    fpsHud: '<div style="font-weight:bold; color:#e74c3c; margin-bottom:4px;">🔫 FPS Шуттер & Спартанский пинок (PointerLock)</div><div>Кликните по экрану для захвата мыши | <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Бег | <kbd>ЛКМ</kbd> Стрельба с отдачей | <kbd>F</kbd> Пинок</div><div>Стреляйте по красным бочкам для каскадной цепной реакции взрывов!</div>',
    meleeHud: '<div style="font-weight:bold; color:#9b59b6; margin-bottom:4px;">⚔️ 3rd Person Слэшер & Парирование</div><div>Атака: <kbd>Space</kbd> или <kbd>ЛКМ</kbd> (3-ударное комбо + Hit-Stop) | Парирование: <kbd>Q</kbd> (щит, искры, звон)</div><div>Парируйте атаку врага в момент замаха, чтобы оглушить его и нанести добивающий нокаут!</div>',
    physicsHud: '<div style="font-weight:bold; color:#00cec9; margin-bottom:4px;">🧲 Физический трос, Отмотка времени & Дэш</div><div><kbd>ЛКМ</kbd> Выстрел крюком-кошкой в светящийся анкер | <kbd>Shift</kbd> Дэш со шлейфом</div><div>Зажмите <kbd>R</kbd> — отмотка времени назад (State Ring Buffer) и создание темпорального эхо-клона!</div>',
    fluidHud: '<div style="font-weight:bold; color:#0984e3; margin-bottom:4px;">🌊 Сила Архимеда, Разрушаемость & Добыча</div><div>Плавающие бочки качаются на синусоидальных волнах с наклоном по нормалям.</div><div>Используйте кнопки снизу: раскалывайте колонны на осколки и бурите породу для добычи кристаллов!</div>',
    swarmHud: '<div style="font-weight:bold; color:#f39c12; margin-bottom:4px;">🐦 Boids Рой дронов & Survivor Loop</div><div>100+ дронов по 3 правилам Рейнольдса (Separation, Alignment, Cohesion) преследуют героя.</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Движение | Орбитальные лезвия крошат орду, собирайте зеленые кристаллы XP!</div>',
    gridHud: '<div style="font-weight:bold; color:#2ecc71; margin-bottom:4px;">🏗️ Сетка размещения & Базовые конвейеры</div><div>Кликните по клетке сетки для постройки выбранного здания.</div><div>Добывающие буры создают ресурсы, конвейеры транспортируют их, турели защищают базу!</div>',
    stealthHud: '<div style="font-weight:bold; color:#e74c3c; margin-bottom:4px;">👁️ Стелс & Динамические 3D конусы зрения</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Прячьтесь за колоннами от лучей патрульного охранника.</div><div>Полигональный конус зрения динамически обрезается о препятствия (Raycast). Шкала тревоги: 0..100%.</div>',
    modelsHud: '<div style="font-weight:bold; color:#2ecc71; margin-bottom:4px;">🎨 100% Процедурный 3D Showroom</div><div>Все модели сгенерированы кодом без внешних .gltf файлов!</div><div>Переключайте модели кнопками снизу, тестируйте анимацию походки и режим сетки (Wireframe).</div>',
    pixiHud: '<div style="font-weight:bold; color:#00cec9; margin-bottom:4px;">👆 2D Сплайны Catmull-Rom, Fruit Slicer & Доска улик</div><div>Режим 1: нарисуйте путь жестом — юнит плавно поедет по кривой.</div><div>Режим 2: рубите летящие сферы лезвием | Режим 3: перетаскивайте улики с натягивающимися нитями.</div>',
    vfxHud: '<div style="font-weight:bold; color:#f39c12; margin-bottom:4px;">✨ VFX Instanced пул частиц (Zero GC) & Шейкер</div><div>1200+ активных частиц за 1 Draw Call. Запускайте эффекты кнопками снизу!</div><div>Кольцо ударной волны (Shockwave ring) и нелинейный спад травмы камеры.</div>',
    soundHud: '<div style="font-weight:bold; color:#3498db; margin-bottom:4px;">🔊 Процедурный синтезатор звуков & Ритм-игра</div><div>100% синтез на чистом Web Audio API без MP3. Нажимайте на кнопки звуков!</div><div>Крутите ползунок газа мотора, попадайте в ритм клавишей <kbd>Space</kbd>, смотрите на живой осциллограф!</div>',
  },
  en: {
    title: '⚡ Factory Knowledge Showcase',
    truckTab: '🚚 ZIL-130 (Rapier 3D)',
    fpsTab: '🔫 FPS & Spartan Kick',
    meleeTab: '⚔️ Slasher & Parry',
    physicsTab: '🧲 Hook, Rewind & Dash',
    fluidTab: '🌊 Buoyancy & Fracture',
    swarmTab: '🐦 Swarm & Survivor',
    gridTab: '🏗️ Grid & Base',
    stealthTab: '👁️ Stealth & Cones',
    modelsTab: '🎨 3D Showroom',
    pixiTab: '👆 2D Splines & Board',
    vfxTab: '✨ VFX & Shaders',
    soundTab: '🔊 Synth & Rhythm',

    truckHud: '<div style="font-weight:bold; color:#e67e22; margin-bottom:4px;">🚚 ZIL-130: Authentic Rapier 3D WASM Physics</div><div>Controls: <kbd>W</kbd>/<kbd>S</kbd> Drive/Brake, <kbd>A</kbd>/<kbd>D</kbd> Steer, <kbd>Space</kbd> Handbrake (Drift)</div><div>Raycast suspension, frame roll, tire skidmarks on terrain, water spray, engine audio synthesis.</div>',
    fpsHud: '<div style="font-weight:bold; color:#e74c3c; margin-bottom:4px;">🔫 FPS Shooter & Spartan Kick (PointerLock)</div><div>Click screen to lock cursor | <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Run | <kbd>LMB</kbd> Shoot with recoil | <kbd>F</kbd> Kick</div><div>Shoot red explosive barrels to trigger cascading kinetic chain reactions!</div>',
    meleeHud: '<div style="font-weight:bold; color:#9b59b6; margin-bottom:4px;">⚔️ 3rd Person Slasher & Parry</div><div>Attack: <kbd>Space</kbd> or <kbd>LMB</kbd> (3-hit combo + Hit-Stop) | Parry: <kbd>Q</kbd> (shield, sparks, clang)</div><div>Parry enemy swings just in time to stun them and unleash a finishing ragdoll knockdown!</div>',
    physicsHud: '<div style="font-weight:bold; color:#00cec9; margin-bottom:4px;">🧲 Grappling Hook, Time Rewind & Dash</div><div><kbd>LMB</kbd> Shoot grapple hook into glowing anchor | <kbd>Shift</kbd> Dash with ghost trail</div><div>Hold <kbd>R</kbd> — Braid-style Time Rewind (State Ring Buffer) and temporal Echo Clone!</div>',
    fluidHud: '<div style="font-weight:bold; color:#0984e3; margin-bottom:4px;">🌊 Archimedes Buoyancy, Fracture & Mining</div><div>Floating objects bob on dynamic sine waves tilted by surface wave normals.</div><div>Use buttons below: shatter stone pillars into physical debris and drill blocks for crystals!</div>',
    swarmHud: '<div style="font-weight:bold; color:#f39c12; margin-bottom:4px;">🐦 Boids Drone Swarm & Survivor Loop</div><div>100+ drones following Reynolds rules (Separation, Alignment, Cohesion) swarm the hero.</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move | Orbital blades shred the horde, collect green XP gems!</div>',
    gridHud: '<div style="font-weight:bold; color:#2ecc71; margin-bottom:4px;">🏗️ Building Grid & Logistics Conveyors</div><div>Click on grid cell to place selected building.</div><div>Mining drills produce resources, conveyor belts transport them, turrets defend the base!</div>',
    stealthHud: '<div style="font-weight:bold; color:#e74c3c; margin-bottom:4px;">👁️ Stealth & Dynamic 3D Vision Cones</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Sneak behind pillars to stay out of guard sight.</div><div>Polygonal vision cone dynamically clips against obstacles (Raycast). Suspicion: 0..100%.</div>',
    modelsHud: '<div style="font-weight:bold; color:#2ecc71; margin-bottom:4px;">🎨 100% Procedural 3D Showroom</div><div>All models generated purely via TypeScript code without external .gltf files!</div><div>Switch models using bottom buttons, test walk cycle animation and wireframe mode.</div>',
    pixiHud: '<div style="font-weight:bold; color:#00cec9; margin-bottom:4px;">👆 2D Catmull-Rom Splines, Slicer & Evidence Board</div><div>Mode 1: Draw path with finger/mouse — unit follows spline smoothly.</div><div>Mode 2: Slice flying targets | Mode 3: Drag evidence cards with gravity-sagging red yarn.</div>',
    vfxHud: '<div style="font-weight:bold; color:#f39c12; margin-bottom:4px;">✨ VFX Instanced Particle Pool (Zero GC) & Shake</div><div>1200+ active particles in 1 Draw Call. Trigger bursts using bottom buttons!</div><div>Shockwave expanding rings and nonlinear camera trauma shake decay.</div>',
    soundHud: '<div style="font-weight:bold; color:#3498db; margin-bottom:4px;">🔊 Procedural Sound Synthesizer & Rhythm Game</div><div>100% pure Web Audio API synthesis without MP3 files. Click sound buttons!</div><div>Modulate engine RPM, hit the rhythm with <kbd>Space</kbd>, view live audio oscilloscope!</div>',
  },
};

async function boot(): Promise<void> {
  const container = document.getElementById('game-root');
  if (!container) throw new Error('Game root is missing');

  app = new ShowcaseApp(container);
  await app.initialize();

  // Export Global Window Functions
  const w = window as any;

  w.switchMode = (mode: string) => {
    if (!app) return;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    (event?.target as HTMLElement)?.classList.add('active');
    app.switchMode(mode);
    updateHudText(mode);
  };

  w.toggleLanguage = () => {
    currentLang = currentLang === 'ru' ? 'en' : 'ru';
    const btn = document.getElementById('lang-toggle-btn');
    if (btn) btn.textContent = currentLang === 'ru' ? '🌐 RU' : '🌐 EN';
    updateTranslations();
    if (app) updateHudText(app.currentMode);
  };

  w.toggleMute = () => {
    if (!app) return;
    const muted = app.audioManager.toggleMute();
    const btn = document.getElementById('mute-toggle-btn');
    if (btn) btn.textContent = muted ? '🔇 Звук: ВЫКЛ' : '🔊 Звук: ВКЛ';
  };

  // Soundboard triggers
  w.playSound = (key: string) => {
    app?.soundboardMode?.playSound(key);
  };
  w.onEngineRpmChange = (val: number) => {
    app?.soundboardMode?.updateEngineRPM(val);
  };
  w.triggerRhythmHit = () => {
    app?.soundboardMode?.triggerRhythmHit();
  };

  // VFX triggers
  w.emitVfx = (type: any) => {
    app?.vfxMode?.emitBurst(type);
  };

  // Showroom triggers
  w.selectModel = (idx: number) => {
    app?.showroomMode?.selectModel(idx);
  };
  w.toggleWireframe = () => {
    app?.showroomMode?.toggleWireframe();
  };

  // Building triggers
  w.selectBuildingType = (type: any) => {
    if (app?.gridBuildingMode) {
      app.gridBuildingMode.selectedBuildingType = type;
      document.querySelectorAll('.build-btn').forEach((b) => b.classList.remove('active'));
      (event?.target as HTMLElement)?.classList.add('active');
    }
  };

  // Fluid / Destruction triggers
  w.smashPillar = () => {
    app?.fluidDestructionMode?.smashPillar();
  };
  w.drillVoxel = () => {
    app?.fluidDestructionMode?.drillVoxel();
  };

  // 2D Pixi sub-mode triggers
  w.selectPixiSubMode = (sub: any) => {
    if (app?.pixi2DMode) {
      app.pixi2DMode.subMode = sub;
      document.querySelectorAll('.pixi-sub-btn').forEach((b) => b.classList.remove('active'));
      (event?.target as HTMLElement)?.classList.add('active');
    }
  };

  // Roguelike Upgrade triggers
  w.choosePerk = (perk: string) => {
    app?.swarmSurvivorMode?.choosePerk(perk);
  };

  updateTranslations();
  updateHudText('truck');
}

function updateTranslations(): void {
  const t = TRANSLATIONS[currentLang];
  const titleEl = document.getElementById('title-text');
  if (titleEl) titleEl.textContent = t.title;

  const tabMap: Record<string, string> = {
    'tab-truck': t.truckTab,
    'tab-fps': t.fpsTab,
    'tab-melee': t.meleeTab,
    'tab-physics': t.physicsTab,
    'tab-fluid': t.fluidTab,
    'tab-swarm': t.swarmTab,
    'tab-grid': t.gridTab,
    'tab-stealth': t.stealthTab,
    'tab-models': t.modelsTab,
    'tab-pixi': t.pixiTab,
    'tab-vfx': t.vfxTab,
    'tab-sound': t.soundTab,
  };

  Object.entries(tabMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

function updateHudText(mode: string): void {
  const hud = document.getElementById('hud-info');
  if (!hud) return;
  const t = TRANSLATIONS[currentLang];

  const hudMap: Record<string, string> = {
    truck: t.truckHud,
    fps: t.fpsHud,
    melee: t.meleeHud,
    physics_sandbox: t.physicsHud,
    fluid_destruction: t.fluidHud,
    swarm_survivor: t.swarmHud,
    grid_building: t.gridHud,
    stealth: t.stealthHud,
    models: t.modelsHud,
    pixijs_2d: t.pixiHud,
    vfx: t.vfxHud,
    soundboard: t.soundHud,
  };

  hud.innerHTML = hudMap[mode] || '';
}

void boot().catch((err) => {
  console.error('Failed to boot ShowcaseApp:', err);
});
