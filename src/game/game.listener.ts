import { QueryRunner, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameUser } from './models/game.user';
import { Game } from './models/game';
import { GameResult, UserStatus } from './game.enum';
import { FinalResult } from './interfaces/final.result';

@Injectable()
export class GameListener {
  constructor(
    @InjectRepository(GameUser)
    private readonly gameUserRepository: Repository<GameUser>,
  ) {}

  async onCreated(game: Game, queryRunner?: QueryRunner): Promise<void> {
    const gameUsers: GameUser[] = [];
    game.users.forEach((userId: number) => {
      const gameUser = this.gameUserRepository.create({
        gameId: game.id,
        userId: userId,
        type: game.type,
      });
      gameUsers.push(gameUser);
    });

    const manager = queryRunner
      ? queryRunner.manager
      : this.gameUserRepository.manager;

    await manager.save(gameUsers);
  }

  async onStarted(game: Game, queryRunner?: QueryRunner): Promise<void> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.gameUserRepository.manager;

    let gameUsers: GameUser[] = await manager.find(GameUser, {
      where: { gameId: game.id },
    });

    gameUsers = gameUsers.map((gameUser) => {
      gameUser.status = UserStatus.PLAYING;
      return gameUser;
    });

    await manager.save(gameUsers);
  }

  async onFinished(game: Game, data: FinalResult, queryRunner?: QueryRunner) {
    const manager = queryRunner
      ? queryRunner.manager
      : this.gameUserRepository.manager;

    let gameUsers: GameUser[] = await manager.find(GameUser, {
      where: { gameId: game.id },
    });

    gameUsers = gameUsers.map((gameUser) => {
      if (data.winners?.includes(gameUser.userId)) {
        gameUser.result = GameResult.WIN;
      } else if (data.losers?.includes(gameUser.userId)) {
        gameUser.result = GameResult.LOSE;
      } else if (data.drawers?.includes(gameUser.userId)) {
        gameUser.result = GameResult.DRAW;
      }

      gameUser.status = UserStatus.FINISHED;

      return gameUser;
    });

    await manager.save(gameUsers);
  }
}
