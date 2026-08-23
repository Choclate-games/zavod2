import { MainMenuScreen } from './screens/MainMenuScreen';
import { WeaponShopScreen } from './screens/WeaponShopScreen';
import { DuelHudScreen } from './screens/DuelHudScreen';
import { RoundEndOverlayScreen } from './screens/RoundEndOverlayScreen';
import { MatchVictoryDefeatScreen } from './screens/MatchVictoryDefeatScreen';
import { LeaderboardModalScreen } from './screens/LeaderboardModalScreen';
import { SettingsModalScreen } from './screens/SettingsModalScreen';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { EventBus } from '../core/EventBus';

export type ScreenType = 'MainMenu' | 'WeaponShop' | 'DuelHUD' | 'RoundEndOverlay' | 'MatchVictoryDefeat';

export class ScreenRouter {
  public mainMenu: MainMenuScreen;
  public weaponShop: WeaponShopScreen;
  public duelHud: DuelHudScreen;
  public roundEnd: RoundEndOverlayScreen;
  public victoryDefeat: MatchVictoryDefeatScreen;
  public leaderboardModal: LeaderboardModalScreen;
  public settingsModal: SettingsModalScreen;
  public hud: Hud;
  public touchControls: TouchControls;

  private currentScreen: ScreenType = 'MainMenu';

  constructor(
    private onStartMatch: () => void,
    private onRematch: () => void
  ) {
    this.hud = new Hud();
    this.touchControls = new TouchControls();

    this.mainMenu = new MainMenuScreen(
      () => this.onStartMatch(),
      () => this.navigate('WeaponShop'),
      () => this.leaderboardModal.show(),
      () => this.settingsModal.show()
    );

    this.weaponShop = new WeaponShopScreen(() => this.navigate('MainMenu'));
    this.duelHud = new DuelHudScreen();
    this.roundEnd = new RoundEndOverlayScreen();
    this.victoryDefeat = new MatchVictoryDefeatScreen(
      () => this.onRematch(),
      () => this.navigate('MainMenu')
    );

    this.leaderboardModal = new LeaderboardModalScreen(() => this.leaderboardModal.hide());
    this.settingsModal = new SettingsModalScreen(() => this.settingsModal.hide());
  }

  public mount(root: HTMLElement): void {
    root.appendChild(this.mainMenu.root);
    root.appendChild(this.weaponShop.root);
    root.appendChild(this.duelHud.root);
    root.appendChild(this.roundEnd.root);
    root.appendChild(this.victoryDefeat.root);
    root.appendChild(this.leaderboardModal.root);
    root.appendChild(this.settingsModal.root);

    this.hud.mount(root);
    this.touchControls.mount(root);

    this.navigate('MainMenu');
  }

  public navigate(screen: ScreenType): void {
    this.currentScreen = screen;

    // Hide all base screens
    this.mainMenu.root.classList.remove('active');
    this.weaponShop.root.classList.remove('active');
    this.duelHud.root.classList.remove('active');
    this.roundEnd.root.classList.remove('active');
    this.victoryDefeat.root.classList.remove('active');

    // Manage HUD & Touch visibility
    if (screen === 'DuelHUD') {
      this.duelHud.root.classList.add('active');
      this.hud.show();
      this.touchControls.show();
      EventBus.get().emit('STATE_CHANGED', 'PLAYING');
    } else if (screen === 'RoundEndOverlay') {
      this.roundEnd.root.classList.add('active');
      this.hud.show();
      this.touchControls.hide();
      EventBus.get().emit('STATE_CHANGED', 'ROUND_END');
    } else if (screen === 'MatchVictoryDefeat') {
      this.victoryDefeat.root.classList.add('active');
      this.hud.hide();
      this.touchControls.hide();
      EventBus.get().emit('STATE_CHANGED', 'MATCH_END');
    } else if (screen === 'WeaponShop') {
      this.weaponShop.root.classList.add('active');
      this.weaponShop.refresh();
      this.hud.hide();
      this.touchControls.hide();
      EventBus.get().emit('STATE_CHANGED', 'MENU');
    } else {
      this.mainMenu.root.classList.add('active');
      this.mainMenu.refresh();
      this.hud.hide();
      this.touchControls.hide();
      EventBus.get().emit('STATE_CHANGED', 'MENU');
    }
  }

  public getCurrentScreen(): ScreenType {
    return this.currentScreen;
  }
}