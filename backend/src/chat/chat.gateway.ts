import {
  SubscribeMessage,
  WebSocketGateway,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { AuthService } from 'src/api/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../api/users/users.service';

// WebSocket経由の入力はHTTPのDTO(class-validator)を通らないため、
// ハンドラ内で明示的に検証する。フロントのHTML5バリデーションは迂回できる前提で扱う。
const MESSAGE_MAX_LENGTH = 2000;
const ROOM_NAME_MAX_LENGTH = 50;
const USER_NAME_MAX_LENGTH = 20;

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}
  @WebSocketServer()
  server: Server;

  // Socket接続時に自動で呼ばれる
  async handleConnection(socket: Socket) {
    try {
      // CookieからJWTトークンを取得
      const token = socket.handshake.headers.cookie
        ?.split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        this.logger.warn(`Socket ${socket.id}: トークンなし`);
        socket.disconnect();
        return;
      }

      // JWTを検証してペイロードを取得
      const payload = await this.jwtService.verifyAsync(token);

      // socket.dataにユーザー情報を保存
      socket.data.userId = payload.sub;
      socket.data.userName = payload.name;

      this.logger.log(`Socket ${socket.id} connected: userId=${payload.sub}, userName=${payload.name}`);
    } catch (e) {
      this.logger.error(`Socket ${socket.id}: 認証失敗 - ${e.message}`);
      socket.disconnect();
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket
  ) {
    // ルームの参加者本人でなければ、roomIdを知っているだけで
    // 覗き見/書き込みできてしまわないようにする。
    const isMember = await this.chatService.isMember(roomId, socket.data.userId);
    if (!isMember) {
      this.logger.warn(`Socket ${socket.id} (userId: ${socket.data.userId}) tried to join room ${roomId} without membership`);
      return { success: false, error: 'このルームには参加できません。' };
    }
    socket.join(roomId);
    this.logger.log(`Socket ${socket.id} (userId: ${socket.data.userId}) joined room ${roomId}`);
    return { success: true, roomId };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket
  ) {
    socket.leave(roomId);
    this.logger.log(`Socket ${socket.id} (userId: ${socket.data.userId}) left room ${roomId}`);
    return { success: true, roomId };
  }

  @SubscribeMessage('getAllMessage')
  async handleGetAllMessage(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket,
  ) {
     const isMember = await this.chatService.isMember(roomId, socket.data.userId);
     if (!isMember) return [];
     return this.chatService.getAllMessage(roomId) || [];
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: {roomId: string, text: string},
    @ConnectedSocket() socket: Socket
  ) {
    const { roomId, text } = data;

    // socket.dataから認証済みユーザー情報を取得
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    if (!userId || !userName) {
      this.logger.error(`Socket ${socket.id}: ユーザー情報なし`);
      return { error: '認証エラー' };
    }

    if (typeof roomId !== 'string' || roomId.length === 0) {
      return { error: 'ルームが指定されていません。' };
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      return { error: 'メッセージが空です。' };
    }
    if (text.length > MESSAGE_MAX_LENGTH) {
      return { error: `メッセージは${MESSAGE_MAX_LENGTH}文字以内で入力してください。` };
    }

    const isMember = await this.chatService.isMember(roomId, userId);
    if (!isMember) {
      this.logger.warn(`Socket ${socket.id} (userId: ${userId}) tried to send to room ${roomId} without membership`);
      return { error: 'このルームには参加していません。' };
    }

    try {
      // メッセージをDBに保存（引数の順番: roomId, userId, text）
      const result = await this.chatService.registerMessage(roomId, userId, text.trim());

      // 同じroomの全ユーザーにブロードキャスト（送信者を含む）
      this.server.to(roomId).emit('receivedMessage', {
        msgId: result.msgId,
        userId: result.userId,
        userName: result.userName,
        text: result.text,
        timeStamp: result.timeStamp,
        roomId: result.roomId
      });

      this.logger.log(`Message sent: ${userName} in room ${roomId}`);

      // 送信者に確認を返す
      return {
        msgId: result.msgId,
        userId: result.userId,
        userName: result.userName,
        text: result.text,
        timeStamp: result.timeStamp,
        roomId: result.roomId
      };
    } catch (e) {
      this.logger.error(`sendMessage error: ${e.message}`);
      return { error: 'メッセージ送信失敗' };
    }
  }
  // @SubscribeMessage('update')
  // async handleMessage(
  //   @MessageBody() text: string,
  //   @ConnectedSocket() socket: Socket
  // ) {
  //   const result = await this.chatService.registerMessage(userId, userName, text, roomId);
  //   if (result.text) {
      
  //   }
  //   // return {
  //   //   msgId: result.msgId,
  //   //   userId: result.userId,
  //   //   userName: result.userName,
  //   //   text: result.text,
  //   //   roomId: result.roomId
  //   // };
  // }
  
  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody() data: {targetUserNames: string[], roomName: string, roomType: string},
    @ConnectedSocket() socket: Socket,
  ) {
    const { roomName, roomType } = data;
    // 招待は必ずユーザー名で行う。生のuserIdを直接知っている前提のUIは非現実的で、
    // 実際には相手の名前を入力していたため常にnull/NaN扱いになり弾かれていた。
    // 作成者自身のIDは信頼できる認証済みsocket.dataから取り、クライアントの自己申告に頼らない。
    const creatorUserId: number = socket.data.userId;
    const creatorUserName: string = socket.data.userName;
    const targetUserNames = [...new Set((data.targetUserNames ?? []).map((n) => n.trim()).filter((n) => n.length > 0))];

    if (targetUserNames.length === 0) {
      return {
        save: false, roomId: '', userNames: [], otherUserName: null,
        roomName: '', roomType: '', error: '招待する相手のユーザー名を入力してください。',
      };
    }

    if (roomType !== 'private' && roomType !== 'group') {
      return {
        save: false, roomId: '', userNames: [], otherUserName: null,
        roomName: '', roomType: '', error: 'ルームの種類が不正です。',
      };
    }
    if (targetUserNames.some((n) => n.length > USER_NAME_MAX_LENGTH)) {
      return {
        save: false, roomId: '', userNames: [], otherUserName: null,
        roomName: '', roomType: '', error: `ユーザー名は${USER_NAME_MAX_LENGTH}文字以内です。`,
      };
    }
    // グループ名はprivateルームでは使わない(相手の名前を表示する)ので、groupのみ必須。
    if (roomType === 'group') {
      if (typeof roomName !== 'string' || roomName.trim().length === 0) {
        return {
          save: false, roomId: '', userNames: [], otherUserName: null,
          roomName: '', roomType: '', error: 'グループ名を入力してください。',
        };
      }
      if (roomName.length > ROOM_NAME_MAX_LENGTH) {
        return {
          save: false, roomId: '', userNames: [], otherUserName: null,
          roomName: '', roomType: '', error: `グループ名は${ROOM_NAME_MAX_LENGTH}文字以内で入力してください。`,
        };
      }
    }

    const { found, missing } = await this.chatService.resolveUserNames(targetUserNames);
    if (missing.length > 0) {
      this.logger.log(`createRoom: unknown usernames ${JSON.stringify(missing)}`);
      return {
        save: false, roomId: '', userNames: [], otherUserName: null,
        roomName: '', roomType: '', error: `ユーザーが見つかりません: ${missing.join(', ')}`,
      };
    }

    const userIds = [creatorUserId, ...found.map((u) => u.userId)];
    const nameByUserId = new Map<number, string>([[creatorUserId, creatorUserName], ...found.map((u): [number, string] => [u.userId, u.userName])]);
    this.logger.log(`room is ${userIds}, ${roomType}, ${roomName}`);

    const result = await this.chatService.createRoom(userIds, roomName, roomType);
    if (!result.save) {
      return {
        save: false, roomId: '', userNames: [], otherUserName: null,
        roomName: '', roomType: '', error: 'このメンバーとのチャットは既に存在するか、作成できませんでした。',
      };
    }

    const userNames = userIds.map((id) => nameByUserId.get(id) ?? '');

    socket.join(result.roomId);
    // 招待対象はuserIdsに含まれる本人だけ。ここをcreator以外の"接続中の全員"に
    // していたのが、無関係な第三者が勝手にprivateルームへjoinさせられてしまう
    // (=他人のチャットが見えてしまう)直接の原因だった。
    const invitedUserIds = found.map((u) => u.userId);
    const sockets = (await this.server.fetchSockets()).filter((s) => invitedUserIds.includes(s.data.userId));

    sockets.forEach((invitedSocket) => {
      invitedSocket.join(result.roomId);
      const otherUserName = nameByUserId.get(creatorUserId) ?? null;
      invitedSocket.emit('joinRoom', {
        roomId: result.roomId,
        userNames,
        otherUserName,
        roomName: result.roomName,
        roomType: result.roomType,
      });
    });

    const otherUserName = roomType === 'private'
      ? nameByUserId.get(invitedUserIds[0]) ?? null
      : null;

    return {
      save: result.save,
      roomId: result.roomId,
      userNames,
      otherUserName,
      roomName: result.roomName,
      roomType: result.roomType,
    };
  }

  @SubscribeMessage('getAllRoom')
  async handlegetAllRoom(
    @MessageBody() currentUserId: number,
    @ConnectedSocket() socket: Socket,
  ) {
    this.logger.log(`getAllRoom called by ${socket.id}, userId: ${currentUserId}`);
    const rooms = await this.chatService.getAllRoom(currentUserId);

    const roomsWithUserNames = rooms.map(room => {
      const userNames = room.users.map(u => u.userName);
      // privateルームの表示名は「相手」の名前を直接引く。並び順には依存しない。
      const otherUserName = room.roomType === 'private'
        ? room.users.find((u) => u.userId !== currentUserId)?.userName ?? null
        : null;

      return {
        roomId: room.roomId,
        save: room.save,
        roomName: room.roomName,
        roomType: room.roomType,
        userNames,
        otherUserName,
      };
    });

    this.logger.log(`Returning ${roomsWithUserNames.length} rooms`);
    return roomsWithUserNames;
  }

  @SubscribeMessage('login')
  async handleLogin(
    @MessageBody() data: { userId: number, userName: string },
    @ConnectedSocket() socket: Socket
  ) {
    socket.data.userId = data.userId;
    socket.data.userName = data.userName;
    this.logger.log(`User ${data.userName} logged in`);
  }

  @SubscribeMessage('inviteUser')
  async handlegetInviteUser(
    @MessageBody() data: {
      userId: number,
      save: boolean,
      roomId: string,
      roomName: string,
      roomType: string
    },
    @ConnectedSocket() socket: Socket,
  ) {
    const {userId, roomId, roomName, save, roomType } = data;
    this.logger.log(`getAllRoom called by ${socket.id}`);
    const sockets = await this.server.fetchSockets();
    const targetSockt = sockets.find((socket) => socket.data.userId === userId );
    if (targetSockt) {
      targetSockt.emit('reciveUser', { save, roomId, roomName, roomType });
      return { success: true };
    }
    return { success: false };
  }
  
  @SubscribeMessage('deleteRoom')
  async handlegetdeleteRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    const isMember = await this.chatService.isMember(roomId, socket.data.userId);
    if (!isMember) {
      this.logger.warn(`Socket ${socket.id} (userId: ${socket.data.userId}) tried to delete room ${roomId} without membership`);
      return { roomId: '', save: false, roomName: '' };
    }
    const result = await this.chatService.deleteRoom(roomId);
    this.logger.log(`deleting room ${roomId}: ${JSON.stringify(result)}`);
    if (result.save) {
      // 削除した本人以外の参加者にも通知する。これをしないと、相手は
      // 実体の無くなったルームを見続け、メッセージ送信で毎回エラーになる。
      this.server.to(roomId).emit('roomDeleted', { roomId });
    }
    return result;
  }

  @SubscribeMessage('inviteToWerewolf')
  async handleInviteToWerewolf(
    @MessageBody() data: { targetUserId: number; gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { targetUserId, gameId } = data;
    // チャットのDM同様、フレンド以外を無関係なゲームに招待できてしまわないよう制限する。
    const friendStatus = await this.usersService.getFriendStatus(socket.data.userId, targetUserId);
    if (friendStatus !== 'FRIENDS') {
      return { success: false, error: 'フレンドのみ招待できます。' };
    }

    const sockets = await this.server.fetchSockets();
    const targetSocket = sockets.find((s) => s.data.userId === targetUserId);
    if (!targetSocket) {
      return { success: false, error: '相手は現在オンラインではありません。' };
    }

    targetSocket.emit('werewolfInvite', {
      gameId,
      fromUserId: socket.data.userId,
      fromUserName: socket.data.userName,
    });
    return { success: true };
  }

  private readonly logger: Logger = new Logger('Gatway Log');
}
