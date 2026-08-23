import { ScreenRouter } from './ScreenRouter';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { ToastManager } from './components/Toast';

export class UiRoot {
  public rootElement: HTMLElement;
  public router: ScreenRouter;
  public hud: Hud;
  public touch: TouchControls;
  public toast: ToastManager;

  constructor(
    rootElement: HTMLElement,
    onStartShift: () => void,
    onOpenArmory: () => void,
    onOpenSettings: () => void,
    onBackToMenu: () => void,
    onResumeGame: () => void,
    onReviveGame: () => void,
    onContextAction: () => void,
    onThrowFlare: () => void,
    onToggleSprint: () => void
  ) {
    this.rootElement = rootElement;
    this.rootElement.innerHTML = '';

    this.toast = new ToastManager();
    this.rootElement.appendChild(this.toast.container);

    this.router = new ScreenRouter(
      onStartShift,
      onOpenArmory,
      onOpenSettings,
      onBackToMenu,
      onResumeGame,
      onReviveGame,
      onContextAction,
      onThrowFlare,
      onToggleSprint
    );
    this.rootElement.appendChild(this.router.container);

    this.hud = new Hud(this.router.gameplay);

    this.touch = new TouchControls(this.rootElement);
  }
}
