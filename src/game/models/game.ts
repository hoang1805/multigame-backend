import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GameMode, GameStatus, GameType } from '../game.enum';

@Entity({ name: 'game' })
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: GameType })
  @Index()
  type: GameType;

  @Column({ type: 'simple-enum', enum: GameMode })
  mode: GameMode;

  @Column({
    type: 'simple-enum',
    enum: GameStatus,
    default: GameStatus.ONGOING,
  })
  @Index()
  status: GameStatus;

  @Column({ type: 'simple-array' })
  users: number[];

  @Column({
    name: 'start_time',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
