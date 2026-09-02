import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type FriendStatus = 'PENDING' | 'ACCEPTED';

@Entity()
export class Friend {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  // 申請を送った側
  @Column({ name: 'requester_id' })
  requesterId: number;

  // 申請を受け取った側
  @Column({ name: 'recipient_id' })
  recipientId: number;

  @Column({ name: 'status', default: 'PENDING' })
  status: FriendStatus;

  @CreateDateColumn({ name: 'time_stamp' })
  timeStamp: Date;
}
