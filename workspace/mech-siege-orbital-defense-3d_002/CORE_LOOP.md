# Core Loop Design: Мех-Осада: Защита Орбитальной Базы 3D

## 1. Visual Flow Diagram
```text
┌─────────────────────────────────────────────────────────────┐
│                       MAIN GAME RUN                         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
                ┌───────────────────────────┐
                │ 1. Spawn Wave & Action    │
                └───────────────────────────┘
                               │
                               ▼
                ┌───────────────────────────┐
                │ 2. Tactical Gameplay      │
                │    - Evading & Striking   │
                │    - Collecting XP/Orbs   │
                └───────────────────────────┘
                               │
                               ▼
                ┌───────────────────────────┐
                │ 3. Wave Clear & Spoils    │
                └───────────────────────────┘
                               │
                               ▼
                ┌───────────────────────────┐
                │ 4. 3-Card Upgrade Choice  │
                │    - Synergies & Rerolls  │
                └───────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        [ Next Wave ]                 [ Boss Encounter ]
                │                             │
                ▼                             ▼
       ( Escalating Waves )          ( Triumph / Defeat )
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │ 5. Meta Armory & Upgrades   │
                               │    - Playgama Cloud Save    │
                               │    - Leaderboard Submit     │
                               └─────────────────────────────┘
```

## 2. Micro-Loop (Second-by-Second)
- Read enemy tell animation -> Dash or Parry -> Strike with impact -> Watch feedback reaction -> Reposition.

## 3. Meso-Loop (Wave-by-Wave)
- Clear wave (45-60 seconds) -> Collect spoils -> Select 1 of 3 upgrade cards -> Prepare for next wave composition.

## 4. Macro-Loop (Session-by-Session)
- Complete run (5-8 minutes) -> Bank currency -> Unlock new weapons/talents -> Climb leaderboards.
