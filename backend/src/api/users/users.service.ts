import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Friend } from './friend.entity';
import { MatchResult } from './match-result.entity';
import type { GameState } from '../../werewolf/werewolf.types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(MatchResult)
    private readonly matchResultRepository: Repository<MatchResult>,
  ) {}

  async getProfile(targetUserId: number, viewerUserId: number) {
    const user = await this.userRepository.findOneBy({ userId: targetUserId });
    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません。');
    }

    const matches = await this.matchResultRepository.find({
      where: { userId: targetUserId },
    });
    const wins = matches.filter((m) => m.won).length;

    const friendStatus = await this.getFriendStatus(viewerUserId, targetUserId);

    return {
      userId: user.userId,
      userName: user.userName,
      timeStamp: user.timeStamp,
      stats: {
        gamesPlayed: matches.length,
        wins,
        losses: matches.length - wins,
      },
      friendStatus,
      isSelf: targetUserId === viewerUserId,
    };
  }

  // viewerUserIdから見た、targetUserIdとの関係を返す。
  // NONE: 何の関係もない / FRIENDS: 承認済み /
  // REQUEST_SENT: 自分から送って返事待ち / REQUEST_RECEIVED: 相手から届いていて未回答
  async getFriendStatus(
    viewerUserId: number,
    targetUserId: number,
  ): Promise<'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED'> {
    if (viewerUserId === targetUserId) return 'NONE';
    const row = await this.friendRepository.findOne({
      where: [
        { requesterId: viewerUserId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: viewerUserId },
      ],
    });
    if (!row) return 'NONE';
    if (row.status === 'ACCEPTED') return 'FRIENDS';
    return row.requesterId === viewerUserId ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
  }

  async getHistory(targetUserId: number) {
    const matches = await this.matchResultRepository.find({
      where: { userId: targetUserId },
      order: { timeStamp: 'DESC' },
      take: 20,
    });
    return matches.map((m) => ({
      gameId: m.gameId,
      finalRole: m.finalRole,
      won: m.won,
      playerCount: m.playerCount,
      timeStamp: m.timeStamp,
    }));
  }

  // 承認済み(=本当の意味での相互フレンド)の一覧。
  async getFriends(userId: number) {
    const rows = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: 'ACCEPTED' },
        { recipientId: userId, status: 'ACCEPTED' },
      ],
    });
    return this.toUserList(rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId)));
  }

  // 自分宛に届いていて、まだ承認/拒否していない申請の一覧。
  async getPendingRequests(userId: number) {
    const rows = await this.friendRepository.find({
      where: { recipientId: userId, status: 'PENDING' },
    });
    return this.toUserList(rows.map((r) => r.requesterId));
  }

  private async toUserList(userIds: number[]) {
    if (userIds.length === 0) return [];
    const users = await this.userRepository.find({ where: { userId: In(userIds) } });
    const nameByUserId = new Map(users.map((u) => [u.userId, u.userName]));
    return userIds.map((id) => ({ userId: id, userName: nameByUserId.get(id) ?? '(不明なユーザー)' }));
  }

  // フレンド申請を送る。相手が既に自分宛に申請してきていた場合(同時申請)は、
  // 新しい申請を作らずその場で承認済みにして即フレンド成立させる。
  async sendFriendRequest(userId: number, friendUserName: string) {
    const target = await this.userRepository.findOneBy({ userName: friendUserName });
    if (!target) {
      throw new NotFoundException('そのユーザー名は見つかりません。');
    }
    if (target.userId === userId) {
      throw new BadRequestException('自分をフレンドに追加することはできません。');
    }

    const existing = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, recipientId: target.userId },
        { requesterId: target.userId, recipientId: userId },
      ],
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException('既にフレンドです。');
      }
      if (existing.requesterId === userId) {
        throw new BadRequestException('既に申請済みです。相手の返事をお待ちください。');
      }
      // 相手からの申請が既に届いていた = 同時申請。自動的にフレンド成立させる。
      existing.status = 'ACCEPTED';
      await this.friendRepository.save(existing);
      return { status: 'ACCEPTED' as const, userId: target.userId, userName: target.userName };
    }

    await this.friendRepository.save(
      this.friendRepository.create({ requesterId: userId, recipientId: target.userId, status: 'PENDING' }),
    );
    return { status: 'PENDING' as const, userId: target.userId, userName: target.userName };
  }

  async acceptFriendRequest(userId: number, requesterUserId: number) {
    const row = await this.friendRepository.findOne({
      where: { requesterId: requesterUserId, recipientId: userId, status: 'PENDING' },
    });
    if (!row) {
      throw new NotFoundException('該当する申請が見つかりません。');
    }
    row.status = 'ACCEPTED';
    await this.friendRepository.save(row);
  }

  // 関係を消す。状態(申請中/承認済み)や方向を問わず、2人の間の関係を丸ごと解消する
  // ので、フレンド解除・自分が送った申請の取り消し・届いた申請の拒否のどれにも使える。
  async removeFriend(userId: number, otherUserId: number) {
    await this.friendRepository.delete([
      { requesterId: userId, recipientId: otherUserId },
      { requesterId: otherUserId, recipientId: userId },
    ]);
  }

  async recordMatchResult(game: GameState): Promise<void> {
    if (game.result === null) return;
    const { winner } = game.result;
    const rows = game.players.map((player) => {
      const isWerewolf = player.currentRole === 'WEREWOLF';
      const won = (winner === 'WEREWOLF') === isWerewolf;
      return this.matchResultRepository.create({
        gameId: game.id,
        userId: player.userId,
        finalRole: player.currentRole ?? 'VILLAGER',
        won,
        playerCount: game.players.length,
      });
    });
    await this.matchResultRepository.save(rows);
  }
}
