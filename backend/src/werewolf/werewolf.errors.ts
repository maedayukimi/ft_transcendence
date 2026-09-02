export const DOMAIN_ERROR_CODES = [
  'INVALID_GAME_ID',
  'GAME_NOT_FOUND',
  'GAME_ALREADY_EXISTS',
  'INVALID_PLAYER_COUNT',
  'DUPLICATE_PLAYER',
  'DUPLICATE_PLAYER_NAME',
  'PLAYER_NOT_FOUND',
  'GAME_ALREADY_STARTED',
  'GAME_NOT_READY',
  'INVALID_PHASE',
  'ROLE_NOT_ASSIGNED',
  'UNAUTHORIZED_ACTION',
  'DUPLICATE_ACTION',
  'INVALID_TARGET',
  'INVALID_CENTER_CARD',
  'INCOMPLETE_ACTIONS',
  'DUPLICATE_VOTE',
  'INCOMPLETE_VOTES',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
