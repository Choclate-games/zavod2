import { Game } from "./core/Game";

window.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  if (!canvas) {
    console.error("Game canvas element not found!");
    return;
  }

  try {
    const game = new Game(canvas);
    await game.initialize();
    console.log("Tactical CQB Breach Assault game initialized successfully.");
  } catch (error) {
    console.error("Fatal error initializing game:", error);
  }
});
