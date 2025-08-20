import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CaroService } from './services/caro.service';
import * as appRequest from 'src/common/interfaces/app.request';
import express from 'express';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Controller('api/caro')
@UseGuards(AuthGuard)
export class CaroController {
  constructor(private readonly caroService: CaroService) {}
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
      .json(await this.caroService.paginate(userId, { page, size }));
  }
}
