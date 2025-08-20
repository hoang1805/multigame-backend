export interface ClientStateInterface {
  matchId: number;
  board: string[][];
  turn: 'X' | 'O';
  userSymbol: 'X' | 'O';
  timeRemain: number; //ms
  size?: number;
  time?: number;
}
