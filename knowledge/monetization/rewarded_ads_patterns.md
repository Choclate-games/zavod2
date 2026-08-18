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

## Technical Implementation

The promise from `showRewarded()` resolves on skip and close too — granting the
reward there pays out for free. Grant it from the `rewarded` **event** only, and
always unsubscribe. Full implementation with the double-click guard:
`../playgama/ads_integration.md`.

```typescript
async function showRewardedPlacement(placementId: string, onReward: () => void) {
    if (!AdsService.isRewardedSupported()) return;   // button should not exist at all — see below

    const granted = await AdsService.showRewardedOnce(placementId);  // event-based, single-flight
    if (granted) {
        onReward();
        SaveService.saveDebounced();
    } else {
        showToast(t('rewardNotGranted'));
    }
}
```

Pausing the game loop and audio around the ad is handled by the platform's own
`PAUSE_STATE_CHANGED` / `AUDIO_STATE_CHANGED` events, not by wrapping the call —
see `../playgama/lifecycle_and_orientation.md`. Doing both double-pauses the
game and leaves it paused when the ad fails to open.

## Button UX is a requirement, not polish

A button that triggers a rewarded ad must **visually say so** before the player
presses it. A bare "Hint" or "Extra Life" label is not enough.

- Two-line button: main label + a small "watch ad" sub-label, plus a distinct
  border/accent colour and a 📺 marker.
- If the same button is reused in a free context (tutorial, premium owner),
  switch it back to the plain label.
- If `isRewardedSupported` is false, **remove the button** — do not disable it.

## Never a random gate

If a feature can be sped up with a rewarded ad, show the option whenever the
action is eligible (`timeLeft >= threshold`), never behind `Math.random() < 0.3`.
A random gate means most sessions never see the offer at all.

## Cap ad-assist

"Short by a few coins? Watch an ad" is strong — but cap it (≤10 % of a typical
session's income) so one ad can never cover a purchase meant to take real
playtime. Never offer ad-assist on the expensive tier.

## Premium players keep rewarded ads

Removing ads means removing *interruptions* — interstitials and banners.
Rewarded ads stay: they are opt-in and beneficial. Only strip them if the premium
tier is explicitly sold as "no ads at all".
