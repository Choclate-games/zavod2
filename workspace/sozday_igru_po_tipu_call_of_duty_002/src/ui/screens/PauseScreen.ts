import { Button } from '../components/Button';
import { ICONS } from '../icons';
import { eventBus } from '../../core/EventBus';
import { audioManager } from '../../audio/AudioManager';

export class PauseScreen {
  public element: HTMLDivElement;

  constructor(onResume: () => void, onQuit: () => void) {
    this.element = document.createElement('div');
    this.element.id = 'screen-pause';
    this.element.className = 'screen hidden';

    // Center Panel
    const centerPanel = document.createElement('div');
    centerPanel.className = 'panel';
    centerPanel.style.maxWidth = '380px';
    centerPanel.style.margin = 'auto';
    centerPanel.style.display = 'flex';
    centerPanel.style.flexDirection = 'column';
    centerPanel.style.gap = '16px';

    const titleEl = document.createElement('h2');
    titleEl.textContent = 'МАТЧ ПРИОСТАНОВЛЕН';
    titleEl.style.color = 'var(--color-primary)';
    titleEl.style.textAlign = 'center';
    centerPanel.appendChild(titleEl);

    // Audio Mute Toggle Button
    const muteBtn = new Button({
      text: audioManager.isAudioMuted() ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ',
      variant: 'secondary',
      icon: audioManager.isAudioMuted() ? ICONS.soundMute : ICONS.sound,
      onClick: () => {
        const nextMute = !audioManager.isAudioMuted();
        audioManager.setMuted(nextMute);
        muteBtn.element.querySelector('.btn-text')!.textContent = nextMute ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ';
        muteBtn.element.querySelector('.btn-icon')!.innerHTML = nextMute ? ICONS.soundMute : ICONS.sound;
      }
    });
    centerPanel.appendChild(muteBtn.element);

    // Resume Button
    const resumeBtn = new Button({
      text: 'ПРОДОЛЖИТЬ',
      variant: 'primary',
      icon: ICONS.play,
      onClick: () => {
        onResume();
      }
    });
    centerPanel.appendChild(resumeBtn.element);

    // Quit to Menu Button
    const quitBtn = new Button({
      text: 'В МЕНЮ',
      variant: 'secondary',
      onClick: () => {
        onQuit();
      }
    });
    centerPanel.appendChild(quitBtn.element);

    this.element.appendChild(centerPanel);
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }
}