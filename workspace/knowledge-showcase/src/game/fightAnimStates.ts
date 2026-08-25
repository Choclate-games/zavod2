/**
 * Список анимаций бойца в одном месте: чем вызывается и сколько длится.
 *
 * Отсюда его берут двое, и это главное свойство файла: **витрина**
 * (`animViewer.ts`, снимается Playwright) и **генератор библиотеки**
 * (`scripts/make-proc-anim.ts`, пишет клипы в `assets/proc_anim/`). Если бы
 * список был у каждого свой, картинка «всё нормально» относилась бы к одному
 * набору поз, а в игру и в библиотеку уезжал бы другой.
 *
 * Анимации вызываются **нажатием клавиш**, а не установкой состояния. Разница
 * не косметическая: состояние ходьбы игровая логика переустанавливает каждый
 * кадр по вводу, и «поставленный» снаружи `walk` она тут же меняла на `idle` —
 * витрина показывала стойку под подписью «шаг», и по ней невозможно было
 * увидеть, что шаг сломан. Через клавиши в кадре ровно то, что увидит игрок.
 *
 * Исключение — реакции (получил удар, сломан гард, подъём с настила): их
 * себе не нажмёшь, они ставятся напрямую.
 *
 * Модуль намеренно не импортирует three: он про состояния, а не про сцену.
 */

/** Минимум, который анимации нужно знать про бойца. */
export interface AnimFighter {
  state: string;
  move: unknown;
  lastHitZone: string;
  headSnap: number;
  enter(state: string, frames?: number): void;
}

export interface AnimState {
  /** Имя файла в библиотеке. */
  id: string;
  /** Подпись в витрине. */
  label: string;
  /** Длительность в игровых кадрах при 60 Гц. */
  frames: number;
  /** Клавиши, зажатые всё время анимации. */
  hold?: string[];
  /** Нажатия: `[кадр, код клавиши]`. */
  taps?: Array<[number, string]>;
  /** Состояние напрямую — для реакций, которые ввод не вызывает. */
  force?(f: AnimFighter, hook: ForceHook): void;
}

/** Что нужно реакции помимо самого бойца. */
export interface ForceHook {
  /** Приём, «которым ударили»: из него берутся кадры стана. */
  hitBy: 'hook' | 'body';
}

const MOVE_KEYS: Array<[string, string, string]> = [
  // id приёма, клавиша, имя файла
  ['jab', 'KeyJ', 'jab'],
  ['hook', 'KeyK', 'hook'],
  ['overhand', 'KeyL', 'overhand'],
  ['uppercut', 'KeyI', 'uppercut'],
  ['body', 'KeyU', 'body_shot'],
  ['sweep', 'KeyO', 'sweep'],
  ['frontKick', 'KeyN', 'front_kick'],
  ['roundhouse', 'KeyM', 'roundhouse'],
];

export const FIGHT_ANIM_STATES: AnimState[] = [
  { id: 'idle', label: 'стойка', frames: 90 },
  { id: 'walk_forward', label: 'шаг вперёд', frames: 56, hold: ['KeyD'] },
  { id: 'walk_back', label: 'шаг назад (это же блок)', frames: 56, hold: ['KeyA'] },
  { id: 'crouch', label: 'присед', frames: 60, hold: ['KeyS'] },
  { id: 'slip', label: 'уклон', frames: 26, taps: [[0, 'KeyZ']] },
  // Рывок — двойное нажатие «вперёд»: одиночное даёт обычный шаг.
  { id: 'dash', label: 'рывок', frames: 30, taps: [[0, 'KeyD'], [4, 'KeyD']] },
  ...MOVE_KEYS.map(([id, key, slug]) => ({
    id: slug,
    label: id,
    frames: 46,
    taps: [[0, key]] as Array<[number, string]>,
  })),
  { id: 'jump', label: 'прыжок целиком', frames: 66, taps: [[0, 'Space']] },
  { id: 'air_punch', label: 'удар с воздуха', frames: 66, taps: [[0, 'Space'], [16, 'KeyJ']] },
  { id: 'air_kick', label: 'нога с воздуха', frames: 66, taps: [[0, 'Space'], [16, 'KeyO']] },
  {
    id: 'hit_head', label: 'получил в голову', frames: 30,
    force: (f) => { f.lastHitZone = 'head'; f.headSnap = 1; f.enter('hitstun', 18); },
  },
  {
    id: 'hit_body', label: 'получил по корпусу', frames: 30,
    force: (f) => { f.lastHitZone = 'body'; f.enter('hitstun', 18); },
  },
  { id: 'blockstun', label: 'блокстан', frames: 24, force: (f) => f.enter('blockstun', 12) },
  { id: 'guard_break', label: 'гард сломан', frames: 38, force: (f) => f.enter('guardbreak', 26) },
  { id: 'get_up', label: 'подъём с настила', frames: 52, force: (f) => f.enter('getup', 40) },
];

/**
 * Ввод для витрины и генератора: зажатые клавиши и расписание нажатий.
 * Живёт здесь, чтобы браузерная страница и головной скрипт кормили игру
 * одинаково — иначе снимок и записанный клип разойдутся.
 */
export class AnimDriver {
  private readonly held = new Set<string>();
  private frame = 0;
  private state: AnimState | null = null;

  /** Подписка демо на клавиши. Витрина и генератор отдают её в `input.onKey`. */
  onKey: ((code: string) => void) | null = null;

  begin(state: AnimState): void {
    this.state = state;
    this.frame = 0;
    this.held.clear();
    for (const key of state.hold ?? []) this.held.add(key);
  }

  /** Вызывается перед каждым игровым кадром. */
  step(): void {
    for (const [frame, key] of this.state?.taps ?? []) {
      if (frame === this.frame) this.onKey?.(key);
    }
    this.frame++;
  }

  isDown(code: string): boolean {
    return this.held.has(code);
  }

  release(): void {
    this.held.clear();
    this.state = null;
  }
}
