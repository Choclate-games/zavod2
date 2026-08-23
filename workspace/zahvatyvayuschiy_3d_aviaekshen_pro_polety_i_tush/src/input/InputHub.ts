/**
 * Десктопная схема ввода: клавиатура + мышь. Пишет только в переиспользуемое
 * состояние полёта — никаких аллокаций и обращений к DOM-слоям интерфейса.
 */

export interface FlightInput {
  /** Нос вниз/вверх, диапазон [-1..1], положительное значение — нос к воде. */
  pitch: number
  /** Крен влево/вправо, диапазон [-1..1]. */
  roll: number
  /** Удержание форсажа. */
  boost: boolean
  /** Импульс залпового сброса; сбрасывается чтением consumeDrop(). */
  dropQueued: boolean
}

export function createFlightInput(): FlightInput {
  return { pitch: 0, roll: 0, boost: false, dropQueued: false }
}

const KEY_PITCH_DOWN = new Set(['KeyW', 'ArrowDown'])
const KEY_PITCH_UP = new Set(['KeyS', 'ArrowUp'])
const KEY_ROLL_LEFT = new Set(['KeyA', 'ArrowLeft'])
const KEY_ROLL_RIGHT = new Set(['KeyD', 'ArrowRight'])
const KEY_BOOST = new Set(['ShiftLeft', 'ShiftRight'])
const KEY_DROP = new Set(['Space'])
const KEY_PAUSE = new Set(['Escape', 'KeyP'])

export class InputHub {
  private readonly pressed = new Set<string>()
  private readonly keys: (e: KeyboardEvent) => void
  private readonly keyUp: (e: KeyboardEvent) => void

  constructor(
    private readonly input: FlightInput,
    private readonly onPauseToggle: () => void,
  ) {
    this.keys = (event) => {
      if (KEY_DROP.has(event.code)) this.input.dropQueued = true
      if (KEY_PAUSE.has(event.code)) this.onPauseToggle()
      if (isGameKey(event.code)) event.preventDefault()
      this.pressed.add(event.code)
    }
    this.keyUp = (event) => {
      this.pressed.delete(event.code)
    }
    window.addEventListener('keydown', this.keys)
    window.addEventListener('keyup', this.keyUp)
    window.addEventListener('blur', () => this.reset())
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keys)
    window.removeEventListener('keyup', this.keyUp)
  }

  reset(): void {
    this.pressed.clear()
    this.input.pitch = 0
    this.input.roll = 0
    this.input.boost = false
    this.input.dropQueued = false
  }

  /** Пересчитать оси из зажатых клавиш. Вызывается в фиксированном шаге. */
  sample(): void {
    let pitch = 0
    if (hasAny(this.pressed, KEY_PITCH_DOWN)) pitch += 1
    if (hasAny(this.pressed, KEY_PITCH_UP)) pitch -= 1
    let roll = 0
    if (hasAny(this.pressed, KEY_ROLL_RIGHT)) roll += 1
    if (hasAny(this.pressed, KEY_ROLL_LEFT)) roll -= 1
    this.input.pitch = pitch
    this.input.roll = roll
    this.input.boost = hasAny(this.pressed, KEY_BOOST)
  }
}

function hasAny(pressed: Set<string>, keys: Set<string>): boolean {
  for (const key of keys) if (pressed.has(key)) return true
  return false
}

function isGameKey(code: string): boolean {
  return (
    KEY_PITCH_DOWN.has(code) ||
    KEY_PITCH_UP.has(code) ||
    KEY_ROLL_LEFT.has(code) ||
    KEY_ROLL_RIGHT.has(code) ||
    KEY_BOOST.has(code) ||
    KEY_DROP.has(code)
  )
}
