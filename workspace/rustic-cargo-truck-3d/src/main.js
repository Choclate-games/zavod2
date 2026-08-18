import './styles.css';
import { Game } from './core/Game';
import { PlaygamaService } from './platform/PlaygamaService';
function installPageGuards() {
    document.documentElement.style.overscrollBehavior = 'none';
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (event) => event.preventDefault(), true);
    document.addEventListener('dragstart', (event) => event.preventDefault(), true);
}
async function boot() {
    installPageGuards();
    const root = document.getElementById('game-root');
    if (!root)
        throw new Error('Game root is missing');
    const platform = new PlaygamaService();
    platform.setProgress(5);
    const save = await platform.initialize();
    platform.setProgress(28);
    const game = new Game(root, save);
    await game.initialize();
    platform.setProgress(82);
    game.start();
    platform.setProgress(100);
    platform.sendReady();
    window.__game = game;
}
const watchdog = window.setTimeout(() => {
    const fallback = new PlaygamaService();
    fallback.setProgress(100);
    fallback.sendReady();
}, 15000);
void boot().catch((error) => {
    console.error('Game boot failed', error);
    const fallback = new PlaygamaService();
    fallback.setProgress(100);
    fallback.sendReady();
}).finally(() => window.clearTimeout(watchdog));
