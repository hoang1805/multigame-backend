import { IsNumber, Min } from 'class-validator';

export class MoveDto {
  @IsNumber()
  matchId: number;

  @IsNumber()
  @Min(0)
  row: number;

  @IsNumber()
  @Min(0)
  col: number;
}
