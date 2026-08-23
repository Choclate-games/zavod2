import { EventBus } from '../core/EventBus';
import { GameplayShiftViewScreen } from './screens/GameplayShiftViewScreen';

export class Hud {
  private gameplayScreen: GameplayShiftViewScreen;

  constructor(gameplayScreen: GameplayShiftViewScreen) {
    this.gameplayScreen = gameplayScreen;
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    EventBus.on('HEAT_LEVEL_CHANGED', () => {});
    EventBus.on('REACTOR_HP_CHANGED', ({ hp, maxHp }) => {
      const ratio = hp / maxHp;
      const color = ratio < 0.3 ? 'var(--color-danger-overheat)' : 'var(--color-reactor-health)';
      this.gameplayScreen.reactorMeter.setValue(ratio, `${Math.round(hp)} / ${maxHp} HP`, color);
    });

    EventBus.on('SCRAP_CHANGED', (scrap) => {
      this.gameplayScreen.scrapDisplay.textContent = String(Math.round(scrap));
    });

    EventBus.on('CRYO_LEVEL_CHANGED', (level) => {
      const ratio = level / 100;
      this.gameplayScreen.cryoMeter.setValue(ratio, `${Math.round(level)} ЕД`, 'var(--color-cooling-ready)');
    });

    EventBus.on('WAVE_PROGRESS', ({ wave, totalWaves, remainingEnemies }) => {
      this.gameplayScreen.waveDisplay.textContent = `ВОЛНА ${wave}/${totalWaves} (${remainingEnemies} ВРАГОВ)`;
    });
  }
}
