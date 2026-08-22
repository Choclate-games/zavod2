# Skill: Dust 2: Ретейк и Дуэли Domain Architecture

## Purpose
Defines domain rules, state machine, and core gameplay loop for Dust 2: Ретейк и Дуэли.

## When to Use
Use when writing or modifying core game state, loop coordination, and progression.

## Core Rules & Constraints
- Strict TypeScript strict mode without any 'any' types.
- Fixed 60Hz delta accumulator with delta clamping.
- Decoupled state management via typed EventBus.
- Zero runtime object allocations inside the 60Hz game loop.

## System Architecture
Decoupled 3-layer architecture: Application/Platform -> Engine/Systems -> Rendering/UI.

## Implementation Guidance
Instantiate Game instance from main.ts, bootstrap PlaygamaService, and start GameLoop.

## Common Mistakes to Avoid
- ❌ **Mistake**: Do not instantiate Three.js meshes or heavy objects inside tick loops.
- ❌ **Mistake**: Do not bypass the EventBus for cross-system communications.

## Validation Checklist
- [ ] Game initializes cleanly and loads within 3 seconds.
- [ ] EventBus routes inputs and system events without memory leaks.
- [ ] Audio auto-pauses and unpauses cleanly with browser focus changes.
