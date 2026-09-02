import { DomainError } from './werewolf.errors';
import {
  type AvailableAction,
  type CenterCard,
  type CenterCardId,
  type ExecutionResult,
  type GamePhase,
  type GamePlayer,
  type GameResult,
  type GameState,
  type PlayerInspection,
  type PlayerView,
  type RandomSource,
  type Role,
  type SeerAction,
  type Winner,
} from './werewolf.types';

const CENTER_CARD_IDS: readonly CenterCardId[] = ['center-0', 'center-1'];

const EMPTY_CENTER_CARDS: GameState['centerCards'] = [
  { id: 'center-0', initialRole: null, currentRole: null },
  { id: 'center-1', initialRole: null, currentRole: null },
];

export function createGame(id: string): GameState {
  if (id.trim().length === 0) {
    throw new DomainError('INVALID_GAME_ID', 'ゲームIDを入力してください。');
  }

  return {
    id,
    phase: 'LOBBY',
    players: [],
    centerCards: EMPTY_CENTER_CARDS,
    completedActionUserIds: new Set<number>(),
    inspections: new Map<number, PlayerInspection>(),
    votes: new Map<number, number>(),
    result: null,
  };
}

export function addPlayer(
  game: GameState,
  userId: number,
  userName: string,
): GameState {
  assertPhase(game, 'LOBBY');
  if (game.players.some((player) => player.userId === userId)) {
    throw new DomainError(
      'DUPLICATE_PLAYER',
      'このプレイヤーは既にゲームへ参加しています。',
    );
  }
  if (game.players.some((player) => player.userName === userName)) {
    throw new DomainError(
      'DUPLICATE_PLAYER_NAME',
      '同じユーザー名のプレイヤーが既に参加しています。',
    );
  }
  if (game.players.length >= 5) {
    throw new DomainError(
      'INVALID_PLAYER_COUNT',
      'ゲームに参加できるのは最大5人です。',
    );
  }

  return {
    ...game,
    players: [
      ...game.players,
      {
        userId,
        userName,
        ready: false,
        initialRole: null,
        currentRole: null,
      },
    ],
  };
}

export function removePlayer(game: GameState, userId: number): GameState {
  // LOBBY: 開始前の離脱。RESULT: 結果画面を離れた場合、次の「もう一度あそぶ」に
  // 未準備のまま残ってしまわないよう名簿から外す。それ以外の進行中フェーズでは
  // ロールや投票の整合性が崩れるため許可しない。
  if (game.phase !== 'LOBBY' && game.phase !== 'RESULT') {
    throw new DomainError(
      'INVALID_PHASE',
      'ゲーム進行中はプレイヤーを退出させられません。',
    );
  }
  assertPlayerExists(game, userId);
  return {
    ...game,
    players: game.players.filter((player) => player.userId !== userId),
  };
}

export function setPlayerReady(
  game: GameState,
  userId: number,
  ready: boolean,
): GameState {
  assertPhase(game, 'LOBBY');
  assertPlayerExists(game, userId);
  return {
    ...game,
    players: game.players.map((player) =>
      player.userId === userId ? { ...player, ready } : player,
    ),
  };
}

export function createRoleDeck(playerCount: number): readonly Role[] {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 5) {
    throw new DomainError(
      'INVALID_PLAYER_COUNT',
      'ゲームには3人から5人のプレイヤーが必要です。',
    );
  }

  return [
    'WEREWOLF',
    'WEREWOLF',
    'SEER',
    'ROBBER',
    ...Array<Role>(playerCount - 2).fill('VILLAGER'),
  ];
}

export function shuffleRoles(
  roles: readonly Role[],
  random: RandomSource,
): readonly Role[] {
  const shuffled = [...roles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random.next() * (index + 1));
    if (randomIndex < 0 || randomIndex > index) {
      throw new DomainError(
        'INVALID_TARGET',
        '乱数は0以上1未満である必要があります。',
      );
    }
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function assignRoles(
  game: GameState,
  roles: readonly Role[],
): GameState {
  assertPhase(game, 'LOBBY');
  if (roles.length !== game.players.length + CENTER_CARD_IDS.length) {
    throw new DomainError(
      'INVALID_PLAYER_COUNT',
      '役職デッキの枚数がプレイヤー数と一致しません。',
    );
  }

  const players = game.players.map((player, index) => {
    const role = roles[index];
    if (role === undefined) {
      throw new DomainError(
        'ROLE_NOT_ASSIGNED',
        'プレイヤーの役職がありません。',
      );
    }
    return { ...player, initialRole: role, currentRole: role };
  });
  const firstCenterRole = roles[players.length];
  const secondCenterRole = roles[players.length + 1];
  if (firstCenterRole === undefined || secondCenterRole === undefined) {
    throw new DomainError(
      'ROLE_NOT_ASSIGNED',
      '中央カードの役職がありません。',
    );
  }
  const centerCards: GameState['centerCards'] = [
    {
      id: 'center-0',
      initialRole: firstCenterRole,
      currentRole: firstCenterRole,
    },
    {
      id: 'center-1',
      initialRole: secondCenterRole,
      currentRole: secondCenterRole,
    },
  ];

  return { ...game, players, centerCards };
}

export function startGame(game: GameState, random: RandomSource): GameState {
  assertPhase(game, 'LOBBY');
  if (game.players.length < 3 || game.players.length > 5) {
    throw new DomainError(
      'INVALID_PLAYER_COUNT',
      'ゲームには3人から5人のプレイヤーが必要です。',
    );
  }
  if (game.players.some((player) => !player.ready)) {
    throw new DomainError(
      'GAME_NOT_READY',
      'ゲーム開始前に全員が準備完了する必要があります。',
    );
  }

  const assigned = assignRoles(
    game,
    shuffleRoles(createRoleDeck(game.players.length), random),
  );
  return {
    ...assigned,
    phase: 'ROLE_REVEAL',
    completedActionUserIds: new Set<number>(),
    inspections: new Map<number, PlayerInspection>(),
    votes: new Map<number, number>(),
    result: null,
  };
}

export function submitSeerAction(
  game: GameState,
  userId: number,
  action: SeerAction,
): GameState {
  assertPhase(game, 'NIGHT_ACTION');
  assertRequiredActor(game, userId, 'SEER');

  if (action.kind === 'PLAYER') {
    if (action.targetUserId === userId) {
      throw new DomainError(
        'INVALID_TARGET',
        '占い師は自分自身のカードを確認できません。',
      );
    }
    const target = findPlayer(game, action.targetUserId);
    return withActionCompleted(game, userId, {
      kind: 'SEER_PLAYER',
      targetUserId: action.targetUserId,
      // 怪盗のスワップと同時進行できるよう、配布時点のinitialRoleを見る。
      // currentRoleを見てしまうと、怪盗が先に処理された場合に
      // 「盗まれた後の役職」が見えてしまい、実行順で結果が変わってしまう。
      role: requiredInitialRole(target),
    });
  }

  const [firstId, secondId] = action.centerCardIds;
  if (firstId === secondId) {
    throw new DomainError(
      'INVALID_CENTER_CARD',
      '占い師は異なる2枚の中央カードを確認する必要があります。',
    );
  }
  const first = findCenterCard(game, firstId);
  const second = findCenterCard(game, secondId);
  return withActionCompleted(game, userId, {
    kind: 'SEER_CENTER',
    centerCardIds: action.centerCardIds,
    roles: [requiredInitialRole(first), requiredInitialRole(second)],
  });
}

export function submitRobberAction(
  game: GameState,
  userId: number,
  targetUserId: number,
): GameState {
  assertPhase(game, 'NIGHT_ACTION');
  assertRequiredActor(game, userId, 'ROBBER');
  if (targetUserId === userId) {
    throw new DomainError(
      'INVALID_TARGET',
      '怪盗は他のプレイヤーを選ぶ必要があります。',
    );
  }

  const robber = findPlayer(game, userId);
  const target = findPlayer(game, targetUserId);
  const robberRole = requiredRole(robber);
  const targetRole = requiredRole(target);
  const swappedPlayers = game.players.map((player) => {
    if (player.userId === userId) {
      return { ...player, currentRole: targetRole };
    }
    if (player.userId === targetUserId) {
      return { ...player, currentRole: robberRole };
    }
    return player;
  });

  return withActionCompleted({ ...game, players: swappedPlayers }, userId, {
    kind: 'ROBBER_SWAP',
    targetUserId,
    newRole: targetRole,
  });
}

export function advancePhase(game: GameState): GameState {
  if (game.phase === 'LOBBY' || game.phase === 'RESULT') {
    throw new DomainError(
      'INVALID_PHASE',
      'このフェーズからゲームを進行できません。',
    );
  }
  if (game.phase === 'VOTING') {
    if (game.votes.size !== game.players.length) {
      throw new DomainError(
        'INCOMPLETE_VOTES',
        '結果表示前に全員が投票する必要があります。',
      );
    }
    const execution = calculateExecution(game);
    const result: GameResult = {
      execution,
      winner: calculateWinner(game, execution),
    };
    return { ...game, phase: 'RESULT', result };
  }
  if (game.phase === 'NIGHT_ACTION') {
    const hasIncompleteAction = requiredActorIds(game).some(
      (userId) => !game.completedActionUserIds.has(userId),
    );
    if (hasIncompleteAction) {
      throw new DomainError(
        'INCOMPLETE_ACTIONS',
        '必要な夜のアクションが完了していません。',
      );
    }
  }

  return {
    ...game,
    phase: nextPhase(game.phase),
    completedActionUserIds: new Set<number>(),
  };
}

export function submitVote(
  game: GameState,
  voterUserId: number,
  targetUserId: number,
): GameState {
  assertPhase(game, 'VOTING');
  assertPlayerExists(game, voterUserId);
  assertPlayerExists(game, targetUserId);
  if (voterUserId === targetUserId) {
    throw new DomainError('INVALID_TARGET', '自分自身には投票できません。');
  }
  if (game.votes.has(voterUserId)) {
    throw new DomainError('DUPLICATE_VOTE', '投票は1回だけ行えます。');
  }
  const votes = new Map(game.votes);
  votes.set(voterUserId, targetUserId);
  return { ...game, votes };
}

export function calculateExecution(game: GameState): ExecutionResult {
  const voteCounts = new Map<number, number>();
  for (const player of game.players) {
    voteCounts.set(player.userId, 0);
  }
  for (const targetUserId of game.votes.values()) {
    voteCounts.set(targetUserId, (voteCounts.get(targetUserId) ?? 0) + 1);
  }
  const highestVoteCount = Math.max(...voteCounts.values());
  const executedUserIds =
    highestVoteCount >= 2
      ? game.players
          .filter(
            (player) => voteCounts.get(player.userId) === highestVoteCount,
          )
          .map((player) => player.userId)
      : [];
  return { voteCounts, executedUserIds };
}

export function calculateWinner(
  game: GameState,
  execution: ExecutionResult = calculateExecution(game),
): Winner {
  const currentWerewolfIds = game.players
    .filter((player) => player.currentRole === 'WEREWOLF')
    .map((player) => player.userId);
  if (currentWerewolfIds.length === 0) {
    return execution.executedUserIds.length === 0 ? 'VILLAGE' : 'WEREWOLF';
  }
  return execution.executedUserIds.some((userId) =>
    currentWerewolfIds.includes(userId),
  )
    ? 'VILLAGE'
    : 'WEREWOLF';
}

export function createPlayerView(
  game: GameState,
  viewerUserId: number,
): PlayerView {
  const viewer = findPlayer(game, viewerUserId);
  const result =
    game.result === null ? null : createResultView(game, game.result);
  const werewolfTeammateUserIds =
    game.phase === 'NIGHT_ACTION' && viewer.initialRole === 'WEREWOLF'
      ? game.players
          .filter(
            (player) =>
              player.userId !== viewerUserId &&
              player.initialRole === 'WEREWOLF',
          )
          .map((player) => player.userId)
      : [];

  return {
    gameId: game.id,
    phase: game.phase,
    players: game.players.map((player) => ({
      userId: player.userId,
      userName: player.userName,
      ready: player.ready,
      hasVoted: game.votes.has(player.userId),
    })),
    ownInitialRole: viewer.initialRole,
    availableAction: availableActionFor(game, viewerUserId),
    werewolfTeammateUserIds,
    privateInspection: game.inspections.get(viewerUserId) ?? null,
    result,
  };
}

function nextPhase(phase: GamePhase): GamePhase {
  if (phase === 'ROLE_REVEAL') return 'NIGHT_ACTION';
  if (phase === 'NIGHT_ACTION') return 'DISCUSSION';
  if (phase === 'DISCUSSION') return 'VOTING';
  throw new DomainError('INVALID_PHASE', '次のフェーズはありません。');
}

function requiredActorIds(game: GameState): readonly number[] {
  return requiredActorIdsForPhase(game, game.phase);
}

// 夜のアクションは全員同時に実行できるため、誰が「実行必須」かは
// 怪盗のスワップで変わり得るcurrentRoleではなく、配布時点で固定される
// initialRoleで判定する。こうしないと、盗まれた側のプレイヤーが
// 「まだアクションが残っている」と誤判定されてしまう。
function requiredActorIdsForPhase(
  game: GameState,
  phase: GamePhase,
): readonly number[] {
  if (phase !== 'NIGHT_ACTION') {
    return [];
  }
  return game.players
    .filter(
      (player) =>
        player.initialRole === 'SEER' || player.initialRole === 'ROBBER',
    )
    .map((player) => player.userId);
}

function availableActionFor(game: GameState, userId: number): AvailableAction {
  if (
    !requiredActorIds(game).includes(userId) ||
    game.completedActionUserIds.has(userId)
  ) {
    return null;
  }
  const player = findPlayer(game, userId);
  if (player.initialRole === 'SEER') return 'SEER_INSPECT';
  if (player.initialRole === 'ROBBER') return 'ROBBER_SWAP';
  return null;
}

function withActionCompleted(
  game: GameState,
  userId: number,
  inspection: PlayerInspection,
): GameState {
  if (game.completedActionUserIds.has(userId)) {
    throw new DomainError(
      'DUPLICATE_ACTION',
      '夜のアクションは1回だけ実行できます。',
    );
  }
  const completedActionUserIds = new Set(game.completedActionUserIds);
  completedActionUserIds.add(userId);
  const inspections = new Map(game.inspections);
  inspections.set(userId, inspection);
  return { ...game, completedActionUserIds, inspections };
}

function assertRequiredActor(
  game: GameState,
  userId: number,
  requiredRoleName: Role,
): void {
  const player = findPlayer(game, userId);
  if (player.initialRole !== requiredRoleName) {
    throw new DomainError(
      'UNAUTHORIZED_ACTION',
      'このプレイヤーは現在のフェーズでアクションできません。',
    );
  }
  if (game.completedActionUserIds.has(userId)) {
    throw new DomainError(
      'DUPLICATE_ACTION',
      '夜のアクションは1回だけ実行できます。',
    );
  }
}

function assertPhase(game: GameState, phase: GamePhase): void {
  if (game.phase !== phase) {
    throw new DomainError(
      'INVALID_PHASE',
      `フェーズが不正です。必要: ${phase}、現在: ${game.phase}。`,
    );
  }
}

function assertPlayerExists(game: GameState, userId: number): void {
  findPlayer(game, userId);
}

function findPlayer(game: GameState, userId: number): GamePlayer {
  const player = game.players.find((candidate) => candidate.userId === userId);
  if (player === undefined) {
    throw new DomainError(
      'PLAYER_NOT_FOUND',
      'このプレイヤーはゲームに参加していません。',
    );
  }
  return player;
}

function findCenterCard(game: GameState, cardId: CenterCardId): CenterCard {
  const card = game.centerCards.find((candidate) => candidate.id === cardId);
  if (card === undefined) {
    throw new DomainError(
      'INVALID_CENTER_CARD',
      '指定された中央カードは存在しません。',
    );
  }
  return card;
}

function requiredRole(
  participant:
    | Pick<GamePlayer, 'currentRole'>
    | Pick<CenterCard, 'currentRole'>,
): Role {
  if (participant.currentRole === null) {
    throw new DomainError(
      'ROLE_NOT_ASSIGNED',
      '役職がまだ配布されていません。',
    );
  }
  return participant.currentRole;
}

function requiredInitialRole(
  participant:
    | Pick<GamePlayer, 'initialRole'>
    | Pick<CenterCard, 'initialRole'>,
): Role {
  if (participant.initialRole === null) {
    throw new DomainError(
      'ROLE_NOT_ASSIGNED',
      '役職がまだ配布されていません。',
    );
  }
  return participant.initialRole;
}

function createResultView(
  game: GameState,
  result: GameResult,
): PlayerView['result'] {
  return {
    winner: result.winner,
    executedUserIds: result.execution.executedUserIds,
    votes: [...game.votes.entries()].map(([voterUserId, targetUserId]) => ({
      voterUserId,
      targetUserId,
    })),
    players: game.players.map((player) => ({
      userId: player.userId,
      userName: player.userName,
      finalRole: requiredRole(player),
      votesReceived: result.execution.voteCounts.get(player.userId) ?? 0,
      executed: result.execution.executedUserIds.includes(player.userId),
    })),
    centerCards: game.centerCards.map((card) => ({
      id: card.id,
      finalRole: requiredRole(card),
    })),
  };
}
