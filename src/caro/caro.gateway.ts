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
import { Server, Socket } from 'socket.io';
import { CaroService } from './services/caro.service';
import { MatchmakerService } from './services/matchmaker.service';
import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { authWs, WsAuthGuard } from 'src/common/guards/ws.auth.guard';
import { MoveDto } from './dtos/move.dto';
import { WsValidationPipe } from 'src/common/validations/ws.validation.pipe';
import { PlayerInterface, StateInterface } from './interfaces/state.interface';
import { EndReasonMulti } from 'src/game/game.enum';
import { ConfigInterface } from './interfaces/config.interface';
import { JwtService } from '@nestjs/jwt';
import { JoinDto } from './dtos/join.dto';
import { ClientStateInterface } from './interfaces/client.state.interface';
import {
  handleWsException,
  WsExceptionFilter,
} from 'src/common/filters/ws.exception.filter';
import { AuthService } from 'src/auth/services/auth.service';
import { RefreshDto } from './dtos/refresh.dto';
import { UserService } from 'src/user/user.service';

@UseFilters(new WsExceptionFilter())
@WebSocketGateway({
  namespace: '/caro',
  cors: { origin: '*' },
})
export class CaroGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private turnTimers: Map<number, TurnTimer> = new Map();
  @WebSocketServer() server!: Server;
  constructor(
    private readonly caroService: CaroService,
    private readonly matchmaker: MatchmakerService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const accessToken: string = client.handshake?.auth?.token;

      if (!accessToken) {
        throw new WsException('Missing access token');
      }

      const payload = await authWs(this.jwtService, accessToken);

      const userId = payload.sub;

      if (!userId || isNaN(userId)) {
        throw new WsException('Invalid user ID');
      }

      this.matchmaker.setSocketId(userId, client.id);

      const activeMatchId = await this.caroService.getPlayingGame(userId);
      if (activeMatchId) {
        this.matchmaker.setMatch(userId, activeMatchId);
        this._sendContinue(userId, activeMatchId);
        return;
      }

      if (await this.caroService.isPlaying(userId)) {
        throw new WsException('User is already playing');
      }

      const matchId = await this.matchmaker.enqueue(userId);
      if (matchId) {
        const match = await this.caroService.getMatch(matchId);
        const players = match.state.players;

        players.forEach((p) => {
          this.matchmaker.setMatch(p.id, matchId);
          this._sendMatchFound(p.id, matchId);
        });

        const config = match.config;

        await this.caroService.startGame(matchId);
        this._startTurnTimer(matchId, config.timeLimit * 1000);
      }
    } catch (err) {
      handleWsException(client, err);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const socketId = client.id;
      const userId = this.matchmaker.getUserId(socketId);
      this.matchmaker.remove(userId);
    } catch (err) {}
  }

  @SubscribeMessage('join')
  async onJoin(@ConnectedSocket() client: Socket) {
    const socketId = client.id;
    const userId = this.matchmaker.getUserId(socketId);
    const matchId = this.matchmaker.getActiveMatch(userId);

    if (!matchId) {
      throw new WsException('No active match found for user');
    }

    const match = await this.caroService.getMatch(matchId);
    const { config, state } = match;
    const player = state.players.find((p) => p.id == userId);
    const opponent = state.players.find((p) => p.id != userId);

    if (!player || !opponent) {
      throw new WsException('Player or opponent not found');
    }

    const timer = this._getTurnTimer(matchId);
    if (!timer) {
      throw new WsException('Turn timer not found');
    }

    const opponentInfo = await this.userService.getById(opponent.id);
    if (!opponentInfo) {
      throw new WsException('Opponent info not found');
    }

    // this._sendConfig(userId, matchId, config);

    const buffer = 3000;
    const remain = Math.max(0, timer.expiresAt - Date.now() - buffer);
    this._sendOpponentInfo(player.id, matchId, opponentInfo.nickname);
    this._sendState(
      matchId,
      player,
      state,
      remain,
      config.size,
      config.timeLimit * 1000,
    );
  }

  @UsePipes(new WsValidationPipe({ transform: true }))
  @SubscribeMessage('move')
  async onMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MoveDto,
  ) {
    try {
      const socketId = client.id;
      const userId = this.matchmaker.getUserId(socketId);
      const matchId = body.matchId;
      const caro = await this.caroService.makeMove(matchId, {
        userId,
        x: body.row,
        y: body.col,
      });

      const players = caro.state.players;

      const player = players.find((p) => p.id == userId);
      if (!player) {
        throw new WsException('Player not found in match');
      }

      const X = players[0].symbol == 'X' ? players[0] : players[1];
      const O = players[0].symbol == 'O' ? players[0] : players[1];
      const state = caro.state;

      const config = caro.config;

      this._clearTurnTimer(matchId);

      if (this.caroService.checkWin(state.board, body.row, body.col, config)) {
        await this.caroService.setWin(matchId, userId, EndReasonMulti.WIN);
        this._sendGameResult(userId, matchId, 'win', state);
        this._sendGameResult(
          X.id == userId ? O.id : X.id,
          matchId,
          'lose',
          state,
        );
        return;
      }

      if (this.caroService.checkDraw(state.board, config)) {
        await this.caroService.setDraw(matchId);
        this._sendGameResult(X.id, matchId, 'draw', state);
        this._sendGameResult(O.id, matchId, 'draw', state);
        return;
      }

      const remain = config.timeLimit * 1000;

      this._startTurnTimer(matchId, remain);

      this._sendState(matchId, X, state, remain);
      this._sendState(matchId, O, state, remain);
    } catch (err) {
      // TODO
      console.log(err);
      throw err;
    }
  }

  private _startTurnTimer(gameId: number, durationMs: number) {
    this._clearTurnTimer(gameId);
    const buffer = 3000;
    const expiresAt = Date.now() + durationMs + buffer;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const timeoutId = setTimeout(async () => {
      if (this.caroService.isLocking(gameId)) {
        return;
      }

      this.caroService.lockGame(gameId);
      const caro = await this.caroService.getMatch(gameId);
      const symbol = caro.state.currentTurn;
      const loser = caro.state.players.find((p) => p.symbol == symbol);
      if (!loser) {
        throw new WsException('Loser not found');
      }
      const winner =
        caro.state.players[0].id == loser?.id
          ? caro.state.players[1].id
          : caro.state.players[0].id;

      await this.caroService.setWin(gameId, winner, EndReasonMulti.TIMEOUT);
      this._sendGameResult(winner, gameId, 'win', caro.state);
      this._sendGameResult(loser?.id, gameId, 'lose', caro.state);
      // this._unlockGame(gameId);
    }, durationMs + buffer);

    this.turnTimers.set(gameId, { timeout: timeoutId, expiresAt });
  }

  private _clearTurnTimer(gameId: number) {
    const timeout = this.turnTimers.get(gameId);
    if (timeout) {
      clearTimeout(timeout.timeout);
      this.turnTimers.delete(gameId);
    }
  }

  private _getTurnTimer(gameId: number) {
    return this.turnTimers.get(gameId);
  }

  private _sendOpponentInfo(playerId: number, matchId: number, name: string) {
    const socketId = this.matchmaker.getSocketId(playerId);
    this.server.to(socketId).emit('caro:opponent', { matchId, name });
  }

  private _sendState(
    matchId: number,
    player: PlayerInterface,
    state: StateInterface,
    timeRemain: number,
    size?: number,
    time?: number,
  ) {
    const socketId = this.matchmaker.getSocketId(player.id);
    const clientState: ClientStateInterface = {
      matchId,
      board: state.board,
      turn: state.currentTurn,
      userSymbol: player.symbol,
      timeRemain,
      size,
      time,
    };
    this.server.to(socketId).emit('caro:state', clientState);
  }

  private _sendMatchFound(playerId: number, matchId: number) {
    const socketId = this.matchmaker.getSocketId(playerId);
    this.server.to(socketId).emit('caro:found', { matchId });
  }

  private _sendGameResult(
    playerId: number,
    matchId: number,
    result: 'win' | 'lose' | 'draw',
    state: StateInterface,
  ) {
    try {
      const socketId = this.matchmaker.getSocketId(playerId);
      this.server
        .to(socketId)
        .emit(`caro:${result}`, { matchId, board: state.board });
    } catch (err) {
      // Có thể log lại hoặc bỏ qua
      console.warn(
        `Không thể gửi kết quả "${result}" cho player ${playerId}`,
        err,
      );
    }
  }

  private _sendContinue(playerId: number, matchId: number) {
    const socketId = this.matchmaker.getSocketId(playerId);
    this.server.to(socketId).emit('caro:continue', { matchId });
  }
}

interface TurnTimer {
  timeout: NodeJS.Timeout;
  expiresAt: number; // timestamp ms khi timeout sẽ trigger
}
