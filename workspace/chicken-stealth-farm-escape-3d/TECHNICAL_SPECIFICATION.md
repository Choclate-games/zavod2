# Technical Specification: Куриный Побег 3D: Стелс на Ферме

## 1. Technology Matrix
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite (Vite with ESBuild)
- **Renderer**: **THREEJS** (^0.170.0)
- **Physics Engine**: **Rapier3D (@dimforge/rapier3d-compat 0.13.x)**
- **Audio Engine**: Howler.js (Web Audio API)
- **Platform SDK**: `@playgama/bridge 2.x`

## 2. Hardware & Performance Targets
- **Target Framerate**: 60 FPS on desktop, >= 50 FPS on mid-tier mobile.
- **Maximum Active Draw Calls**: < 45
- **Maximum Triangles in View**: < 35000
- **Initial Download Size**: < 3.5 MB.
- **Max Memory Footprint**: < 180 MB WebGL heap.
