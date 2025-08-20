import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenPayload } from 'src/auth/interfaces/jwt.token.payload';
import { AuthService } from 'src/auth/services/auth.service';
import { AppRequest } from '../interfaces/app.request';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const accessToken = this._getTokenFromHeader(request);

    let payload: JwtTokenPayload | null = null;
    try {
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(
        accessToken,
        {
          secret: process.env.ACCESS_TOKEN_SECRET,
        },
      );
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('token_expired');
      }
    }

    if (!payload) {
      throw new UnauthorizedException();
    }

    // const session = await this.authService.getSession(payload.sid, payload.sub);
    // if (!session) {
    //   throw new UnauthorizedException();
    // }

    request.__context = payload;
    return true;
  }

  private _getTokenFromHeader(request: Request, prefix: string = 'Bearer ') {
    const auth = request.headers['authorization'];

    if (!auth || !auth.startsWith(prefix)) {
      throw new UnauthorizedException();
    }

    return auth.substring(prefix.length);
  }
}
