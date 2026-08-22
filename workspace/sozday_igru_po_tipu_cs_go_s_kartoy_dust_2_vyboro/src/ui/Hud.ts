import { events, GameEvents } from '../core/EventBus';
import { ICONS, getIcon } from './icons';
import { ui } from './UiRoot';

export class Hud {
  private static instance: Hud;
  public readonly element: HTMLElement;

  // Cached DOM elements
  private hpText!: HTMLElement;
  private armorText!: HTMLElement;
  private ammoText!: HTMLElement;
  private weaponIconSpan!: HTMLElement;
  private weaponNameSpan!: HTMLElement;
  private defuseKitIconSpan!: HTMLElement;

  private scoreCTText!: HTMLElement;
  private scoreTText!: HTMLElement;
  private roundTimerText!: HTMLElement;
  private c4StatusText!: HTMLElement;

  private defuseBarContainer!: HTMLElement;
  private defuseBarFill!: HTMLElement;

  private killfeedContainer!: HTMLElement;
  private radarCanvas!: HTMLCanvasElement;
  private radarCtx!: CanvasRenderingContext2D | null;

  // Crosshair lines
  private crosshairTop!: HTMLElement;
  private crosshairBottom!: HTMLElement;
  private crosshairLeft!: HTMLElement;
  private crosshairRight!: HTMLElement;

  private isVisible = false;

  private constructor() {
    this.element = ui.hudLayer;
    this.element.style.display = 'none';
    this.buildMarkup();

    events.on('HUD_UPDATE', (data) => this.update(data));
    events.on('KILLFEED_EVENT', (data) => this.pushKillfeed(data));
  }

  public static getInstance(): Hud {
    if (!Hud.instance) {
      Hud.instance = new Hud();
    }
    return Hud.instance;
  }

  private buildMarkup(): void {
    // Anchor: Top Left (Radar & C4 marker)
    const anchorTL = document.createElement('div');
    anchorTL.className = 'hud-anchor-top-left';
    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.className = 'radar-box';
    this.radarCanvas.width = 110;
    this.radarCanvas.height = 110;
    this.radarCtx = this.radarCanvas.getContext('2d');
    anchorTL.appendChild(this.radarCanvas);
    this.element.appendChild(anchorTL);

    // Anchor: Top Center (Match Score & C4 / Round Timer)
    const anchorTC = document.createElement('div');
    anchorTC.className = 'hud-anchor-top-center';

    const scoreCard = document.createElement('div');
    scoreCard.className = 'card-panel';
    scoreCard.style.cssText = 'display:flex;align-items:center;gap:12px;padding:6px 16px;';

    const ctBox = document.createElement('div');
    ctBox.style.cssText = 'display:flex;align-items:center;gap:6px;color:var(--color-ct);';
    ctBox.innerHTML = `${ICONS.TEAM_CT}`;
    this.scoreCTText = document.createElement('span');
    this.scoreCTText.className = 'num-slot';
    this.scoreCTText.textContent = '0';
    ctBox.appendChild(this.scoreCTText);

    const divider = document.createElement('span');
    divider.style.cssText = 'font-weight:700;color:var(--color-text-muted);';
    divider.textContent = ':';

    const tBox = document.createElement('div');
    tBox.style.cssText = 'display:flex;align-items:center;gap:6px;color:var(--color-t);';
    this.scoreTText = document.createElement('span');
    this.scoreTText.className = 'num-slot';
    this.scoreTText.textContent = '0';
    tBox.appendChild(this.scoreTText);
    tBox.innerHTML += `${ICONS.TEAM_T}`;

    scoreCard.appendChild(ctBox);
    scoreCard.appendChild(divider);
    scoreCard.appendChild(tBox);
    anchorTC.appendChild(scoreCard);

    // Round / C4 timer status
    const timerCard = document.createElement('div');
    timerCard.className = 'card-panel';
    timerCard.style.cssText = 'margin-top:4px;padding:4px 12px;display:flex;align-items:center;gap:8px;';
    this.roundTimerText = document.createElement('span');
    this.roundTimerText.className = 'num-slot';
    this.roundTimerText.style.fontSize = '1.1rem';
    this.roundTimerText.textContent = '0:45';

    this.c4StatusText = document.createElement('span');
    this.c4StatusText.style.cssText = 'font-size:0.9rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;';
    this.c4StatusText.textContent = 'C4 ARMED';
    this.c4StatusText.style.color = 'var(--color-c4-danger)';

    timerCard.appendChild(this.roundTimerText);
    timerCard.appendChild(this.c4StatusText);
    anchorTC.appendChild(timerCard);

    this.element.appendChild(anchorTC);

    // Anchor: Top Right (Killfeed)
    const anchorTR = document.createElement('div');
    anchorTR.className = 'hud-anchor-top-right';
    this.killfeedContainer = document.createElement('div');
    this.killfeedContainer.className = 'killfeed-list';
    anchorTR.appendChild(this.killfeedContainer);
    this.element.appendChild(anchorTR);

    // Anchor: Center (Dynamic Crosshair & Defuse Bar)
    const anchorCenter = document.createElement('div');
    anchorCenter.className = 'hud-anchor-center';

    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair-container';
    this.crosshairTop = document.createElement('div');
    this.crosshairTop.className = 'crosshair-line crosshair-top';
    this.crosshairBottom = document.createElement('div');
    this.crosshairBottom.className = 'crosshair-line crosshair-bottom';
    this.crosshairLeft = document.createElement('div');
    this.crosshairLeft.className = 'crosshair-line crosshair-left';
    this.crosshairRight = document.createElement('div');
    this.crosshairRight.className = 'crosshair-line crosshair-right';
    const dot = document.createElement('div');
    dot.className = 'crosshair-dot';

    crosshair.appendChild(this.crosshairTop);
    crosshair.appendChild(this.crosshairBottom);
    crosshair.appendChild(this.crosshairLeft);
    crosshair.appendChild(this.crosshairRight);
    crosshair.appendChild(dot);
    anchorCenter.appendChild(crosshair);

    this.defuseBarContainer = document.createElement('div');
    this.defuseBarContainer.className = 'defuse-progress-bar';
    this.defuseBarContainer.style.display = 'none';
    this.defuseBarFill = document.createElement('div');
    this.defuseBarFill.className = 'defuse-fill';
    this.defuseBarContainer.appendChild(this.defuseBarFill);
    anchorCenter.appendChild(this.defuseBarContainer);

    this.element.appendChild(anchorCenter);

    // Anchor: Bottom Left (Health & Armor)
    const anchorBL = document.createElement('div');
    anchorBL.className = 'hud-anchor-bottom-left';

    const hpCard = document.createElement('div');
    hpCard.className = 'card-panel';
    hpCard.style.cssText = 'display:flex;align-items:center;gap:8px;border-left:4px solid var(--color-hp);';
    hpCard.innerHTML = `<span style="color:var(--color-hp)">${ICONS.HEALTH}</span>`;
    this.hpText = document.createElement('span');
    this.hpText.className = 'num-slot';
    this.hpText.textContent = '100';
    hpCard.appendChild(this.hpText);

    const armorCard = document.createElement('div');
    armorCard.className = 'card-panel';
    armorCard.style.cssText = 'display:flex;align-items:center;gap:8px;border-left:4px solid var(--color-armor);';
    armorCard.innerHTML = `<span style="color:var(--color-armor)">${ICONS.ARMOR}</span>`;
    this.armorText = document.createElement('span');
    this.armorText.className = 'num-slot';
    this.armorText.textContent = '100';
    armorCard.appendChild(this.armorText);

    this.defuseKitIconSpan = document.createElement('span');
    this.defuseKitIconSpan.style.cssText = 'color:var(--color-ct);display:none;';
    this.defuseKitIconSpan.innerHTML = ICONS.DEFUSE_KIT;
    armorCard.appendChild(this.defuseKitIconSpan);

    anchorBL.appendChild(hpCard);
    anchorBL.appendChild(armorCard);
    this.element.appendChild(anchorBL);

    // Anchor: Bottom Right (Ammo & Weapon)
    const anchorBR = document.createElement('div');
    anchorBR.className = 'hud-anchor-bottom-right';

    const weaponCard = document.createElement('div');
    weaponCard.className = 'card-panel';
    weaponCard.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:140px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    this.weaponIconSpan = document.createElement('span');
    this.weaponIconSpan.innerHTML = ICONS.AK47;
    this.weaponNameSpan = document.createElement('span');
    this.weaponNameSpan.style.cssText = 'font-weight:700;font-size:0.95rem;text-transform:uppercase;';
    this.weaponNameSpan.textContent = 'AK-47';
    topRow.appendChild(this.weaponNameSpan);
    topRow.appendChild(this.weaponIconSpan);

    this.ammoText = document.createElement('div');
    this.ammoText.className = 'num-slot';
    this.ammoText.style.cssText = 'font-size:1.8rem;color:var(--color-primary-action);';
    this.ammoText.textContent = '30 / 90';

    weaponCard.appendChild(topRow);
    weaponCard.appendChild(this.ammoText);
    anchorBR.appendChild(weaponCard);

    this.element.appendChild(anchorBR);
  }

  public show(): void {
    this.isVisible = true;
    this.element.style.display = 'block';
  }

  public hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  public update(data: GameEvents['HUD_UPDATE']): void {
    if (!this.isVisible) return;

    this.hpText.textContent = Math.max(0, Math.round(data.health)).toString();
    this.armorText.textContent = Math.max(0, Math.round(data.armor)).toString();
    this.ammoText.textContent = `${data.ammo} / ${data.reserveAmmo}`;
    this.weaponNameSpan.textContent = data.weaponName;

    const iconKey = data.weaponId.toUpperCase() as keyof typeof ICONS;
    if (ICONS[iconKey]) {
      this.weaponIconSpan.innerHTML = getIcon(iconKey);
    }

    this.defuseKitIconSpan.style.display = data.hasDefuseKit ? 'inline-block' : 'none';

    this.scoreCTText.textContent = data.scoreCT.toString();
    this.scoreTText.textContent = data.scoreT.toString();

    // Round timer / C4 timer
    if (data.c4Ticking) {
      this.roundTimerText.textContent = `${Math.max(0, data.c4TimeRemaining).toFixed(1)}s`;
      this.c4StatusText.textContent = 'C4 TICKING';
      this.c4StatusText.style.color = 'var(--color-c4-danger)';
    } else {
      const minutes = Math.floor(data.c4TimeRemaining / 60);
      const seconds = Math.floor(data.c4TimeRemaining % 60);
      this.roundTimerText.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      this.c4StatusText.textContent = 'RETAKE 3v3';
      this.c4StatusText.style.color = 'var(--color-text-muted)';
    }

    // Defuse bar
    if (data.isDefusing) {
      this.defuseBarContainer.style.display = 'block';
      this.defuseBarFill.style.transform = `scaleX(${Math.min(1, data.defuseProgress)})`;
    } else {
      this.defuseBarContainer.style.display = 'none';
    }

    // Dynamic Crosshair spread
    const spreadPx = Math.max(0, data.crosshairSpread * 0.4);
    this.crosshairTop.style.transform = `translateY(-${spreadPx}px)`;
    this.crosshairBottom.style.transform = `translateY(${spreadPx}px)`;
    this.crosshairLeft.style.transform = `translateX(-${spreadPx}px)`;
    this.crosshairRight.style.transform = `translateX(${spreadPx}px)`;

    // Draw Radar
    this.drawRadar(data.radarEntities, data.c4Position);
  }

  private drawRadar(entities: GameEvents['HUD_UPDATE']['radarEntities'], c4Pos?: { x: number; z: number }): void {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 1.4; // pixels per world unit

    ctx.clearRect(0, 0, w, h);

    // Radar grid rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.stroke();

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    // Find player position as center offset
    const player = entities.find((e) => e.isPlayer);
    const px = player ? player.x : 0;
    const pz = player ? player.z : 0;

    // Draw C4 icon/marker if planted
    if (c4Pos) {
      const rx = cx + (c4Pos.x - px) * scale;
      const ry = cy + (c4Pos.z - pz) * scale;
      if (rx >= 4 && rx <= w - 4 && ry >= 4 && ry <= h - 4) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.9)';
        ctx.beginPath();
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.stroke();
      }
    }

    // Draw entities
    for (const ent of entities) {
      if (!ent.isAlive) continue;
      const rx = cx + (ent.x - px) * scale;
      const ry = cy + (ent.z - pz) * scale;

      if (rx < 4 || rx > w - 4 || ry < 4 || ry > h - 4) continue;

      ctx.beginPath();
      if (ent.isPlayer) {
        ctx.fillStyle = 'rgba(0, 255, 102, 0.9)';
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      } else if (ent.team === 'CT') {
        ctx.fillStyle = 'rgba(74, 144, 226, 0.9)';
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = 'rgba(230, 126, 34, 0.9)';
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  public pushKillfeed(data: GameEvents['KILLFEED_EVENT']): void {
    const row = document.createElement('div');
    row.className = 'killfeed-row';

    const killerColor = data.killerTeam === 'CT' ? 'var(--color-ct)' : 'var(--color-t)';
    const victimColor = data.victimTeam === 'CT' ? 'var(--color-ct)' : 'var(--color-t)';

    let iconsHtml = `<span style="opacity:0.7">${data.weapon.toUpperCase()}</span>`;
    if (data.isWallbang) {
      iconsHtml += ` ${ICONS.WALLBANG}`;
    }
    if (data.isHeadshot) {
      iconsHtml += ` <span style="color:var(--color-c4-danger)">${ICONS.HEADSHOT}</span>`;
    }

    row.innerHTML = `
      <span style="font-weight:700;color:${killerColor}">${data.killerName}</span>
      ${iconsHtml}
      <span style="font-weight:700;color:${victimColor}">${data.victimName}</span>
    `;

    this.killfeedContainer.prepend(row);

    // Limit to 5 rows and auto-remove after 4.5s
    while (this.killfeedContainer.children.length > 5) {
      this.killfeedContainer.lastElementChild?.remove();
    }

    setTimeout(() => {
      row.style.transition = 'opacity 0.5s ease';
      row.style.opacity = '0';
      setTimeout(() => row.remove(), 500);
    }, 4500);
  }
}

export const hud = Hud.getInstance();
