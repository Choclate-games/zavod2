# Playgama Bridge API Reference & Architecture

## Overview
Playgama Bridge (`@playgama/bridge`) is the unified SDK bridging HTML5 / WebGL games to Yandex Games, VK Play, CrazyGames, GameDistribution, and other platforms.

## Core Modules & Typings

### 1. Initialization & Lifecycle
```typescript
import bridge, { PlatformMessage } from '@playgama/bridge';

export async function initPlaygamaBridge(): Promise<void> {
    try {
        await bridge.initialize();
        console.log('Playgama Bridge Initialized. Platform:', bridge.platform.id);
        
        // Notify platform when game assets and main menu are ready
        bridge.platform.sendMessage(PlatformMessage.GAME_READY);
    } catch (err) {
        console.error('Failed to initialize Playgama Bridge', err);
    }
}
```

### 2. Platform & Device Info
- `bridge.platform.id`: `'yandex' | 'crazy_games' | 'vk' | 'game_distribution' | 'mock'`
- `bridge.platform.language`: `'ru' | 'en' | 'tr' | 'es' | ...`
- `bridge.device.type`: `'mobile' | 'tablet' | 'desktop'`

### 3. Advertisement Module
- `bridge.advertisement.showInterstitial()` -> Promise
- `bridge.advertisement.showRewarded()` -> Promise
- `bridge.advertisement.interstitialState`: `'loading' | 'opened' | 'closed' | 'failed'`
- `bridge.advertisement.rewardedState`: `'loading' | 'opened' | 'rewarded' | 'closed' | 'failed'`

### 4. Storage Module
- `bridge.storage.get(key | keys[], storageType)`
- `bridge.storage.set(key | keys[], value | values[], storageType)`
- `bridge.storage.delete(key | keys[], storageType)`
- `StorageType.LOCAL_STORAGE`, `StorageType.PLATFORM_INTERNAL`

### 5. Leaderboards Module
- `bridge.leaderboard.setScore({ leaderboardName, score })`
- `bridge.leaderboard.getEntries({ leaderboardName, quantityTop, quantityAround })`
