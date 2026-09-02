import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm"
import { Test2 } from "./test2"

@Entity()
export class Test1 {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    url: string

    @ManyToOne(() => Test2)
    user: Test2
}

