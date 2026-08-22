import type { WeaponConfig } from "../core/Types";

export class HUD {
  private container: HTMLDivElement;

  // Cached DOM elements
  private roomLabelEl!: HTMLSpanElement;
  private timerEl!: HTMLSpanElement;
  private slowMoStatusEl!: HTMLSpanElement;

  private shieldBarFillEl!: HTMLDivElement;
  private shieldHpTextEl!: HTMLSpanElement;
  private shieldGlassStatusEl!: HTMLSpanElement;

  private focusBarFillEl!: HTMLDivElement;
  private focusContainerEl!: HTMLDivElement;

  private ammoCountEl!: HTMLSpanElement;
  private weaponNameEl!: HTMLSpanElement;
  private reloadPromptEl!: HTMLDivElement;

  private reticleEl!: HTMLDivElement;
  private hitmarkerEl!: HTMLDivElement;
  private damageFlashEl!: HTMLDivElement;
  private reconOverlayEl!: HTMLDivElement;

  private lastShots = -1;
  private lastReserve = -1;
  private lastShield = -1;
  private lastTime = -1;
  private hitmarkerTimeout: number | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "gameplay-hud";
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.pointerEvents = "none";
    this.container.style.zIndex = "var(--z-hud)";
    this.container.style.display = "none";

    document.getElementById("ui-root")?.appendChild(this.container);

    this.buildDOM();
  }

  private buildDOM(): void {
    // 1. Damage flash vignette
    this.damageFlashEl = document.createElement("div");
    this.damageFlashEl.style.position = "absolute";
    this.damageFlashEl.style.inset = "0";
    this.damageFlashEl.style.boxShadow = "inset 0 0 80px rgba(255, 30, 39, 0)";
    this.damageFlashEl.style.transition = "box-shadow 0.15s ease-out";
    this.damageFlashEl.style.pointerEvents = "none";
    this.container.appendChild(this.damageFlashEl);

    // 2. Recon Night-Vision Overlay
    this.reconOverlayEl = document.createElement("div");
    this.reconOverlayEl.style.position = "absolute";
    this.reconOverlayEl.style.inset = "0";
    this.reconOverlayEl.style.background = "radial-gradient(circle, rgba(0,255,102,0.12) 0%, rgba(0,40,10,0.65) 100%)";
    this.reconOverlayEl.style.border = "4px solid var(--safe-success)";
    this.reconOverlayEl.style.display = "none";
    this.reconOverlayEl.style.pointerEvents = "none";

    const reconScanlines = document.createElement("div");
    reconScanlines.style.position = "absolute";
    reconScanlines.style.inset = "0";
    reconScanlines.style.backgroundImage = "linear-gradient(rgba(0,255,102,0) 50%, rgba(0,0,0,0.4) 50%)";
    reconScanlines.style.backgroundSize = "100% 4px";
    this.reconOverlayEl.appendChild(reconScanlines);

    const reconLabel = document.createElement("div");
    reconLabel.style.position = "absolute";
    reconLabel.style.top = "calc(16px + var(--safe-top))";
    reconLabel.style.left = "calc(20px + var(--safe-left))";
    reconLabel.style.color = "var(--safe-success)";
    reconLabel.style.fontFamily = "var(--font-mono)";
    reconLabel.style.fontSize = "13px";
    reconLabel.style.letterSpacing = "1px";
    reconLabel.textContent = "[NV-OPTIC WAND ACTIVE: THREAT SCANNING]";
    this.reconOverlayEl.appendChild(reconLabel);

    this.container.appendChild(this.reconOverlayEl);

    // 3. Top HUD: Room & Time status
    const topBar = document.createElement("div");
    topBar.style.position = "absolute";
    topBar.style.top = "calc(16px + var(--safe-top))";
    topBar.style.left = "50%";
    topBar.style.transform = "translateX(-50%)";
    topBar.style.display = "flex";
    topBar.style.gap = "18px";
    topBar.style.alignItems = "center";
    topBar.style.padding = "6px 16px";
    topBar.style.backgroundColor = "var(--bg-card)";
    topBar.style.border = "1px solid var(--border-color)";
    topBar.style.borderRadius = "var(--radius-sm)";
    topBar.style.fontFamily = "var(--font-mono)";
    topBar.style.fontSize = "13px";

    this.roomLabelEl = document.createElement("span");
    this.roomLabelEl.style.color = "var(--tactical-info)";
    this.roomLabelEl.style.fontWeight = "bold";
    this.roomLabelEl.textContent = "СЕКТОР 1/3";

    this.timerEl = document.createElement("span");
    this.timerEl.className = "tabular-nums";
    this.timerEl.style.color = "var(--text-main)";
    this.timerEl.textContent = "⏱ 01:30";

    this.slowMoStatusEl = document.createElement("span");
    this.slowMoStatusEl.style.color = "var(--color-primary)";
    this.slowMoStatusEl.style.fontWeight = "bold";
    this.slowMoStatusEl.style.display = "none";
    this.slowMoStatusEl.textContent = "⚡ SLOW-MO";

    topBar.appendChild(this.roomLabelEl);
    topBar.appendChild(this.timerEl);
    topBar.appendChild(this.slowMoStatusEl);
    this.container.appendChild(topBar);

    // 4. Center Reticle & Hitmarker
    this.reticleEl = document.createElement("div");
    this.reticleEl.style.position = "absolute";
    this.reticleEl.style.top = "50%";
    this.reticleEl.style.left = "50%";
    this.reticleEl.style.width = "18px";
    this.reticleEl.style.height = "18px";
    this.reticleEl.style.transform = "translate(-50%, -50%)";
    this.reticleEl.style.border = "2px solid rgba(77, 238, 234, 0.75)";
    this.reticleEl.style.borderRadius = "50%";
    this.reticleEl.style.pointerEvents = "none";

    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.top = "50%";
    dot.style.left = "50%";
    dot.style.width = "4px";
    dot.style.height = "4px";
    dot.style.transform = "translate(-50%, -50%)";
    dot.style.backgroundColor = "var(--tactical-info)";
    dot.style.borderRadius = "50%";
    this.reticleEl.appendChild(dot);
    this.container.appendChild(this.reticleEl);

    // Red Headshot Hitmarker X
    this.hitmarkerEl = document.createElement("div");
    this.hitmarkerEl.style.position = "absolute";
    this.hitmarkerEl.style.top = "50%";
    this.hitmarkerEl.style.left = "50%";
    this.hitmarkerEl.style.transform = "translate(-50%, -50%)";
    this.hitmarkerEl.style.color = "var(--critical-danger)";
    this.hitmarkerEl.style.fontFamily = "var(--font-mono)";
    this.hitmarkerEl.style.fontSize = "22px";
    this.hitmarkerEl.style.fontWeight = "bold";
    this.hitmarkerEl.style.display = "none";
    this.hitmarkerEl.textContent = "✕ HEADSHOT";
    this.container.appendChild(this.hitmarkerEl);

    // 5. Bottom Left: Shield Integrity Gauge
    const shieldCard = document.createElement("div");
    shieldCard.className = "tactical-card";
    shieldCard.style.position = "absolute";
    shieldCard.style.bottom = "calc(20px + var(--safe-bottom))";
    shieldCard.style.left = "calc(20px + var(--safe-left))";
    shieldCard.style.width = "180px";
    shieldCard.style.padding = "8px 12px";

    const shieldHeader = document.createElement("div");
    shieldHeader.style.display = "flex";
    shieldHeader.style.justifyContent = "space-between";
    shieldHeader.style.fontFamily = "var(--font-mono)";
    shieldHeader.style.fontSize = "11px";
    shieldHeader.style.color = "var(--text-muted)";
    shieldHeader.style.marginBottom = "4px";

    const shieldTitle = document.createElement("span");
    shieldTitle.textContent = "🛡️ ЩИТ СТОЙКОСТЬ";

    this.shieldHpTextEl = document.createElement("span");
    this.shieldHpTextEl.className = "tabular-nums";
    this.shieldHpTextEl.style.color = "var(--tactical-info)";
    this.shieldHpTextEl.style.fontWeight = "bold";
    this.shieldHpTextEl.textContent = "100%";

    shieldHeader.appendChild(shieldTitle);
    shieldHeader.appendChild(this.shieldHpTextEl);
    shieldCard.appendChild(shieldHeader);

    // Shield Bar
    const shieldBarTrack = document.createElement("div");
    shieldBarTrack.style.width = "100%";
    shieldBarTrack.style.height = "6px";
    shieldBarTrack.style.backgroundColor = "rgba(255,255,255,0.1)";
    shieldBarTrack.style.borderRadius = "3px";
    shieldBarTrack.style.overflow = "hidden";

    this.shieldBarFillEl = document.createElement("div");
    this.shieldBarFillEl.style.width = "100%";
    this.shieldBarFillEl.style.height = "100%";
    this.shieldBarFillEl.style.backgroundColor = "var(--tactical-info)";
    this.shieldBarFillEl.style.transformOrigin = "left center";
    this.shieldBarFillEl.style.transform = "scaleX(1.0)";
    this.shieldBarFillEl.style.transition = "transform 0.15s ease";
    shieldBarTrack.appendChild(this.shieldBarFillEl);
    shieldCard.appendChild(shieldBarTrack);

    this.shieldGlassStatusEl = document.createElement("div");
    this.shieldGlassStatusEl.style.fontFamily = "var(--font-mono)";
    this.shieldGlassStatusEl.style.fontSize = "9px";
    this.shieldGlassStatusEl.style.color = "var(--text-muted)";
    this.shieldGlassStatusEl.style.marginTop = "4px";
    this.shieldGlassStatusEl.textContent = "СТЕКЛО: ЦЕЛО";
    shieldCard.appendChild(this.shieldGlassStatusEl);

    this.container.appendChild(shieldCard);

    // 6. Bottom Center: Slow-Mo Focus Bar
    this.focusContainerEl = document.createElement("div");
    this.focusContainerEl.style.position = "absolute";
    this.focusContainerEl.style.bottom = "calc(85px + var(--safe-bottom))";
    this.focusContainerEl.style.left = "50%";
    this.focusContainerEl.style.transform = "translateX(-50%)";
    this.focusContainerEl.style.width = "160px";
    this.focusContainerEl.style.display = "none";
    this.focusContainerEl.style.flexDirection = "column";
    this.focusContainerEl.style.alignItems = "center";
    this.focusContainerEl.style.gap = "3px";

    const focusTitle = document.createElement("span");
    focusTitle.style.fontFamily = "var(--font-mono)";
    focusTitle.style.fontSize = "10px";
    focusTitle.style.color = "var(--color-primary)";
    focusTitle.style.fontWeight = "bold";
    focusTitle.textContent = "ФОКУС ШТУРМА";
    this.focusContainerEl.appendChild(focusTitle);

    const focusTrack = document.createElement("div");
    focusTrack.style.width = "100%";
    focusTrack.style.height = "5px";
    focusTrack.style.backgroundColor = "rgba(255,255,255,0.1)";
    focusTrack.style.borderRadius = "2px";
    focusTrack.style.overflow = "hidden";

    this.focusBarFillEl = document.createElement("div");
    this.focusBarFillEl.style.width = "100%";
    this.focusBarFillEl.style.height = "100%";
    this.focusBarFillEl.style.backgroundColor = "var(--color-primary)";
    this.focusBarFillEl.style.transformOrigin = "center center";
    this.focusBarFillEl.style.transform = "scaleX(1.0)";
    focusTrack.appendChild(this.focusBarFillEl);
    this.focusContainerEl.appendChild(focusTrack);

    this.container.appendChild(this.focusContainerEl);

    // 7. Bottom Right: Ammo Counter
    const ammoCard = document.createElement("div");
    ammoCard.className = "tactical-card";
    ammoCard.style.position = "absolute";
    ammoCard.style.bottom = "calc(20px + var(--safe-bottom))";
    ammoCard.style.right = "calc(20px + var(--safe-right))";
    ammoCard.style.padding = "8px 14px";
    ammoCard.style.minWidth = "140px";
    ammoCard.style.textAlign = "right";

    this.weaponNameEl = document.createElement("div");
    this.weaponNameEl.style.fontFamily = "var(--font-mono)";
    this.weaponNameEl.style.fontSize = "10px";
    this.weaponNameEl.style.color = "var(--text-muted)";
    this.weaponNameEl.textContent = "ТАКТИЧЕСКИЙ P9";

    this.ammoCountEl = document.createElement("div");
    this.ammoCountEl.className = "tabular-nums";
    this.ammoCountEl.style.fontFamily = "var(--font-mono)";
    this.ammoCountEl.style.fontSize = "20px";
    this.ammoCountEl.style.fontWeight = "bold";
    this.ammoCountEl.style.color = "var(--text-main)";
    this.ammoCountEl.textContent = "15 / 60";

    this.reloadPromptEl = document.createElement("div");
    this.reloadPromptEl.style.fontFamily = "var(--font-mono)";
    this.reloadPromptEl.style.fontSize = "10px";
    this.reloadPromptEl.style.color = "var(--color-primary)";
    this.reloadPromptEl.style.display = "none";
    this.reloadPromptEl.textContent = "ПЕРЕЗАРЯДКА [R]";

    ammoCard.appendChild(this.weaponNameEl);
    ammoCard.appendChild(this.ammoCountEl);
    ammoCard.appendChild(this.reloadPromptEl);
    this.container.appendChild(ammoCard);
  }

  update(
    roomId: number,
    timeRemaining: number,
    shieldPercent: number,
    glassPercent: number,
    weapon: WeaponConfig,
    ammoInMag: number,
    ammoInReserve: number,
    isReloading: boolean,
    isSlowMo: boolean,
    slowMoRemainingRatio: number,
    isRecon: boolean
  ): void {
    // 1. Room label
    this.roomLabelEl.textContent = `СЕКТОР ${roomId}/3`;

    // 2. Timer
    const roundedTime = Math.max(0, Math.ceil(timeRemaining));
    if (roundedTime !== this.lastTime) {
      this.lastTime = roundedTime;
      const mins = Math.floor(roundedTime / 60);
      const secs = roundedTime % 60;
      this.timerEl.textContent = `⏱ ${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
      if (roundedTime <= 10) {
        this.timerEl.style.color = "var(--critical-danger)";
      } else {
        this.timerEl.style.color = "var(--text-main)";
      }
    }

    // 3. Shield
    if (shieldPercent !== this.lastShield) {
      this.lastShield = shieldPercent;
      this.shieldHpTextEl.textContent = `${shieldPercent}%`;
      this.shieldBarFillEl.style.transform = `scaleX(${Math.max(0, shieldPercent / 100)})`;

      if (shieldPercent <= 25) {
        this.shieldBarFillEl.style.backgroundColor = "var(--critical-danger)";
      } else {
        this.shieldBarFillEl.style.backgroundColor = "var(--tactical-info)";
      }

      this.shieldGlassStatusEl.textContent =
        glassPercent <= 0 ? "СТЕКЛО: РАЗБИТО" : glassPercent < 50 ? "СТЕКЛО: ТРЕЩИНЫ" : "СТЕКЛО: ЦЕЛО";
    }

    // 4. Ammo & Weapon
    this.weaponNameEl.textContent = weapon.name;
    if (ammoInMag !== this.lastShots || ammoInReserve !== this.lastReserve) {
      this.lastShots = ammoInMag;
      this.lastReserve = ammoInReserve;
      this.ammoCountEl.textContent = `${ammoInMag} / ${ammoInReserve}`;

      if (ammoInMag === 0) {
        this.ammoCountEl.style.color = "var(--critical-danger)";
      } else {
        this.ammoCountEl.style.color = "var(--text-main)";
      }
    }

    // 5. Reload prompt
    this.reloadPromptEl.style.display = isReloading ? "block" : "none";

    // 6. Slow-Mo Focus Bar
    this.slowMoStatusEl.style.display = isSlowMo ? "inline" : "none";
    if (isSlowMo) {
      this.focusContainerEl.style.display = "flex";
      this.focusBarFillEl.style.transform = `scaleX(${Math.max(0, Math.min(1, slowMoRemainingRatio))})`;
    } else {
      this.focusContainerEl.style.display = "none";
    }

    // 7. Recon Overlay
    this.reconOverlayEl.style.display = isRecon ? "block" : "none";
  }

  showHeadshotHitmarker(): void {
    this.hitmarkerEl.style.display = "block";
    if (this.hitmarkerTimeout !== null) clearTimeout(this.hitmarkerTimeout);
    this.hitmarkerTimeout = window.setTimeout(() => {
      this.hitmarkerEl.style.display = "none";
    }, 450);
  }

  triggerDamageFlash(): void {
    this.damageFlashEl.style.boxShadow = "inset 0 0 100px rgba(255, 30, 39, 0.75)";
    setTimeout(() => {
      this.damageFlashEl.style.boxShadow = "inset 0 0 80px rgba(255, 30, 39, 0)";
    }, 180);
  }

  show(): void {
    this.container.style.display = "block";
  }

  hide(): void {
    this.container.style.display = "none";
  }
}
