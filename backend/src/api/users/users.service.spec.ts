import type { Repository } from 'typeorm';
import type { GameState } from '../../werewolf/werewolf.types';
import type { User } from '../auth/user.entity';
import type { Friend } from './friend.entity';
import type { MatchResult } from './match-result.entity';
import { UsersService } from './users.service';

type MatchRow = Omit<MatchResult, 'id'>;
type UserRow = Pick<User, 'userId' | 'userName'>;

// TypeORM の In(...) は FindOperator で、value に配列を持つ。モックではそれだけを見る。
interface FindOperatorLike<T> {
  value?: T[];
}

interface MatchWhereLike {
  userId?: number;
  matchId?: FindOperatorLike<string>;
}

function matchRow(
  matchId: string,
  userId: number,
  won: boolean,
  finalRole = 'VILLAGER',
  playerCount = 3,
): MatchRow {
  return {
    matchId,
    gameId: `game-${matchId}`,
    userId,
    finalRole,
    won,
    playerCount,
    timeStamp: new Date('2026-09-01T00:00:00Z'),
  };
}

// Repository をこのテストで使うメソッドだけ手書きでモックする(DB 接続なし)。
function createMatchRepository(rows: MatchRow[]) {
  const find = jest.fn(async (options?: { where?: MatchWhereLike }): Promise<MatchRow[]> => {
    const where = options?.where;
    if (where?.userId !== undefined) {
      return rows.filter((row) => row.userId === where.userId);
    }
    if (where?.matchId?.value) {
      const ids = where.matchId.value;
      return rows.filter((row) => ids.includes(row.matchId));
    }
    return [...rows];
  });
  const create = jest.fn((partial: Partial<MatchResult>) => ({ ...partial }) as MatchResult);
  const save = jest.fn(async (entities: MatchResult[]) => entities);
  return { find, create, save };
}

function createUserRepository(users: UserRow[]) {
  return {
    find: jest.fn(async (options: { where: { userId: FindOperatorLike<number> } }) => {
      const ids = options.where.userId.value ?? [];
      return users.filter((user) => ids.includes(user.userId));
    }),
    findOneBy: jest.fn(
      async (where: { userId?: number }) =>
        users.find((user) => user.userId === where.userId) ?? null,
    ),
  };
}

function createFriendRepository() {
  return { findOne: jest.fn(async () => null) };
}

function createService(rows: MatchRow[], users: UserRow[]) {
  const matchRepository = createMatchRepository(rows);
  const userRepository = createUserRepository(users);
  const friendRepository = createFriendRepository();
  const service = new UsersService(
    userRepository as unknown as Repository<User>,
    friendRepository as unknown as Repository<Friend>,
    matchRepository as unknown as Repository<MatchResult>,
  );
  return { service, matchRepository, userRepository };
}

const USERS: UserRow[] = [
  { userId: 1, userName: 'alice' },
  { userId: 2, userName: 'bob' },
  { userId: 3, userName: 'carol' },
  { userId: 4, userName: 'dave' },
];

describe('UsersService.recordMatchResult', () => {
  it('stores one row per player with a shared matchId and the correct won flag', async () => {
    const { service, matchRepository } = createService([], USERS);
    const game = {
      id: 'game-1',
      players: [
        { userId: 1, userName: 'alice', ready: true, initialRole: 'WEREWOLF', currentRole: 'WEREWOLF' },
        { userId: 2, userName: 'bob', ready: true, initialRole: 'SEER', currentRole: 'SEER' },
        { userId: 3, userName: 'carol', ready: true, initialRole: 'ROBBER', currentRole: 'ROBBER' },
      ],
      result: { winner: 'VILLAGE', execution: { voteCounts: new Map(), executedUserIds: [1] } },
    } as unknown as GameState;

    await service.recordMatchResult(game);

    expect(matchRepository.save).toHaveBeenCalledTimes(1);
    const rows = matchRepository.save.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    const matchIds = new Set(rows.map((row) => row.matchId));
    expect(matchIds.size).toBe(1);
    expect([...matchIds][0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      rows.map((row) => [row.userId, row.won, row.finalRole, row.playerCount, row.gameId]),
    ).toEqual([
      [1, false, 'WEREWOLF', 3, 'game-1'],
      [2, true, 'SEER', 3, 'game-1'],
      [3, true, 'ROBBER', 3, 'game-1'],
    ]);
  });

  it('does nothing when the game has no result', async () => {
    const { service, matchRepository } = createService([], USERS);
    await service.recordMatchResult({ id: 'game-1', players: [], result: null } as unknown as GameState);
    expect(matchRepository.save).not.toHaveBeenCalled();
  });
});

describe('UsersService.getHistory', () => {
  it('attaches the other participants of the same match as opponents', async () => {
    const rows = [
      matchRow('m1', 1, false, 'WEREWOLF'),
      matchRow('m1', 2, true, 'SEER'),
      matchRow('m1', 3, true),
      matchRow('m2', 1, true, 'VILLAGER', 4),
      matchRow('m2', 4, false, 'WEREWOLF', 4),
      matchRow('m3', 2, true),
    ];
    const { service } = createService(rows, USERS);

    const history = await service.getHistory(1);

    expect(history).toHaveLength(2);
    const first = history.find((entry) => entry.matchId === 'm1');
    expect(first).toMatchObject({ gameId: 'game-m1', finalRole: 'WEREWOLF', won: false, playerCount: 3 });
    expect(first?.opponents).toEqual([
      { userId: 2, userName: 'bob', finalRole: 'SEER', won: true },
      { userId: 3, userName: 'carol', finalRole: 'VILLAGER', won: true },
    ]);
    const second = history.find((entry) => entry.matchId === 'm2');
    expect(second).toMatchObject({ gameId: 'game-m2', won: true, playerCount: 4 });
    expect(second?.opponents).toEqual([{ userId: 4, userName: 'dave', finalRole: 'WEREWOLF', won: false }]);
    expect(history.every((entry) => entry.opponents.every((opponent) => opponent.userId !== 1))).toBe(true);
  });

  it('returns an empty list when the user has no matches', async () => {
    const { service, userRepository } = createService([matchRow('m1', 2, true)], USERS);
    expect(await service.getHistory(9)).toEqual([]);
    expect(userRepository.find).not.toHaveBeenCalled();
  });
});

describe('UsersService.getLeaderboard', () => {
  const rows = [
    matchRow('m1', 1, true),
    matchRow('m2', 1, true),
    matchRow('m1', 2, true),
    matchRow('m2', 2, false),
    matchRow('m1', 3, false),
  ];

  it('ranks players by wins and resolves names and levels', async () => {
    const { service } = createService(rows, USERS);
    const board = await service.getLeaderboard();
    expect(board.map((entry) => [entry.rank, entry.userId, entry.userName, entry.wins, entry.losses, entry.level])).toEqual([
      [1, 1, 'alice', 2, 0, 1],
      [2, 2, 'bob', 1, 1, 1],
      [3, 3, 'carol', 0, 1, 1],
    ]);
    expect(board[0].winRate).toBe(1);
    expect(board[1].winRate).toBe(0.5);
  });

  it('respects the limit', async () => {
    const { service } = createService(rows, USERS);
    const board = await service.getLeaderboard(1);
    expect(board).toHaveLength(1);
    expect(board[0].userId).toBe(1);
  });
});

describe('UsersService.getProfile', () => {
  it('includes rank, progression and achievements alongside the existing fields', async () => {
    const rows = [
      matchRow('m1', 1, true),
      matchRow('m2', 1, true),
      matchRow('m1', 2, true, 'SEER'),
      matchRow('m2', 2, false),
    ];
    const { service } = createService(rows, USERS);

    const profile = await service.getProfile(2, 1);

    expect(profile).toMatchObject({
      userId: 2,
      userName: 'bob',
      stats: { gamesPlayed: 2, wins: 1, losses: 1 },
      rank: 2,
      progression: { xp: 35, level: 1, xpIntoLevel: 35, xpForNextLevel: 100 },
      friendStatus: 'NONE',
      isSelf: false,
    });
    expect(profile.achievements.find((achievement) => achievement.id === 'seer_win')?.unlocked).toBe(true);
    expect(profile.achievements.find((achievement) => achievement.id === 'veteran')?.unlocked).toBe(false);
  });

  it('returns rank null for a user without matches', async () => {
    const { service } = createService([matchRow('m1', 1, true)], USERS);
    const profile = await service.getProfile(3, 3);
    expect(profile.rank).toBeNull();
    expect(profile.isSelf).toBe(true);
  });
});
