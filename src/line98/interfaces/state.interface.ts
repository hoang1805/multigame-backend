export interface BallState {
  x: number;
  y: number;
  color: number;
}

export interface StateInterface {
  balls: BallState[];
  time: number;
  helpRemaining: number;
  nextBalls: number[];
  gameOver: boolean;
}

export interface MoveEvent {
  moveFrom?: { x: number; y: number };
  moveTo?: { x: number; y: number };
  removed?: BallState[];
  added?: BallState[];
  nextBalls?: number[];
  points?: number;
}

export interface Move {
  from: { x: number; y: number };
  to: { x: number; y: number };
}
