# Technical Specification: Аркадный fps упором пинки

## 1. Technology Matrix
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite 5.x (Vite with ESBuild)
- **Renderer**: **THREEJS** (^0.170.0)
- **Physics Engine**: **Rapier3D (@dimforge/rapier3d-compat 0.13.x)**
- **Audio Engine**: Howler.js (^2.2.4) с WebAudio API
- **Platform SDK**: `@playgama/bridge 2.x`

## 2. Hardware & Performance Targets
- **Target Framerate**: 60 FPS on desktop, >= 50 FPS on mid-tier mobile.
- **Maximum Active Draw Calls**: < 75
- **Maximum Triangles in View**: < 40000
- **Initial Download Size**: < 4.2 MB.
- **Max Memory Footprint**: < 180 MB WebGL heap.
