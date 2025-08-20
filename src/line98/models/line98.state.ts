import { EndReasonSingle } from 'src/game/game.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as configInterface from '../interfaces/config.interface';
import * as stateInterface from '../interfaces/state.interface';

@Entity({ name: 'line98_state' })
export class Line98State {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'game_id' })
  gameId: number;

  @Column({ default: 0 })
  score: number;

  @Column({
    type: 'simple-enum',
    name: 'end_reason',
    nullable: true,
    enum: EndReasonSingle,
  })
  endReason: EndReasonSingle;

  @Column({ name: 'is_finished', default: false })
  isFinished: boolean;

  @Column({ type: 'simple-json' })
  config: configInterface.ConfigInterface;

  @Column({ type: 'simple-json' })
  state: stateInterface.StateInterface;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
