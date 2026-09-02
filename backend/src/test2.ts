import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from "typeorm"
import { Test1 } from "./test1"
import { DataSource } from "typeorm"

@Entity()
export class Test2 {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    name: string

    @OneToOne(() => Test1)
    @JoinColumn()
    profile:Test2
}
