import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { Line98Service } from 'src/line98/line98.service';
import { Line98State } from 'src/line98/models/line98.state';
import { EndReasonSingle, GameMode, GameType } from 'src/game/game.enum';
import { GameService } from 'src/game/game.service';

describe('Line98Service (with AppModule)', () => {
  let service: Line98Service;
  let dataSource: DataSource;
  let gameService: GameService;
  let state: Line98State;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = module.get<Line98Service>(Line98Service);
    dataSource = module.get<DataSource>(DataSource);
    gameService = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(dataSource).toBeDefined();
    expect(gameService).toBeDefined();
  });

  it('should create and get a game', async () => {
    state = await service.createGame(1);
    expect(state).toBeDefined();
    expect(state.state.balls.length).toBeGreaterThan(0);

    const found = await service.getGame(state.id);
    expect(found?.gameId).toBe(state.gameId);
  });

  it('should finish game (game over)', async () => {
    const ended = await service.setGameOver(state.id, 1);

    expect(ended.isFinished).toBe(true);
    expect(ended.endReason).toBe(EndReasonSingle.GAME_OVER);
  });
//     const newState = await service.createGame(1);
//     newState.state.balls = [];
//     await dataSource.getRepository(Line98State).save(newState);

//     const result = await service.isGameOver(newState.id);
//     expect(result).toBe(true);
//   });
});
