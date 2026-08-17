# Playgama Bridge: Ads Integration Architecture

## Complete Service Pattern
```typescript
import bridge, { VisibilityState } from '@playgama/bridge';

export class AdsService {
    private static lastInterstitialTime = 0;
    private static readonly INTERSTITIAL_COOLDOWN_MS = 90_000; // 90s

    static init(onPause: () => void, onResume: () => void) {
        bridge.advertisement.on('interstitial_state_changed', (state) => {
            if (state === 'opened') onPause();
            else if (state === 'closed' || state === 'failed') onResume();
        });

        bridge.advertisement.on('rewarded_state_changed', (state) => {
            if (state === 'opened') onPause();
            else if (state === 'closed' || state === 'failed') onResume();
        });
    }

    static canShowInterstitial(): boolean {
        return Date.now() - this.lastInterstitialTime >= this.INTERSTITIAL_COOLDOWN_MS;
    }

    static async showInterstitial(): Promise<boolean> {
        if (!this.canShowInterstitial()) return false;
        try {
            await bridge.advertisement.showInterstitial();
            this.lastInterstitialTime = Date.now();
            return true;
        } catch (e) {
            console.warn('Interstitial failed:', e);
            return false;
        }
    }

    static async showRewarded(onSuccess: () => void): Promise<boolean> {
        try {
            await bridge.advertisement.showRewarded();
            onSuccess();
            return true;
        } catch (e) {
            console.warn('Rewarded ad failed:', e);
            return false;
        }
    }
}
```
