import type { FightState } from './combat.ts'
/** Freeze cooldown/dodge duration across a menu pause; no combat values change. */
export function resumeFightClock(fight: FightState, elapsed: number): FightState {
  const shift = Math.max(0, elapsed)
  return { ...fight, mech: { ...fight.mech, dodgeUntilMs: fight.mech.dodgeUntilMs ? fight.mech.dodgeUntilMs + shift : 0, fireCooldownUntilMs: fight.mech.fireCooldownUntilMs ? fight.mech.fireCooldownUntilMs + shift : 0 } }
}
