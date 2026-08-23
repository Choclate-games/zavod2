# Две схемы управления: ПК и мобильные, переключение по `bridge.device.type`

Игра фабрики выпускается сразу на площадки, где рядом сидят игрок с
клавиатурой и игрок с телефоном. Значит, **схем управления всегда две**, обе
написаны целиком, и в каждый момент работает ровно одна.

Ошибка, которая уже стоила нам двух готовых игр: собрана одна «универсальная»
раскладка — тач-слой создаётся и вставляется в DOM безусловно, а рядом висят
`keydown` и pointer lock. На ПК прозрачные кнопки перехватывают мышь и мешают
целиться; на телефоне половина действий висит на клавишах, которых нет. Схема
не подошла ни одной из платформ, хотя код обеих был написан.

> Признак этой ошибки в коде: `new TouchControls()` в конструкторе интерфейса
> без единой проверки устройства. Если тач-слой создаётся всегда — управление
> сломано, сколько бы кода в нём ни было.

---

## 1. Контракт

1. **Обе схемы обязательны.** Десктопная — клавиатура и мышь. Мобильная —
   экранные органы управления из `knowledge/ux/touch_controls.md`. Ни одна не
   «версия попроще»: обе закрывают все действия игры.
2. **Активна одна.** Неактивная схема не слушает события, а её слой не
   существует в DOM (не `display:none`, а не вставлен либо снят).
3. **Режим определяет площадка**, а не догадки браузера: источник истины —
   `bridge.device.type` из Playgama Bridge.
4. **Режим переключается на лету.** Ноутбук с сенсорным экраном, планшет с
   клавиатурой, `?input=` при проверке — игрок вправе сменить руки посреди
   сессии, и игра обязана это пережить без перезагрузки.
5. **Подсказки следуют за режимом.** «Нажмите **Пробел**» на телефоне — это
   дефект приёмки. Тексты берутся из i18n по текущему режиму.

---

## 2. Определение режима

`bridge.device.type` возвращает `'mobile' | 'tablet' | 'desktop'` и учитывает
то, чего браузер не знает: как площадка встроила игру. Планшет считается
мобильным — палец там главный.

Порядок источников строго такой:

```ts
// src/input/InputMode.ts
export type InputMode = 'desktop' | 'touch'

/** Ручное переопределение для проверки: ?input=touch или ?input=desktop. */
export function forcedMode(): InputMode | null {
  const value = new URLSearchParams(location.search).get('input')
  return value === 'touch' || value === 'desktop' ? value : null
}

/**
 * Режим на момент старта.
 *
 * `bridge.device.type` — первый источник: только он знает, как игру открыла
 * площадка. Браузерные признаки остаются запасным вариантом для dev-сервера,
 * где моста нет вовсе, и для платформ, которые поле не заполняют.
 */
export function detectInputMode(deviceType?: string): InputMode {
  const forced = forcedMode()
  if (forced) return forced
  if (deviceType === 'mobile' || deviceType === 'tablet') return 'touch'
  if (deviceType === 'desktop') return 'desktop'
  const coarse = matchMedia('(pointer: coarse)').matches
  return coarse || navigator.maxTouchPoints > 0 ? 'touch' : 'desktop'
}
```

В сервисе моста тип устройства достаётся один раз и переживает отсутствие
моста — на dev-сервере `bridge` не существует, и падать здесь нельзя:

```ts
// src/platform/PlaygamaService.ts
get deviceType(): string {
  try {
    return this.bridge?.device?.type ?? ''
  } catch {
    return ''
  }
}
```

---

## 3. Роутер ввода

Одна точка, через которую игра узнаёт о вводе. Системы игры **не** слушают
`keydown` и не знают о существовании стика: они читают состояние из роутера.

```ts
// src/input/InputRouter.ts
export interface InputState {
  moveX: number        // -1..1
  moveY: number        // -1..1
  aimX: number         // дельта обзора за кадр
  aimY: number
  primary: boolean     // огонь / основное действие
  secondary: boolean   // прицел / второе действие
  actions: Set<string> // разовые: 'reload', 'jump', 'dash', 'pause'
}

export class InputRouter {
  public readonly state: InputState = createEmptyState()
  private mode: InputMode
  private readonly desktop = new DesktopInput(this.state)
  private readonly touch = new TouchInput(this.state)
  private readonly listeners = new Set<(mode: InputMode) => void>()

  constructor(private readonly host: HTMLElement, deviceType: string) {
    this.mode = detectInputMode(deviceType)
    this.activate(this.mode)
    this.watchForModeChange()
  }

  /** Снять старую схему целиком и поднять новую. Порядок важен: сначала
   *  отпустить всё, что было зажато, иначе газ уедет в новую схему. */
  private activate(mode: InputMode): void {
    this.desktop.detach()
    this.touch.detach()
    this.resetState()
    this.mode = mode
    if (mode === 'touch') this.touch.attach(this.host)
    else this.desktop.attach(this.host)
    document.body.dataset.input = mode          // CSS и подсказки читают отсюда
    this.listeners.forEach((fn) => fn(mode))
  }

  /**
   * Живое переключение по первому настоящему событию другого источника.
   *
   * Условие «настоящего» разное у источников: касание — это уже намерение, а
   * `mousemove` браузер шлёт и следом за тапом, поэтому десктоп включает
   * только клавиша или движение мыши с ненулевой дельтой.
   */
  private watchForModeChange(): void {
    if (forcedMode()) return                    // проверяем раскладку — режим не менять
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && this.mode !== 'touch') this.activate('touch')
    }, { capture: true })
    addEventListener('keydown', () => {
      if (this.mode !== 'desktop') this.activate('desktop')
    }, { capture: true })
    addEventListener('mousemove', (e) => {
      if (this.mode !== 'desktop' && (e.movementX || e.movementY)) this.activate('desktop')
    }, { capture: true })
  }

  onModeChange(fn: (mode: InputMode) => void): void { this.listeners.add(fn) }
}
```

Что даёт разделение: системы игры (`Player`, `CameraRig`, `CombatSystem`)
читают `router.state` и не содержат ни одного обработчика событий. Тач-слой и
клавиатура становятся заменяемыми деталями, а не второй копией игровой логики.

---

## 4. Что обязана уметь каждая схема

Действие одно и то же, орган управления разный. Пустых клеток быть не может:
действие, доступное только на одной платформе, — дефект проектирования.

| Действие | Десктоп | Мобильные |
|---|---|---|
| Перемещение | `WASD` + стрелки | левый плавающий стик |
| Обзор / прицел | мышь (pointer lock там, где жанр требует) | правая зона свайпа |
| Основное действие | ЛКМ / `Space` | крупная кнопка справа (≥ 96 px) |
| Второе действие | ПКМ / `Shift` | вторая кнопка справа |
| Разовые (перезарядка, дэш, прыжок) | `R`, `E`, `Q`, `Space` | отдельные кнопки, а не жесты |
| Пауза | `Esc` | кнопка в HUD |
| Выбор в меню | клавиатура + мышь | тап |

Отдельно про pointer lock: он существует **только** в десктопной схеме.
`requestPointerLock()` на телефоне либо ничего не делает, либо ломает первый
тап, а «кликните, чтобы захватить курсор» на сенсорном экране игрок прочитать
может, а выполнить — нет.

---

## 5. Слой управления и DOM

```ts
// UiRoot
this.router.onModeChange((mode) => {
  if (mode === 'touch') this.touchLayer.mount(this.rootElement)
  else this.touchLayer.unmount()      // remove(), а не display:none
  this.hints.setMode(mode)
})
```

`display:none` недостаточно: слой остаётся в дереве и в раскладке, а любая
ошибка со `z-index` возвращает его поверх игры. Снимаем узел.

Обратное так же обязательно: на телефоне не должно остаться подсказок с
клавишами и обработчиков `keydown`, которые «просто не сработают» — они
перехватывают события у экранной клавиатуры в полях ввода имени.

---

## 6. Подсказки и тексты

```ts
// i18n
setTouchMode(mode === 'touch')

// строки
"hint.fire.desktop": "ЛКМ — огонь",
"hint.fire.touch":   "Кнопка справа — огонь",
```

Обучение первой сессии, экран управления в настройках и подписи в HUD берут
строку по текущему режиму. Переключение режима перерисовывает их немедленно —
иначе игрок, взявший мышь, продолжает видеть «нажмите кнопку справа».

---

## 7. Чек-лист приёмки

- [ ] В коде есть обе схемы, и каждая закрывает все действия игры.
- [ ] Режим стартует от `bridge.device.type`; браузерные признаки — только
      запасной вариант, а не первый.
- [ ] На десктопе тач-слоя нет в DOM; на телефоне нет `keydown` и pointer lock.
- [ ] `?input=touch` и `?input=desktop` принудительно включают схему и
      отключают автопереключение — так обе раскладки проверяются на одной машине.
- [ ] Клавиша на планшете с клавиатурой переводит игру в десктопную схему без
      перезагрузки; касание возвращает обратно.
- [ ] При смене режима все зажатые оси и кнопки сброшены.
- [ ] Подсказки соответствуют активному режиму на всех экранах.
- [ ] Ни одна игровая система не слушает `keydown`/`pointerdown` напрямую.
