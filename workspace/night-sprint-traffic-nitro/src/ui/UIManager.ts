import { GameState, PlayerSaveData } from '../types';
import { CAR_CATALOG, TRACK_CATALOG } from '../core/Config';
import { eventBus } from '../core/EventBus';
import { storageService } from '../platform/StorageService';
import { playgamaService } from '../platform/PlaygamaService';
import { audioManager } from '../audio/AudioManager';

export class UIManager {
  private rootEl: HTMLDivElement | null = null;
  private hudEl: HTMLDivElement | null = null;
  private menuEl: HTMLDivElement | null = null;
  private garageEl: HTMLDivElement | null = null;
  private tracksEl: HTMLDivElement | null = null;
  private victoryEl: HTMLDivElement | null = null;
  private reviveEl: HTMLDivElement | null = null;
  private pauseEl: HTMLDivElement | null = null;
  private leaderboardEl: HTMLDivElement | null = null;
  private settingsEl: HTMLDivElement | null = null;

  private speedNumEl: HTMLElement | null = null;
  private gearNumEl: HTMLElement | null = null;
  private nitroBarEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;
  private progressBarEl: HTMLElement | null = null;
  private comboBadgeEl: HTMLElement | null = null;
  private comboBarEl: HTMLElement | null = null;
  private stuntTextEl: HTMLElement | null = null;

  private garageSelectedCarIndex = 0;

  mount(container: HTMLElement): void {
    const root = document.createElement('div');
    root.id = 'game-ui-root';
    root.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; font-family: "RichardSoft", "Segoe UI", sans-serif; color: #ffffff; user-select: none;'
    );
    container.appendChild(root);
    this.rootEl = root;

    this.buildHUD();
    this.buildMainMenu();
    this.buildGarage();
    this.buildTracks();
    this.buildVictory();
    this.buildRevive();
    this.buildPause();
    this.buildLeaderboard();
    this.buildSettings();

    this.setupSaveListener();
  }

  private setupSaveListener(): void {
    eventBus.on('save:updated', (data) => {
      this.refreshCashRepHeader(data);
    });

    eventBus.on('score:stunt', (data) => {
      this.showStuntText(data.message, data.points);
    });
  }

  showStuntText(msg: string, points: number): void {
    if (!this.stuntTextEl) return;
    this.stuntTextEl.innerHTML = `${msg} <span style="color: #ffd700">+${points}</span>`;
    this.stuntTextEl.style.opacity = '1';
    this.stuntTextEl.style.transform = 'scale(1.1)';
    setTimeout(() => {
      if (this.stuntTextEl) {
        this.stuntTextEl.style.opacity = '0';
        this.stuntTextEl.style.transform = 'scale(1.0)';
      }
    }, 1400);
  }

  private buildHUD(): void {
    const hud = document.createElement('div');
    hud.id = 'hud-screen';
    hud.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; pointer-events: none;'
    );

    hud.innerHTML = `
      <div style="position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
        <div style="font-size: 12px; letter-spacing: 2px; color: #00f0ff; font-weight: 900;">ВРЕМЯ ЧЕКПОИНТА</div>
        <div id="hud-timer" style="font-size: 48px; font-weight: 900; letter-spacing: 2px; color: #fff; text-shadow: 0 0 15px #00f0ff; transition: transform 0.15s ease;">25.0</div>
        <div id="hud-stunt" style="margin-top: 6px; font-size: 16px; font-weight: 900; color: #00f0ff; opacity: 0; transition: all 0.25s ease; text-shadow: 0 0 10px #00f0ff;"></div>
      </div>

      <div style="position: absolute; top: calc(10px + env(safe-area-inset-top)); right: calc(15px + env(safe-area-inset-right)); display: flex; gap: 10px; align-items: center; pointer-events: auto;">
        <div id="hud-combo-badge" style="background: rgba(13,17,23,0.85); border: 2px solid #ffd700; border-radius: 8px; padding: 6px 12px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 0 12px #ffd700;">
          <div style="font-size: 10px; color: #ffd700; font-weight: 900;">КОМБО</div>
          <div id="hud-combo-value" style="font-size: 20px; font-weight: 900; color: #fff">x1.0</div>
          <div style="width: 50px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin-top: 4px; overflow: hidden;">
            <div id="hud-combo-bar" style="width: 100%; height: 100%; background: #ffd700;"></div>
          </div>
        </div>

        <div id="btn-pause" style="width: 42px; height: 42px; background: rgba(13,17,23,0.85); border: 1px solid #00f0ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 0 10px rgba(0,240,255,0.4);">
          <span style="font-size: 16px; color: #00f0ff;">❚❚</span>
        </div>
      </div>

      <div style="position: absolute; bottom: calc(20px + env(safe-area-inset-bottom)); left: calc(20px + env(safe-area-inset-left)); pointer-events: none;">
        <div style="display: flex; align-items: baseline; gap: 6px;">
          <div id="hud-speed" style="font-size: 62px; font-weight: 900; letter-spacing: 1px; color: #fff; text-shadow: 0 0 20px #00f0ff;">0</div>
          <div style="font-size: 14px; font-weight: 900; color: #00f0ff;">КМ/Ч</div>
          <div id="hud-gear" style="margin-left: 12px; font-size: 28px; font-weight: 900; color: #ffd700; background: rgba(13,17,23,0.85); border: 1px solid #ffd700; padding: 2px 10px; border-radius: 6px;">1</div>
        </div>

        <div style="margin-top: 8px; width: 180px; height: 8px; background: rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden; border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0,240,255,0.4);">
          <div id="hud-nitro-bar" style="width: 50%; height: 100%; background: linear-gradient(90deg, #00f0ff, #ff007f); box-shadow: 0 0 15px #00f0ff;"></div>
        </div>
      </div>

      <div style="position: absolute; top: calc(5px + env(safe-area-inset-top)); left: 20%; right: 20%; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; overflow: hidden;">
        <div id="hud-progress-bar" style="width: 0%; height: 100%; background: #00ff66; box-shadow: 0 0 10px #00ff66;"></div>
      </div>
    `;

    this.rootEl?.appendChild(hud);
    this.hudEl = hud;
    this.speedNumEl = hud.querySelector('#hud-speed');
    this.gearNumEl = hud.querySelector('#hud-gear');
    this.nitroBarEl = hud.querySelector('#hud-nitro-bar');
    this.timerEl = hud.querySelector('#hud-timer');
    this.progressBarEl = hud.querySelector('#hud-progress-bar');
    this.comboBadgeEl = hud.querySelector('#hud-combo-value');
    this.comboBarEl = hud.querySelector('#hud-combo-bar');
    this.stuntTextEl = hud.querySelector('#hud-stunt');

    hud.querySelector('#btn-pause')?.addEventListener('click', () => {
      audioManager.playClick();
      eventBus.emit('game:pause', undefined);
    });
  }

  private buildMainMenu(): void {
    const menu = document.createElement('div');
    menu.id = 'main-menu-screen';
    menu.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: calc(30px + env(safe-area-inset-top)) calc(30px + env(safe-area-inset-right)) calc(30px + env(safe-area-inset-bottom)) calc(30px + env(safe-area-inset-left)); box-sizing: border-box; pointer-events: auto; background: rgba(9,11,16,0.35);'
    );

    menu.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; flex-direction: column;">
          <div style="font-size: 24px; font-weight: 900; color: #00f0ff; letter-spacing: 2px; text-shadow: 0 0 10px #00f0ff;">НОЧНОЙ СПРИНТ</div>
          <div style="font-size: 13px; font-weight: 700; color: #ff007f; letter-spacing: 4px;">ТРАФИК И ЗАКИСЬ</div>
        </div>

        <div style="display: flex; gap: 18px;">
          <div style="background: rgba(13,17,23,0.9); border: 1px solid #ffd700; border-radius: 8px; padding: 6px 16px; display: flex; gap: 8px; align-items: center; box-shadow: 0 0 12px rgba(255,215,0,0.3);">
            <span style="color: #ffd700; font-weight: 900;">◈</span>
            <span id="menu-cash-val" style="font-weight: 900; font-size: 16px;">5000</span>
          </div>
          <div style="background: rgba(13,17,23,0.9); border: 1px solid #00f0ff; border-radius: 8px; padding: 6px 16px; display: flex; gap: 8px; align-items: center; box-shadow: 0 0 12px rgba(0,240,255,0.3);">
            <span style="color: #00f0ff; font-weight: 900;">★</span>
            <span id="menu-rep-val" style="font-weight: 900; font-size: 16px;">0</span>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px; align-items: center;">
        <div id="btn-main-play" style="width: 260px; padding: 18px 0; text-align: center; background: linear-gradient(90deg, #00f0ff, #ff007f); border-radius: 12px; font-weight: 900; font-size: 22px; letter-spacing: 2px; cursor: pointer; box-shadow: 0 0 25px #00f0ff; transition: transform 0.1s ease;">ВЫЕХАТЬ В ГОНКУ</div>
        <div id="btn-main-garage" style="width: 260px; padding: 14px 0; text-align: center; background: rgba(13,17,23,0.85); border: 1px solid #00f0ff; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 0 10px rgba(0,240,255,0.3);">ГАРАЖ</div>
        <div id="btn-main-leaders" style="width: 260px; padding: 14px 0; text-align: center; background: rgba(13,17,23,0.85); border: 1px solid #ffd700; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 0 10px rgba(255,215,0,0.3);">ТОП ЛИДЕРОВ</div>
        <div id="btn-main-settings" style="width: 260px; padding: 14px 0; text-align: center; background: rgba(13,17,23,0.85); border: 1px solid #7928ca; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 0 10px rgba(121,40,202,0.3);">НАСТРОЙКИ</div>
      </div>

      <div style="text-align: center; font-size: 11px; color: #888888;">v1.0.0 | High Performance WebGL 60 FPS</div>
    `;

    menu.querySelector('#btn-main-play')?.addEventListener('click', () => {
      audioManager.playClick();
      this.setState('TRACK_SELECT');
    });

    menu.querySelector('#btn-main-garage')?.addEventListener('click', () => {
      audioManager.playClick();
      this.setState('GARAGE');
    });

    menu.querySelector('#btn-main-leaders')?.addEventListener('click', () => {
      audioManager.playClick();
      this.showLeaderboard();
    });

    menu.querySelector('#btn-main-settings')?.addEventListener('click', () => {
      audioManager.playClick();
      this.showSettings();
    });

    this.rootEl?.appendChild(menu);
    this.menuEl = menu;
  }

  private buildGarage(): void {
    const g = document.createElement('div');
    g.id = 'garage-screen';
    g.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: space-between; padding: calc(20px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); box-sizing: border-box; pointer-events: auto;'
    );

    g.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div id="btn-garage-back" style="background: rgba(13,17,23,0.85); border: 1px solid #00f0ff; padding: 8px 16px; border-radius: 8px; font-weight: 900; cursor: pointer;">← НАЗАД</div>
        <div style="font-size: 20px; font-weight: 900; color: #00f0ff;">ГАРАЖ</div>
        <div id="garage-cash-rep" style="font-weight: 900; color: #ffd700;">5000 LC</div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div id="btn-garage-prev" style="background: rgba(13,17,23,0.9); border: 2px solid #00f0ff; border-radius: 24px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 20px;">←</div>
        <div style="text-align: center;">
          <div id="garage-car-name" style="font-size: 20px; font-weight: 900; color: #ffffff;">KAIZEN CIVIC R-SPEC</div>
          <div id="garage-car-cat" style="font-size: 12px; color: #00f0ff; margin-top: 2px;">Street Tuner</div>
        </div>
        <div id="btn-garage-next" style="background: rgba(13,17,23,0.9); border: 2px solid #00f0ff; border-radius: 24px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 20px;">→</div>
      </div>

      <div style="background: rgba(13,17,23,0.85); border: 1px solid #00f0ff; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
          <div>СКОРОСТЬ: <span id="stat-speed" style="color: #00f0ff; font-weight: 900;">210 км/ч</span></div>
          <div>РАЗГОН: <span id="stat-accel" style="color: #00f0ff; font-weight: 900;">5.2 с</span></div>
          <div>ЗАЦЕП: <span id="stat-grip" style="color: #00f0ff; font-weight: 900;">82%</span></div>
          <div>N2O ЕМКОСТЬ: <span id="stat-nitro" style="color: #00f0ff; font-weight: 900;">4.0 с</span></div>
        </div>

        <div id="btn-garage-action" style="background: linear-gradient(90deg, #00f0ff, #ff007f); padding: 12px; border-radius: 8px; text-align: center; font-weight: 900; cursor: pointer;">ВЫБРАТЬ</div>
      </div>
    `;

    g.querySelector('#btn-garage-back')?.addEventListener('click', () => {
      audioManager.playClick();
      this.setState('MENU');
    });

    g.querySelector('#btn-garage-prev')?.addEventListener('click', () => {
      audioManager.playClick();
      this.garageSelectedCarIndex = (this.garageSelectedCarIndex - 1 + CAR_CATALOG.length) % CAR_CATALOG.length;
      this.refreshGarageUI();
    });

    g.querySelector('#btn-garage-next')?.addEventListener('click', () => {
      audioManager.playClick();
      this.garageSelectedCarIndex = (this.garageSelectedCarIndex + 1) % CAR_CATALOG.length;
      this.refreshGarageUI();
    });

    g.querySelector('#btn-garage-action')?.addEventListener('click', () => {
      audioManager.playClick();
      const car = CAR_CATALOG[this.garageSelectedCarIndex];
      const data = storageService.getData();
      if (data.unlockedCars.includes(car.id)) {
        storageService.modify((s) => { s.selectedCarId = car.id; });
      } else if (data.cash >= car.price && data.rep >= car.repRequired) {
        storageService.modify((s) => {
          s.cash -= car.price;
          s.unlockedCars.push(car.id);
          s.selectedCarId = car.id;
        });
      }
      this.refreshGarageUI();
    });

    this.rootEl?.appendChild(g);
    this.garageEl = g;
  }

  private refreshGarageUI(): void {
    const car = CAR_CATALOG[this.garageSelectedCarIndex];
    const data = storageService.getData();
    const isUnlocked = data.unlockedCars.includes(car.id);
    const isSelected = data.selectedCarId === car.id;

    const nameEl = this.garageEl?.querySelector('#garage-car-name');
    if (nameEl) nameEl.textContent = car.name;

    const catEl = this.garageEl?.querySelector('#garage-car-cat');
    if (catEl) catEl.textContent = `${car.category} - ${car.description}`;

    const actionEl = this.garageEl?.querySelector('#btn-garage-action') as HTMLElement;
    if (actionEl) {
      if (isSelected) {
        actionEl.textContent = 'ВЫБРАНО';
        actionEl.style.background = '#00ff66';
      } else if (isUnlocked) {
        actionEl.textContent = 'ВЫБРАТЬ';
        actionEl.style.background = 'linear-gradient(90deg, #00f0ff, #ff007f)';
      } else {
        actionEl.textContent = `КУПИТЬ (${car.price} LC)`;
        actionEl.style.background = '#ffd700';
      }
    }
  }

  private buildTracks(): void {
    const t = document.createElement('div');
    t.id = 'tracks-screen';
    t.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; padding: calc(20px + env(safe-area-inset-top)) calc(15px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(15px + env(safe-area-inset-left)); box-sizing: border-box; pointer-events: auto; background: rgba(9,11,16,0.90);'
    );

    let tracksHTML = '';
    for (const trk of TRACK_CATALOG) {
      tracksHTML += `
        <div class="track-card" data-id="${trk.id}" style="background: rgba(13,17,23,0.85); border: 1px solid #00f0ff; border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; box-shadow: 0 0 10px rgba(0,240,255,0.2);">
          <div>
            <div style="font-weight: 900; font-size: 15px;">${trk.name}</div>
            <div style="font-size: 11px; color: #888888; margin-top: 2px;">Район: ${trk.district} | Д. ${trk.lengthMeters}м | HARD_TIME: ${trk.targetGoldSec}с</div>
          </div>
          <div style="background: linear-gradient(90deg, #00f0ff, #ff007f); padding: 8px 16px; border-radius: 6px; font-weight: 900; font-size: 13px;">СТАРТ</div>
        </div>
      `;
    }

    t.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div id="btn-tracks-back" style="background: rgba(13,17,23,0.85); border: 1px solid #00f0ff; padding: 8px 16px; border-radius: 8px; font-weight: 900; cursor: pointer;">← НАЗАД</div>
        <div style="font-size: 20px; font-weight: 900; color: #00f0ff;">ВЫБОР ТРАССЫ</div>
        <div style="width: 60px;"></div>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 6px;">
        ${tracksHTML}
      </div>
    `;

    t.querySelector('#btn-tracks-back')?.addEventListener('click', () => {
      audioManager.playClick();
      this.setState('MENU');
    });

    for (const card of Array.from(t.querySelectorAll('.track-card'))) {
      card.addEventListener('click', () => {
        audioManager.playClick();
        const trackId = card.getAttribute('data-id') || 'track_01';
        const selectedCar = storageService.getData().selectedCarId;
        eventBus.emit('game:start_run', { trackId, carId: selectedCar });
      });
    }

    this.rootEl?.appendChild(t);
    this.tracksEl = t;
  }

  private buildVictory(): void {
    const v = document.createElement('div');
    v.id = 'victory-screen';
    v.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; background: rgba(9,11,16,0.95); pointer-events: auto;'
    );

    v.innerHTML = `
      <div style="background: rgba(13,17,23,0.95); border: 2px solid #00f0ff; border-radius: 16px; padding: 24px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 0 30px rgba(0,240,255,0.4);">
        <div id="victory-title" style="font-size: 28px; font-weight: 900; color: #ffd700; letter-spacing: 2px;">ФИНИШ!</div>
        <div id="victory-medal" style="font-size: 48px; margin: 12px 0;">🥇</div>
        <div id="victory-time" style="font-size: 16px; color: #00f0ff; font-weight: 900;">ВРЕМЯ: 60.5 с</div>
        <div id="victory-rewards" style="margin: 16px 0; display: flex; justify-content: center; gap: 20px; font-weight: 900;">
          <div style="color: #ffd700;">+5000 LC</div>
          <div style="color: #00f0ff;">+250 REP</div>
        </div>
        <div style="display: flex; gap: 12px;">
          <div id="btn-victory-menu" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid #fff; padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">МЕНЮ</div>
          <div id="btn-victory-retry" style="flex: 1; background: linear-gradient(90deg, #00f0ff, #ff007f); padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">ДАЛЕЕ</div>
        </div>
      </div>
    `;

    v.querySelector('#btn-victory-menu')?.addEventListener('click', () => {
      audioManager.playClick();
      playgamaService.showInterstitial();
      this.setState('MENU');
    });

    v.querySelector('#btn-victory-retry')?.addEventListener('click', () => {
      audioManager.playClick();
      playgamaService.showInterstitial();
      eventBus.emit('game:restart_run', undefined);
    });

    this.rootEl?.appendChild(v);
    this.victoryEl = v;
  }

  private buildRevive(): void {
    const rev = document.createElement('div');
    rev.id = 'revive-screen';
    rev.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; background: rgba(9,11,16,0.85); pointer-events: auto;'
    );

    rev.innerHTML = `
      <div style="background: rgba(13,17,23,0.95); border: 2px solid #ff0033; border-radius: 16px; padding: 24px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 0 30px rgba(255,0,51,0.4);">
        <div style="font-size: 24px; font-weight: 900; color: #ff0033; letter-spacing: 2px;">АВАРИЯ!</div>
        <div style="font-size: 14px; color: #fff; margin: 12px 0;">Воскреснуть с полным NO2 и неуязвимостью 3 секунды?</div>
        <div id="btn-revive-ad" style="background: linear-gradient(90deg, #00f0ff, #00ff66); padding: 14px; border-radius: 8px; font-weight: 900; color: #0d101f; margin-bottom: 12px; cursor: pointer; box-shadow: 0 0 15px #00ff66;">▶ ВОСКРЕСНУТЬ (РЕКЛАМА)</div>
        <div id="btn-revive-skip" style="color: #888888; font-size: 13px; cursor: pointer;">Завершить заезд</div>
      </div>
    `;

    rev.querySelector('#btn-revive-ad')?.addEventListener('click', async () => {
      audioManager.playClick();
      const success = await playgamaService.showRewarded('revive');
      if (success) {
        eventBus.emit('game:revive', undefined);
      }
    });

    rev.querySelector('#btn-revive-skip')?.addEventListener('click', () => {
      audioManager.playClick();
      playgamaService.showInterstitial();
      this.setState('MENU');
    });

    this.rootEl?.appendChild(rev);
    this.reviveEl = rev;
  }

  private buildPause(): void {
    const p = document.createElement('div');
    p.id = 'pause-screen';
    p.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; background: rgba(9,11,16,0.85); pointer-events: auto;'
    );

    p.innerHTML = `
      <div style="background: rgba(13,17,23,0.95); border: 2px solid #00f0ff; border-radius: 16px; padding: 24px; width: 90%; max-width: 320px; text-align: center; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 22px; font-weight: 900; color: #00f0ff; margin-bottom: 8px;">ПАУЗА</div>
        <div id="btn-pause-resume" style="background: linear-gradient(90deg, #00f0ff, #ff007f); padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">ПРОДОЛЖИТЬ</div>
        <div id="btn-pause-retry" style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">ЗАНОВО</div>
        <div id="btn-pause-menu" style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">В МЕНЮ</div>
      </div>
    `;

    p.querySelector('#btn-pause-resume')?.addEventListener('click', () => {
      audioManager.playClick();
      eventBus.emit('game:resume_run', undefined);
    });

    p.querySelector('#btn-pause-retry')?.addEventListener('click', () => {
      audioManager.playClick();
      eventBus.emit('game:restart_run', undefined);
    });

    p.querySelector('#btn-pause-menu')?.addEventListener('click', () => {
      audioManager.playClick();
      this.setState('MENU');
    });

    this.rootEl?.appendChild(p);
    this.pauseEl = p;
  }

  private buildLeaderboard(): void {
    const lel = document.createElement('div');
    lel.id = 'leaderboard-screen';
    lel.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; background: rgba(9,11,16,0.90); pointer-events: auto;'
    );

    lel.innerHTML = `
      <div style="background: rgba(13,17,23,0.95); border: 2px solid #ffd700; border-radius: 16px; padding: 24px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 0 30px rgba(255,215,0,0.3);">
        <div style="font-size: 22px; font-weight: 900; color: #ffd700; margin-bottom: 16px;">ТОП ИГРОКОВ</div>
        <div id="leaderboard-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; text-align: left; font-size: 13px;">
          <div style="display: flex; justify-content: space-between;"><span>1. NitroKing_99</span> <span style="color: #ffd700">74,500</span></div>
          <div style="display: flex; justify-content: space-between;"><span>2. SilviaDrifter</span> <span style="color: #ffd700">68,200</span></div>
          <div style="display: flex; justify-content: space-between;"><span>3. CyberPhantom</span> <span style="color: #ffd700">61,100</span></div>
        </div>
        <div id="btn-leaders-close" style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">ЗАКРЫТЬ</div>
      </div>
    `;

    lel.querySelector('#btn-leaders-close')?.addEventListener('click', () => {
      audioManager.playClick();
      lel.style.display = 'none';
    });

    this.rootEl?.appendChild(lel);
    this.leaderboardEl = lel;
  }

  private buildSettings(): void {
    const sel = document.createElement('div');
    sel.id = 'settings-screen';
    sel.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; background: rgba(9,11,16,0.90); pointer-events: auto;'
    );

    sel.innerHTML = `
      <div style="background: rgba(13,17,23,0.95); border: 2px solid #7928ca; border-radius: 16px; padding: 24px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 0 30px rgba(121,40,202,0.4);">
        <div style="font-size: 22px; font-weight: 900; color: #7928ca; margin-bottom: 16px;">НАСТРОЙКИ</div>
        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; text-align: left; font-size: 14px;">
          <div>
            <div>Громкость музыки</div>
            <input id="set-music-vol" type="range" min="0" max="1" step="0.05" value="0.7" style="width: 100%;" />
          </div>
          <div>
            <div>Громкость звуков</div>
            <input id="set-sfx-vol" type="range" min="0" max="1" step="0.05" value="0.8" style="width: 100%;" />
          </div>
        </div>
        <div id="btn-settings-close" style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-weight: 900; cursor: pointer;">ЗАКРЫТЬ</div>
      </div>
    `;

    sel.querySelector('#set-music-vol')?.addEventListener('input', (ev: any) => {
      const v = Number(ev.target.value);
      audioManager.setMusicVolume(v);
      storageService.modify((s) => { s.settings.musicVolume = v; });
    });

    sel.querySelector('#set-sfx-vol')?.addEventListener('input', (ev: any) => {
      const v = Number(ev.target.value);
      audioManager.setSfxVolume(v);
      storageService.modify((s) => { s.settings.sfxVolume = v; });
    });

    sel.querySelector('#btn-settings-close')?.addEventListener('click', () => {
      audioManager.playClick();
      sel.style.display = 'none';
    });

    this.rootEl?.appendChild(sel);
    this.settingsEl = sel;
  }

  showLeaderboard(): void {
    if (this.leaderboardEl) this.leaderboardEl.style.display = 'flex';
  }

  showSettings(): void {
    if (this.settingsEl) this.settingsEl.style.display = 'flex';
  }

  refreshCashRepHeader(data: PlayerSaveData): void {
    const menuCash = this.menuEl?.querySelector('#menu-cash-val');
    if (menuCash) menuCash.textContent = String(data.cash);

    const menuRep = this.menuEl?.querySelector('#menu-rep-val');
    if (menuRep) menuRep.textContent = String(data.rep);
  }

  setState(state: GameState): void {
    if (this.hudEl) this.hudEl.style.display = state === 'PLAYING' || state === 'PAUSED' ? 'block' : 'none';
    if (this.menuEl) this.menuEl.style.display = state === 'MENU' || state === 'BOOT' ? 'flex' : 'none';
    if (this.garageEl) this.garageEl.style.display = state === 'GARAGE' ? 'flex' : 'none';
    if (this.tracksEl) this.tracksEl.style.display = state === 'TRACK_SELECT' ? 'flex' : 'none';
    if (this.victoryEl) this.victoryEl.style.display = state === 'VICTORY' ? 'flex' : 'none';
    if (this.reviveEl) this.reviveEl.style.display = state === 'CRASH_REVIVE' ? 'flex' : 'none';
    if (this.pauseEl) this.pauseEl.style.display = state === 'PAUSED' ? 'flex' : 'none';
  }

  updateHUD(speedKmh: number, gear: number, nitroPercent: number, timeSec: number, progressPercent: number, comboMult: number, comboRatio: number): void {
    if (this.speedNumEl) this.speedNumEl.textContent = String(Math.floor(speedKmh));
    if (this.gearNumEl) this.gearNumEl.textContent = String(gear);
    if (this.nitroBarEl) this.nitroBarEl.style.width = `${Math.min(100, Math.max(0, nitroPercent))}%`;
    if (this.timerEl) {
      this.timerEl.textContent = Math.max(0, timeSec).toFixed(1);
      this.timerEl.style.color = timeSec < 5.0 ? '#ff0033' : '#ffffff';
    }
    if (this.progressBarEl) this.progressBarEl.style.width = `${progressPercent * 100}%`;
    if (this.comboBadgeEl) this.comboBadgeEl.textContent = `x${comboMult.toFixed(1)}`;
    if (this.comboBarEl) this.comboBarEl.style.width = `${Math.max(0, comboRatio) * 100}%`;
  }
}

export const uiManager = new UIManager();