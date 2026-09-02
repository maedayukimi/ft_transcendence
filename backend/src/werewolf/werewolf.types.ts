export const ROLES = ['WEREWOLF', 'VILLAGER', 'SEER', 'ROBBER'] as const;

export type Role = (typeof ROLES)[number];

export const PHASES = [
  'LOBBY',
  'ROLE_REVEAL',
  'NIGHT_ACTION',
  'DISCUSSION',
  'VOTING',
  'RESULT',
] as const;

export type GamePhase = (typeof PHASES)[number];
export type CenterCardId = 'center-0' | 'center-1';
export type Winner = 'VILLAGE' | 'WEREWOLF';

export interface RandomSource {
  next(): number;
}

export interface GamePlayer {
  readonly userId: number;
  readonly userName: string;
  readonly ready: boolean;
  readonly initialRole: Role | null;
  readonly currentRole: Role | null;
}

export interface CenterCard {
  readonly id: CenterCardId;
  readonly initialRole: Role | null;
  readonly currentRole: Role | null;
}

export interface SeerPlayerInspection {
  readonly kind: 'SEER_PLAYER';
  readonly targetUserId: number;
  readonly role: Role;
}

export interface SeerCenterInspection {
  readonly kind: 'SEER_CENTER';
  readonly centerCardIds: readonly [CenterCardId, CenterCardId];
  readonly roles: readonly [Role, Role];
}

export interface RobberInspection {
  readonly kind: 'ROBBER_SWAP';
  readonly targetUserId: number;
  readonly newRole: Role;
}

export type PlayerInspection =
  | SeerPlayerInspection
  | SeerCenterInspection
  | RobberInspection;

export interface SeerPlayerAction {
  readonly kind: 'PLAYER';
  readonly targetUserId: number;
}

export interface SeerCenterAction {
  readonly kind: 'CENTER';
  readonly centerCardIds: readonly [CenterCardId, CenterCardId];
}

export type SeerAction = SeerPlayerAction | SeerCenterAction;

export interface ExecutionResult {
  readonly voteCounts: ReadonlyMap<number, number>;
  readonly executedUserIds: readonly number[];
}

export interface GameResult {
  readonly execution: ExecutionResult;
  readonly winner: Winner;
}

export interface GameState {
  readonly id: string;
  readonly phase: GamePhase;
  readonly players: readonly GamePlayer[];
  readonly centerCards: readonly [CenterCard, CenterCard];
  readonly completedActionUserIds: ReadonlySet<number>;
  readonly inspections: ReadonlyMap<number, PlayerInspection>;
  readonly votes: ReadonlyMap<number, number>;
  readonly result: GameResult | null;
}

export interface PlayerViewPlayer {
  readonly userId: number;
  readonly userName: string;
  readonly ready: boolean;
  readonly hasVoted: boolean;
}

export type AvailableAction = 'SEER_INSPECT' | 'ROBBER_SWAP' | null;

export interface ResultPlayerView {
  readonly userId: number;
  readonly userName: string;
  readonly finalRole: Role;
  readonly votesReceived: number;
  readonly executed: boolean;
}

export interface ResultVoteView {
  readonly voterUserId: number;
  readonly targetUserId: number;
}

export interface ResultView {
  readonly winner: Winner;
  readonly executedUserIds: readonly number[];
  readonly votes: readonly ResultVoteView[];
  readonly players: readonly ResultPlayerView[];
  readonly centerCards: readonly { id: CenterCardId; finalRole: Role }[];
}

export interface PlayerView {
  readonly gameId: string;
  readonly phase: GamePhase;
  readonly players: readonly PlayerViewPlayer[];
  readonly ownInitialRole: Role | null;
  readonly availableAction: AvailableAction;
  readonly werewolfTeammateUserIds: readonly number[];
  readonly privateInspection: PlayerInspection | null;
  readonly result: ResultView | null;
}
