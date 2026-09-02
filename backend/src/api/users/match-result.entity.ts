import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class MatchResult {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'game_id' })
  gameId: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'final_role' })
  finalRole: string;

  @Column({ name: 'won' })
  won: boolean;

  @Column({ name: 'player_count' })
  playerCount: number;

  @CreateDateColumn({ name: 'time_stamp' })
  timeStamp: Date;
}
