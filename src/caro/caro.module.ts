import { forwardRef, Module } from '@nestjs/common';
import { CaroService } from './services/caro.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaroState } from './models/caro.state';
import { GameModule } from 'src/game/game.module';
import { MatchmakerService } from './services/matchmaker.service';
import { CaroGateway } from './caro.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { CaroController } from './caro.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaroState]),
    GameModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
  ],
  providers: [CaroService, MatchmakerService, CaroGateway],
  controllers: [CaroController],
})
export class CaroModule {}
