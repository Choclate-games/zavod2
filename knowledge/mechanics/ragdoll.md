# Mechanic: Active Ragdoll Physics Combat

Name: Active Ragdoll Physics Combat
Category: Combat & Physics
Description: A hybrid physics-driven character controller where characters have underlying kinematic bone targets tracked by physical rigidbodies connected via damped spring joints (PD controllers). When struck by weapon forces, equilibrium is lost, generating emergent staggering, flailing, and tumbling before attempting self-righting balance.

Player interaction:
Players direct movement and swing momentum. The physical weapon rigidbody collides with enemy body segments, applying directional impulses proportional to weapon mass and angular velocity.

Feedback:
- Dynamic particle sparks / blood spray at point of impact.
- Screen trauma shake proportional to kinetic energy transfer.
- Hit-stop micro-pause (40ms) on heavy critical connections.
- Audio pitch modulation based on impact velocity.

Strengths:
- Endless emergent comedy and tactical variety.
- Every strike feels uniquely tactile rather than canned animation playback.
- Extremely high viral and streaming appeal.

Weaknesses:
- CPU overhead for multi-joint solving on low-end mobile.
- Risk of glitchy joint snapping or physics instability if simulation steps drop.

Good combinations:
- Weapon Weight & Inertia.
- Destructible Arena Obstacles (knocking enemies into pillars/hazards).
- Crowd Favor / Momentum Buffs.

Bad combinations:
- Pixel-perfect platforming.
- Ultra-fast twitch hitscans.

Technical complexity:
High. Requires Rapier3D or Cannon-es with sub-stepping (fixed timestep 60Hz) and joint angle constraints.

Three.js suitability:
Excellent (9.5/10). Direct integration with Rapier3D or Cannon-es.

PixiJS suitability:
Moderate (4/10). Better suited for 2D ragdolls with Matter.js or Box2D.

Retention potential:
Very High. Emergent physical interactions prevent gameplay fatigue.
