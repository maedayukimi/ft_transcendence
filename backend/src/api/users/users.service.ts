import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { User } from '../auth/user.entity';
import { Friend } from './friend.entity';
import { MatchResult } from './match-result.entity';
import {
  aggregateByUser,
  aggregateForUser,
  calculateProgression,
  evaluateAchievements,
  rankPlayers,
} from './stats.domain';
import type { GameState } from '../../werewolf/werewolf.types';

const UNKNOWN_USER_NAME = '(不明なユーザー)';
const LEADERBOARD_LIMIT = 20;

export interface HistoryOpponent {
  userId: number;
  userName: string;
  finalRole: string;
  won: boolean;
}

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
    const aggregate = aggregateForUser(matches, targetUserId);

    const friendStatus = await this.getFriendStatus(viewerUserId, targetUserId);

    return {
      userId: user.userId,
      userName: user.userName,
      timeStamp: user.timeStamp,
      stats: {
        gamesPlayed: aggregate.gamesPlayed,
        wins: aggregate.wins,
        losses: aggregate.losses,
      },
      // Game statistics モジュール用。順位は全プレイヤー中の位置(0 戦なら null)、
      // レベルと達成は MatchResult から毎回導出する(DB には持たない)。
      rank: await this.findRank(targetUserId),
      progression: calculateProgression(aggregate),
      achievements: evaluateAchievements(matches),
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
    if (matches.length === 0) return [];

    // 同じ試合(matchId)の他プレイヤー行を引いて対戦相手にする。
    // gameId は再戦で使い回されるため、試合の識別には matchId を使う。
    const participants = await this.matchResultRepository.find({
      where: { matchId: In(matches.map((m) => m.matchId)) },
    });
    const others = participants.filter((row) => row.userId !== targetUserId);
    const nameByUserId = await this.userNamesById(others.map((row) => row.userId));
    const opponentsByMatchId = new Map<string, HistoryOpponent[]>();
    for (const row of others) {
      const list = opponentsByMatchId.get(row.matchId) ?? [];
      list.push({
        userId: row.userId,
        userName: nameByUserId.get(row.userId) ?? UNKNOWN_USER_NAME,
        finalRole: row.finalRole,
        won: row.won,
      });
      opponentsByMatchId.set(row.matchId, list);
    }

    return matches.map((m) => ({
      matchId: m.matchId,
      gameId: m.gameId,
      finalRole: m.finalRole,
      won: m.won,
      playerCount: m.playerCount,
      timeStamp: m.timeStamp,
      opponents: opponentsByMatchId.get(m.matchId) ?? [],
    }));
  }

  // 勝利数ランキング。データ量が小さいため全行を読んで純粋関数で集計する
  // (規模が増えたら GROUP BY の集計クエリに置き換える)。
  async getLeaderboard(limit = LEADERBOARD_LIMIT) {
    const ranked = rankPlayers(aggregateByUser(await this.matchResultRepository.find())).slice(0, limit);
    const nameByUserId = await this.userNamesById(ranked.map((player) => player.userId));
    return ranked.map((player) => ({
      rank: player.rank,
      userId: player.userId,
      userName: nameByUserId.get(player.userId) ?? UNKNOWN_USER_NAME,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      winRate: player.winRate,
      level: calculateProgression(player).level,
    }));
  }

  private async findRank(userId: number): Promise<number | null> {
    const ranked = rankPlayers(aggregateByUser(await this.matchResultRepository.find()));
    return ranked.find((player) => player.userId === userId)?.rank ?? null;
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
    const nameByUserId = await this.userNamesById(userIds);
    return userIds.map((id) => ({ userId: id, userName: nameByUserId.get(id) ?? UNKNOWN_USER_NAME }));
  }

  // userId -> userName の Map。重複を除いて 1 回のクエリで引く。空なら DB に行かない。
  private async userNamesById(userIds: number[]): Promise<Map<number, string>> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return new Map();
    const users = await this.userRepository.find({ where: { userId: In(uniqueIds) } });
    return new Map(users.map((u) => [u.userId, u.userName]));
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
    // 1 試合の全行に同じ matchId を付け、対戦履歴で「同じ試合の相手」を引けるようにする。
    const matchId = randomUUID();
    const rows = game.players.map((player) => {
      const isWerewolf = player.currentRole === 'WEREWOLF';
      const won = (winner === 'WEREWOLF') === isWerewolf;
      return this.matchResultRepository.create({
        matchId,
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
