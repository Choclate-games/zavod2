import './style.css';
import { Game } from './core/Game';
import { PlaygamaService } from './platform/PlaygamaService';
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root is missing');
const platform = new PlaygamaService();
const game = new Game(app);
void (async () => { await platform.init(); await game.boot(); platform.readyOnce(); })();
