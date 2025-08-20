import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Session } from '../models/session';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtTokenPayload } from '../interfaces/jwt.token.payload';
import { JwtClientToken } from '../interfaces/jwt.client.token';
import { HashUtil } from 'src/common/utils/hash.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async login(userId: number, userName: string): Promise<JwtClientToken> {
    await this.revokeByUser(userId);
    const session = await this.createSession(userId);

    const payload: JwtTokenPayload = {
      sub: userId,
      sid: session.id,
      username: userName,
    };
    // generate access token
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: process.env.ACCESS_TOKEN_EXPIRE,
    });

    // generate refresh token
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE,
    });

    session.refreshToken = await HashUtil.hashBcrypt(refreshToken);
    await this.sessionRepository.save(session);

    return { accessToken, refreshToken };
  }

  async refresh(token: string): Promise<string> {
    try {
      const { sub, sid, username } =
        await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
          secret: process.env.REFRESH_TOKEN_SECRET,
        });

      const session = await this.getSession(sid, sub);
      if (!session) {
        throw new UnauthorizedException();
      }

      if (!(await HashUtil.compareBcrypt(token, session.refreshToken))) {
        throw new UnauthorizedException();
      }

      const payload: JwtTokenPayload = {
        sub,
        sid,
        username,
      };

      return this.jwtService.signAsync(payload, {
        secret: process.env.ACCESS_TOKEN_SECRET,
        expiresIn: process.env.ACCESS_TOKEN_EXPIRE,
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const payload = this.jwtService.decode<JwtTokenPayload>(token);
        if (payload?.sid) {
          await this.revokeSession(payload.sid);
        }

        throw new UnauthorizedException('Refresh token has expired');
      }

      if (err.name === 'UnauthorizedException') {
        throw err;
      }

      throw new InternalServerErrorException(
        err.message ?? 'Invalid refresh token',
      );
    }
  }

  async getSession(id: number, userId: number): Promise<Session | null> {
    return this.sessionRepository.findOne({
      where: { id, userId, revoked: false },
    });
  }

  async revokeSession(id: number): Promise<void> {
    await this.sessionRepository.update(id, { revoked: true });
  }

  async createSession(userId: number): Promise<Session> {
    const session = this.sessionRepository.create({
      userId: userId,
      refreshToken: '',
    });

    return await this.sessionRepository.save(session);
  }

  async revokeByUser(userId: number): Promise<void> {
    await this.sessionRepository.update(
      { userId: userId, revoked: false },
      { revoked: true },
    );
  }
}
