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
let allDemos: Demo[] = [];
let selectedCategoryId: string = 'all';
let searchQuery: string = '';
let isCatalogOpen: boolean = false;

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
  ru: {
    title: '⚡ Стенд базы знаний',
    sound: ['🔊 Звук', '🔇 Звук'],
    loading: 'Загрузка…',
    catalogTitle: 'Каталог демонстраций',
    allCategories: 'Все',
    searchPlaceholder: 'Поиск по названию или тегам…',
    emptyResults: 'Ничего не найдено',
    activeBadge: 'Активно',
    footerHint: 'Быстрое переключение: <b>Q</b> / <b>E</b> или <b>[</b> / <b>]</b> · Меню: <b>M</b> · Закрыть: <b>Esc</b>',
    prevTitle: 'Предыдущее демо (Q / [)',
    nextTitle: 'Следующее демо (E / ])',
  },
  en: {
    title: '⚡ Knowledge Showcase',
    sound: ['🔊 Sound', '🔇 Sound'],
    loading: 'Loading…',
    catalogTitle: 'Demonstration Catalog',
    allCategories: 'All',
    searchPlaceholder: 'Search by title or tags…',
    emptyResults: 'No demos found',
    activeBadge: 'Active',
    footerHint: 'Quick switcher: <b>Q</b> / <b>E</b> or <b>[</b> / <b>]</b> · Menu: <b>M</b> · Close: <b>Esc</b>',
    prevTitle: 'Previous demo (Q / [)',
    nextTitle: 'Next demo (E / ])',
  },
} as const;

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#game-canvas is missing');

  host = new DemoHost(canvas);
  allDemos = [];
  for (const factory of REGISTRY) {
    const demo = factory();
    allDemos.push(demo);
    host.register(demo.id, () => demo);
  }

  wireGlobalControls();
  wireCatalogEvents();

  await selectDemo(allDemos[0].id);
  host.start();
}

function updateHeaderSelector(targetId?: string): void {
  const activeId = targetId || host.activeId || allDemos[0]?.id;
  const currentDemo = allDemos.find((d) => d.id === activeId) || host.demo || allDemos[0];
  const titleEl = document.getElementById('current-demo-title');
  const countBadgeEl = document.getElementById('demo-count-badge');
  const prevBtn = document.getElementById('demo-prev-btn');
  const nextBtn = document.getElementById('demo-next-btn');

  if (titleEl && currentDemo) {
    titleEl.textContent = currentDemo.title[lang === 'ru' ? 0 : 1];
  }
  if (currentDemo) {
    document.title = `${currentDemo.title[lang === 'ru' ? 0 : 1]} | ${UI[lang].title}`;
  }
  if (countBadgeEl) {
    countBadgeEl.textContent = String(allDemos.length);
  }
  if (prevBtn) prevBtn.title = UI[lang].prevTitle;
  if (nextBtn) nextBtn.title = UI[lang].nextTitle;
}

async function selectDemo(id: string): Promise<void> {
  // Мгновенно обновляем название и заголовок вкладки
  updateHeaderSelector(id);

  const hint = document.getElementById('demo-hint');
  if (hint) hint.textContent = UI[lang].loading;

  if (isCatalogOpen) {
    renderCatalog();
  }

  await host.switchTo(id);

  updateHeaderSelector(id);
  refreshHint();
  if (isCatalogOpen) {
    renderCatalog();
  }
}

function navigateDemo(offset: -1 | 1): void {
  if (allDemos.length === 0) return;
  const currentId = host.activeId || allDemos[0].id;
  const currentIndex = allDemos.findIndex((d) => d.id === currentId);
  const nextIndex = (currentIndex + offset + allDemos.length) % allDemos.length;
  void selectDemo(allDemos[nextIndex].id);
}

function refreshHint(): void {
  const demo = host.demo;
  const hint = document.getElementById('demo-hint');
  if (demo && hint) hint.innerHTML = demo.hint[lang === 'ru' ? 0 : 1];
}

function openCatalog(): void {
  isCatalogOpen = true;
  const modal = document.getElementById('catalog-modal');
  if (modal) modal.style.display = 'flex';
  renderCatalog();
  const searchInput = document.getElementById('catalog-search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.focus();
  }
}

function closeCatalog(): void {
  isCatalogOpen = false;
  const modal = document.getElementById('catalog-modal');
  if (modal) modal.style.display = 'none';
}

function toggleCatalog(): void {
  if (isCatalogOpen) {
    closeCatalog();
  } else {
    openCatalog();
  }
}

function getDistinctCategories(): Array<{ id: string; name: string; count: number }> {
  const langIdx = lang === 'ru' ? 0 : 1;
  const map = new Map<string, { id: string; name: string; count: number }>();

  for (const demo of allDemos) {
    const catName = demo.category ? demo.category[langIdx] : (lang === 'ru' ? '📦 Прочее' : '📦 Other');
    const catId = demo.category ? demo.category[0] : 'other';

    const existing = map.get(catId);
    if (existing) {
      existing.count++;
    } else {
      map.set(catId, { id: catId, name: catName, count: 1 });
    }
  }

  return [
    { id: 'all', name: UI[lang].allCategories, count: allDemos.length },
    ...Array.from(map.values()),
  ];
}

function renderCatalog(): void {
  const langIdx = lang === 'ru' ? 0 : 1;
  const titleEl = document.getElementById('catalog-title');
  const totalBadge = document.getElementById('catalog-total-badge');
  const searchInput = document.getElementById('catalog-search') as HTMLInputElement | null;
  const footerHint = document.getElementById('catalog-footer-hint');
  const emptyText = document.getElementById('catalog-empty-text');

  if (titleEl) titleEl.textContent = UI[lang].catalogTitle;
  if (totalBadge) totalBadge.textContent = String(allDemos.length);
  if (searchInput) searchInput.placeholder = UI[lang].searchPlaceholder;
  if (footerHint) footerHint.innerHTML = UI[lang].footerHint;
  if (emptyText) emptyText.textContent = UI[lang].emptyResults;

  // 1. Рендерим чипсы категорий
  const catContainer = document.getElementById('catalog-categories');
  if (catContainer) {
    catContainer.innerHTML = '';
    const categories = getDistinctCategories();

    // Проверяем, существует ли ещё выбранная категория
    if (selectedCategoryId !== 'all' && !categories.some((c) => c.id === selectedCategoryId)) {
      selectedCategoryId = 'all';
    }

    for (const cat of categories) {
      const chip = document.createElement('button');
      chip.className = `cat-chip ${cat.id === selectedCategoryId ? 'active' : ''}`;
      chip.innerHTML = `${cat.name} <span class="cat-chip-count">${cat.count}</span>`;
      chip.addEventListener('click', () => {
        selectedCategoryId = cat.id;
        renderCatalog();
      });
      catContainer.append(chip);
    }
  }

  // 2. Фильтруем демо по категории и поисковому запросу
  const query = searchQuery.trim().toLowerCase();
  const filtered = allDemos.filter((demo) => {
    // Фильтр по категории
    if (selectedCategoryId !== 'all') {
      const demoCatId = demo.category ? demo.category[0] : 'other';
      if (demoCatId !== selectedCategoryId) return false;
    }

    // Фильтр по поиску
    if (query) {
      const titleRu = demo.title[0].toLowerCase();
      const titleEn = demo.title[1].toLowerCase();
      const catRu = demo.category ? demo.category[0].toLowerCase() : '';
      const catEn = demo.category ? demo.category[1].toLowerCase() : '';
      const tags = demo.tags ? demo.tags.join(' ').toLowerCase() : '';
      const match =
        titleRu.includes(query) ||
        titleEn.includes(query) ||
        catRu.includes(query) ||
        catEn.includes(query) ||
        tags.includes(query);
      if (!match) return false;
    }

    return true;
  });

  // 3. Рендерим сетку карточек
  const grid = document.getElementById('catalog-grid');
  const emptyState = document.getElementById('catalog-empty');

  if (grid && emptyState) {
    grid.innerHTML = '';
    if (filtered.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      const activeId = host.activeId || allDemos[0]?.id;

      for (const demo of filtered) {
        const isActive = demo.id === activeId;
        const card = document.createElement('div');
        card.className = `demo-card ${isActive ? 'active' : ''}`;
        card.setAttribute('role', 'button');
        card.tabIndex = 0;

        const titleText = demo.title[langIdx];
        const catText = demo.category ? demo.category[langIdx] : '';

        // Извлекаем чистый текст подсказки
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = demo.hint[langIdx];
        const hintHtml = tempDiv.innerHTML;

        card.innerHTML = `
          <div class="demo-card-top">
            <div class="demo-card-title-wrap">
              <span class="demo-card-title">${titleText}</span>
            </div>
            ${isActive ? `<span class="demo-card-badge-active">${UI[lang].activeBadge}</span>` : ''}
          </div>
          ${catText ? `<div class="demo-card-cat">${catText}</div>` : ''}
          <div class="demo-card-hint">${hintHtml}</div>
        `;

        const onSelect = (): void => {
          void selectDemo(demo.id);
          closeCatalog();
        };

        card.addEventListener('click', onSelect);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        });

        grid.append(card);
      }
    }
  }
}

function wireCatalogEvents(): void {
  const triggerBtn = document.getElementById('demo-catalog-trigger');
  const closeBtn = document.getElementById('catalog-close-btn');
  const modal = document.getElementById('catalog-modal');
  const prevBtn = document.getElementById('demo-prev-btn');
  const nextBtn = document.getElementById('demo-next-btn');
  const searchInput = document.getElementById('catalog-search') as HTMLInputElement | null;
  const searchClear = document.getElementById('catalog-search-clear');

  triggerBtn?.addEventListener('click', () => toggleCatalog());
  closeBtn?.addEventListener('click', () => closeCatalog());

  prevBtn?.addEventListener('click', () => navigateDemo(-1));
  nextBtn?.addEventListener('click', () => navigateDemo(1));

  // Клик по фону закрывает модалку
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCatalog();
    }
  });

  // Поиск
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchClear) {
      searchClear.style.display = searchQuery ? 'block' : 'none';
    }
    renderCatalog();
  });

  searchClear?.addEventListener('click', () => {
    searchQuery = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    if (searchClear) searchClear.style.display = 'none';
    renderCatalog();
  });

  // Глобальные горячие клавиши
  window.addEventListener('keydown', (e) => {
    const isTyping =
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.tagName === 'SELECT';

    if (e.key === 'Escape') {
      if (isCatalogOpen) {
        e.preventDefault();
        closeCatalog();
      }
      return;
    }

    if (!isTyping) {
      if (e.key === 'q' || e.key === 'Q' || e.key === '[') {
        navigateDemo(-1);
      } else if (e.key === 'e' || e.key === 'E' || e.key === ']') {
        navigateDemo(1);
      } else if (e.key === 'm' || e.key === 'M') {
        toggleCatalog();
      }
    }
  });
}

function wireGlobalControls(): void {
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    lang = lang === 'ru' ? 'en' : 'ru';
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'ru' ? '🌐 RU' : '🌐 EN';
    const title = document.getElementById('title-text');
    if (title) title.textContent = UI[lang].title;

    updateHeaderSelector();
    refreshHint();
    if (isCatalogOpen) {
      renderCatalog();
    }
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
