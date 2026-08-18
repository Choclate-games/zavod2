# Technical Specification: Муравьиный Рой: Война Колоний

## 1. Technology Matrix
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite (Vite with ESBuild)
- **Renderer**: **PIXIJS** (^8.0.0)
- **Physics Engine**: **Matter.js (^0.19.0)**
- **Audio Engine**: Web Audio API (Howler.js with html5: false)
- **Platform SDK**: `@playgama/bridge 2.x`

## 2. Hardware & Performance Targets
- **Target Framerate**: 60 FPS on desktop, >= 50 FPS on mid-tier mobile.
- **Maximum Active Draw Calls**: < 25
- **Maximum Triangles in View**: < 2000
- **Initial Download Size**: < 3.2 MB.
- **Max Memory Footprint**: < 180 MB WebGL heap.
