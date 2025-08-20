import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';

class Cell {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class MoveDto {
  @IsNumber()
  matchId: number;

  @Type(() => Cell)
  @ValidateNested()
  from: Cell;

  @Type(() => Cell)
  @ValidateNested()
  to: Cell;
}
