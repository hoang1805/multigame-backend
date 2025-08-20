import { Module } from '@nestjs/common';
import { Line98Controller } from './line98.controller';
import { Line98Service } from './line98.service';
import { GameModule } from 'src/game/game.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Line98State } from './models/line98.state';
import { Line98Gateway } from './line98.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Line98State]), GameModule, AuthModule],
  controllers: [Line98Controller],
  providers: [Line98Service, Line98Gateway],
})
export class Line98Module {}
