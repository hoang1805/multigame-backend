import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GameResult, GameType, UserStatus } from '../game.enum';

@Entity({ name: 'game_user' })
export class GameUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'game_id' })
  gameId: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @Column({ type: 'simple-enum', enum: GameResult, nullable: true })
  result: GameResult;

  @Column({
    type: 'simple-enum',
    enum: UserStatus,
    default: UserStatus.WAITING,
  })
  status: UserStatus;

  @Column({ type: 'simple-enum', enum: GameType })
  type: GameType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
