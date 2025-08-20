import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { CaroService } from 'src/caro/services/caro.service';
import { EndReasonMulti } from 'src/game/game.enum';
import { CaroState } from '../models/caro.state';

describe('CaroService (AppModule)', () => {
  let service: CaroService;
  let caro: CaroState;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = module.get<CaroService>(CaroService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new game with 2 users', async () => {
    caro = await service.createGame([1, 2]);
    expect(caro).toBeDefined();
    expect(caro.state.players.length).toBe(2);
    expect(caro.state.board.length).toBe(caro.config.size);
  });

  it('should allow a valid move', async () => {
    const move = { userId: caro.state.players[0].id, x: 0, y: 0 };
    const updated = await service.makeMove(caro.id, move);
    expect(updated.state.board[0][0]).not.toBe('');
    expect(updated.state.currentTurn).toBe(
      caro.state.players.find((p) => p.id !== move.userId)?.symbol,
    );
  });

  it('should detect win condition (5 in a row)', () => {
    const config = service.getConfig();
    const size = config.size;
    const board = Array.from({ length: size }, () =>
      Array<string>(size).fill(''),
    );
    for (let i = 0; i < config.winCondition; i++) {
      board[0][i] = 'X';
    }
    const win = service.checkWin(board, 0, 2, config);
    expect(win).toBe(true);
  });

  it('should detect draw when board is full', () => {
    const config = service.getConfig();
    const size = config.size;
    const board = Array.from({ length: size }, () =>
      Array<string>(size).fill('X'),
    );
    const draw = service.checkDraw(board, config);
    expect(draw).toBe(true);
  });

  it('should set a winner', async () => {
    const winnerId = caro.state.players[0].id;

    const ended = await service.setWin(caro.id, winnerId, EndReasonMulti.WIN);
    expect(ended.isFinished).toBe(true);
    expect(ended.winner).toBe(winnerId);
    expect(ended.endReason).toBe(EndReasonMulti.WIN);
  });

  it('should set a draw', async () => {
    const newCaro = await service.createGame([1, 2]);

    const ended = await service.setDraw(newCaro.id);
    expect(ended.isFinished).toBe(true);
    expect(ended.endReason).toBe(EndReasonMulti.DRAW);
  });
});
