import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { Line98Service } from './line98.service';
import * as appRequest from 'src/common/interfaces/app.request';

@Controller('api/line98')
@UseGuards(AuthGuard)
export class Line98Controller {
  constructor(private readonly line98Service: Line98Service) {}
  @Get('config')
  getConfig(@Res() response: express.Response) {
    response.status(HttpStatus.OK).json(this.line98Service.getConfig());
  }

  @Post('play')
  async createGame(
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
  ) {
    const userId = request.__context?.sub;
    if (!userId) {
      return new UnauthorizedException('');
    }

    const game = await this.line98Service.createGame(userId);
    this.line98Service.setGameCache(userId, game.id);

    response.status(HttpStatus.OK).json({ id: game.id });
  }

  @Get('history')
  async getHistory(
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
    @Query('page', ParseIntPipe) page: number,
    @Query('size', ParseIntPipe) size: number,
  ) {
    if (isNaN(page) || isNaN(size) || page < 0 || size < 0) {
      throw new BadRequestException('Invalid page or size');
    }

    const userId = request.__context?.sub;
    if (!userId) {
      return new UnauthorizedException();
    }

    response
      .status(HttpStatus.OK)
      .json(await this.line98Service.paginate(userId, { page, size }));
  }

  @Get(':id')
  async getGame(
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = request.__context?.sub;
    if (!userId) {
      return new UnauthorizedException();
    }

    const game = await this.line98Service.getGame(id);
    if (!game || game.isFinished) {
      return new NotFoundException();
    }
    const { config, state, score } = game;
    this.line98Service.setGameCache(userId, game.id);

    response.status(HttpStatus.OK).json({ config, state, score });
  }
}
