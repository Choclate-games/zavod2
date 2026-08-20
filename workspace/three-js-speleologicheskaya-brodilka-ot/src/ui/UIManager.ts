import { HUD } from "./HUD";
import { TouchControls } from "./TouchControls";
import { CardModal } from "./CardModal";
import { MetaShopModal } from "./MetaShopModal";
import { ResultModal, ResultData } from "./ResultModal";
import { GameStats, UpgradeCard } from "../utils/Constants";
import { PlayerSaveData } from "../core/GameState";
import { ProgressionManager } from "../systems/ProgressionManager";

export class UIManager {
  public hud: HUD;
  public touch: TouchControls;
  public cardModal: CardModal;
  public metaShop: MetaShopModal;
  public resultModal: ResultModal;

  private mainMenuContainer: HTMLElement;
  private pauseModalContainer: HTMLElement;
  private reviveModalContainer: HTMLElement;
  private toastContainer: HTMLElement;

  private onStartExpedition: () => void;
  private onOpenCamp: () => void;
  private onResumeGame: () => void;
  private onReviveAccept: () => void;
  private onReviveDecline: () => void;
  private onToggleAudio: () => void;

  constructor(
    progression: ProgressionManager,
    callbacks: {
      onStartExpedition: () => void;
      onOpenCamp: () => void;
      onResumeGame: () => void;
      onRestartRun: () => void;
      onReturnToCamp: () => void;
      onDoubleReward: () => void;
      onCardSelected: (card: UpgradeCard) => void;
      onRerollCards: () => void;
      onReviveAccept: () => void;
      onReviveDecline: () => void;
      onToggleAudio: () => void;
    }
  ) {
    this.onStartExpedition = callbacks.onStartExpedition;
    this.onOpenCamp = callbacks.onOpenCamp;
    this.onResumeGame = callbacks.onResumeGame;
    this.onReviveAccept = callbacks.onReviveAccept;
    this.onReviveDecline = callbacks.onReviveDecline;
    this.onToggleAudio = callbacks.onToggleAudio;

    this.setupStyles();

    // 1. Toast Container
    this.toastContainer = document.createElement("div");
    this.toastContainer.id = "toast-container";
    document.getElementById("ui-layer")?.appendChild(this.toastContainer);

    // 2. HUD & Touch Controls
    this.hud = new HUD(() => this.showPauseMenu());
    this.touch = new TouchControls();

    // 3. Card Modal & Meta Shop & Result Modal
    this.cardModal = new CardModal(
      (card) => {
        this.touch.setVisible(true);
        callbacks.onCardSelected(card);
      },
      () => callbacks.onRerollCards()
    );

    this.metaShop = new MetaShopModal(
      progression,
      () => callbacks.onStartExpedition(),
      () => this.showMainMenu()
    );

    this.resultModal = new ResultModal(
      () => callbacks.onRestartRun(),
      () => callbacks.onReturnToCamp(),
      () => callbacks.onDoubleReward()
    );

    // 4. Main Menu View
    this.mainMenuContainer = document.createElement("div");
    this.mainMenuContainer.id = "main-menu-view";
    this.mainMenuContainer.innerHTML = `
      <div class="menu-backdrop">
        <div class="menu-content interactive">
          <div class="menu-logo-box">
            <div class="menu-badge">3D СПЕЛЕОЛОГИЧЕСКИЙ РОГАЛИК</div>
            <h1 class="menu-title">ЭХОЛОКАЦИЯ</h1>
            <p class="menu-tagline">Погрузитесь в абсолютную тьму пещер. Ваш сканер — ваш единственный свет и главная угроза.</p>
          </div>

          <div class="menu-buttons-list">
            <button id="menu-btn-start" class="btn-menu-primary interactive">
              🔦 НАЧАТЬ ЭКСПЕДИЦИЮ
            </button>
            <button id="menu-btn-camp" class="btn-menu-secondary interactive">
              ⛺ БАЗОВЫЙ ЛАГЕРЬ (ПРОКАЧКА)
            </button>
          </div>

          <div class="menu-guide-box">
            <div class="guide-title">УПРАВЛЕНИЕ</div>
            <div class="guide-row"><span>🎮 ПК:</span> <b>WASD</b> — Движение | <b>ЛКМ</b> — Сонар | <b>ПКМ</b> — Маяк | <b>Пробел</b> — Прыжок | <b>Shift</b> — Бег</div>
            <div class="guide-row"><span>📱 Тач:</span> <b>Левая зона</b> — Джойстик | <b>Правая зона</b> — Сонар, Маяк, Прыжок, Бег</div>
          </div>

          <div class="menu-bottom-settings">
            <button id="menu-btn-audio" class="btn-icon-setting interactive">🔊 Звук</button>
            <button id="menu-btn-fullscreen" class="btn-icon-setting interactive">⛶ Экран</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("ui-layer")?.appendChild(this.mainMenuContainer);

    // 5. Pause Modal
    this.pauseModalContainer = document.createElement("div");
    this.pauseModalContainer.id = "pause-modal";
    this.pauseModalContainer.innerHTML = `
      <div class="pause-backdrop">
        <div class="pause-panel interactive">
          <h2 class="pause-title">ПАУЗА</h2>
          <div class="pause-btn-list">
            <button id="pause-btn-resume" class="btn-menu-primary interactive">▶️ Продолжить</button>
            <button id="pause-btn-audio" class="btn-menu-secondary interactive">🔊 Звук</button>
            <button id="pause-btn-restart" class="btn-menu-secondary interactive">🔄 Рестарт</button>
            <button id="pause-btn-camp" class="btn-menu-secondary interactive">⛺ В лагерь</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("ui-layer")?.appendChild(this.pauseModalContainer);

    // 6. Revive Modal
    this.reviveModalContainer = document.createElement("div");
    this.reviveModalContainer.id = "revive-modal";
    this.reviveModalContainer.innerHTML = `
      <div class="revive-backdrop">
        <div class="revive-panel interactive">
          <div class="revive-icon">⚡</div>
          <h2 class="revive-title">ВТОРОЕ ДЫХАНИЕ</h2>
          <p class="revive-desc">Восстановите 50% HP и вызовите мощную звуковую волну, раскидывающую монстров!</p>
          <div id="revive-countdown" class="revive-timer">5</div>
          <div class="revive-actions">
            <button id="btn-revive-watch" class="btn-menu-primary interactive">🎬 ВОСКРЕСНУТЬ (РЕКЛАМА)</button>
            <button id="btn-revive-skip" class="btn-menu-secondary interactive">Сдаться</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("ui-layer")?.appendChild(this.reviveModalContainer);

    this.bindButtons(callbacks);
  }

  private setupStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #main-menu-view, #pause-modal, #revive-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: none;
        z-index: 25;
      }

      .menu-backdrop, .pause-backdrop, .revive-backdrop {
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(10, 20, 36, 0.88) 0%, rgba(2, 6, 15, 0.96) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }

      .menu-content {
        max-width: 600px;
        width: 90%;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }

      .menu-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: bold;
        letter-spacing: 2px;
        color: #00f0ff;
        border: 1px solid rgba(0, 240, 255, 0.4);
        padding: 4px 12px;
        border-radius: 20px;
        margin-bottom: 8px;
        background: rgba(0, 240, 255, 0.1);
      }

      .menu-title {
        font-size: 42px;
        font-weight: 900;
        letter-spacing: 4px;
        color: #fff;
        text-shadow: 0 0 25px rgba(0, 240, 255, 0.6);
        margin: 0;
      }

      .menu-tagline {
        font-size: 14px;
        color: #94a3b8;
        line-height: 1.5;
        margin-top: 8px;
      }

      .menu-buttons-list, .pause-btn-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 380px;
      }

      .btn-menu-primary {
        background: linear-gradient(135deg, #00f0ff, #0088cc);
        border: none;
        color: #040812;
        padding: 16px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: bold;
        letter-spacing: 1px;
        cursor: pointer;
        box-shadow: 0 0 25px rgba(0, 240, 255, 0.4);
        transition: transform 0.1s;
      }

      .btn-menu-primary:active { transform: scale(0.97); }

      .btn-menu-secondary {
        background: rgba(30, 41, 59, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e2e8f0;
        padding: 14px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      }

      .menu-guide-box {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(0, 240, 255, 0.2);
        border-radius: 10px;
        padding: 12px 16px;
        width: 100%;
        max-width: 480px;
        font-size: 12px;
        text-align: left;
      }

      .guide-title {
        color: #00f0ff;
        font-weight: bold;
        letter-spacing: 1px;
        margin-bottom: 6px;
      }

      .guide-row { color: #cbd5e1; margin-bottom: 4px; }
      .guide-row b { color: #fff; }

      .menu-bottom-settings {
        display: flex;
        gap: 12px;
      }

      .btn-icon-setting {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
      }

      .pause-panel, .revive-panel {
        background: rgba(10, 18, 32, 0.95);
        border: 2px solid rgba(0, 240, 255, 0.4);
        border-radius: 16px;
        padding: 28px 36px;
        max-width: 420px;
        width: 90%;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .pause-title, .revive-title { color: #00f0ff; font-size: 24px; letter-spacing: 2px; }
      .revive-icon { font-size: 48px; }
      .revive-desc { font-size: 13px; color: #94a3b8; line-height: 1.4; }
      .revive-timer { font-size: 32px; font-weight: bold; color: #ffd700; }
      .revive-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }

      /* Toast Notification */
      #toast-container {
        position: absolute;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        z-index: 50;
      }

      .toast-msg {
        background: rgba(10, 18, 32, 0.95);
        border: 1px solid #00f0ff;
        color: #fff;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: bold;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
        animation: fadeInOut 2.5s forwards;
      }

      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(10px); }
        15% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  private bindButtons(callbacks: any): void {
    document.getElementById("menu-btn-start")?.addEventListener("click", () => {
      this.hideMainMenu();
      this.onStartExpedition();
    });

    document.getElementById("menu-btn-camp")?.addEventListener("click", () => {
      this.hideMainMenu();
      this.onOpenCamp();
    });

    document.getElementById("menu-btn-audio")?.addEventListener("click", () => {
      this.onToggleAudio();
    });

    document.getElementById("menu-btn-fullscreen")?.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.getElementById("pause-btn-resume")?.addEventListener("click", () => {
      this.hidePauseMenu();
      this.onResumeGame();
    });

    document.getElementById("pause-btn-audio")?.addEventListener("click", () => {
      this.onToggleAudio();
    });

    document.getElementById("pause-btn-restart")?.addEventListener("click", () => {
      this.hidePauseMenu();
      callbacks.onRestartRun();
    });

    document.getElementById("pause-btn-camp")?.addEventListener("click", () => {
      this.hidePauseMenu();
      callbacks.onReturnToCamp();
    });

    document.getElementById("btn-revive-watch")?.addEventListener("click", () => {
      this.hideReviveModal();
      this.onReviveAccept();
    });

    document.getElementById("btn-revive-skip")?.addEventListener("click", () => {
      this.hideReviveModal();
      this.onReviveDecline();
    });
  }

  public showMainMenu(): void {
    this.hideAll();
    this.mainMenuContainer.style.display = "block";
  }

  public hideMainMenu(): void {
    this.mainMenuContainer.style.display = "none";
  }

  public showPauseMenu(): void {
    this.touch.releaseAll();
    this.touch.setVisible(false);
    this.pauseModalContainer.style.display = "block";
  }

  public hidePauseMenu(): void {
    this.pauseModalContainer.style.display = "none";
  }

  public showReviveModal(onComplete: (accepted: boolean) => void): void {
    this.touch.releaseAll();
    this.touch.setVisible(false);
    this.reviveModalContainer.style.display = "block";

    let timeLeft = 6;
    const timerEl = document.getElementById("revive-countdown")!;
    timerEl.textContent = `${timeLeft}`;

    const timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timer);
        this.hideReviveModal();
        onComplete(false);
      } else {
        timerEl.textContent = `${timeLeft}`;
      }
    }, 1000);
  }

  public hideReviveModal(): void {
    this.reviveModalContainer.style.display = "none";
  }

  public showToast(msg: string): void {
    const toast = document.createElement("div");
    toast.className = "toast-msg";
    toast.textContent = msg;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  public hideAll(): void {
    this.hud.setVisible(false);
    this.touch.setVisible(false);
    this.mainMenuContainer.style.display = "none";
    this.pauseModalContainer.style.display = "none";
    this.reviveModalContainer.style.display = "none";
    this.cardModal.hide();
    this.metaShop.hide();
    this.resultModal.hide();
  }
}
