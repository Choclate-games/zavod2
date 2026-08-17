# In-App Purchases & Web Microtransactions

## Web Gaming Economics
On platforms like Yandex Games, VK Play, and CrazyGames:
- Primary revenue comes from Ads (Rewarded + Interstitial).
- In-App Purchases (Yandex Yan, VK Voices, etc.) provide 15-30% additional revenue from whales.

## Top IAP SKUs
1. **Ad-Free Starter Pack / VIP Pass**:
   - Removes mandatory interstitial ads forever.
   - Provides 1.5x passive gold bonus and cosmetic golden armor skin.
2. **Permanent Meta-Coin Bundles**:
   - Small, Medium, Large coin packs for rapid character unlocking.
3. **Exclusive Class / Champion Unlocks**:
   - Premium gladiator or mech with unique signature ability.

## Architecture Guidelines
- Always wrap payment calls in `PaymentService` that verifies purchase state through `bridge.payments` if supported, falling back gracefully on non-paying platforms.
