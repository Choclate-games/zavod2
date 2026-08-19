# Technical Specification: Бур Судного Дня: Шахтерский Рогалик

## 1. Technology Matrix
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite (Vite with ESBuild)
- **Renderer**: **PIXIJS** (^8.0.0)
- **Physics Engine**: **Matter.js (^0.19.0)**
- **Audio Engine**: Howler.js с пулом Web Audio API каналов
- **Platform SDK**: `@playgama/bridge 2.x`

## 2. Hardware & Performance Targets
- **Target Framerate**: 60 FPS on desktop, >= 50 FPS on mid-tier mobile.
- **Maximum Active Draw Calls**: < 25
- **Maximum Triangles in View**: < 3500
- **Initial Download Size**: < 2.8 MB.
- **Max Memory Footprint**: < 180 MB WebGL heap.
