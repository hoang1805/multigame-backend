import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as stateInterface from '../interfaces/state.interface';
import * as configInterface from '../interfaces/config.interface';
import { EndReasonMulti } from 'src/game/game.enum';

@Entity({ name: 'caro_state' })
export class CaroState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'game_id' })
  gameId: number;

  @Column({ type: 'simple-json' })
  config: configInterface.ConfigInterface;

  @Column({ type: 'simple-json' })
  state: stateInterface.StateInterface;

  @Column({ name: 'first_player' })
  firstPlayer: number;

  @Column({ nullable: true })
  winner: number;

  @Column({ name: 'is_finished', default: false })
  isFinished: boolean;

  @Column({
    name: 'end_reason',
    type: 'simple-enum',
    enum: EndReasonMulti,
    nullable: true,
  })
  endReason: EndReasonMulti;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
