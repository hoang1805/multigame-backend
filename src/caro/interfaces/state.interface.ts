export interface StateInterface {
  board: string[][];
  currentTurn: 'X' | 'O';
  players: PlayerInterface[];
}

export interface PlayerInterface {
  id: number;
  symbol: 'X' | 'O';
}

export interface Move {
  userId: number;
  x: number;
  y: number;
}
