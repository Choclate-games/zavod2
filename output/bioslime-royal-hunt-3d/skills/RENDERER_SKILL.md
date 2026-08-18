# Skill: THREEJS WebGL Performance Guide

## Purpose
Optimization and visual standards for THREEJS WebGL pipeline.

## When to Use
Use when configuring scenes, cameras, lighting, materials, instanced meshes, and particle systems.

## Core Rules & Constraints
- Keep active draw calls strictly under 80.
- Use InstancedMesh for debris, bullets, and crowd mobs.
- Clamp pixel ratio to Math.min(window.devicePixelRatio, 1.5) on mobile.
- Share material instances across identical geometry.

## System Architecture
Scene graph with pre-allocated sprite and mesh pools, dynamic shadow frustum optimization.

## Implementation Guidance
Initialize renderer with antialias enabled on desktop, powerPreference 'high-performance'.

## Common Mistakes to Avoid
- ❌ **Mistake**: Do not construct new Geometries, Textures, or Materials in the render loop.
- ❌ **Mistake**: Do not leave unused GPU assets without calling .dispose().

## Validation Checklist
- [ ] Maintains solid 60 FPS on desktop and >= 50 FPS on mobile.
- [ ] No WebGL context loss errors on tab switches.
- [ ] Shadow map renders crisp without artifact acne.
