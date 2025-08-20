import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Line98Service } from './line98.service';
import { Server, Socket } from 'socket.io';
import { UseFilters, UsePipes } from '@nestjs/common';
import { authWs } from 'src/common/guards/ws.auth.guard';
import { JwtService } from '@nestjs/jwt';
import { WsValidationPipe } from 'src/common/validations/ws.validation.pipe';
import { MoveDto } from './dtos/move.dto';
import { Move, MoveEvent } from './interfaces/state.interface';
import {
  handleWsException,
  WsExceptionFilter,
} from 'src/common/filters/ws.exception.filter';
import { AuthService } from 'src/auth/services/auth.service';
import { JoinDto } from './dtos/join.dto';
import { RefreshDto } from './dtos/refresh.dto';

@UseFilters(new WsExceptionFilter())
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/line98',
})
export class Line98Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly line98Service: Line98Service,
    private readonly jwtService: JwtService,
  ) {}

  @WebSocketServer() server!: Server;
  private socketToUser = new Map<string, number>();
  private userToSocket = new Map<
    number,
    { socketId: string; time?: number; matchId?: number }
  >();

  async handleConnection(client: Socket) {
    try {
      const accessToken: string = client.handshake?.auth?.token;

      if (!accessToken) {
        throw new WsException('missing_token');
      }

      const payload = await authWs(this.jwtService, accessToken);

      const userId = payload.sub;
      const socketId = client.id;

      if (!userId || isNaN(userId)) {
        throw new WsException('');
      }

      this._setSocket(userId, socketId);

      client.emit('line98:connected');
    } catch (err) {
      handleWsException(client, err);
    }
  }

  handleDisconnect(client: Socket) {
    const socketId = client.id;
    const userId = this._getUser(socketId);
    if (userId) {
      this._removeSocket(userId);
      this.line98Service.deleteGameCache(userId);
    }
  }

  @UsePipes(new WsValidationPipe({ transform: true }))
  @SubscribeMessage('join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: JoinDto) {
    const socketId = client.id;
    const userId = this._getUser(socketId);
    if (!userId) {
      throw new WsException('');
    }

    client.emit('line98:connected');

    const matchId = this.line98Service.getGameCache(userId);
    if (!matchId || body.matchId != matchId) {
      throw new WsException('');
    }

    this._setMatch(userId, matchId);
  }

  @UsePipes(new WsValidationPipe({ transform: true }))
  @SubscribeMessage('move')
  async onMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MoveDto,
  ) {
    const socketId = client.id;
    const userId = this._getUser(socketId);
    if (!userId) {
      throw new WsException('');
    }

    const matchId = body.matchId;
    const result = await this.line98Service.move(matchId, body.from, body.to);
    this._sendMove(userId, matchId, result);

    const recheck = await this.line98Service.checkAfterAdd(matchId);
    this._sendMove(userId, matchId, recheck);

    if (await this.line98Service.isGameOver(matchId)) {
      await this.line98Service.setGameOver(matchId, userId);
      this._sendGameOver(userId, matchId);
    }
  }

  @SubscribeMessage('help')
  async onHelp(@ConnectedSocket() client: Socket) {
    const socketId = client.id;
    const userId = this._getUser(socketId);
    if (!userId) {
      throw new WsException('');
    }

    const gameId = this._getUserInfo(userId)?.matchId;
    if (!gameId) {
      throw new WsException('');
    }

    const help = await this.line98Service.getHelp(gameId);
    if (help) {
      this._sendHelp(userId, help);
    }
  }

  @SubscribeMessage('cancel')
  async onCancel(@ConnectedSocket() client: Socket) {
    const socketId = client.id;
    const userId = this._getUser(socketId);
    if (!userId) {
      throw new WsException('');
    }

    const gameId = this._getUserInfo(userId)?.matchId;
    if (!gameId) {
      throw new WsException('');
    }

    await this.line98Service.setGameOver(gameId, userId);
    this._sendGameOver(userId, gameId);
  }

  private _sendGameOver(userId: number, matchId: number) {
    const socketId = this._getUserInfo(userId)?.socketId;
    if (!socketId) {
      throw new WsException('');
    }

    this.server.to(socketId).emit('line98:game.over', { matchId });
  }

  private _sendMove(userId: number, matchId: number, move: MoveEvent) {
    const socketId = this._getUserInfo(userId)?.socketId;
    if (!socketId) {
      throw new WsException('');
    }

    this.server.to(socketId).emit('line98:move', { matchId, move });
  }

  private _sendHelp(userId: number, help: Move) {
    const socketId = this._getUserInfo(userId)?.socketId;
    if (!socketId) {
      throw new WsException('');
    }

    this.server.to(socketId).emit('line98:help', help);
  }

  private _removeSocket(userId: number) {
    const socketId = this.userToSocket.get(userId)?.socketId;
    if (socketId) {
      this.socketToUser.delete(socketId);
    }

    this.userToSocket.delete(userId);
  }

  private _setSocket(userId: number, socketId: string) {
    this._removeSocket(userId);
    this.userToSocket.set(userId, { socketId });
    this.socketToUser.set(socketId, userId);
  }

  private _setMatch(userId: number, matchId: number) {
    const info = this._getUserInfo(userId);
    if (!info) {
      return;
    }

    info.matchId = matchId;
    info.time = Date.now();
  }

  private _getUser(socketId: string) {
    return this.socketToUser.get(socketId);
  }

  private _getUserInfo(userId: number) {
    return this.userToSocket.get(userId);
  }
}
