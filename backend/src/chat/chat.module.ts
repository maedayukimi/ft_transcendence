import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { Chatroom } from './chat.entity';
import { ChatService } from './chat.service';
import { Message } from './massge.entity';
import { AuthModule } from '../api/auth/auth.module';
import { UsersModule } from '../api/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chatroom, Message]),
    AuthModule,
    UsersModule
  ],
  providers: [ChatGateway, ChatService]
})
export class ChatModule {}
