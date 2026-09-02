export type Role = 'WEREWOLF' | 'VILLAGER' | 'SEER' | 'ROBBER';

export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT_ACTION'
  | 'DISCUSSION'
  | 'VOTING'
  | 'RESULT';

export type CenterCardId = 'center-0' | 'center-1';
export type Winner = 'VILLAGE' | 'WEREWOLF';
export type AvailableAction = 'SEER_INSPECT' | 'ROBBER_SWAP' | null;

export interface PlayerViewPlayer {
  userId: number;
  userName: string;
  ready: boolean;
  hasVoted: boolean;
}

export interface SeerPlayerInspection {
  kind: 'SEER_PLAYER';
  targetUserId: number;
  role: Role;
}

export interface SeerCenterInspection {
  kind: 'SEER_CENTER';
  centerCardIds: [CenterCardId, CenterCardId];
  roles: [Role, Role];
}

export interface RobberInspection {
  kind: 'ROBBER_SWAP';
  targetUserId: number;
  newRole: Role;
}

export type PlayerInspection =
  | SeerPlayerInspection
  | SeerCenterInspection
  | RobberInspection;

export interface ResultPlayerView {
  userId: number;
  userName: string;
  finalRole: Role;
  votesReceived: number;
  executed: boolean;
}

export interface ResultVoteView {
  voterUserId: number;
  targetUserId: number;
}

export interface ResultView {
  winner: Winner;
  executedUserIds: number[];
  votes: ResultVoteView[];
  players: ResultPlayerView[];
  centerCards: { id: CenterCardId; finalRole: Role }[];
}

export interface PlayerView {
  gameId: string;
  phase: GamePhase;
  players: PlayerViewPlayer[];
  ownInitialRole: Role | null;
  availableAction: AvailableAction;
  werewolfTeammateUserIds: number[];
  privateInspection: PlayerInspection | null;
  result: ResultView | null;
}

export interface AckSuccess {
  success: true;
}

export interface AckFailure {
  success: false;
  code: string;
  message: string;
}

export type Ack = AckSuccess | AckFailure;
