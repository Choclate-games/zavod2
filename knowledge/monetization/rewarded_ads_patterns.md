# Rewarded Ads Patterns for Web & Mobile Games

## Core Philosophy
Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.

## Top High-Performing Rewarded Ad Placements

### 1. Second Chance / Run Revive
- **When**: On fatal damage in an active run.
- **Offer**: Restore 50% HP + 3-second invulnerability shield with shockwave clearing nearby enemies.
- **Constraint**: Strict limit of 1 revive per run to preserve permadeath tension.
- **Conversion Rate**: 35-55% when the player reached wave 5+.

### 2. End-of-Run Spoils Multiplier (2x Gold)
- **When**: On Game Over / Victory summary screen.
- **Offer**: Double the meta-currency / gold earned during that specific run.
- **UI**: Clear visual animation of gold count spinning and multiplying.
- **Conversion Rate**: 40-60% on high-earning runs.

### 3. Upgrade Reroll / Guaranteed Rare Card
- **When**: During the 3-choice upgrade modal when player rolls unwanted common cards.
- **Offer**: Free reroll with guaranteed Rare or Epic tier card in the new pool.
- **Constraint**: 2 uses per run max or 1 per boss wave.

### 4. Daily Crate / Free Arena Chest
- **When**: In Main Menu / Meta Shop.
- **Offer**: Instant unlock of gear chest containing weapons or cosmetics.
- **Cooldown**: 4 hours or once per calendar day.

## Technical Implementation with Playgama Bridge
```typescript
async function showRewardedPlacement(placementId: string, onReward: () => void) {
    if (!bridge.advertisement.isRewardedSupported) {
        console.warn('Rewarded ads not supported on this platform');
        return;
    }
    
    // Pause audio and game loop
    AudioManager.pauseAll();
    GameLoop.pause();
    
    try {
        await bridge.advertisement.showRewarded();
        // Give reward upon successful completion
        onReward();
        SaveService.saveDebounced();
    } catch (error) {
        console.warn('Rewarded ad failed or closed prematurely', error);
    } finally {
        // Resume audio and game loop
        AudioManager.resumeAll();
        GameLoop.resume();
    }
}
```
