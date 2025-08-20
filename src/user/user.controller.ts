import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { UserService } from './user.service';
import { UserResponseDto } from './dtos/user.response.dto';
import * as appRequest from 'src/common/interfaces/app.request';
import { UpdateUserDto } from './dtos/update.user.dto';
import { ChangePasswordDto } from './dtos/change.password.dto';

@Controller('api/user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('all')
  async getAll(
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
  ) {
    const userId = request.__context?.sub;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const users = await this.userService.getAll();

    const data: UserResponseDto[] = users.map((user) => {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.createdAt,
      };
    });

    response.status(HttpStatus.OK).json({ users: data });
  }

  @Get('me')
  async getCurrentUser(
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
  ) {
    const userId = request.__context?.sub;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const user = await this.userService.getById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const exportData: UserResponseDto = {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      createdAt: user.createdAt,
    };

    response.status(HttpStatus.OK).json(exportData);
  }

  @Get(':id')
  async getUser(@Param('id') id: number, @Res() response: express.Response) {
    const user = await this.userService.getById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const exportData: UserResponseDto = {
      id: user.id,
      username: user.username,
      email: user.nickname,
      nickname: user.nickname,
      createdAt: user.createdAt,
    };

    response.status(HttpStatus.OK).json(exportData);
  }

  @Put()
  async updateUser(
    @Body() data: UpdateUserDto,
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
  ) {
    const userId = request.__context?.sub;
    const user = userId ? await this.userService.getById(userId) : null;

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userService.updateUser(user.id, data);
    const exportData: UserResponseDto = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      nickname: updatedUser.nickname,
      createdAt: updatedUser.createdAt,
    };
    response.status(HttpStatus.OK).json(exportData);
  }

  @Post('password')
  async changePassword(
    @Body() data: ChangePasswordDto,
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
  ) {
    const userId = request.__context?.sub;
    await this.userService.changePassword(userId, data);
    response
      .status(HttpStatus.OK)
      .json({ message: 'Change password successfully' });
  }
}
