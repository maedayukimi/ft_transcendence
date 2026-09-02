import { DomainError } from './werewolf.errors';
import {
  addPlayer,
  advancePhase,
  assignRoles,
  calculateExecution,
  calculateWinner,
  createGame,
  createPlayerView,
  createRoleDeck,
  removePlayer,
  setPlayerReady,
  shuffleRoles,
  startGame,
  submitRobberAction,
  submitSeerAction,
  submitVote,
} from './werewolf.domain';
import type { GameState, RandomSource, Role } from './werewolf.types';

const fixedRandom: RandomSource = { next: () => 0 };

function createLobby(playerCount = 3): GameState {
  let game = createGame('test-game');
  for (let userId = 1; userId <= playerCount; userId += 1) {
    game = addPlayer(game, userId, `player-${userId}`);
    game = setPlayerReady(game, userId, true);
  }
  return game;
}

function createAssignedGame(roles: readonly Role[]): GameState {
  return assignRoles(createLobby(roles.length - 2), roles);
}

function roleOf(game: GameState, userId: number): Role | null {
  return (
    game.players.find((player) => player.userId === userId)?.currentRole ?? null
  );
}

describe('lobby and deck domain', () => {
  it('creates the required two-center-card deck for three, four, and five players', () => {
    expect(createRoleDeck(3)).toEqual([
      'WEREWOLF',
      'WEREWOLF',
      'SEER',
      'ROBBER',
      'VILLAGER',
    ]);
    expect(createRoleDeck(4)).toHaveLength(6);
    expect(createRoleDeck(5)).toHaveLength(7);
    expect(
      createRoleDeck(5).filter((role) => role === 'VILLAGER'),
    ).toHaveLength(3);
  });

  it('shuffles with an injected random source and preserves input', () => {
    const roles = createRoleDeck(3);
    expect(shuffleRoles(roles, fixedRandom)).toEqual([
      'WEREWOLF',
      'SEER',
      'ROBBER',
      'VILLAGER',
      'WEREWOLF',
    ]);
    expect(roles[0]).toBe('WEREWOLF');
  });

  it('adds, removes, and readies players without mutating the prior state', () => {
    const game = createGame('lobby');
    const withPlayer = addPlayer(game, 1, 'one');
    const ready = setPlayerReady(withPlayer, 1, true);
    expect(game.players).toHaveLength(0);
    expect(withPlayer.players[0].ready).toBe(false);
    expect(ready.players[0].ready).toBe(true);
    expect(removePlayer(ready, 1).players).toHaveLength(0);
  });

  it('allows removing a player after result but rejects it mid-game', () => {
    const finished = {
      ...createAssignedGame([
        'WEREWOLF',
        'VILLAGER',
        'VILLAGER',
        'SEER',
        'ROBBER',
      ]),
      phase: 'RESULT' as const,
    };
    expect(removePlayer(finished, 2).players.map((p) => p.userId)).toEqual([
      1, 3,
    ]);
    expect(() =>
      removePlayer({ ...finished, phase: 'NIGHT_ACTION' }, 2),
    ).toThrow(DomainError);
    expect(() =>
      removePlayer({ ...finished, phase: 'VOTING' }, 2),
    ).toThrow(DomainError);
  });

  it('rejects duplicate user names within the same game', () => {
    const game = addPlayer(createGame('lobby'), 1, 'mawako');
    expect(() => addPlayer(game, 2, 'mawako')).toThrow(DomainError);
    try {
      addPlayer(game, 2, 'mawako');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('DUPLICATE_PLAYER_NAME');
      expect((error as DomainError).message).toBe(
        '同じユーザー名のプレイヤーが既に参加しています。',
      );
    }
  });

  it('requires three ready players before start and assigns two center cards', () => {
    expect(() => startGame(createLobby(2), fixedRandom)).toThrow(DomainError);
    const unready = addPlayer(createGame('unready'), 1, 'one');
    expect(() => startGame(unready, fixedRandom)).toThrow(DomainError);

    const game = startGame(createLobby(3), fixedRandom);
    expect(game.phase).toBe('ROLE_REVEAL');
    expect(
      game.players.every((player) => player.initialRole === player.currentRole),
    ).toBe(true);
    expect(game.centerCards.map((card) => card.id)).toEqual([
      'center-0',
      'center-1',
    ]);
  });
});

describe('night actions and phase progression', () => {
  it('enters a single night action phase and moves straight to discussion when no seer or robber is among the players', () => {
    const game = createAssignedGame([
      'WEREWOLF',
      'WEREWOLF',
      'VILLAGER',
      'VILLAGER',
      'VILLAGER',
    ]);
    const nightPhase = advancePhase({ ...game, phase: 'ROLE_REVEAL' });
    expect(nightPhase.phase).toBe('NIGHT_ACTION');
    expect(advancePhase(nightPhase).phase).toBe('DISCUSSION');
  });

  it('shows werewolves only to werewolves and gives them no action command', () => {
    const game = createAssignedGame([
      'WEREWOLF',
      'WEREWOLF',
      'SEER',
      'ROBBER',
      'VILLAGER',
    ]);
    const nightPhase = advancePhase({ ...game, phase: 'ROLE_REVEAL' });
    expect(createPlayerView(nightPhase, 1).werewolfTeammateUserIds).toEqual([
      2,
    ]);
    expect(createPlayerView(nightPhase, 1).availableAction).toBeNull();
    expect(createPlayerView(nightPhase, 3).werewolfTeammateUserIds).toEqual(
      [],
    );
  });

  it('lets the seer inspect one other player or both center cards', () => {
    const game = createAssignedGame([
      'SEER',
      'WEREWOLF',
      'VILLAGER',
      'ROBBER',
      'VILLAGER',
    ]);
    const playerInspection = submitSeerAction(
      { ...game, phase: 'NIGHT_ACTION' },
      1,
      { kind: 'PLAYER', targetUserId: 2 },
    );
    expect(playerInspection.inspections.get(1)).toEqual({
      kind: 'SEER_PLAYER',
      targetUserId: 2,
      role: 'WEREWOLF',
    });

    const centerInspection = submitSeerAction(
      { ...game, phase: 'NIGHT_ACTION' },
      1,
      { kind: 'CENTER', centerCardIds: ['center-0', 'center-1'] },
    );
    expect(centerInspection.inspections.get(1)).toEqual({
      kind: 'SEER_CENTER',
      centerCardIds: ['center-0', 'center-1'],
      roles: ['ROBBER', 'VILLAGER'],
    });
    expect(() =>
      submitSeerAction({ ...game, phase: 'NIGHT_ACTION' }, 1, {
        kind: 'CENTER',
        centerCardIds: ['center-0', 'center-0'],
      }),
    ).toThrow(DomainError);
  });

  it('gives the seer the pre-swap role even when the robber acts on them first', () => {
    // 夜のアクションは全員同時に行えるため、怪盗の交換が先に処理されても
    // 占い師(自身が盗まれた側)の申告は配布時点の役職のままでなければならない。
    const game = createAssignedGame([
      'SEER',
      'ROBBER',
      'VILLAGER',
      'WEREWOLF',
      'VILLAGER',
    ]);
    const nightPhase = { ...game, phase: 'NIGHT_ACTION' as const };
    const afterRobber = submitRobberAction(nightPhase, 2, 1);
    expect(roleOf(afterRobber, 1)).toBe('ROBBER');
    expect(roleOf(afterRobber, 2)).toBe('SEER');

    const afterSeer = submitSeerAction(afterRobber, 1, {
      kind: 'PLAYER',
      targetUserId: 3,
    });
    expect(afterSeer.inspections.get(1)).toEqual({
      kind: 'SEER_PLAYER',
      targetUserId: 3,
      role: 'VILLAGER',
    });
  });

  it('swaps robber and target current roles while preserving initial roles', () => {
    const game = createAssignedGame([
      'ROBBER',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
      'VILLAGER',
    ]);
    const robbed = submitRobberAction(
      { ...game, phase: 'NIGHT_ACTION' },
      1,
      2,
    );
    expect(roleOf(robbed, 1)).toBe('WEREWOLF');
    expect(roleOf(robbed, 2)).toBe('ROBBER');
    expect(robbed.players[0].initialRole).toBe('ROBBER');
    expect(robbed.inspections.get(1)).toEqual({
      kind: 'ROBBER_SWAP',
      targetUserId: 2,
      newRole: 'WEREWOLF',
    });
    expect(() =>
      submitRobberAction({ ...game, phase: 'NIGHT_ACTION' }, 1, 1),
    ).toThrow(DomainError);
  });

  it('does not let the robbed player act again after the swap', () => {
    const game = createAssignedGame([
      'ROBBER',
      'WEREWOLF',
      'VILLAGER',
      'SEER',
      'VILLAGER',
    ]);
    const robbed = submitRobberAction(
      { ...game, phase: 'NIGHT_ACTION' },
      1,
      2,
    );
    expect(createPlayerView(robbed, 2).availableAction).toBeNull();
    expect(advancePhase(robbed).phase).toBe('DISCUSSION');
  });

  it('does not advance a required action phase until its action completes', () => {
    const game = createAssignedGame([
      'SEER',
      'WEREWOLF',
      'VILLAGER',
      'ROBBER',
      'VILLAGER',
    ]);
    expect(() => advancePhase({ ...game, phase: 'NIGHT_ACTION' })).toThrow(
      DomainError,
    );
  });
});

describe('voting and winner calculation', () => {
  const votingGame = (): GameState => ({
    ...createAssignedGame([
      'WEREWOLF',
      'VILLAGER',
      'VILLAGER',
      'SEER',
      'ROBBER',
    ]),
    phase: 'VOTING',
  });

  it('rejects self and duplicate votes', () => {
    const game = votingGame();
    expect(() => submitVote(game, 1, 1)).toThrow(DomainError);
    const voted = submitVote(game, 1, 2);
    expect(() => submitVote(voted, 1, 3)).toThrow(DomainError);
  });

  it('executes tied highest-vote players only when the count is at least two', () => {
    let game = votingGame();
    game = submitVote(game, 1, 2);
    game = submitVote(game, 2, 1);
    game = submitVote(game, 3, 1);
    expect(calculateExecution(game).executedUserIds).toEqual([1]);

    const noExecution = submitVote(votingGame(), 1, 2);
    expect(calculateExecution(noExecution).executedUserIds).toEqual([]);
  });

  it('calculates village win when a current werewolf is executed', () => {
    const game = votingGame();
    expect(
      calculateWinner(game, {
        voteCounts: new Map([[1, 2]]),
        executedUserIds: [1],
      }),
    ).toBe('VILLAGE');
    expect(
      calculateWinner(game, {
        voteCounts: new Map([[2, 2]]),
        executedUserIds: [2],
      }),
    ).toBe('WEREWOLF');
  });

  it('uses final roles and the no-werewolf special rule', () => {
    const robbed = submitRobberAction(
      {
        ...createAssignedGame([
          'ROBBER',
          'WEREWOLF',
          'VILLAGER',
          'SEER',
          'VILLAGER',
        ]),
        phase: 'NIGHT_ACTION',
      },
      1,
      2,
    );
    expect(
      calculateWinner(robbed, { voteCounts: new Map(), executedUserIds: [1] }),
    ).toBe('VILLAGE');

    const noWerewolf = createAssignedGame([
      'VILLAGER',
      'VILLAGER',
      'VILLAGER',
      'SEER',
      'ROBBER',
    ]);
    expect(
      calculateWinner(noWerewolf, {
        voteCounts: new Map(),
        executedUserIds: [],
      }),
    ).toBe('VILLAGE');
    expect(
      calculateWinner(noWerewolf, {
        voteCounts: new Map(),
        executedUserIds: [1],
      }),
    ).toBe('WEREWOLF');
  });

  it('moves to result only after every player has voted', () => {
    let game = votingGame();
    game = submitVote(game, 1, 2);
    game = submitVote(game, 2, 1);
    game = submitVote(game, 3, 1);
    expect(advancePhase(game).phase).toBe('RESULT');
    expect(advancePhase(game).result?.winner).toBe('VILLAGE');
  });
});

describe('player-specific views', () => {
  it('does not leak hidden roles, center cards, inspections, or vote targets before result', () => {
    const game = {
      ...createAssignedGame([
        'WEREWOLF',
        'WEREWOLF',
        'SEER',
        'ROBBER',
        'VILLAGER',
      ]),
      phase: 'NIGHT_ACTION' as const,
      votes: new Map([[1, 2]]),
    };
    const view = createPlayerView(game, 1);
    expect(view.ownInitialRole).toBe('WEREWOLF');
    expect(view.werewolfTeammateUserIds).toEqual([2]);
    expect(view.players[1]).not.toHaveProperty('currentRole');
    expect(view.players[0]).not.toHaveProperty('hasCompletedRequiredAction');
    expect(view).not.toHaveProperty('centerCards');
    expect(view.players[0].hasVoted).toBe(true);
    expect(view.privateInspection).toBeNull();
  });

  it('exposes an inspection only to its owner and reveals final roles and votes at result', () => {
    const actionGame = submitSeerAction(
      {
        ...createAssignedGame([
          'SEER',
          'WEREWOLF',
          'VILLAGER',
          'ROBBER',
          'VILLAGER',
        ]),
        phase: 'NIGHT_ACTION',
      },
      1,
      { kind: 'PLAYER', targetUserId: 2 },
    );
    expect(createPlayerView(actionGame, 1).privateInspection).not.toBeNull();
    expect(createPlayerView(actionGame, 2).privateInspection).toBeNull();

    const resultGame = {
      ...actionGame,
      phase: 'RESULT' as const,
      votes: new Map([[1, 2]]),
      result: {
        execution: { voteCounts: new Map([[1, 2]]), executedUserIds: [1] },
        winner: 'VILLAGE' as const,
      },
    };
    const resultView = createPlayerView(resultGame, 2);
    expect(resultView.result?.players[0].finalRole).toBe('SEER');
    expect(resultView.result?.centerCards).toHaveLength(2);
    expect(resultView.result?.votes).toEqual([
      { voterUserId: 1, targetUserId: 2 },
    ]);
  });
});
