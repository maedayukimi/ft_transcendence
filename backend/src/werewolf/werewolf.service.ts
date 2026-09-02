import { Injectable } from '@nestjs/common';
import { DomainError } from './werewolf.errors';
import {
  addPlayer,
  advancePhase,
  createGame,
  createPlayerView,
  removePlayer,
  setPlayerReady,
  startGame,
  submitRobberAction,
  submitSeerAction,
  submitVote,
} from './werewolf.domain';
import type {
  GameState,
  PlayerView,
  RandomSource,
  SeerAction,
} from './werewolf.types';

class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

@Injectable()
export class WerewolfService {
  private readonly games = new Map<string, GameState>();
  private readonly random: RandomSource = new MathRandomSource();

  createGame(gameId: string, userId: number, userName: string): GameState {
    const existing = this.games.get(gameId);
    if (existing !== undefined) {
      if (!existing.players.some((player) => player.userId === userId)) {
        throw new DomainError(
          'GAME_ALREADY_EXISTS',
          'このゲームIDは既に使用されています。',
        );
      }
      // 終了済みゲームへの再作成は「同じメンバーでの再戦」として扱う。
      // そうしないと、同じgameIdは永遠に古い結果を表示し続けてしまう。
      if (existing.phase === 'RESULT') {
        return this.resetToLobby(gameId, existing);
      }
      // 作成者本人のリロード等による再作成は既存ゲームへの再参加として扱う。
      return existing;
    }
    const game = addPlayer(createGame(gameId), userId, userName);
    this.games.set(gameId, game);
    return game;
  }

  restartGame(gameId: string, userId: number): GameState {
    const existing = this.getGame(gameId);
    this.assertHost(existing, userId);
    if (existing.phase !== 'RESULT') {
      throw new DomainError(
        'INVALID_PHASE',
        'ゲームが終了していないため再戦を開始できません。',
      );
    }
    return this.resetToLobby(gameId, existing);
  }

  private resetToLobby(gameId: string, previous: GameState): GameState {
    let fresh = createGame(gameId);
    for (const player of previous.players) {
      fresh = addPlayer(fresh, player.userId, player.userName);
    }
    this.games.set(gameId, fresh);
    return fresh;
  }

  joinGame(gameId: string, userId: number, userName: string): GameState {
    const game = this.getGame(gameId);
    // 既に参加済みのプレイヤーによる再接続(リロード等)は冪等に許可する。
    if (game.players.some((player) => player.userId === userId)) {
      return game;
    }
    const updated = addPlayer(game, userId, userName);
    this.games.set(gameId, updated);
    return updated;
  }

  leaveGame(gameId: string, userId: number): GameState | null {
    const game = this.games.get(gameId);
    if (game === undefined) {
      return null;
    }
    // 既に名簿にいない(二重クリック等)なら何もしない。
    if (!game.players.some((player) => player.userId === userId)) {
      return game;
    }
    if (game.phase === 'RESULT') {
      // ホストが結果画面を離れたら部屋を閉じる。そうしないと終了済みの
      // ゲームがずっとMapに残り続け、gameIdを知っている誰かに
      // 再アクセス/再利用されてしまう。
      const isHost = game.players[0]?.userId === userId;
      if (isHost) {
        this.games.delete(gameId);
        return null;
      }
      // 非ホストが結果画面を離れた場合は名簿から外す。そうしないと、
      // ホストが「もう一度あそぶ」した次のロビーに未準備のまま残ってしまう。
      const withoutPlayer = removePlayer(game, userId);
      this.games.set(gameId, withoutPlayer);
      return withoutPlayer;
    }
    if (game.phase !== 'LOBBY') {
      return game;
    }
    const updated = removePlayer(game, userId);
    if (updated.players.length === 0) {
      this.games.delete(gameId);
      return null;
    }
    this.games.set(gameId, updated);
    return updated;
  }

  // 誰も接続していないゲームを完全に破棄する。進行中フェーズは
  // leaveGame()単体では掃除されない(再接続を待つ設計のため)ので、
  // 「最後の1人が切断した」タイミングでgatewayから呼ばれる想定。
  hasGame(gameId: string): boolean {
    return this.games.has(gameId);
  }

  deleteGame(gameId: string): void {
    this.games.delete(gameId);
  }

  setReady(gameId: string, userId: number, ready: boolean): GameState {
    const updated = setPlayerReady(this.getGame(gameId), userId, ready);
    this.games.set(gameId, updated);
    return updated;
  }

  startGame(gameId: string, userId: number): GameState {
    const game = this.getGame(gameId);
    this.assertHost(game, userId);
    const updated = startGame(game, this.random);
    this.games.set(gameId, updated);
    return updated;
  }

  submitSeerAction(
    gameId: string,
    userId: number,
    action: SeerAction,
  ): GameState {
    const updated = submitSeerAction(this.getGame(gameId), userId, action);
    this.games.set(gameId, updated);
    return updated;
  }

  submitRobberAction(
    gameId: string,
    userId: number,
    targetUserId: number,
  ): GameState {
    const updated = submitRobberAction(
      this.getGame(gameId),
      userId,
      targetUserId,
    );
    this.games.set(gameId, updated);
    return updated;
  }

  advancePhase(gameId: string, userId: number): GameState {
    const game = this.getGame(gameId);
    this.assertHost(game, userId);
    const updated = advancePhase(game);
    this.games.set(gameId, updated);
    return updated;
  }

  submitVote(gameId: string, voterUserId: number, targetUserId: number): GameState {
    const updated = submitVote(this.getGame(gameId), voterUserId, targetUserId);
    this.games.set(gameId, updated);
    return updated;
  }

  // 進行操作(開始・フェーズ送り・再戦)はホスト(名簿の先頭)だけに許可する。
  // フロントはホスト以外にボタンを出さないが、gameIdを知っていれば誰でも
  // イベントを送れるため、サーバー側でも必ず検査する。
  private assertHost(game: GameState, userId: number): void {
    const isPlayer = game.players.some((player) => player.userId === userId);
    if (!isPlayer) {
      throw new DomainError(
        'PLAYER_NOT_FOUND',
        'このプレイヤーはゲームに参加していません。',
      );
    }
    if (game.players[0]?.userId !== userId) {
      throw new DomainError(
        'UNAUTHORIZED_ACTION',
        'この操作はホストのみ実行できます。',
      );
    }
  }

  getGame(gameId: string): GameState {
    const game = this.games.get(gameId);
    if (game === undefined) {
      throw new DomainError('GAME_NOT_FOUND', 'ゲームが見つかりません。');
    }
    return game;
  }

  createPlayerView(gameId: string, userId: number): PlayerView {
    return createPlayerView(this.getGame(gameId), userId);
  }
}
