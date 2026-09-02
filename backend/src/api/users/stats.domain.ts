// 試合結果(MatchResult)の行から戦績・XP/レベル・達成・順位を導出する純粋関数群。
// DB や Nest に依存しないため、werewolf.domain と同様にユニットテストで振る舞いを固定する。

export interface MatchRecord {
  readonly matchId: string;
  readonly gameId: string;
  readonly userId: number;
  readonly finalRole: string;
  readonly won: boolean;
  readonly playerCount: number;
  readonly timeStamp: Date;
}

export interface PlayerAggregate {
  readonly userId: number;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  /** 0〜1。0 戦のときは 0。 */
  readonly winRate: number;
}

export interface Progression {
  readonly xp: number;
  readonly level: number;
  /** 現在のレベル内で貯まった xp。 */
  readonly xpIntoLevel: number;
  /** 次のレベルに必要な xp(レベル内の満量)。 */
  readonly xpForNextLevel: number;
}

export interface AchievementView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly unlocked: boolean;
  /** 進捗。target を上限にする。 */
  readonly current: number;
  readonly target: number;
}

export interface RankedPlayer extends PlayerAggregate {
  readonly rank: number;
}

export const XP_PER_GAME = 10;
export const XP_PER_WIN = 15;
export const XP_PER_LEVEL = 100;

export function aggregateForUser(
  records: readonly MatchRecord[],
  userId: number,
): PlayerAggregate {
  const own = records.filter((record) => record.userId === userId);
  const wins = own.filter((record) => record.won).length;
  return buildAggregate(userId, own.length, wins);
}

export function aggregateByUser(
  records: readonly MatchRecord[],
): readonly PlayerAggregate[] {
  const counters = new Map<number, { games: number; wins: number }>();
  for (const record of records) {
    const counter = counters.get(record.userId) ?? { games: 0, wins: 0 };
    counters.set(record.userId, {
      games: counter.games + 1,
      wins: counter.wins + (record.won ? 1 : 0),
    });
  }
  return [...counters.entries()].map(([userId, { games, wins }]) =>
    buildAggregate(userId, games, wins),
  );
}

function buildAggregate(
  userId: number,
  gamesPlayed: number,
  wins: number,
): PlayerAggregate {
  return {
    userId,
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    winRate: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
  };
}

// 1 戦ごとに XP_PER_GAME、勝利ごとに XP_PER_WIN を加算し、XP_PER_LEVEL ごとにレベルが上がる。
export function calculateProgression(aggregate: PlayerAggregate): Progression {
  const xp = aggregate.gamesPlayed * XP_PER_GAME + aggregate.wins * XP_PER_WIN;
  return {
    xp,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForNextLevel: XP_PER_LEVEL,
  };
}

interface AchievementRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly target: number;
  readonly measure: (records: readonly MatchRecord[]) => number;
}

const countWhere =
  (predicate: (record: MatchRecord) => boolean) =>
  (records: readonly MatchRecord[]): number =>
    records.filter(predicate).length;

const ACHIEVEMENT_RULES: readonly AchievementRule[] = [
  {
    id: 'first_game',
    title: '初陣',
    description: '人狼ゲームを1回プレイする',
    target: 1,
    measure: (records) => records.length,
  },
  {
    id: 'veteran',
    title: '常連',
    description: '人狼ゲームを10回プレイする',
    target: 10,
    measure: (records) => records.length,
  },
  {
    id: 'first_win',
    title: '初勝利',
    description: '1回勝利する',
    target: 1,
    measure: countWhere((record) => record.won),
  },
  {
    id: 'champion',
    title: '村の英雄',
    description: '5回勝利する',
    target: 5,
    measure: countWhere((record) => record.won),
  },
  {
    id: 'werewolf_win',
    title: '狼の牙',
    description: '人狼として勝利する',
    target: 1,
    measure: countWhere((record) => record.won && record.finalRole === 'WEREWOLF'),
  },
  {
    id: 'seer_win',
    title: '千里眼',
    description: '占い師として勝利する',
    target: 1,
    measure: countWhere((record) => record.won && record.finalRole === 'SEER'),
  },
  {
    id: 'robber_win',
    title: '名怪盗',
    description: '怪盗として勝利する',
    target: 1,
    measure: countWhere((record) => record.won && record.finalRole === 'ROBBER'),
  },
  {
    id: 'full_table_win',
    title: '大舞台',
    description: '5人戦で勝利する',
    target: 1,
    measure: countWhere((record) => record.won && record.playerCount === 5),
  },
];

// 1 ユーザー分の records を渡す。達成は DB に保存せず、毎回ここで導出する。
export function evaluateAchievements(
  records: readonly MatchRecord[],
): readonly AchievementView[] {
  return ACHIEVEMENT_RULES.map((rule) => {
    const measured = rule.measure(records);
    return {
      id: rule.id,
      title: rule.title,
      description: rule.description,
      unlocked: measured >= rule.target,
      current: Math.min(measured, rule.target),
      target: rule.target,
    };
  });
}

// 勝利数 → 勝率 → 対戦数 → userId(昇順) の順で並べ、1 始まりの連番を順位にする。
export function rankPlayers(
  aggregates: readonly PlayerAggregate[],
): readonly RankedPlayer[] {
  const sorted = [...aggregates].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      b.gamesPlayed - a.gamesPlayed ||
      a.userId - b.userId,
  );
  return sorted.map((aggregate, index) => ({ ...aggregate, rank: index + 1 }));
}
