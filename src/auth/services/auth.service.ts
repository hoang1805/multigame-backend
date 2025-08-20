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

  /**
   * Logs in a user by revoking previous sessions, creating a new session,
   * and generating access and refresh JWT tokens.
   * @param userId - The user's ID
   * @param userName - The user's name
   * @returns JwtClientToken containing accessToken and refreshToken
   */
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

  /**
   * Refresh the access token using a valid refresh token.
   * Verifies the refresh token, checks session validity, and issues a new access token.
   * Revokes session if the refresh token is expired.
   * @param token - The refresh token
   * @returns New access token as a string
   */
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

  /**
   * Get a session by its ID and user ID, ensuring it is not revoked.
   * @param id - Session ID
   * @param userId - User ID
   * @returns Session object or null if not found
   */
  async getSession(id: number, userId: number): Promise<Session | null> {
    return this.sessionRepository.findOne({
      where: { id, userId, revoked: false },
    });
  }

  /**
   * Revokes a session by setting its revoked flag to true.
   * @param id - Session ID
   */
  async revokeSession(id: number): Promise<void> {
    await this.sessionRepository.update(id, { revoked: true });
  }

  /**
   * Creates a new session for a user.
   * @param userId - User ID
   * @returns Newly created Session object
   */
  async createSession(userId: number): Promise<Session> {
    const session = this.sessionRepository.create({
      userId: userId,
      refreshToken: '',
    });

    return await this.sessionRepository.save(session);
  }

  /**
   * Revokes all active sessions for a user.
   * @param userId - User ID
   */
  async revokeByUser(userId: number): Promise<void> {
    await this.sessionRepository.update(
      { userId: userId, revoked: false },
      { revoked: true },
    );
  }
}
