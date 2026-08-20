import { Game } from "./core/Game";
import { PlaygamaService } from "./platform/PlaygamaService";

function installViewportGuards(): void {
  // Prevent contextmenu
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Prevent drag
  window.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });

  // Prevent double tap zoom on mobile Safari
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // Prevent gesture zoom
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());
}

async function bootstrap(): Promise<void> {
  installViewportGuards();

  console.log("🎮 Initializing Three.js Спелеологическая бродилка...");

  const playgama = PlaygamaService.getInstance();
  await playgama.init();

  const game = new Game();
  await game.init();

  console.log("✅ Game ready and running!");
}

window.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((err) => {
    console.error("Critical error during game bootstrap:", err);
  });
});
