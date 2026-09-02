import { User } from '../api/auth/user.entity';
import { Chatroom } from './chat.entity';
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';

@Entity()
export class Message {
    @PrimaryGeneratedColumn({name: 'id'})
    msgId: number

    @ManyToOne(() => Chatroom)
    @JoinColumn({ name: 'room_id' })
    chatroom: Chatroom

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User

    @Column({name: 'text'})
    text: string

    @CreateDateColumn({name: 'time_stamp'})
    timeStamp: Date
}