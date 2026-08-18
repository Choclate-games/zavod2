# Skill: Combat, Physics & Movement Systems

## Purpose
Defines standards for physics simulation, combat mechanics, and tactile player feedback.

## When to Use
Use when writing character controllers, weapon systems, collision listeners, and juice/VFX.

## Core Rules & Constraints
- Clamp delta time to maximum 100ms to prevent physics tunneling.
- Use continuous collision detection (CCD) for fast projectiles.
- Apply hitstop (40ms time dilation) on impactful strikes.
- Always synchronize physics rigid body transforms to mesh representations.

## System Architecture
Physics engine (Rapier3D/Matter.js) stepped on fixed 60Hz timestep, meshes interpolated.

## Implementation Guidance
Use EventBus to emit 'entity:hit', 'combat:parry', 'wave:cleared' events for sound and VFX triggers.

## Common Mistakes to Avoid
- ❌ **Mistake**: Never modify transform matrices directly on physics-controlled entities.
- ❌ **Mistake**: Do not hardcode magic numbers for damage or velocities without centralized configuration.

## Validation Checklist
- [ ] Player movement is responsive with no input lag.
- [ ] Hits produce satisfying sensory feedback (VFX spark, screen shake, audio impact).
- [ ] Ragdoll or death animations trigger smoothly without physics jitter.
