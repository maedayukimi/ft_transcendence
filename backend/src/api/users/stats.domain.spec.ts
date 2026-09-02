import {
  aggregateByUser,
  aggregateForUser,
  calculateProgression,
  evaluateAchievements,
  rankPlayers,
  XP_PER_GAME,
  XP_PER_LEVEL,
  XP_PER_WIN,
} from './stats.domain';
import type { MatchRecord, PlayerAggregate } from './stats.domain';

let sequence = 0;

function record(
  userId: number,
  won: boolean,
  overrides: Partial<Pick<MatchRecord, 'finalRole' | 'playerCount' | 'matchId'>> = {},
): MatchRecord {
  sequence += 1;
  return {
    matchId: overrides.matchId ?? `match-${sequence}`,
    gameId: 'game',
    userId,
    finalRole: overrides.finalRole ?? 'VILLAGER',
    won,
    playerCount: overrides.playerCount ?? 3,
    timeStamp: new Date('2026-09-01T00:00:00Z'),
  };
}

function records(userId: number, wins: number, losses: number): MatchRecord[] {
  return [
    ...Array.from({ length: wins }, () => record(userId, true)),
    ...Array.from({ length: losses }, () => record(userId, false)),
  ];
}

function aggregate(userId: number, gamesPlayed: number, wins: number): PlayerAggregate {
  return {
    userId,
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    winRate: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
  };
}

describe('aggregateForUser', () => {
  it('returns zeros for a user without records', () => {
    expect(aggregateForUser([], 1)).toEqual(aggregate(1, 0, 0));
  });

  it('counts only the given user', () => {
    const all = [...records(1, 2, 1), ...records(2, 5, 0)];
    expect(aggregateForUser(all, 1)).toEqual(aggregate(1, 3, 2));
    expect(aggregateForUser(all, 2)).toEqual(aggregate(2, 5, 5));
  });
});

describe('aggregateByUser', () => {
  it('returns an empty list for no records', () => {
    expect(aggregateByUser([])).toEqual([]);
  });

  it('groups records per user', () => {
    const all = [...records(1, 1, 1), ...records(2, 0, 3)];
    const result = aggregateByUser(all);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(aggregate(1, 2, 1));
    expect(result).toContainEqual(aggregate(2, 3, 0));
  });
});

describe('calculateProgression', () => {
  it('starts at level 1 with no xp', () => {
    expect(calculateProgression(aggregate(1, 0, 0))).toEqual({
      xp: 0,
      level: 1,
      xpIntoLevel: 0,
      xpForNextLevel: XP_PER_LEVEL,
    });
  });

  it('awards xp per game and per win', () => {
    const progression = calculateProgression(aggregate(1, 4, 2));
    expect(progression.xp).toBe(4 * XP_PER_GAME + 2 * XP_PER_WIN);
    expect(progression.level).toBe(1);
    expect(progression.xpIntoLevel).toBe(progression.xp);
  });

  it('levels up every XP_PER_LEVEL xp', () => {
    // 7 戦 3 勝 = 70 + 45 = 115 xp
    expect(calculateProgression(aggregate(1, 7, 3))).toEqual({
      xp: 115,
      level: 2,
      xpIntoLevel: 15,
      xpForNextLevel: XP_PER_LEVEL,
    });
  });
});

describe('evaluateAchievements', () => {
  const byId = (list: ReturnType<typeof evaluateAchievements>) =>
    new Map(list.map((achievement) => [achievement.id, achievement]));

  it('lists all eight achievements locked for a new player', () => {
    const list = evaluateAchievements([]);
    expect(list.map((achievement) => achievement.id)).toEqual([
      'first_game',
      'veteran',
      'first_win',
      'champion',
      'werewolf_win',
      'seer_win',
      'robber_win',
      'full_table_win',
    ]);
    expect(list.every((achievement) => !achievement.unlocked)).toBe(true);
    expect(list.every((achievement) => achievement.current === 0)).toBe(true);
  });

  it('unlocks play-count achievements at the boundary', () => {
    const nine = byId(evaluateAchievements(records(1, 0, 9)));
    expect(nine.get('first_game')).toMatchObject({ unlocked: true, current: 1, target: 1 });
    expect(nine.get('veteran')).toMatchObject({ unlocked: false, current: 9, target: 10 });

    const ten = byId(evaluateAchievements(records(1, 0, 10)));
    expect(ten.get('veteran')).toMatchObject({ unlocked: true, current: 10, target: 10 });
  });

  it('caps current at the target', () => {
    const many = byId(evaluateAchievements(records(1, 7, 5)));
    expect(many.get('first_game')?.current).toBe(1);
    expect(many.get('first_win')?.current).toBe(1);
    expect(many.get('champion')).toMatchObject({ unlocked: true, current: 5, target: 5 });
  });

  it('unlocks role and table-size achievements only on wins', () => {
    const list = byId(
      evaluateAchievements([
        record(1, true, { finalRole: 'WEREWOLF' }),
        record(1, false, { finalRole: 'SEER' }),
        record(1, true, { finalRole: 'ROBBER', playerCount: 5 }),
      ]),
    );
    expect(list.get('werewolf_win')?.unlocked).toBe(true);
    expect(list.get('seer_win')).toMatchObject({ unlocked: false, current: 0 });
    expect(list.get('robber_win')?.unlocked).toBe(true);
    expect(list.get('full_table_win')?.unlocked).toBe(true);
  });
});

describe('rankPlayers', () => {
  it('returns an empty list for no players', () => {
    expect(rankPlayers([])).toEqual([]);
  });

  it('orders by wins, then win rate, then games played, then userId', () => {
    const ranked = rankPlayers([
      aggregate(10, 4, 2), // 2 勝, 勝率 0.5
      aggregate(11, 2, 2), // 2 勝, 勝率 1.0
      aggregate(12, 6, 3), // 3 勝
      aggregate(13, 8, 2), // 2 勝, 勝率 0.25
      aggregate(14, 4, 2), // 2 勝, 勝率 0.5, 10 と同点 -> userId 昇順
    ]);
    expect(ranked.map((player) => [player.rank, player.userId])).toEqual([
      [1, 12],
      [2, 11],
      [3, 10],
      [4, 14],
      [5, 13],
    ]);
  });

  it('does not mutate the input', () => {
    const input = [aggregate(1, 1, 0), aggregate(2, 1, 1)];
    const copy = [...input];
    rankPlayers(input);
    expect(input).toEqual(copy);
  });
});
