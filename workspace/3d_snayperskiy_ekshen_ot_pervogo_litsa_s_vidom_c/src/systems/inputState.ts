/** Общее состояние ввода, которое пишут обе схемы и читает игра каждый тик. */
export interface InputState {
  /** -1..1: шаг по карнизу влево/вправо */
  strafe: number
  /** накопленные дельты наведения, съедаются игрой раз за кадр */
  aimDX: number
  aimDY: number
  breathHeld: boolean
}

export function createInputState(): InputState {
  return { strafe: 0, aimDX: 0, aimDY: 0, breathHeld: false }
}

export function resetInputState(state: InputState): void {
  state.strafe = 0
  state.aimDX = 0
  state.aimDY = 0
  state.breathHeld = false
}
