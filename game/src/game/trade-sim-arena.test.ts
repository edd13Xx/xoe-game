import { describe, expect, it } from "vitest"
import { SHIELD_MAX, applyTradeImpulse, createArena, tickArena, toggleArenaEased, toggleArenaPaused } from "./trade-sim-arena.ts"
import { XOE_SIM_MAX, XOE_SIM_MIN } from "./xoe-sim-price.ts"

describe("trade sim arena", () => {
  it("maps higher sim prices higher on the field", () => {
    const low = createArena(XOE_SIM_MIN)
    const mid = createArena(10)
    const high = createArena(XOE_SIM_MAX)
    expect(high.shipY).toBeLessThan(mid.shipY)
    expect(mid.shipY).toBeLessThan(low.shipY)
  })

  it("pauses motion and keeps the shield as a sim-only value", () => {
    let state = toggleArenaPaused(createArena(10))
    expect(state.paused).toBe(true)
    const later = tickArena(state, 0.5, { price: 12, fireShip: true })
    expect(later.enemies).toEqual([])
    expect(later.shield).toBe(SHIELD_MAX)
    state = toggleArenaEased(createArena(10))
    expect(state.eased).toBe(true)
  })

  it("spawns bot attackers and never awards currency", () => {
    let state = createArena(10)
    for (let i = 0; i < 40; i++) state = tickArena(state, 0.2, { price: 10 + (i % 3) * 0.1, history: [10, 10.2, 9.8, 11], difficulty: "hard" })
    expect(state.enemies.length).toBeGreaterThan(0)
    expect(state.shield).toBeGreaterThan(0)
    expect(state).not.toHaveProperty("reward")
  })

  it("reacts to an SNL short with a downward kick", () => {
    const state = applyTradeImpulse(createArena(10), "short")
    expect(state.bounce).toBe(1)
    expect(state.tradeKick).toBeGreaterThan(0)
  })

  it("spawns bot attackers faster on a red day and lags the ship", () => {
    let calm = createArena(10)
    let storm = createArena(10)
    for (let i = 0; i < 40; i++) {
      calm = tickArena(calm, 0.15, { price: 10, history: [10, 10], difficulty: "normal" })
      storm = tickArena(storm, 0.15, { price: 10, history: [10, 10], difficulty: "normal", redDay: true })
    }
    expect(storm.enemies.length).toBeGreaterThan(calm.enemies.length)
    const startY = createArena(10).shipY
    const calmFollow = tickArena(createArena(10), 0.2, { price: 12, history: [10, 12] })
    const stormFollow = tickArena(createArena(10), 0.2, { price: 12, history: [10, 12], redDay: true })
    expect(Math.abs(stormFollow.shipY - calmFollow.shipY)).toBeGreaterThan(0)
    expect(Math.abs(stormFollow.shipY - startY)).toBeLessThan(Math.abs(calmFollow.shipY - startY))
  })
})
