import { describe, expect, it } from "vitest"
import {
  applyDamageToMech,
  canFire,
  enemyTick,
  playerDodge,
  playerFire,
  startFight,
  writeFightDifficulty,
  readFightDifficulty,
} from "./combat.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

describe("mech combat", () => {
  it("damages enemies on fire and tracks hull/shield", () => {
    let fight = startFight("skirmish", "normal")
    expect(fight.enemies.length).toBeGreaterThan(0)
    const id = fight.enemies[0]!.id
    const before = fight.enemies[0]!.hp
    fight = playerFire(fight, 0, id)
    expect(fight.enemies[0]!.hp).toBeLessThan(before)
    expect(canFire(fight, 0)).toBe(false)
    expect(canFire(fight, 500)).toBe(true)
    const shielded = applyDamageToMech(fight, 20)
    expect(shielded.mech.shield + shielded.mech.hp).toBeLessThan(fight.mech.shield + fight.mech.hp)
  })

  it("dodge then restores control; difficulty persists", () => {
    const store = mem()
    writeFightDifficulty(store, "hard")
    expect(readFightDifficulty(store)).toBe("hard")
    let fight = startFight("boss", "easy")
    const now = 10_000
    fight = playerDodge(fight, now)
    expect(fight.mech.dodgeUntilMs).toBeGreaterThan(now)
    // while dodging, enemy tick should not cut hull
    const hp = fight.mech.hp
    fight = enemyTick(fight, now + 10)
    expect(fight.mech.hp).toBe(hp)
  })
})
