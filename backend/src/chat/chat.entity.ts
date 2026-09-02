import { User } from 'src/api/auth/user.entity';
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToMany,
    JoinTable,
} from 'typeorm';

@Entity()
export class Chatroom {
    @PrimaryGeneratedColumn("uuid", {name: 'id'})
    roomId: string;

    @Column({name: 'save'})
    save: boolean;

    @Column({name: 'room_name'})
    roomName: string;

    @Column({name: 'room_type'})
    roomType: string;

    @CreateDateColumn()
    timeStamp: Date;

    @ManyToMany(() => User, (user) => user.chatrooms)
    @JoinTable({
        name: 'chatroom_users',
        joinColumn: {
            name: 'chatroom_id',
            referencedColumnName: 'roomId'
        },
        inverseJoinColumn: {
            name: 'user_id',
            referencedColumnName: 'userId'
        }
    })
    users: User[]
}