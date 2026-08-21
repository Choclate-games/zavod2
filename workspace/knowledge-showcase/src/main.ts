import './styles.css';
import { DemoHost } from './core/DemoHost';
import type { Demo } from './core/Demo';
import { TruckDemo } from './demos/TruckDemo';
import { FightingDemo } from './demos/FightingDemo';
import { RacingDemo } from './demos/RacingDemo';
import { TowerDefenseDemo } from './demos/TowerDefenseDemo';
import { RtsDemo } from './demos/RtsDemo';
import { BvhDemo } from './demos/BvhDemo';
import { YukaDemo } from './demos/YukaDemo';
import { PostFxDemo } from './demos/PostFxDemo';
import { RecastDemo } from './demos/RecastDemo';
import { FpsDemo } from './demos/FpsDemo';
import { MeleeDemo } from './demos/MeleeDemo';
import { SurvivorDemo } from './demos/SurvivorDemo';
import { StealthDemo } from './demos/StealthDemo';

type Lang = 'ru' | 'en';
let lang: Lang = 'ru';
let host: DemoHost;

/**
 * Реестр вкладок. Новое демо добавляется одной строкой — весь цикл кадра,
 * качество, ввод, звук и постобработка живут в DemoHost.
 */
const REGISTRY: Array<() => Demo> = [
  () => new TruckDemo(),
  () => new RacingDemo(),
  () => new FightingDemo(),
  () => new TowerDefenseDemo(),
  () => new RtsDemo(),
  () => new FpsDemo(),
  () => new MeleeDemo(),
  () => new SurvivorDemo(),
  () => new StealthDemo(),
  () => new BvhDemo(),
  () => new YukaDemo(),
  () => new PostFxDemo(),
  () => new RecastDemo(),
];

const UI = {
  ru: { title: '⚡ Стенд базы знаний фабрики', sound: ['🔊 Звук', '🔇 Звук'], loading: 'Загрузка…' },
  en: { title: '⚡ Factory Knowledge Showcase', sound: ['🔊 Sound', '🔇 Sound'], loading: 'Loading…' },
} as const;

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#game-canvas is missing');

  host = new DemoHost(canvas);
  const demos: Demo[] = [];
  for (const factory of REGISTRY) {
    const demo = factory();
    demos.push(demo);
    host.register(demo.id, () => demo);
  }

  buildTabs(demos);
  wireGlobalControls();

  await selectDemo(demos[0].id);
  host.start();
}

function buildTabs(demos: Demo[]): void {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;
  bar.innerHTML = '';
  for (const demo of demos) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.demo = demo.id;
    btn.textContent = demo.title[lang === 'ru' ? 0 : 1];
    btn.addEventListener('click', () => void selectDemo(demo.id));
    bar.append(btn);
  }
}

async function selectDemo(id: string): Promise<void> {
  const hint = document.getElementById('demo-hint');
  if (hint) hint.textContent = UI[lang].loading;

  await host.switchTo(id);

  document.querySelectorAll<HTMLElement>('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.demo === id);
  });
  refreshHint();
}

function refreshHint(): void {
  const demo = host.demo;
  const hint = document.getElementById('demo-hint');
  if (demo && hint) hint.innerHTML = demo.hint[lang === 'ru' ? 0 : 1];
}

function wireGlobalControls(): void {
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    lang = lang === 'ru' ? 'en' : 'ru';
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'ru' ? '🌐 RU' : '🌐 EN';
    const title = document.getElementById('title-text');
    if (title) title.textContent = UI[lang].title;
    document.querySelectorAll<HTMLElement>('.tab-btn').forEach((b) => {
      const demo = host.listDemos().find((d) => d.id === b.dataset.demo);
      if (demo) b.textContent = demo.title[lang === 'ru' ? 0 : 1];
    });
    refreshHint();
  });

  document.getElementById('mute-toggle')?.addEventListener('click', () => {
    const muted = host.audio.toggleMute();
    const btn = document.getElementById('mute-toggle');
    if (btn) btn.textContent = UI[lang].sound[muted ? 1 : 0];
  });

  const quality = document.getElementById('quality-select') as HTMLSelectElement | null;
  if (quality) {
    quality.value = host.qualityTier;
    quality.addEventListener('change', () => host.setTier(quality.value as 'low' | 'medium' | 'high'));
  }
}

void boot().catch((err) => {
  console.error('Showcase boot failed:', err);
  const hint = document.getElementById('demo-hint');
  if (hint) hint.textContent = `Ошибка загрузки: ${(err as Error).message}`;
});
