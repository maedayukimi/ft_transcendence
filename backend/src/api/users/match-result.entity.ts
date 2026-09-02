import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Generated,
} from 'typeorm';

@Entity()
export class MatchResult {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  // 1 試合ごとの識別子。gameId は再戦で使い回されるため、
  // 「同じ試合の参加者」はこの列で引く。DB 既定値(uuid)を持たせておくことで、
  // 既存行のあるテーブルにも synchronize で列を追加できる。
  @Column({ name: 'match_id', type: 'uuid' })
  @Generated('uuid')
  matchId: string;

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
