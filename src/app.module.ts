import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Session } from './auth/models/session';
import { User } from './user/models/user';
import { CommonModule } from './common/common.module';
import { GameModule } from './game/game.module';
import { Line98Module } from './line98/line98.module';
import { CaroModule } from './caro/caro.module';
import { Game } from './game/models/game';
import { GameUser } from './game/models/game.user';
import { Line98State } from './line98/models/line98.state';
import { CaroState } from './caro/models/caro.state';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      entities: [Session, User, Game, GameUser, Line98State, CaroState],
      database: 'multigame.sqlite',
      synchronize: true,
    }),
    JwtModule.register({
      global: true,
    }),
    ConfigModule.forRoot(),
    UserModule,
    AuthModule,
    CommonModule,
    GameModule,
    Line98Module,
    CaroModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
