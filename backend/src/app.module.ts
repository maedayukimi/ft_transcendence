import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
import { Chatroom } from './chat/chat.entity';
import { Message } from './chat/massge.entity';
import { AuthModule } from './api/auth/auth.module';
import { User } from './api/auth/user.entity';
import { Test2 } from './test2';
import { Test1 } from './test1';
import { WerewolfModule } from './werewolf/werewolf.module';
import { UsersModule } from './api/users/users.module';
import { Friend } from './api/users/friend.entity';
import { MatchResult } from './api/users/match-result.entity';

@Module({
  imports: [
  ConfigModule.forRoot({
    isGlobal: true,
  }),
  ChatModule,
  AuthModule,
  WerewolfModule,
  UsersModule,
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'werewolf-gamedb',
    entities: [Chatroom, Message, User, Friend, MatchResult],
    synchronize: true,
  })],
  controllers: [],
  providers: [],
})
export class AppModule {}
