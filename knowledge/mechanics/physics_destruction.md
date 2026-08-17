# Mechanic: Destructible Environment & Dynamic Hazards

Name: Destructible Environment & Dynamic Hazards
Category: Environment & Physics
Description: Arena structures (stone pillars, wooden crates, barricades, weapon racks, spike pits) with physical health and fracture meshes. High-velocity impacts from weapons or ragdoll bodies shatter elements into physical debris chunks.

Player interaction:
Players can lure enemies near hazards, push enemies into spikes, or bash structures down to crush opponents or collect dropped weapons.

Feedback:
- Instanced debris mesh physics explosion.
- Heavy stone/wood shattering audio.
- Screen shake and ground dust ring particles.

Strengths:
- Converts the static arena into an interactive weapon.
- High visual spectacle and emergent tactics.

Weaknesses:
- Creating new meshes dynamically causes garbage collection spikes in JS. Must use pre-instanced mesh pooling.

Good combinations:
- Ragdoll combat.
- Heavy weapon impacts.

Bad combinations:
- Minimalist abstract games.

Technical complexity:
Moderate to High. Requires instanced mesh pooling and debris lifetime culling (2.5s).

Three.js suitability:
Very High (9.5/10). Excellent with InstancedMesh and Rapier3D.

PixiJS suitability:
Moderate (5/10).

Retention potential:
High.
