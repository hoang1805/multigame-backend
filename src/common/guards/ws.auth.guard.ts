import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtTokenPayload } from 'src/auth/interfaces/jwt.token.payload';
import { AuthService } from 'src/auth/services/auth.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const accessToken: string = client.handshake?.auth?.token;

    if (!accessToken) {
      throw new WsException('missing_token');
    }

    const payload: JwtTokenPayload = await authWs(this.jwtService, accessToken);

    // const session = await this.authService.getSession(payload.sid, payload.sub);
    // if (!session) {
    //   throw new WsException('session_not_found');
    // }

    (client as any).__context = payload;

    return true;
  }
}

export async function authWs(jwtService: JwtService, accessToken: string) {
  let payload: JwtTokenPayload | null = null;
  try {
    payload = await jwtService.verifyAsync<JwtTokenPayload>(accessToken, {
      secret: process.env.ACCESS_TOKEN_SECRET,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new WsException('token_expired');
    }
  }

  if (!payload) {
    throw new WsException('invalid_token');
  }

  return payload;
}
