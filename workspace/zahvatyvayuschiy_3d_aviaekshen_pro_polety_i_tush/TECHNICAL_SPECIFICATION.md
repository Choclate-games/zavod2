# Technical Specification: Огненный Каньон: Водный Сброс

## 1. Technology Matrix
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite (Vite with ESBuild)
- **Renderer**: **THREEJS** (^0.185.1)
- **Physics Engine**: **Rapier3D (@dimforge/rapier3d-compat ^0.20.0)**
- **Audio Engine**: Web Audio API (Howler.js with html5: false)
- **Platform SDK**: `@playgama/bridge 2.x`

## 2. Hardware & Performance Targets
- **Target Framerate**: 60 FPS on desktop, >= 50 FPS on mid-tier mobile.
- **Maximum Active Draw Calls**: < 65
- **Maximum Triangles in View**: < 38000
- **Initial Download Size**: < 4.2 MB.
- **Max Memory Footprint**: < 180 MB WebGL heap.
