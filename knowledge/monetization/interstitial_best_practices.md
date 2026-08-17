# Interstitial Ads Best Practices

## Core Placement Rules
1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment.
2. **Natural break points only**:
   - Level complete / Wave milestone transition.
   - Run game over (after player declined or used rewarded revive).
   - Returning to Main Menu after a session.
3. **Respect Cooldown Windows**:
   - Minimum 90 to 120 seconds between consecutive interstitial impressions.
   - Track `lastInterstitialTimestamp` in memory.
4. **First Session Grace Period**:
   - Never show interstitials during the first 2 minutes of a user's first game launch (Tutorial / Onboarding grace period).

## Handling Audio & Game State
- Always mute WebAudio/Howler.js when `interstitialState === 'opened'`.
- Freeze Physics and GameLoop timers so physics don't explode or enemies don't kill player in the background.
- On ad close, resume audio and unpause game loop cleanly.
