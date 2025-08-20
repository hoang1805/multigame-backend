import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { Line98State } from './models/line98.state';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigInterface } from './interfaces/config.interface';
import { Line98Config } from './line98.config';
import { GameService } from 'src/game/game.service';
import { EndReasonSingle, GameMode, GameType } from 'src/game/game.enum';
import { Game } from 'src/game/models/game';
import {
  BallState,
  Move,
  MoveEvent,
  StateInterface,
} from './interfaces/state.interface';
import { RandomUtil } from 'src/common/utils/random.util';
import { Queue } from 'src/common/utils/queue.util';
import {
  Pagination,
  PaginationResponse,
} from 'src/common/interfaces/pagination.interface';
import { GameUser } from 'src/game/models/game.user';

@Injectable()
export class Line98Service {
  constructor(
    @InjectRepository(Line98State)
    private readonly line98Repository: Repository<Line98State>,
    private readonly gameService: GameService,
    private readonly dataSource: DataSource,
  ) {}

  private gameCache = new Map<number, number>();

  getConfig(): ConfigInterface {
    return Line98Config;
  }

  async getGame(id: number) {
    return this.line98Repository.findOneBy({ id });
  }

  async paginate(
    userId: number,
    pagination: Pagination,
  ): Promise<PaginationResponse<Line98State>> {
    const gameUser = await this.gameService.paginate(
      userId,
      GameType.LINE98,
      pagination,
    );

    const gameIds = gameUser.data.map((g) => g.gameId);
    const [data, total] = await this.line98Repository.findAndCountBy({
      gameId: In(gameIds),
    });

    return {
      ...pagination,
      data: data,
      total: gameUser.total,
      totalPages: gameUser.totalPages,
    };
  }

  async createGame(userId: number) {
    if (await this.gameService.isPlaying(userId, GameType.LINE98)) {
      const gameUser = await this.gameService.getPlayingGame(
        userId,
        GameType.LINE98,
      );
      if (!gameUser) {
        throw new NotFoundException();
      }

      const game = await this._getByGameId(gameUser.gameId);
      if (!game || game.isFinished) {
        throw new NotFoundException();
      }

      return game;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let gameState: Line98State | null = null;

    try {
      const game = await this.gameService.createGame(
        GameType.LINE98,
        GameMode.SINGLE,
        [userId],
        queryRunner,
      );

      gameState = await this._createState(game, queryRunner);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return gameState;
  }

  async move(
    gameId: number,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<MoveEvent> {
    const currentState = await this.getGame(gameId);

    const moveEvent: MoveEvent = {};

    if (!currentState) {
      return moveEvent;
    }

    if (currentState.state.gameOver) {
      return moveEvent;
    }

    const config = currentState.config;
    const balls = currentState.state.balls;

    if (!this._canMoveBall(from, to, balls, config)) {
      return moveEvent;
    }

    moveEvent.moveFrom = from;
    moveEvent.moveTo = to;
    let movedBall: BallState | null = null;
    currentState.state.balls = balls.map((ball) => {
      const { x, y, color } = ball;
      if (x == from.x && y == from.y) {
        movedBall = { x: to.x, y: to.y, color };
        return movedBall;
      }

      return ball;
    });

    if (!movedBall) {
      return {};
    }

    const matrix = this._initColorMatrix(currentState.state.balls, config);
    const removedBalls = this._checkLines(matrix, movedBall, config);
    moveEvent.removed = removedBalls;
    const removedSet = new Set(removedBalls.map((b) => `${b.x},${b.y}`));
    currentState.state.balls = currentState.state.balls.filter(
      (b) => !removedSet.has(`${b.x},${b.y}`),
    );

    moveEvent.points = removedBalls.length * config.pointFactor;
    currentState.score += moveEvent.points;
    if (removedBalls.length) {
      await this.line98Repository.save(currentState);
      return moveEvent;
    }

    const addedBalls = this._generateRandomBalls(
      currentState.state.balls,
      config.perTurnBalls,
      config,
      currentState.state.nextBalls,
    );
    moveEvent.added = addedBalls;
    currentState.state.balls.push(...addedBalls);

    const nextBalls = this._generateColors(config.perTurnBalls, config);
    moveEvent.nextBalls = nextBalls;
    currentState.state.nextBalls = nextBalls;

    await this.line98Repository.save(currentState);
    return moveEvent;
  }

  async checkAfterAdd(gameId: number): Promise<MoveEvent> {
    const currentState = await this.getGame(gameId);
    const moveEvent: MoveEvent = {};

    if (!currentState) {
      return moveEvent;
    }

    const removeBalls: BallState[] = [];
    const config = currentState.config;
    const board = this._initColorMatrix(currentState.state.balls, config);

    const currentBalls: BallState[] = [];
    currentState.state.balls.forEach((ball) => {
      if (board[ball.x][ball.y] == -1) {
        return;
      }

      const removed = this._checkLines(board, ball, config);
      removed.forEach(({ x, y }) => {
        board[x][y] = -1;
      });
      removeBalls.push(...removed);

      if (board[ball.x][ball.y] == ball.color) {
        currentBalls.push(ball);
      }
    });

    moveEvent.points = removeBalls.length * config.pointFactor;
    currentState.score += moveEvent.points;

    currentState.state.balls = currentBalls;
    await this.line98Repository.save(currentState);

    moveEvent.removed = removeBalls;

    return moveEvent;
  }

  async isGameOver(gameId: number): Promise<boolean> {
    const currentState = await this.getGame(gameId);
    if (!currentState) {
      return false;
    }

    const { state, config } = currentState;
    const size = config.size;

    if (state.gameOver) {
      return true;
    }

    if (state.balls.length == 0 || state.balls.length == size * size) {
      return true;
    }

    return false;
  }

  async setGameOver(gameId: number, userId: number): Promise<Line98State> {
    const game = await this.getGame(gameId);
    if (!game || game.isFinished) {
      throw new Error();
    }

    game.isFinished = true;
    game.endReason = EndReasonSingle.GAME_OVER;

    await this.line98Repository.save(game);

    await this.gameService.finishGame(game.gameId, {
      losers: [userId],
    });

    return game;
  }

  getGameCache(userId: number) {
    return this.gameCache.get(userId);
  }

  setGameCache(userId: number, matchId: number) {
    this.gameCache.set(userId, matchId);
  }

  deleteGameCache(userId: number) {
    this.gameCache.delete(userId);
  }

  async getHelp(gameId: number): Promise<Move | null> {
    const currentState = await this.getGame(gameId);

    if (!currentState) {
      return null;
    }

    const config = currentState.config;
    const state = currentState.state;

    if (!state.helpRemaining || !config.allowHelp) {
      return null;
    }

    const board = this._initAdjMatrix(state.balls, config);

    const result = this._suggestSmartMove(board, config);
    if (result) {
      currentState.state.helpRemaining--;
      await this.line98Repository.save(currentState);
    }

    return result;
  }

  private async _getByGameId(gameId: number): Promise<Line98State | null> {
    return this.line98Repository.findOne({
      where: {
        gameId,
      },
    });
  }

  private async _createState(
    game: Game,
    queryRunner?: QueryRunner,
  ): Promise<Line98State> {
    const config = this.getConfig();
    const manager = queryRunner
      ? queryRunner.manager
      : this.line98Repository.manager;

    const initState = this._generateStartState(config);
    const gameState = this.line98Repository.create({
      gameId: game.id,
      config,
      state: initState,
    });

    return manager.save(gameState);
  }

  private _generateStartState(config: ConfigInterface): StateInterface {
    return {
      balls: this._generateRandomBalls([], config.initialBalls, config),
      time: 0,
      helpRemaining: config.allowHelp ? config.maxHelp : 0,
      nextBalls: this._generateColors(config.perTurnBalls, config),
      gameOver: false,
    };
  }

  private _generateRandomBalls(
    balls: BallState[],
    numberBalls: number,
    config: ConfigInterface,
    colors?: number[],
  ) {
    const availablePositions = this._getAvailablePositions(balls, config);

    const generatedBalls: BallState[] = [];
    for (let i = 0; i < numberBalls && availablePositions.length > 0; i++) {
      const posIndex = RandomUtil.randomNumber(
        0,
        availablePositions.length - 1,
      );
      const pos = availablePositions.splice(posIndex, 1)[0];

      let color: number;
      if (colors && colors.length > 0) {
        color = colors[RandomUtil.randomNumber(0, colors.length - 1)];
      } else {
        color = RandomUtil.randomNumber(1, config.colors); // fallback
      }

      generatedBalls.push({
        x: pos.x,
        y: pos.y,
        color,
      });
    }

    return generatedBalls;
  }

  private _generateColors(
    numberBalls: number,
    config: ConfigInterface,
  ): number[] {
    const colors: number[] = [];
    for (let i = 0; i < numberBalls; i++) {
      colors.push(RandomUtil.randomNumber(1, config.colors));
    }

    return colors;
  }

  private _initAdjMatrix(
    balls: BallState[],
    config: ConfigInterface,
  ): number[][] {
    const { size } = config;

    const adj: number[][] = Array.from({ length: size }, () =>
      Array<number>(size).fill(0),
    );

    balls.forEach((ball) => {
      const { x, y } = ball;
      adj[x][y] = -1;
    });

    return adj;
  }

  private _initColorMatrix(
    balls: BallState[],
    config: ConfigInterface,
  ): number[][] {
    const { size } = config;

    const matrix: number[][] = Array.from({ length: size }, () =>
      Array<number>(size).fill(-1),
    );

    balls.forEach((ball) => {
      const { x, y, color } = ball;
      matrix[x][y] = color;
    });

    return matrix;
  }

  private _getAvailablePositions(
    balls: BallState[],
    config: ConfigInterface,
  ): { x: number; y: number }[] {
    const { size } = config;
    const matrix = this._initColorMatrix(balls, config);
    const availablePositions: { x: number; y: number }[] = [];
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (matrix[i][j] < 0) {
          availablePositions.push({ x: i, y: j });
        }
      }
    }
    return availablePositions;
  }

  private _canMoveBall(
    from: { x: number; y: number },
    to: { x: number; y: number },
    balls: BallState[],
    config: ConfigInterface,
  ): boolean {
    if (from.x === to.x && from.y === to.y) return false;
    const adj = this._initAdjMatrix(balls, config);

    if (!adj[from.x][from.y]) {
      return false;
    }

    if (adj[to.x][to.y]) {
      return false;
    }

    const queue = new Queue<{ x: number; y: number }>();
    queue.push(from);
    adj[from.x][from.y] = 1;

    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const size = config.size;

    while (!queue.isEmpty()) {
      const current = queue.pop();

      if (!current) {
        continue;
      }

      if (current.x == to.x && current.y == to.y) {
        return true;
      }

      directions.forEach(({ dx, dy }) => {
        const x = current.x + dx;
        const y = current.y + dy;

        if (x < 0 || x >= size) {
          return;
        }

        if (y < 0 || y >= size) {
          return;
        }

        if (adj[x][y]) {
          return;
        }

        adj[x][y] = adj[current.x][current.y] + 1;
        queue.push({ x, y });
      });
    }

    return false;
  }

  private _checkLines(
    matrix: number[][],
    ball: BallState,
    config: ConfigInterface,
  ): BallState[] {
    const { size, minLineLength } = config;

    const { x: row, y: col, color } = ball;

    const removes = new Set<string>();

    const directions = [
      [
        [0, 1],
        [0, -1],
      ], // horizontal
      [
        [1, 0],
        [-1, 0],
      ], // vertical
      [
        [1, 1],
        [-1, -1],
      ], // major diagonal
      [
        [1, -1],
        [-1, 1],
      ], // minor diagonal
    ];

    const countLine = (dx: number, dy: number) => {
      let x = row + dx,
        y = col + dy,
        count = 0;
      while (
        0 <= x &&
        x < size &&
        0 <= y &&
        y < size &&
        matrix[x][y] == color
      ) {
        x += dx;
        y += dy;
        ++count;
      }

      return count;
    };

    const collectLine = (dx: number, dy: number) => {
      let x = row + dx,
        y = col + dy;
      while (
        x >= 0 &&
        x < size &&
        y >= 0 &&
        y < size &&
        matrix[x][y] === color
      ) {
        removes.add(`${x},${y}`);
        x += dx;
        y += dy;
      }
    };

    for (const [dir1, dir2] of directions) {
      const total =
        countLine(dir1[0], dir1[1]) + countLine(dir2[0], dir2[1]) + 1;
      if (total >= minLineLength) {
        collectLine(dir1[0], dir1[1]);
        collectLine(dir2[0], dir2[1]);
        removes.add(`${row},${col}`);
      }
    }

    const removeBalls: BallState[] = [];
    removes.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      removeBalls.push({ x, y, color });
    });

    return removeBalls;
  }

  private _findValidMoves(board: number[][], config: ConfigInterface): Move[] {
    const moves: Move[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] !== 0) {
          const reachable = this._bfs(board, i, j, config);
          reachable.forEach((dest) => {
            moves.push({ from: { x: i, y: j }, to: dest });
          });
        }
      }
    }
    return moves;
  }

  private _bfs(
    board: number[][],
    row: number,
    col: number,
    config: ConfigInterface,
  ): { x: number; y: number }[] {
    const queue = new Queue<{ x: number; y: number }>();
    const reachable: { x: number; y: number }[] = [];

    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const cloneBoard = this._cloneBoard(board);

    const size = config.size;
    cloneBoard[row][col] = 1;
    queue.push({ x: row, y: col });
    while (!queue.isEmpty()) {
      const current = queue.pop();
      if (!current) {
        continue;
      }

      directions.forEach(({ dx, dy }) => {
        const x = current.x + dx;
        const y = current.y + dy;

        if (x < 0 || x >= size) {
          return;
        }

        if (y < 0 || y >= size) {
          return;
        }

        if (cloneBoard[x][y]) {
          return;
        }

        cloneBoard[x][y] = cloneBoard[current.x][current.y] + 1;
        reachable.push({ x, y });
        queue.push({ x, y });
      });
    }

    return reachable;
  }

  private _createsLine(
    board: number[][],
    x: number,
    y: number,
    config: ConfigInterface,
  ): boolean {
    const color = board[x][y];
    const directions = [
      [
        [0, 1],
        [0, -1],
      ], // ngang
      [
        [1, 0],
        [-1, 0],
      ], // dọc
      [
        [1, 1],
        [-1, -1],
      ], // chéo xuống
      [
        [1, -1],
        [-1, 1],
      ], // chéo lên
    ];

    const size = config.size;

    for (const dir of directions) {
      let count = 1;
      for (const [dx, dy] of dir) {
        let nx = x + dx,
          ny = y + dy;
        while (
          nx >= 0 &&
          ny >= 0 &&
          nx < size &&
          ny < size &&
          board[nx][ny] === color
        ) {
          count++;
          nx += dx;
          ny += dy;
        }
      }
      if (count >= config.minLineLength) return true;
    }

    return false;
  }

  private _suggestSmartMove(
    board: number[][],
    config: ConfigInterface,
  ): Move | null {
    const validMoves = this._findValidMoves(board, config);

    for (const move of validMoves) {
      const tempBoard = this._cloneBoard(board);
      const { x: fromX, y: fromY } = move.from;
      const { x: toX, y: toY } = move.to;

      tempBoard[toX][toY] = tempBoard[fromX][fromY];
      tempBoard[fromX][fromY] = 0;

      if (this._createsLine(tempBoard, toX, toY, config)) {
        return move; // Ưu tiên nước đi tạo hàng
      }
    }

    // Nếu không có nước đi nào tạo hàng, chọn ngẫu nhiên
    if (validMoves.length === 0) return null;
    const index = RandomUtil.randomNumber(0, validMoves.length - 1);
    return validMoves[index];
  }

  private _cloneBoard(board: number[][]): number[][] {
    return board.map((row) => [...row]);
  }
}
