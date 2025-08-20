import { IsNumber } from 'class-validator';

export class JoinDto {
  @IsNumber()
  matchId: number;
}
