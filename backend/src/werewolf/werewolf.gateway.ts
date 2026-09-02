import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { WerewolfService } from './werewolf.service';
import { DomainError } from './werewolf.errors';
import type { SeerAction } from './werewolf.types';
import { UsersService } from '../api/users/users.service';

const GAME_ID_MAX_LENGTH = 50;

@WebSocketGateway({
  namespace: '/werewolf',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class WerewolfGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly werewolfService: WerewolfService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('WerewolfGateway');

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.headers.cookie
        ?.split('; ')
        .find((row) => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        this.logger.warn(`Socket ${socket.id}: トークンなし`);
        socket.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      socket.data.userId = payload.sub;
      socket.data.userName = payload.name;
    } catch (e) {
      this.logger.error(`Socket ${socket.id}: 認証失敗 - ${e.message}`);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const gameId = socket.data.gameId;
    if (!gameId) return;
    const updated = this.werewolfService.leaveGame(gameId, socket.data.userId);
    if (updated) {
      await this.broadcastState(gameId);
    }

    // leaveGame()は進行中フェーズ(ROLE_REVEAL〜VOTING)ではあえて何もしない
    // (再接続を待つため)。しかしそれだと、全員が二度と戻らずに切断した
    // 進行中ゲームがMapに永久に残り続け、メモリリークになる。
    // 「このgameIdの部屋に誰も接続していない」ことを最後の切断のたびに
    // 確認し、その場合は無条件でゲームを破棄する。
    if (this.werewolfService.hasGame(gameId)) {
      const remaining = await this.server.in(gameId).fetchSockets();
      if (remaining.length === 0) {
        this.werewolfService.deleteGame(gameId);
      }
    }
  }

  @SubscribeMessage('createGame')
  async handleCreateGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.createGame(
        data.gameId,
        socket.data.userId,
        socket.data.userName,
      ),
    );
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.joinGame(
        data.gameId,
        socket.data.userId,
        socket.data.userName,
      ),
    );
  }

  @SubscribeMessage('setReady')
  async handleSetReady(
    @MessageBody() data: { gameId: string; ready: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.setReady(data.gameId, socket.data.userId, data.ready),
    );
  }

  @SubscribeMessage('startGame')
  async handleStartGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.startGame(data.gameId, socket.data.userId),
    );
  }

  @SubscribeMessage('restartGame')
  async handleRestartGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.restartGame(data.gameId, socket.data.userId),
    );
  }

  @SubscribeMessage('seerAction')
  async handleSeerAction(
    @MessageBody() data: { gameId: string; action: SeerAction },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.submitSeerAction(
        data.gameId,
        socket.data.userId,
        data.action,
      ),
    );
  }

  @SubscribeMessage('robberAction')
  async handleRobberAction(
    @MessageBody() data: { gameId: string; targetUserId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.submitRobberAction(
        data.gameId,
        socket.data.userId,
        data.targetUserId,
      ),
    );
  }

  @SubscribeMessage('advancePhase')
  async handleAdvancePhase(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, async () => {
      const updated = this.werewolfService.advancePhase(data.gameId, socket.data.userId);
      if (updated.phase === 'RESULT') {
        // Game statistics/match historyモジュール用に、結果確定の瞬間に1回だけ記録する。
        await this.usersService.recordMatchResult(updated);
      }
      return updated;
    });
  }

  @SubscribeMessage('vote')
  async handleVote(
    @MessageBody() data: { gameId: string; targetUserId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    return this.run(socket, data.gameId, () =>
      this.werewolfService.submitVote(
        data.gameId,
        socket.data.userId,
        data.targetUserId,
      ),
    );
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    this.werewolfService.leaveGame(data.gameId, socket.data.userId);
    socket.leave(data.gameId);
    socket.data.gameId = undefined;
    await this.broadcastState(data.gameId);
    return { success: true };
  }

  // 全アクションで共通のパターン(ドメイン操作 -> ルーム参加 -> 各プレイヤーへ個別viewを配信)を1箇所にまとめる。
  private async run(
    socket: Socket,
    gameId: string,
    action: () => unknown | Promise<unknown>,
  ): Promise<{ success: true } | { success: false; code: string; message: string }> {
    // gameIdはクライアントが自由に入力する文字列で、そのままSocket.IOのルーム名に
    // なる。全ハンドラがここを通るので、入口で一度だけ検証しておく。
    if (typeof gameId !== 'string' || gameId.trim().length === 0) {
      return { success: false, code: 'INVALID_GAME_ID', message: 'ゲームIDを入力してください。' };
    }
    if (gameId.length > GAME_ID_MAX_LENGTH) {
      return {
        success: false,
        code: 'INVALID_GAME_ID',
        message: `ゲームIDは${GAME_ID_MAX_LENGTH}文字以内で入力してください。`,
      };
    }

    try {
      await action();
      socket.data.gameId = gameId;
      await socket.join(gameId);
      await this.broadcastState(gameId);
      return { success: true };
    } catch (e) {
      if (e instanceof DomainError) {
        return { success: false, code: e.code, message: e.message };
      }
      this.logger.error(`Unexpected error: ${e.message}`);
      return { success: false, code: 'INTERNAL_ERROR', message: '予期しないエラーが発生しました。' };
    }
  }

  private async broadcastState(gameId: string) {
    const sockets = await this.server.in(gameId).fetchSockets();
    for (const remoteSocket of sockets) {
      try {
        const view = this.werewolfService.createPlayerView(
          gameId,
          remoteSocket.data.userId,
        );
        remoteSocket.emit('state', view);
      } catch (e) {
        this.logger.warn(`broadcastState failed for ${remoteSocket.id}: ${e.message}`);
      }
    }
  }
}
