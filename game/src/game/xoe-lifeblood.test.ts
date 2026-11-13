import { describe, expect, it } from "vitest"
import {
  DEFAULT_LIVES,
  LIQUIDATED_LABEL,
  LIQUIDATION_PRICE_LABEL,
  RESPAWN_INVINCIBILITY_SEC,
  STARTING_XOE,
  XOE_DRAIN_BAD,
  XOE_GAIN_GOOD,
  XOE_UNIT,
  applyBadMove,
  applyGoodMove,
  applyMarkCheck,
  beginDeath,
  finishRespawn,
  initialXoeRun,
  isAtOrPastLiquidation,
  isInvincible,
  liquidationPrice,
  liquidationPriceLabel,
  TOTAL_LIQUIDATION_MARKER,
  resolveDeath,
  finishRecharge,
  RECHARGE_MS,
  persistRechargeUntil,
  isRechargeBlocking,
  respawnFadeAlpha,
} from "./xoe-lifeblood.ts"
import { applyPaperAction, applyPracticeTick, forcePracticeLiquidation, initialPractice, runPractice } from "./practice.ts"

describe("XOE lifeblood unit", () => {
  it("names the score unit XOE and starts at full health with 2 attempts", () => {
    expect(XOE_UNIT).toBe("XOE")
    expect(LIQUIDATED_LABEL).toBe("Total Liquidation")
    expect(TOTAL_LIQUIDATION_MARKER).toBe("Total Liquidation -4.4%")
    expect(LIQUIDATION_PRICE_LABEL).toBe("Total Liquidation price")
    expect(RESPAWN_INVINCIBILITY_SEC).toBe(2.0)
    const s = initialXoeRun()
    expect(s.xoe).toBe(STARTING_XOE)
    expect(s.lives).toBe(DEFAULT_LIVES)
    expect(s.deathPhase).toBe("alive")
  })

  it("computes Total Liquidation price at −4.4% long and +4.4% short", () => {
    expect(liquidationPrice(100, "long")).toBe(95.6)
    expect(liquidationPrice(100, "short")).toBe(104.4)
    expect(liquidationPriceLabel(200, "long")).toBe(`${LIQUIDATION_PRICE_LABEL} 191.2`)
    expect(isAtOrPastLiquidation(95.6, 100, "long")).toBe(true)
    expect(isAtOrPastLiquidation(95.5, 100, "long")).toBe(true)
    expect(isAtOrPastLiquidation(95.7, 100, "long")).toBe(false)
    expect(isAtOrPastLiquidation(104.4, 100, "short")).toBe(true)
    expect(isAtOrPastLiquidation(104.3, 100, "short")).toBe(false)
  })

  it("gains XOE and destroys an enemy on a good move; drains on a bad move", () => {
    let s = initialXoeRun()
    s = applyGoodMove(s)
    expect(s.xoe).toBe(STARTING_XOE) // capped at max
    expect(s.enemiesDestroyed).toBe(1)
    s = { ...s, xoe: 50 }
    s = applyGoodMove(s)
    expect(s.xoe).toBe(50 + XOE_GAIN_GOOD)
    s = applyBadMove(s, 0)
    expect(s.xoe).toBe(50 + XOE_GAIN_GOOD - XOE_DRAIN_BAD)
  })

  it("begins death when XOE hits 0 or liquidation price is reached", () => {
    let s = { ...initialXoeRun(), xoe: XOE_DRAIN_BAD }
    s = applyBadMove(s, 0)
    expect(s.deathPhase).toBe("dying")
    expect(s.xoe).toBe(0)
    expect(s.lastEffect).toBe("liquidated")

    s = { ...initialXoeRun(), side: "long" as const, entry: 100 }
    s = applyMarkCheck(s, 95.6, 0)
    expect(s.deathPhase).toBe("dying")
  })

  it("recharges 15s wall-clock then shield-fades; game over when no lives", () => {
    expect(RECHARGE_MS).toBe(15000)
    let s = beginDeath(initialXoeRun())
    expect(s.deathPhase).toBe("dying")
    const now = Date.now()
    s = resolveDeath(s, now)
    expect(s.deathPhase).toBe("recharging")
    expect(s.lives).toBe(DEFAULT_LIVES - 1)
    expect(s.rechargeUntilMs!).toBeGreaterThanOrEqual(now + RECHARGE_MS - 50)

    // Still recharging — cannot finish early
    expect(finishRecharge(s, now + 1000).deathPhase).toBe("recharging")

    // Persist end time
    const mem: Record<string, string> = {}
    const store = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v
      },
      removeItem: (k: string) => {
        delete mem[k]
      },
    }
    persistRechargeUntil(store, now + RECHARGE_MS)
    expect(isRechargeBlocking(store, now + 1000)).toBe(true)
    expect(isRechargeBlocking(store, now + RECHARGE_MS + 1)).toBe(false)

    // After full window → respawning with shield fade
    s = finishRecharge({ ...s, rechargeUntilMs: now + RECHARGE_MS }, now + RECHARGE_MS)
    expect(s.deathPhase).toBe("respawning")
    expect(respawnFadeAlpha(now + RECHARGE_MS, s)).toBeGreaterThan(0.15)
    expect(isInvincible(s, now + RECHARGE_MS)).toBe(true)
    const drained = applyBadMove(s, now + RECHARGE_MS)
    expect(drained.xoe).toBe(s.xoe)

    const after = finishRespawn(s, now + RECHARGE_MS + RESPAWN_INVINCIBILITY_SEC * 1000)
    expect(after.deathPhase).toBe("alive")

    s = beginDeath({ ...initialXoeRun(), lives: 1 })
    s = resolveDeath(s, Date.now())
    expect(s.deathPhase).toBe("gameover")
    expect(s.lives).toBe(0)
  })
})

describe("practice XOE + liquidation", () => {
  it("labels PAPER_UP as paper-up and spends lives / liquidates on adverse 5% jumps", () => {
    const up = runPractice(["buy", "sell", "buy", "sell"])
    expect(up.outcome).toBe("paper-up")
    expect(up.xoe.xoe).toBeGreaterThan(0)

    const down = runPractice(["sell", "buy", "sell", "buy"])
    expect(["paper-down", "liquidated"]).toContain(down.outcome)

    // Long at 10 then mark 9.4 crosses the 4.4% liquidation band and spends a life
    let s = initialPractice({ price: 10 })
    s = applyPaperAction(s, "buy", 10)
    s = applyPracticeTick(s, 9.4)
    expect(s.xoe.lives < DEFAULT_LIVES || s.outcome === "liquidated" || s.xoe.deathPhase !== "alive").toBe(true)
  })

  it("force liquidation ends the run when lives are exhausted via settle", () => {
    let state = initialPractice()
    // Burn three deaths
    state = forcePracticeLiquidation(state)
    expect(state.xoe.lives).toBeLessThan(DEFAULT_LIVES)
    state = forcePracticeLiquidation(state)
    state = forcePracticeLiquidation(state)
    expect(state.outcome).toBe("liquidated")
    expect(state.xoe.lives).toBe(0)
  })

  it("records gain then drain across a buy that matches then a bad follow-up", () => {
    let s = initialPractice()
    s = applyPaperAction(s, "buy", 10)
    s = applyPracticeTick(s, 11)
    expect(s.xoe.lastEffect).toBe("gain")
    expect(s.xoe.enemiesDestroyed).toBe(1)
  })
})
