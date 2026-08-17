# Skill: Playgama Bridge SDK Integration

## Purpose
Defines implementation patterns for @playgama/bridge (Ads, Cloud Storage, Leaderboards, Lifecycle).

## When to Use
Use when implementing advertising triggers, cloud save/load, and portal lifecycle hooks.

## Core Rules & Constraints
- Always await bridge.initialize() before showing any ads or loading storage.
- Mute Howler audio master and pause game loop while ads are active.
- Handle ad errors gracefully without blocking the player's progression.
- Auto-save player progress on wave complete and game over.

## System Architecture
Singleton PlaygamaService wrapper exposing strongly-typed promises for Ads, Storage, and Leaderboards.

## Implementation Guidance
Call bridge.advertisement.showRewardedVideo() with proper reward callbacks and error handling.

## Common Mistakes to Avoid
- ❌ **Mistake**: Never show Interstitials during active gameplay without user expectation.
- ❌ **Mistake**: Never assume internet connection is permanent—support local offline fallback.

## Validation Checklist
- [ ] Rewarded video grants exact promised reward upon completion.
- [ ] Leaderboard score submits and displays correctly.
- [ ] Game auto-pauses when browser tab loses visibility.
