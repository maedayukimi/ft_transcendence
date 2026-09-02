import { Chatroom } from "src/chat/chat.entity"
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToMany
} from "typeorm"

@Entity()
export class User {
    @PrimaryGeneratedColumn({name: 'id'})
    userId: number

    @Column({name: 'name', unique: true})
    userName: string

    @Column({name: 'email', unique: true})
    emailAddress: string

    @Column({name: 'password'})
    password: string

    @CreateDateColumn({name: 'time_stamp'})
    timeStamp: Date

    @ManyToMany(() => Chatroom, (chatroom) => chatroom.users)
    chatrooms: Chatroom[]
}