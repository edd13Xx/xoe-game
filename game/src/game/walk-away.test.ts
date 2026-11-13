import { describe, expect, it } from "vitest"
import { WALK_AWAY_MS, walkAwayShouldDrain } from "./walk-away.ts"

describe("walk away", () => {
  it("starts drain only after 20s idle", () => {
    expect(WALK_AWAY_MS).toBe(20_000)
    expect(walkAwayShouldDrain(19_999)).toBe(false)
    expect(walkAwayShouldDrain(20_000)).toBe(true)
  })
})
