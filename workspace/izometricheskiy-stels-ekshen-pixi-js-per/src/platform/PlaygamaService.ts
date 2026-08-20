/**
 * Playgama Bridge Service v2 wrapper
 */

import bridge from '@playgama/bridge';
import { eventBus } from '../core/EventBus';

export class PlaygamaService {
  private static isInitialized = false;
  private static gameReadySent = false;
  private static lastInterstitialTime = 0;
  private static pendingInterstitialPlacement: string | null = null;
  private static inFlightRewarded: Promise<boolean> | null = null;
  private static readonly INTERSTITIAL_COOLDOWN_MS = 90_000;

  static async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 10 second timeout race
      await Promise.race([
        bridge.initialize(),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
      this.isInitialized = true;

      try {
        bridge.platform.sendMessage('in_game_loading_started');
      } catch {}

      // Lifecycle pause & audio events
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) => {
        eventBus.emit('game:pause', paused);
      });

      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) => {
        eventBus.emit('audio:sfx', { name: enabled ? 'unmute' : 'mute' });
      });

      // Silent auto-auth for VK / OK
      if (['vk', 'ok'].includes(bridge.platform.id)) {
        try {
          if (bridge.player?.authorize) {
            await Promise.race([
              bridge.player.authorize(),
              new Promise((r) => setTimeout(r, 4000)),
            ]);
          }
        } catch (err) {
          console.info('[Playgama] Silent auth fallback:', err);
        }
      }
    } catch (err) {
      console.warn('[Playgama] Bridge init fallback to offline mode:', err);
      this.isInitialized = true;
    }
  }

  static sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      bridge.platform.sendMessage('game_ready');
    } catch {}
    try {
      bridge.platform.sendMessage('in_game_loading_stopped');
    } catch {}
  }

  static setProgress(percent: number): void {
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)));
      bridge.setGameLoadingProgress(clamped);
    } catch {}
  }

  static get isRewardedSupported(): boolean {
    return Boolean(bridge.advertisement?.isRewardedSupported);
  }

  static get isInterstitialSupported(): boolean {
    return Boolean(bridge.advertisement?.isInterstitialSupported);
  }

  static get isBannerSupported(): boolean {
    return Boolean(bridge.advertisement?.isBannerSupported);
  }

  static get isLeaderboardSupported(): boolean {
    return Boolean(bridge.leaderboards && bridge.leaderboards.type && bridge.leaderboards.type !== 'not_available');
  }

  static showRewarded(placement: string): Promise<boolean> {
    if (this.inFlightRewarded) {
      return this.inFlightRewarded;
    }

    if (!this.isRewardedSupported) {
      console.info(`[Playgama] Rewarded not supported on platform, granting reward fallback.`);
      return Promise.resolve(true);
    }

    this.inFlightRewarded = new Promise<boolean>((resolve) => {
      let isSettled = false;

      const cleanup = () => {
        try {
          bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        } catch {}
      };

      const handler = (state: string) => {
        if (isSettled) return;
        if (state === 'rewarded') {
          isSettled = true;
          cleanup();
          resolve(true);
        } else if (state === 'closed' || state === 'failed') {
          isSettled = true;
          cleanup();
          resolve(false);
        }
      };

      try {
        bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, handler);
        bridge.advertisement.showRewarded(placement);
      } catch (err) {
        console.error('[Playgama] showRewarded error:', err);
        cleanup();
        resolve(false);
      }
    }).finally(() => {
      this.inFlightRewarded = null;
    });

    return this.inFlightRewarded;
  }

  static armInterstitial(placement: string): void {
    this.pendingInterstitialPlacement = placement;
  }

  static flushInterstitial(): boolean {
    const placement = this.pendingInterstitialPlacement;
    this.pendingInterstitialPlacement = null;

    if (!placement || !this.isInterstitialSupported) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastInterstitialTime < this.INTERSTITIAL_COOLDOWN_MS) {
      return false;
    }

    this.lastInterstitialTime = now;
    try {
      bridge.advertisement.showInterstitial(placement);
      return true;
    } catch (err) {
      console.error('[Playgama] Interstitial error:', err);
      return false;
    }
  }

  static showBanner(position: 'top' | 'bottom' = 'bottom'): void {
    if (!this.isBannerSupported) return;
    try {
      bridge.advertisement.showBanner(position);
    } catch {}
  }

  static hideBanner(): void {
    if (!this.isBannerSupported) return;
    try {
      bridge.advertisement.hideBanner();
    } catch {}
  }

  static async setLeaderboardScore(leaderboardName: string, score: number): Promise<void> {
    if (!this.isLeaderboardSupported) return;
    try {
      await bridge.leaderboards.setScore(leaderboardName, Math.round(score));
    } catch (err) {
      console.warn('[Playgama] Set leaderboard score failed:', err);
    }
  }

  static async getLeaderboardEntries(leaderboardName: string): Promise<Array<{ rank: number; name: string; score: number }>> {
    if (!this.isLeaderboardSupported) {
      return [
        { rank: 1, name: 'Лесной Страж', score: 12 },
        { rank: 2, name: 'Ведун Радомир', score: 9 },
        { rank: 3, name: 'Охотник Ярослав', score: 7 },
        { rank: 4, name: 'Знахарка Мирослава', score: 5 },
        { rank: 5, name: 'Следопыт Любомир', score: 4 },
      ];
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await bridge.leaderboards.getEntries(leaderboardName) as any;
      if (res && Array.isArray(res)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return res.map((e: any, index: number) => ({
          rank: e.rank || index + 1,
          name: e.player?.name || `Игрок #${index + 1}`,
          score: e.score || 0,
        }));
      }
    } catch (err) {
      console.warn('[Playgama] Get leaderboard entries fallback:', err);
    }

    return [
      { rank: 1, name: 'Лесной Страж', score: 12 },
      { rank: 2, name: 'Ведун Радомир', score: 9 },
      { rank: 3, name: 'Охотник Ярослав', score: 7 },
    ];
  }
}
