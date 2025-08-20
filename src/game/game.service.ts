import { Injectable } from '@nestjs/common';
import { In, QueryRunner, Repository } from 'typeorm';
import { Game } from './models/game';
import { InjectRepository } from '@nestjs/typeorm';
import { GameListener } from './game.listener';
import { GameMode, GameStatus, GameType, UserStatus } from './game.enum';
import { GameUser } from './models/game.user';
import { FinalResult } from './interfaces/final.result';
import {
  Pagination,
  PaginationResponse,
} from 'src/common/interfaces/pagination.interface';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game) private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameUser)
    private readonly gameUserRepository: Repository<GameUser>,
    private readonly gameListener: GameListener,
  ) {}

  async createGame(
    type: GameType,
    mode: GameMode,
    users: number[],
    queryRunner?: QueryRunner,
  ): Promise<Game> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.gameRepository.manager;

    let game = this.gameRepository.create({
      type,
      mode,
      users,
    });

    game = await manager.save(game);

    await this.gameListener.onCreated(game, queryRunner);

    return game;
  }

  async isPlaying(userId: number, type: GameType): Promise<boolean> {
    return this.gameUserRepository.existsBy({
      userId: userId,
      status: In([UserStatus.PLAYING, UserStatus.WAITING]),
      type,
    });
  }

  async getPlayingGame(
    userId: number,
    type: GameType,
  ): Promise<GameUser | null> {
    return this.gameUserRepository.findOneBy({
      userId,
      type,
      status: In([UserStatus.PLAYING, UserStatus.WAITING]),
    });
  }

  async startGame(gameId: number): Promise<void> {
    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
      throw new Error('');
    }

    await this.gameListener.onStarted(game);
  }

  async finishGame(
    gameId: number,
    result: FinalResult,
    queryRunner?: QueryRunner,
  ) {
    const manager = queryRunner
      ? queryRunner.manager
      : this.gameRepository.manager;

    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
      throw new Error('');
    }

    game.status = GameStatus.FINISHED;
    game.endTime = new Date();
    await manager.save(game);

    await this.gameListener.onFinished(game, result, queryRunner);
  }

  async paginate(
    userId: number,
    type: GameType,
    pagination: Pagination,
  ): Promise<PaginationResponse<GameUser>> {
    const { page, size } = pagination;
    const skip = (page - 1) * size;
    const data = await this.gameUserRepository.find({
      where: {
        userId,
        type,
      },
      skip,
      take: size,
    });

    const total = await this.gameUserRepository.count({
      where: {
        userId,
        type,
      },
    });

    return {
      page,
      size,
      total,
      data,
      totalPages: Math.ceil(total / size),
    };
  }
}
