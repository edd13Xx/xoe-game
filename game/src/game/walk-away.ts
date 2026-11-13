/** Idle / walk-away: after this many ms without a move, XO floats and drain starts. */
export const WALK_AWAY_MS = 20_000
export const WALK_AWAY_DRAIN_PER_SEC = 5

export function walkAwayShouldDrain(idleMs: number): boolean {
  return idleMs >= WALK_AWAY_MS
}
