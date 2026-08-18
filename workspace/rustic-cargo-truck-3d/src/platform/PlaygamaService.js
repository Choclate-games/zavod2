import { StorageService } from './StorageService';
import npmBridge from '@playgama/bridge';
export class PlaygamaService {
    storage = new StorageService();
    readySent = false;
    lastInterstitial = 0;
    async initialize() {
        const bridge = this.activeBridge();
        if (bridge?.initialize) {
            await Promise.race([bridge.initialize().catch(() => undefined), new Promise((resolve) => window.setTimeout(resolve, 10000))]);
            try {
                bridge.platform?.sendMessage?.('in_game_loading_started');
            }
            catch { /* optional SDK */ }
        }
        return this.load();
    }
    setProgress(percent) {
        const bridge = this.activeBridge();
        try {
            bridge?.setGameLoadingProgress?.(Math.max(0, Math.min(100, Math.round(percent))));
        }
        catch { /* optional SDK */ }
    }
    sendReady() {
        if (this.readySent)
            return;
        this.readySent = true;
        const bridge = this.activeBridge();
        try {
            bridge.platform?.sendMessage?.('game_ready');
        }
        catch { /* optional SDK */ }
        try {
            bridge.platform?.sendMessage?.('in_game_loading_stopped');
        }
        catch { /* optional SDK */ }
    }
    async load() {
        const local = this.storage.loadLocal();
        try {
            const remote = await this.activeBridge().storage?.get?.('player_coins');
            if (remote && typeof remote === 'object') {
                const merged = this.storage.normalize({ ...local, ...remote });
                this.storage.schedule(merged);
                return merged;
            }
        }
        catch {
            // Offline guests use the mirrored local save.
        }
        return local;
    }
    async save(save) {
        this.storage.schedule(save);
        try {
            await this.activeBridge().storage?.set?.('player_coins', save);
        }
        catch { /* offline fallback */ }
    }
    bindLifecycle(onPause, onAudio) {
        const platform = this.activeBridge().platform;
        platform?.on?.('PAUSE_STATE_CHANGED', onPause);
        platform?.on?.('AUDIO_STATE_CHANGED', onAudio);
    }
    async rewarded(placement) {
        const show = this.activeBridge().advertisement?.showRewarded;
        if (!show)
            return false;
        try {
            await show(placement);
            return true;
        }
        catch {
            return false;
        }
    }
    async interstitial() {
        if (Date.now() - this.lastInterstitial < 90000)
            return false;
        const show = this.activeBridge().advertisement?.showInterstitial;
        if (!show)
            return false;
        try {
            await show();
            this.lastInterstitial = Date.now();
            return true;
        }
        catch {
            return false;
        }
    }
    activeBridge() {
        return window.bridge ?? npmBridge;
    }
}
