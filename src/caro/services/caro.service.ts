import { Injectable } from '@nestjs/common';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { CaroState } from '../models/caro.state';
import { InjectRepository } from '@nestjs/typeorm';
import { GameService } from 'src/game/game.service';
import { CaroConfig } from '../caro.config';
import { EndReasonMulti, GameMode, GameType } from 'src/game/game.enum';
import { Game } from 'src/game/models/game';
import { ConfigInterface } from '../interfaces/config.interface';
import {
  Move,
  PlayerInterface,
  StateInterface,
} from '../interfaces/state.interface';
import { RandomUtil } from 'src/common/utils/random.util';
import {
  Pagination,
  PaginationResponse,
} from 'src/common/interfaces/pagination.interface';

@Injectable()
export class CaroService {
  private readonly gameLocks = new Map<number, boolean>();
  private readonly matchCache = new Map<number, CaroState>();

  constructor(
    @InjectRepository(CaroState)
    private readonly caroRepository: Repository<CaroState>,
    private readonly gameService: GameService,
    private readonly dataSource: DataSource,
  ) {}

  getConfig() {
    return CaroConfig;
  }

  /**
   * Get caro.id that player is playing
   * @param userId User id
   * @returns number or null
   */
  async getPlayingGame(userId: number): Promise<number | null> {
    const gameUser = await this.gameService.getPlayingGame(
      userId,
      GameType.CARO,
    );

    if (!gameUser) {
      return null;
    }
    const game = await this.caroRepository.findOneBy({
      gameId: gameUser.gameId,
    });
    return game?.id ?? null;
  }

  /**
   * Create game
   * @param users List id
   * @returns CaroState
   */
  async createGame(users: number[]) {
    const config = this.getConfig();

    if (users.length != config.players) {
      throw new Error('');
    }

    if ((await this.isPlaying(users[0])) || (await this.isPlaying(users[1]))) {
      throw new Error('');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let caro: CaroState;

    try {
      const game = await this.gameService.createGame(
        GameType.CARO,
        GameMode.MULTI,
        users,
        queryRunner,
      );

      caro = await this._createCaroState(game, config, queryRunner);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return caro;
  }

  /**
   * Make a move in the Caro game
   * @param caroId Caro game ID
   * @param move Move object
   * @returns CaroState
   */
  async makeMove(caroId: number, move: Move): Promise<CaroState> {
    if (this.isLocking(caroId)) {
      throw new Error('');
    }

    const caro = await this.getMatch(caroId);

    if (caro.isFinished) {
      throw new Error('');
    }

    try {
      this.lockGame(caroId);

      const state = caro.state;
      const config = caro.config;

      const { userId, x, y } = move;
      if (!this._isInMatch(state, userId)) {
        throw new Error('');
      }

      const player = state.players.find((p) => p.id == userId);

      if (player?.id != userId) {
        throw new Error('');
      }

      const size = config.size;

      if (x < 0 || x >= size || y < 0 || y >= size) {
        throw new Error('');
      }

      const board = state.board;

      if (board[x][y]) {
        throw new Error('');
      }

      const userSymbol = this._getSymbol(state.players, userId);
      if (!userSymbol) {
        throw new Error('');
      }

      state.board[x][y] = userSymbol;

      const nextPlayer = state.players.find((p) => p.id !== userId);
      if (!nextPlayer) {
        throw new Error('');
      }
      state.currentTurn = nextPlayer?.symbol;
      this.unlockGame(caroId);

      return caro;
    } catch (err) {
      this.unlockGame(caroId);
      throw err;
    }

    // return await this.caroRepository.save(caro);
  }

  /**
   * Check if the move results in a win
   * @param board Game board
   * @param row Row index
   * @param col Column index
   * @param config Game config
   * @returns boolean
   */
  checkWin(
    board: string[][],
    row: number,
    col: number,
    config: ConfigInterface,
  ): boolean {
    const directions = [
      { dx: 0, dy: 1 }, // ngang
      { dx: 1, dy: 0 }, // dọc
      { dx: 1, dy: 1 }, // chéo xuống
      { dx: 1, dy: -1 }, // chéo lên
    ];

    const { size, winCondition } = config;
    const symbol = board[row][col];

    if (!symbol) {
      throw new Error('');
    }

    const countSymbol = (dx: number, dy: number) => {
      let count = 1;
      for (const dir of [-1, 1]) {
        let x = row + dir * dx;
        let y = col + dir * dy;

        while (
          x >= 0 &&
          x < size &&
          y >= 0 &&
          y < size &&
          board[x][y] == symbol
        ) {
          count++;
          x += dir * dx;
          y += dir * dy;
        }
      }

      return count;
    };

    for (const { dx, dy } of directions) {
      const count = countSymbol(dx, dy);
      if (count >= winCondition) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if the game is a draw
   * @param board Game board
   * @param config Game config
   * @returns boolean
   */
  checkDraw(board: string[][], config: ConfigInterface): boolean {
    const size = config.size;
    // Nếu còn ô trống -> chưa hòa
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] == '') {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Start the Caro game
   * @param caroId Caro game ID
   * @returns void
   */
  async startGame(caroId: number) {
    const caro = await this.getMatch(caroId);
    await this.gameService.startGame(caro.gameId);
  }

  /**
   * Set the winner of the game
   * @param caroId Caro game ID
   * @param userId Winner user ID
   * @param reason End reason
   * @returns CaroState
   */
  async setWin(
    caroId: number,
    userId: number,
    reason: EndReasonMulti,
  ): Promise<CaroState> {
    let caro = await this.getMatch(caroId);
    if (!this._isInMatch(caro.state, userId)) {
      throw new Error('');
    }

    caro.winner = userId;
    caro.endReason = reason;
    caro.isFinished = true;

    caro = await this.caroRepository.save(caro);
    this._removeInCache(caro.id);

    await this.gameService.finishGame(caro.gameId, {
      winners: [userId],
      losers: caro.state.players.filter((p) => p.id != userId).map((p) => p.id),
    });

    return caro;
  }

  /**
   * Paginate Caro games for a user
   * @param userId User ID
   * @param pagination Pagination object
   * @returns PaginationResponse<CaroState>
   */
  async paginate(
    userId: number,
    pagination: Pagination,
  ): Promise<PaginationResponse<CaroState>> {
    const gameUser = await this.gameService.paginate(
      userId,
      GameType.CARO,
      pagination,
    );

    const gameIds = gameUser.data.map((g) => g.gameId);
    const [data, total] = await this.caroRepository.findAndCountBy({
      gameId: In(gameIds),
    });

    return {
      ...pagination,
      data: data,
      total: gameUser.total,
      totalPages: gameUser.totalPages,
    };
  }

  /**
   * Set the game as draw
   * @param caroId Caro game ID
   * @returns CaroState
   */
  async setDraw(caroId: number) {
    let caro = await this.getMatch(caroId);

    caro.endReason = EndReasonMulti.DRAW;
    caro.isFinished = true;

    caro = await this.caroRepository.save(caro);
    this._removeInCache(caro.id);

    await this.gameService.finishGame(caro.gameId, {
      drawers: caro.state.players.map((p) => p.id),
    });

    return caro;
  }

  /**
   * Check if the user is playing a Caro game
   * @param userId User ID
   * @returns boolean
   */
  async isPlaying(userId: number): Promise<boolean> {
    return this.gameService.isPlaying(userId, GameType.CARO);
  }

   /**
   * Cache the Caro match
   * @param caro CaroState object
   * @returns void
   */
  setCache(caro: CaroState) {
    this.matchCache.set(caro.id, caro);
  }

   /**
   * Get Caro match by ID
   * @param id Caro game ID
   * @returns CaroState
   */
  async getMatch(id: number): Promise<CaroState> {
    let caro = this.matchCache.get(id) ?? null;
    if (!caro) {
      caro = await this._getById(id);
      if (!caro) {
        throw new Error('');
      }

      if (caro.isFinished) {
        throw new Error('');
      }

      this.matchCache.set(id, caro);
    }

    if (caro.isFinished) {
      throw new Error('');
    }

    return caro;
  }

  /**
   * Check if the game is locked
   * @param id Caro game ID
   * @returns boolean
   */
  isLocking(id: number): boolean {
    return this.gameLocks.get(id) ?? false;
  }

  /**
   * Lock the game
   * @param id Caro game ID
   * @returns void
   */
  lockGame(id: number) {
    this.gameLocks.set(id, true);
  }

  /**
   * Unlock the game
   * @param id Caro game ID
   * @returns void
   */
  unlockGame(id: number) {
    this.gameLocks.set(id, false);
  }

  private _getSymbol(
    players: PlayerInterface[],
    userId: number,
  ): string | null {
    return players.find((p) => p.id == userId)?.symbol ?? null;
  }

  private _isInMatch(state: StateInterface, userId: number): boolean {
    const players = state.players;
    return players[0].id == userId || players[1].id == userId;
  }

  private async _getById(id: number): Promise<CaroState | null> {
    return this.caroRepository.findOneBy({ id });
  }

  private _removeInCache(id: number): void {
    this.matchCache.delete(id);
    this.gameLocks.delete(id);
  }

  private async _createCaroState(
    game: Game,
    config: ConfigInterface,
    queryRunner?: QueryRunner,
  ): Promise<CaroState> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.caroRepository.manager;

    const state = this._initState(game.users, config);
    const firstPlayer = state.players.find((p) => p.symbol == 'X');

    const caro = this.caroRepository.create({
      gameId: game.id,
      config,
      state,
      firstPlayer: firstPlayer?.id,
    });

    return manager.save(caro);
  }

  private _initState(users: number[], config: ConfigInterface): StateInterface {
    const size = config.size;
    const initBoard = Array.from({ length: size }, () =>
      Array<string>(size).fill(''),
    );
    const firstPlayer = users[RandomUtil.randomNumber(0, 100) % 2];

    const players: PlayerInterface[] = [
      {
        id: users[0],
        symbol: firstPlayer == users[0] ? 'X' : 'O',
      },
      {
        id: users[1],
        symbol: firstPlayer == users[1] ? 'X' : 'O',
      },
    ];

    return {
      board: initBoard,
      currentTurn: 'X',
      players: players,
    };
  }
}
