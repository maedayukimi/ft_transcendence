import { DomainError } from './werewolf.errors';
import { WerewolfService } from './werewolf.service';
import type { RandomSource } from './werewolf.types';

const GAME_ID = 'service-test';
const HOST = 1;
const GUEST = 2;
const THIRD = 3;
const FOURTH = 4;
const OUTSIDER = 99;

// next() が常に 0 を返すと shuffleRoles は毎回「先頭と末尾の入れ替え」だけになり、
// 3 人戦の配役は p1=WEREWOLF, p2=SEER, p3=ROBBER, 中央=[VILLAGER, WEREWOLF] に固定される。
// (werewolf.domain.spec.ts の fixedRandom と同じ)
const fixedRandom: RandomSource = { next: () => 0 };

function createService(): WerewolfService {
  const service = new WerewolfService();
  // random は private readonly のため、テストでは決定的な乱数源に差し替える。
  Object.assign(service, { random: fixedRandom });
  return service;
}

function createReadyLobby(
  service: WerewolfService,
  userIds: readonly number[] = [HOST, GUEST, THIRD],
): void {
  const [host, ...others] = userIds;
  service.createGame(GAME_ID, host, `user-${host}`);
  for (const userId of others) {
    service.joinGame(GAME_ID, userId, `user-${userId}`);
  }
  for (const userId of userIds) {
    service.setReady(GAME_ID, userId, true);
  }
}

// 3 人戦を LOBBY から RESULT まで進める。配役は fixedRandom で固定されている前提。
function playToResult(service: WerewolfService): void {
  createReadyLobby(service);
  service.startGame(GAME_ID, HOST); // ROLE_REVEAL
  service.advancePhase(GAME_ID, HOST); // NIGHT_ACTION
  service.submitSeerAction(GAME_ID, GUEST, { kind: 'PLAYER', targetUserId: HOST });
  service.submitRobberAction(GAME_ID, THIRD, HOST);
  service.advancePhase(GAME_ID, HOST); // DISCUSSION
  service.advancePhase(GAME_ID, HOST); // VOTING
  service.submitVote(GAME_ID, HOST, GUEST);
  service.submitVote(GAME_ID, GUEST, THIRD);
  service.submitVote(GAME_ID, THIRD, HOST);
  service.advancePhase(GAME_ID, HOST); // RESULT
}

function expectDomainError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`DomainError(${code}) が投げられるはずでした。`);
}

describe('WerewolfService host enforcement', () => {
  it('rejects startGame from a non-participant', () => {
    const service = createService();
    createReadyLobby(service);
    expectDomainError(() => service.startGame(GAME_ID, OUTSIDER), 'PLAYER_NOT_FOUND');
    expect(service.getGame(GAME_ID).phase).toBe('LOBBY');
  });

  it('rejects startGame from a non-host participant', () => {
    const service = createService();
    createReadyLobby(service);
    expectDomainError(() => service.startGame(GAME_ID, GUEST), 'UNAUTHORIZED_ACTION');
    expect(service.getGame(GAME_ID).phase).toBe('LOBBY');
  });

  it('lets the host start the game', () => {
    const service = createService();
    createReadyLobby(service);
    expect(service.startGame(GAME_ID, HOST).phase).toBe('ROLE_REVEAL');
  });

  it('rejects advancePhase from a non-participant and from a non-host', () => {
    const service = createService();
    createReadyLobby(service);
    service.startGame(GAME_ID, HOST);
    expectDomainError(() => service.advancePhase(GAME_ID, OUTSIDER), 'PLAYER_NOT_FOUND');
    expectDomainError(() => service.advancePhase(GAME_ID, GUEST), 'UNAUTHORIZED_ACTION');
    expect(service.getGame(GAME_ID).phase).toBe('ROLE_REVEAL');
    expect(service.advancePhase(GAME_ID, HOST).phase).toBe('NIGHT_ACTION');
  });

  it('rejects restartGame from a non-participant and from a non-host after the result', () => {
    const service = createService();
    playToResult(service);
    expect(service.getGame(GAME_ID).phase).toBe('RESULT');
    expectDomainError(() => service.restartGame(GAME_ID, OUTSIDER), 'PLAYER_NOT_FOUND');
    expectDomainError(() => service.restartGame(GAME_ID, GUEST), 'UNAUTHORIZED_ACTION');
    expect(service.getGame(GAME_ID).phase).toBe('RESULT');

    const restarted = service.restartGame(GAME_ID, HOST);
    expect(restarted.phase).toBe('LOBBY');
    expect(restarted.players.map((player) => player.userId)).toEqual([HOST, GUEST, THIRD]);
    expect(restarted.players.every((player) => !player.ready)).toBe(true);
  });

  it('checks the host before the phase when restarting', () => {
    const service = createService();
    createReadyLobby(service);
    expectDomainError(() => service.restartGame(GAME_ID, GUEST), 'UNAUTHORIZED_ACTION');
    expectDomainError(() => service.restartGame(GAME_ID, HOST), 'INVALID_PHASE');
  });

  it('promotes the next player to host when the host leaves the lobby', () => {
    const service = createService();
    createReadyLobby(service, [HOST, GUEST, THIRD, FOURTH]);
    service.leaveGame(GAME_ID, HOST);
    expect(service.getGame(GAME_ID).players[0]?.userId).toBe(GUEST);
    expectDomainError(() => service.startGame(GAME_ID, THIRD), 'UNAUTHORIZED_ACTION');
    expect(service.startGame(GAME_ID, GUEST).phase).toBe('ROLE_REVEAL');
  });
});
