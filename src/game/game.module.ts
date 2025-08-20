import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './models/game';
import { GameUser } from './models/game.user';
import { GameListener } from './game.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameUser])],
  providers: [GameService, GameListener],
  exports: [GameService],
})
export class GameModule {}
