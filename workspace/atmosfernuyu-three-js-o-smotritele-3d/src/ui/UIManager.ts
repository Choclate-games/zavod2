import { i18n } from '../i18n/I18n';
import { VirtualJoystick } from './VirtualJoystick';
import { CardModal } from './CardModal';
import type { InputManager } from '../core/InputManager';
import type { UpgradeCard } from '../systems/UpgradeManager';

type ScreenName = 'loading' | 'menu' | 'how' | 'pause' | 'results' | null;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export interface ResultsData {
  victory: boolean;
  depth: number;
  samples: number;
  wave: number;
  bestDepth: number;
  canRevive: boolean;
  canDouble: boolean;
}

/**
 * UI & HUD Layer. Owns the HTML/CSS overlay: resource bars, wave/depth readouts,
 * menus, pause, results, loading, the touch controls and the upgrade card modal.
 * All user-visible strings route through i18n so localization is enforced.
 */
export class UIManager {
  // Callbacks wired by Game.
  onPlay = (): void => {};
  onResume = (): void => {};
  onQuit = (): void => {};
  onRetry = (): void => {};
  onMenu = (): void => {};
  onHow = (): void => {};
  onRevive = (): void => {};
  onDouble = (): void => {};
  onUpgradeChoose: (id: string) => void = () => {};
  onReroll = (): void => {};
  onToggleMute = (): void => {};

  readonly joystick: VirtualJoystick;
  readonly cardModal: CardModal;

  private hud!: HTMLDivElement;
  private airFill!: HTMLDivElement;
  private energyFill!: HTMLDivElement;
  private hullFill!: HTMLDivElement;
  private depthReadout!: HTMLDivElement;
  private samplesReadout!: HTMLDivElement;
  private waveReadout!: HTMLDivElement;
  private hypeFill!: HTMLDivElement;
  private toastEl!: HTMLDivElement;
  private loadingFill!: HTMLDivElement;

  private screens: Record<Exclude<ScreenName, null>, HTMLDivElement> =
    {} as Record<Exclude<ScreenName, null>, HTMLDivElement>;
  private touchActive = false;

  constructor(
    private readonly root: HTMLElement,
    input: InputManager,
  ) {
    this.buildHud();
    this.buildScreens();
    this.joystick = new VirtualJoystick(root, input);
    this.cardModal = new CardModal(root);
    this.refreshText();
    this.showScreen('loading');
  }

  private buildHud(): void {
    this.hud = h('div', { id: 'hud' });
    const topLeft = h('div', { class: 'hud-topleft' });
    const mkStat = (labelKey: string, barClass: string) => {
      const stat = h('div', { class: 'stat' });
      stat.appendChild(h('span', { class: 'label', 'data-i18n': labelKey }, i18n.t(labelKey)));
      const bar = h('div', { class: `bar ${barClass}` });
      const fill = h('div', { class: 'fill' });
      bar.appendChild(fill);
      stat.appendChild(bar);
      topLeft.appendChild(stat);
      return fill;
    };
    this.airFill = mkStat('hud.air', 'air');
    this.energyFill = mkStat('hud.energy', 'energy');
    this.hullFill = mkStat('hud.hull', 'hull');

    const topRight = h('div', { class: 'hud-topright' });
    this.depthReadout = h('div', { class: 'hud-readout' });
    this.samplesReadout = h('div', { class: 'hud-readout' });
    this.waveReadout = h('div', { class: 'hud-readout' });
    topRight.append(this.depthReadout, this.samplesReadout, this.waveReadout);

    const hypeWrap = h('div', { id: 'hype-wrap' });
    const hypeBar = h('div', { id: 'hype-bar' });
    this.hypeFill = h('div', { class: 'fill' });
    hypeBar.appendChild(this.hypeFill);
    const hypeLabel = h('div', { id: 'hype-label', 'data-i18n': 'hud.hype' }, i18n.t('hud.hype'));
    hypeWrap.append(hypeBar, hypeLabel);

    this.toastEl = h('div', { id: 'toast' });

    this.hud.append(topLeft, topRight, hypeWrap, this.toastEl);
    this.root.appendChild(this.hud);
  }

  private buildScreens(): void {
    // Loading
    const loading = h('div', { class: 'screen', id: 'screen-loading' });
    loading.appendChild(h('div', { class: 'panel' }, `<h1 data-i18n="title">${i18n.t('title')}</h1><p data-i18n="loading.title">${i18n.t('loading.title')}</p>`));
    const loaderBar = h('div', { class: 'loader-bar' });
    this.loadingFill = h('div', { id: 'loading-fill' });
    loaderBar.appendChild(this.loadingFill);
    loading.appendChild(loaderBar);
    this.screens.loading = loading;

    // Menu
    const menu = h('div', { class: 'screen', id: 'screen-menu' });
    const menuPanel = h('div', { class: 'panel' });
    menuPanel.appendChild(h('h1', { 'data-i18n': 'title' }, i18n.t('title')));
    menuPanel.appendChild(h('p', { id: 'menu-best' }));
    menuPanel.appendChild(h('p', { id: 'menu-samples' }));
    const playBtn = h('button', { class: 'btn', id: 'btn-play', 'data-i18n': 'menu.play' }, i18n.t('menu.play'));
    const howBtn = h('button', { class: 'btn secondary', id: 'btn-how', 'data-i18n': 'menu.how' }, i18n.t('menu.how'));
    const muteBtn = h('button', { class: 'btn secondary small', id: 'btn-mute', 'data-i18n': 'pause.mute' }, i18n.t('pause.mute'));
    const row = h('div', { class: 'btn-row' });
    row.append(playBtn, howBtn, muteBtn);
    menuPanel.appendChild(row);
    menu.appendChild(menuPanel);
    this.screens.menu = menu;
    playBtn.addEventListener('click', () => this.onPlay());
    howBtn.addEventListener('click', () => this.onHow());
    muteBtn.addEventListener('click', () => this.onToggleMute());

    // How-to
    const how = h('div', { class: 'screen', id: 'screen-how' });
    const howPanel = h('div', { class: 'panel' });
    howPanel.appendChild(h('h2', { 'data-i18n': 'how.title' }, i18n.t('how.title')));
    howPanel.appendChild(h('p', { 'data-i18n': 'how.body' }, i18n.t('how.body')));
    howPanel.appendChild(h('p', { 'data-i18n': 'how.controls' }, i18n.t('how.controls')));
    const howBack = h('button', { class: 'btn', id: 'btn-how-back', 'data-i18n': 'common.ok' }, i18n.t('common.ok'));
    howPanel.appendChild(howBack);
    how.appendChild(howPanel);
    this.screens.how = how;
    howBack.addEventListener('click', () => this.showScreen('menu'));

    // Pause
    const pause = h('div', { class: 'screen', id: 'screen-pause' });
    const pausePanel = h('div', { class: 'panel' });
    pausePanel.appendChild(h('h2', { 'data-i18n': 'pause.title' }, i18n.t('pause.title')));
    const resumeBtn = h('button', { class: 'btn', id: 'btn-resume', 'data-i18n': 'pause.resume' }, i18n.t('pause.resume'));
    const pauseMute = h('button', { class: 'btn secondary', id: 'btn-pause-mute', 'data-i18n': 'pause.mute' }, i18n.t('pause.mute'));
    const quitBtn = h('button', { class: 'btn secondary', id: 'btn-quit', 'data-i18n': 'pause.menu' }, i18n.t('pause.menu'));
    const prow = h('div', { class: 'btn-row' });
    prow.append(resumeBtn, pauseMute, quitBtn);
    pausePanel.appendChild(prow);
    pause.appendChild(pausePanel);
    this.screens.pause = pause;
    resumeBtn.addEventListener('click', () => this.onResume());
    pauseMute.addEventListener('click', () => this.onToggleMute());
    quitBtn.addEventListener('click', () => this.onQuit());

    // Results
    const results = h('div', { class: 'screen', id: 'screen-results' });
    const resPanel = h('div', { class: 'panel' });
    resPanel.appendChild(h('h2', { id: 'results-title' }));
    resPanel.appendChild(h('p', { id: 'results-depth' }));
    resPanel.appendChild(h('p', { id: 'results-samples' }));
    resPanel.appendChild(h('p', { id: 'results-wave' }));
    const adRow = h('div', { class: 'ad-row' });
    const reviveBtn = h('button', { class: 'ad-btn hidden', id: 'btn-revive', 'data-i18n': 'results.revive' }, i18n.t('results.revive'));
    const doubleBtn = h('button', { class: 'ad-btn hidden', id: 'btn-double', 'data-i18n': 'results.double' }, i18n.t('results.double'));
    adRow.append(reviveBtn, doubleBtn);
    resPanel.appendChild(adRow);
    const resRow = h('div', { class: 'btn-row' });
    const retryBtn = h('button', { class: 'btn', id: 'btn-retry', 'data-i18n': 'results.retry' }, i18n.t('results.retry'));
    const menuBtn2 = h('button', { class: 'btn secondary', id: 'btn-results-menu', 'data-i18n': 'results.menu' }, i18n.t('results.menu'));
    resRow.append(retryBtn, menuBtn2);
    resPanel.appendChild(resRow);
    results.appendChild(resPanel);
    this.screens.results = results;
    reviveBtn.addEventListener('click', () => this.onRevive());
    doubleBtn.addEventListener('click', () => this.onDouble());
    retryBtn.addEventListener('click', () => this.onRetry());
    menuBtn2.addEventListener('click', () => this.onMenu());

    for (const s of Object.values(this.screens)) this.root.appendChild(s);
  }

  refreshText(): void {
    i18n.translateDOM(this.root);
  }

  setTouchActive(v: boolean): void {
    this.touchActive = v;
  }

  setPlayingControls(v: boolean): void {
    this.hud.classList.toggle('visible', v);
    this.joystick.setVisible(v && this.touchActive);
  }

  showScreen(name: ScreenName): void {
    for (const s of Object.values(this.screens)) s.classList.add('hidden');
    if (name) this.screens[name].classList.remove('hidden');
  }

  setLoading(percent: number): void {
    this.loadingFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  updateBars(air: number, maxAir: number, energy: number, maxEnergy: number, hull: number, maxHull: number): void {
    this.airFill.style.transform = `scaleX(${Math.max(0, air / maxAir)})`;
    this.energyFill.style.transform = `scaleX(${Math.max(0, energy / maxEnergy)})`;
    this.hullFill.style.transform = `scaleX(${Math.max(0, hull / maxHull)})`;
    this.airFill.style.background = air < 18 ? 'linear-gradient(90deg,#ff5a6e,#ff9aa8)' : 'linear-gradient(90deg,#2fd0ff,#7af0ff)';
  }

  updateReadouts(depth: number, samples: number, wave: number): void {
    this.depthReadout.innerHTML = `${i18n.t('hud.depth')}: ${depth.toFixed(0)} m`;
    this.samplesReadout.innerHTML = `${i18n.t('hud.samples')}: ${samples}`;
    this.waveReadout.innerHTML = `${i18n.t('hud.wave')}: ${wave}`;
  }

  setFavor(favor: number, max: number): void {
    this.hypeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, favor / max))})`;
  }

  private toastTimer = 0;
  toast(textKey: string): void {
    this.toastEl.textContent = i18n.t(textKey);
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }

  showResults(d: ResultsData): void {
    (this.screens.results.querySelector('#results-title') as HTMLElement).textContent = i18n.t(d.victory ? 'results.victory' : 'results.defeat');
    (this.screens.results.querySelector('#results-depth') as HTMLElement).textContent = `${i18n.t('results.depth')}: ${d.depth.toFixed(0)} m`;
    (this.screens.results.querySelector('#results-samples') as HTMLElement).textContent = `${i18n.t('results.samples')}: ${d.samples}`;
    (this.screens.results.querySelector('#results-wave') as HTMLElement).textContent = `${i18n.t('results.wave')}: ${d.wave}`;
    const reviveBtn = this.screens.results.querySelector('#btn-revive') as HTMLButtonElement;
    const doubleBtn = this.screens.results.querySelector('#btn-double') as HTMLButtonElement;
    reviveBtn.classList.toggle('hidden', !d.canRevive);
    doubleBtn.classList.toggle('hidden', !d.canDouble);
    this.showScreen('results');
  }

  showUpgrade(cards: UpgradeCard[], canReroll: boolean): void {
    this.cardModal.show(cards, (id) => this.onUpgradeChoose(id), () => this.onReroll(), canReroll);
  }

  hideUpgrade(): void {
    this.cardModal.hide();
  }

  setMenuStats(bestDepth: number, samples: number): void {
    (this.screens.menu.querySelector('#menu-best') as HTMLElement).textContent = `${i18n.t('menu.best')}: ${bestDepth.toFixed(0)} m`;
    (this.screens.menu.querySelector('#menu-samples') as HTMLElement).textContent = `${i18n.t('menu.samples')}: ${samples}`;
  }
}
