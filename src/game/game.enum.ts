export enum GameType {
  LINE98 = 'line98',
  CARO = 'caro',
}

export enum GameMode {
  SINGLE = 'single',
  MULTI = 'multi',
}

export enum GameStatus {
  ONGOING = 'ongoing',
  FINISHED = 'finished',
}

export enum EndReasonSingle {
  GAME_OVER = 'game_over',
  QUIT = 'quit',
  TIMEOUT = 'timeout',
}

export enum EndReasonMulti {
  WIN = 'win',
  DRAW = 'draw',
  QUIT = 'quit',
  TIMEOUT = 'timeout',
}

export enum UserStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export enum GameResult {
  WIN = 'win',
  LOSE = 'lose',
  DRAW = 'draw',
}
