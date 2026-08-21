import bridge from '@playgama/bridge';
import { storageService } from './StorageService';
import { eventBus } from '../core/EventBus';
import { CONFIG } from '../core/Config';

export class PlaygamaService {
  private isInitialized = false;
  private gameReadySent = false;
  private lastInterstitialTime = 0;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10 second timeout guard
      await Promise.race([
        (bridge as any).initialize(),
        new Promise((r) => setTimeout(r, 10000)),
      ]);
      try {
        (bridge as any).platform.sendMessage('in_game_loading_started');
      } catch {}

      this.setupLifecycle();

      // Silent auth for VK/OK
      await this.autoAuthorizeSilent();

      // Load saved data
      await storageService.load((bridge as any).storage);

      this.isInitialized = true;
    } catch (err) {
      console.warn('[PlaygamaService] Initialization failed or timed out', err);
      await storageService.load();
      this.isInitialized = true;
    }
  }

  sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      (bridge as any).platform.sendMessage('game_ready');
    } catch (err) {
      console.warn('[PlaygamaService] game_ready failed', err);
    }
    try {
      (bridge as any).platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  private setupLifecycle(): void {
    try {
      const EN = (bridge as any).EVENT_NAME || {};
      if (EN.PAUSE_STATE_CHANGED) {
        (bridge as any).platform.on(EN.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
          if (isPaused) {
            eventBus.emit('game:pause', undefined);
          }
        });
      }
      if (EN.AUDIO_STATE_CHANGED) {
        (bridge as any).platform.on(EN.AUDIO_STATE_CHANGED, (isMuted: boolean) => {
          eventBus.emit('audio:mute_toggle', isMuted);
        });
      }
    } catch (err) {
      console.warn('[PlaygamaService] lifecycle setup error', err);
    }
  }

  private async autoAuthorizeSilent(): Promise<void> {
    try {
      const platformId = (bridge as any).platform?.id;
      if (platformId === 'vk' || platformId === 'ok') {
        await Promise.race([
          (bridge as any).player.authorize(),
          new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
        ]).catch(() => false);
      }
    } catch {}
  }

  get isRewardedSupported(): boolean {
    try {
      return Boolean((bridge as any).supports?.has?.('advertisement.rewarded') ?? true);
    } catch {
      return true;
    }
  }

  async showRewarded(placementType: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let rewardGranted = false;
      let hasCleanedUp = false;

      const EN = (bridge as any).EVENT_NAME || {};
      const eventName = EN.REWARDED_STATE_CHANGED || 'rewarded_state_changed';

      const onStateChanged = (state: string) => {
        if (state === 'rewarded') {
          rewardGranted = true;
        } else if (state === 'closed' || state === 'failed') {
          cleanup();
          resolve(rewardGranted);
        }
      };

      const cleanup = () => {
        if (hasCleanedUp) return;
        hasCleanedUp = true;
        try {
          (bridge as any).advertisement.off(eventName, onStateChanged);
        } catch {}
      };

      try {
        (bridge as any).advertisement.on(eventName, onStateChanged);
        (bridge as any).advertisement.showRewarded(placementType).catch((err: any) => {
          console.warn('[PlaygamaService] showRewarded rejected', err);
          cleanup();
          resolve(false);
        });
      } catch (err) {
        console.warn('[PlaygamaService] showRewarded failed', err);
        cleanup();
        // In local dev mode without bridge, grant reward for testing
        resolve(true);
      }
    });
  }

  async showInterstitial(): Promise<boolean> {
    const now = Date.now();
    if (storageService.getData().vipAdFree) {
      return false;
    }

    if (now - this.lastInterstitialTime < CONFIG.ads.interstitialCooldownSec * 1000) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      this.lastInterstitialTime = now;
      try {
        (bridge as any).advertisement.showInterstitial()
          .then(() => resolve(true))
          .catch(() => resolve(false));
      } catch (err) {
        resolve(false);
      }
    });
  }

  async showBanner(position = 'bottom'): Promise<void> {
    try {
      if ((bridge as any).advertisement.showBanner) {
        await (bridge as any).advertisement.showBanner({ position });
      }
    } catch (err) {}
  }

  async hideBanner(): Promise<void> {
    try {
      if ((bridge as any).advertisement.hideBanner) {
        await (bridge as any).advertisement.hideBanner();
      }
    } catch (err) {}
  }

  async setLeaderboardScore(leaderboardName: string, score: number): Promise<boolean> {
    try {
      if ((bridge as any).leaderboard && (bridge as any).leaderboard.setScore) {
        await (bridge as any).leaderboard.setScore({
          leaderboardName,
          score,
        });
        return true;
      }
    } catch (err) {
      console.warn('[PlaygamaService] setLeaderboardScore failed', err);
    }
    return false;
  }

  async getLeaderboardEntries(leaderboardName: string, limit = 10): Promise<any[]> {
    try {
      if ((bridge as any).leaderboard && (bridge as any).leaderboard.getEntries) {
        const res = await (bridge as any).leaderboard.getEntries({
          leaderboardName,
          limit,
        });
        return res?.entries || [];
      }
    } catch (err) {
      console.warn('[PlaygamaService] getLeaderboardEntries failed', err);
    }
    return [
      { rank: 1, name: 'NitroKing_99', score: 74500 },
      { rank: 2, name: 'SilviaDrifter', score: 68200 },
      { rank: 3, name: 'CyberPhantom', score: 61100 },
      { rank: 4, name: 'SkylineGTR', score: 55000 },
      { rank: 5, name: 'ApexRunner', score: 49000 },
    ];
  }
}

export const playgamaService = new PlaygamaService();