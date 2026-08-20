import './styles.css';
import { ShowcaseApp } from './showcase';

let app: ShowcaseApp | null = null;

async function boot(): Promise<void> {
  const container = document.getElementById('game-root');
  if (!container) throw new Error('Game root is missing');

  app = new ShowcaseApp(container);
  await app.initialize();

  // Экспорт функции переключения режима в глобальную область
  (window as any).switchMode = (mode: string) => {
    if (!app) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    (event?.target as HTMLElement)?.classList.add('active');
    app.switchMode(mode);
    updateHudText(mode);
  };
}

function updateHudText(mode: string): void {
  const hud = document.getElementById('hud-info');
  if (!hud) return;

  if (mode === 'truck') {
    hud.innerHTML = `
      <div style="font-weight:bold; color:#e67e22; margin-bottom:4px;">🚚 ЗиЛ-130: 100% честная физика Rapier 3D (WASM)</div>
      <div>Управление: <kbd>W</kbd>/<kbd>S</kbd> Газ / Тормоз, <kbd>A</kbd>/<kbd>D</kbd> Руль</div>
      <div>Настоящая динамическая подвеска с лучевым прощупыванием рельефа (Raycast Vehicle)!</div>
      <div>Грязь, пробуксовка, крен рамы, дым из выхлопной трубы!</div>
    `;
  } else if (mode === 'fps') {
    hud.innerHTML = `
      <div style="font-weight:bold; color:#e74c3c; margin-bottom:4px;">🔫 FPS Шуттер & Пинок (PointerLock)</div>
      <div>1. Кликните по экрану для захвата мыши (PointerLock)</div>
      <div>2. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Бег | <kbd>ЛКМ</kbd> Стрельба с отдачей | <kbd>F</kbd> Спартанский пинок</div>
    `;
  } else if (mode === 'melee') {
    hud.innerHTML = `
      <div style="font-weight:bold; color:#9b59b6; margin-bottom:4px;">⚔️ 3rd Person Слэшер & Парирование</div>
      <div>Удар мечом: <kbd>Space</kbd> или <kbd>ЛКМ</kbd> (3-ударное комбо + хит-стоп)</div>
      <div>Парирование: <kbd>Q</kbd> (щит, искры, скрежет металла)</div>
    `;
  } else if (mode === 'models') {
    hud.innerHTML = `<div style="font-weight:bold; color:#2ecc71;">🎨 Процедурный 3D Showroom</div><div>Модели собраны кодом без внешних .gltf!</div>`;
  } else if (mode === 'gestures') {
    hud.innerHTML = `<div style="font-weight:bold; color:#00cec9;">👆 Свайпы & Жесты (Fruit Ninja Blade)</div><div>Зажмите <kbd>ЛКМ</kbd> и проведите по экрану — лезвие режет со шлейфом!</div>`;
  } else if (mode === 'vfx_shaders') {
    hud.innerHTML = `<div style="font-weight:bold; color:#f39c12;">✨ VFX Частицы & GLSL Шейдеры</div><div>Инстансированные частицы без сборки мусора (Zero GC).</div>`;
  } else if (mode === 'soundboard') {
    hud.innerHTML = `<div style="font-weight:bold; color:#3498db;">🔊 Web Audio Soundboard</div><div>Чистый синтез звуков без MP3.</div>`;
  }
}

void boot().catch((err) => {
  console.error('Failed to boot ShowcaseApp:', err);
});
