import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { UserService } from 'src/user/user.service';
import { RegisterDto } from './dtos/register.dto';
import express, { response } from 'express';
import { LoginDto } from './dtos/login.dto';
import { HashUtil } from 'src/common/utils/hash.util';
import * as appRequest from 'src/common/interfaces/app.request';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  async registerAccount(
    @Body() data: RegisterDto,
    @Res() response: express.Response,
  ) {
    if (data.password != data.rePassword) {
      throw new BadRequestException(
        'Your password does not match. Please try again!!',
      );
    }

    await this.userService.createUser(
      data.username,
      data.password,
      data.email,
      data.nickname,
    );

    response
      .status(HttpStatus.OK)
      .json({ message: 'Register account successfully !!!' });
  }

  @Post('login')
  async login(@Body() data: LoginDto, @Res() response: express.Response) {
    const user = await this.userService.getByUsername(data.username);
    const notFound = new NotFoundException(
      'Invalid username or password. Please try again !!!',
    );

    if (!user) {
      throw notFound;
    }

    if (!(await HashUtil.compareBcrypt(data.password, user.password))) {
      throw notFound;
    }

    const clientToken = await this.authService.login(user.id, user.username);

    response.status(HttpStatus.OK).json(clientToken);
  }

  @Get('refresh')
  async refreshAccessToken(
    @Query('refreshToken') token: string,
    @Res() response: express.Response,
  ) {
    const accessToken = await this.authService.refresh(token);
    response.status(HttpStatus.OK).json({ accessToken });
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(
    @Req() request: appRequest.AppRequest,
    @Res() response: express.Response,
  ) {
    const context = request.__context;

    if (!context) {
      throw new UnauthorizedException();
    }

    await this.authService.revokeSession(context.sid);
    response.status(HttpStatus.OK).json({ message: 'Logout successfully !!!' });
  }
}
