import { describe, expect, it } from "vitest"
import { tookFightHit } from "./shield-visual.ts"
import { enemyTick, playerDodge, playerFire, startFight } from "./combat.ts"

describe("real-hit shield visual", () => {
  it("triggers for absorbed damage and hull damage, never healing or mount", () => {
    expect(tookFightHit(null, { hp: 100, shield: 40 })).toBe(false)
    expect(tookFightHit({ hp: 100, shield: 40 }, { hp: 100, shield: 32 })).toBe(true)
    expect(tookFightHit({ hp: 100, shield: 0 }, { hp: 92, shield: 0 })).toBe(true)
    expect(tookFightHit({ hp: 100, shield: 30 }, { hp: 100, shield: 40 })).toBe(false)
  })
  it("does not trigger for fire or a blocked dodge; never changes fight math", () => {
    const f = startFight("colony")
    const hit = enemyTick(f, 5000)
    expect(tookFightHit(f.mech, hit.mech)).toBe(true)
    expect(tookFightHit(f.mech, playerFire(f, 5000, null).mech)).toBe(false)
    const dodging = playerDodge(f, 5000)
    expect(tookFightHit(dodging.mech, enemyTick(dodging, 5100).mech)).toBe(false)
    expect(f.mech.shield).toBe(40)
    expect(f.mech.hp).toBe(100)
  })
})
