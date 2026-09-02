import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Chatroom } from './chat.entity';
import { User } from '../api/auth/user.entity';
import { Logger } from '@nestjs/common';
import { Message } from './massge.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chatroom)
    private ChatRepository: Repository<Chatroom>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async registerMessage(
    roomId: string,
    userId: number,
    text: string
  ) {
    try {
      // Chatroom と User を取得
      const chatroom = await this.ChatRepository.findOne({
        where: { roomId }
      });
      const user = await this.userRepository.findOne({
        where: { userId }
      });

      if (!chatroom || !user) {
        throw new Error('Room or User not found');
      }

      // Message を保存（relation使用）
      const message = this.messageRepository.create({
        chatroom: chatroom,
        user: user,
        text: text
      });

      const result = await this.messageRepository.save(message);

      if (!result)
        throw new Error('保存失敗');

      return {
        msgId: result.msgId,
        userId: result.user.userId,
        userName: result.user.userName,
        text: result.text,
        timeStamp: result.timeStamp,
        roomId: result.chatroom.roomId
      }
    } catch (e) {
      this.logger.log(`registerMessage: ${e.message}`);
      throw e;
    }
  }

  async getAllMessage(roomId: string) {
    try {
      const messages = await this.messageRepository.find({
        where: { chatroom: {roomId: roomId }},
        relations: {
          chatroom: true,
          user: true,
        },
        order: {
          timeStamp: 'ASC',
        },
      });
      if (!messages)
        throw new Error('メッセージがない');
      // registerMessage()と同じフラットな形に揃える。
      // ネストしたまま返すとフロントのMessage型(msg.userName等)と噛み合わない。
      return messages.map((message) => ({
        msgId: message.msgId,
        userId: message.user.userId,
        userName: message.user.userName,
        text: message.text,
        timeStamp: message.timeStamp,
        roomId: message.chatroom.roomId,
      }));
    } catch(e) {
      this.logger.log(e.massage);
    }
  }

  async getAllRoom(userId: number) {
    try {
      const user = await this.userRepository.findOne({
        where: { userId },
        relations: {
          chatrooms: {
            users: true
          }
        }
    });
      return user?.chatrooms || [];
    } catch (e) {
      this.logger.log(`getAllRoom: ${e.message}`);
      return [];
    }
  }

  async createRoom(userIds: number[], roomName: string, roomType: string) {
    try {
      const uniqueUserIds = [...new Set(userIds)];
      const users = await this.userRepository.find({
        where: {
          userId: In(uniqueUserIds)
        }
      });
      // 指定されたuserIdの誰かが実在しない場合は作成しない。
      if (users.length !== uniqueUserIds.length) {
        this.logger.log(`createRoom: some userIds do not exist (${JSON.stringify(userIds)})`);
        return { roomId: '', save: false, roomName: '', roomType: '' };
      }

      if (roomType === 'private') {
        if (uniqueUserIds.length !== 2) {
          return { roomId: '', save: false, roomName: '', roomType: '' };
        }
        // 同じ2人の組み合わせのprivateルームが既にあれば、それを使い回す
        // (何個も重複作成できてしまうのを防ぐ)。
        const existing = await this.findExistingPrivateRoom(uniqueUserIds[0], uniqueUserIds[1]);
        if (existing) {
          return {
            roomId: existing.roomId,
            save: true,
            roomName: existing.roomName,
            roomType: existing.roomType,
          };
        }
      }

      const chatroom = this.ChatRepository.create({
        save: true,
        roomName: roomName,
        roomType: roomType,
      });
      chatroom.users = users;
      await this.ChatRepository.save(chatroom);
      this.logger.log(`roomName: ${roomName}  save: ${chatroom}`);
      return {
        roomId: chatroom.roomId,
        save: true,
        roomName: chatroom.roomName,
        roomType: chatroom.roomType
      };
    } catch (e) {
      this.logger.log(`createRoom: ${e.message}`);
      return {
        roomId: '',
        save: false,
        roomName: '',
        roomType: ''
      };
    }
  }

  async findExistingPrivateRoom(userIdA: number, userIdB: number): Promise<Chatroom | null> {
    const rooms = await this.ChatRepository.find({
      where: { roomType: 'private' },
      relations: { users: true },
    });
    return rooms.find((room) =>
      room.users.length === 2 &&
      room.users.some((u) => u.userId === userIdA) &&
      room.users.some((u) => u.userId === userIdB)
    ) ?? null;
  }

  async isMember(roomId: string, userId: number): Promise<boolean> {
    const chatroom = await this.ChatRepository.findOne({
      where: { roomId },
      relations: { users: true },
    });
    return chatroom?.users.some((u) => u.userId === userId) ?? false;
  }

  // チャットへの招待はユーザー名で行う(数字のuserIdを直接知っている前提の
  // UIは非現実的で、実際には「相手の名前」を入力していたため常に解決できず
  // 弾かれていた)。存在しない名前があればその一覧を返す。
  async resolveUserNames(userNames: string[]): Promise<{ found: User[]; missing: string[] }> {
    if (userNames.length === 0) return { found: [], missing: [] };
    const found = await this.userRepository.find({ where: { userName: In(userNames) } });
    const foundNames = new Set(found.map((u) => u.userName));
    const missing = userNames.filter((name) => !foundNames.has(name));
    return { found, missing };
  }

  async getOneUser(userId: string) {

  }

  async deleteRoom(roomId: string) {
    try {
      // メッセージが残ったままだと外部キー制約でchatroom本体の削除が失敗し、
      // その例外が握りつぶされて「削除しても何も起きない」ように見えていた。
      // 先に紐づくメッセージを削除してから本体を消す。
      await this.messageRepository
        .createQueryBuilder()
        .delete()
        .where('room_id = :roomId', { roomId })
        .execute();

      const result = await this.ChatRepository.delete(roomId);
      // result.rawはPostgresだと成功時も[]([]は真値)を返すため、
      // 成功判定にはaffectedの件数を見る必要がある。
      if (!result.affected) {
        return { roomId: '', save: false, roomName: '' };
      }
      return { roomId, save: true, roomName: '' };
    } catch(e) {
      this.logger.log(`deleteRoom: ${e.message}`);
      return {
        roomId: '',
        save: false,
        roomName: ''
      };
    }
  }
  private readonly logger :Logger = new Logger('Gatway Log');
}
