export interface InputSnapshot {
  moveX: number;
  moveY: number;
  primary: boolean;
  secondary: boolean;
  dash: boolean;
  pause: boolean;
}

export function createZeroInput(): InputSnapshot {
  return {
    moveX: 0,
    moveY: 0,
    primary: false,
    secondary: false,
    dash: false,
    pause: false
  };
}
