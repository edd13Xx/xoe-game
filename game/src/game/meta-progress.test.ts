import { describe, expect, it } from "vitest"
import {
  ENERGY_REFILL_COIN_COST,
  XOE_COIN_CAP,
  XOE_ENERGY_MAX,
  XP_PER_LEVEL,
  initialMeta,
  settleRunCoins,
  xpNeededToCompleteLevel,
} from "./meta-progress.ts"
import { statsAtLevel } from "./class-stats.ts"

describe("return-to-map coin split (no halving)", () => {
  it("1) refills energy, 2) XP to one level cap, 3) remainder to XOE Vault", () => {
    let meta = initialMeta("Sentinel")
    meta = { ...meta, energy: 40, xp: 80, level: 1 } // need 20 XP to level; energy needs 60
    // Full energy refill costs ENERGY_REFILL_COIN_COST from 0; from 40 need 60% → 12 coins
    const coinsForEnergy = Math.ceil(((XOE_ENERGY_MAX - 40) / XOE_ENERGY_MAX) * ENERGY_REFILL_COIN_COST)
    expect(coinsForEnergy).toBe(12)
    const runCoins = 100 // plenty
    const { meta: next, breakdown } = settleRunCoins(meta, runCoins)

    expect(next.energy).toBe(XOE_ENERGY_MAX)
    expect(breakdown.coinsSpentOnEnergy).toBe(12)
    // XP: need 20 to complete level 1 → at most one level-up
    expect(breakdown.xpGained).toBe(20)
    expect(breakdown.leveledUp).toBe(true)
    expect(next.level).toBe(2)
    expect(next.xp).toBe(0)
    // Class boost applied
    expect(next.def).toBe(statsAtLevel("Sentinel", 2).def)
    expect(next.off).toBe(statsAtLevel("Sentinel", 2).off)
    // Remainder → vault: 100 - 12 - 20 = 68 (NO half)
    expect(breakdown.vaultGained).toBe(68)
    expect(next.vault).toBe(68)
    expect(breakdown.summary).toBe("Energy +60, XP +20, Vault +68")
  })

  it("does not halve coins and vault is uncapped while pocket stays capped", () => {
    const meta = { ...initialMeta("Striker"), energy: XOE_ENERGY_MAX, xp: 0, level: 1, vault: 50 }
    // Energy full → 0 spent on energy; XP needs 100 for level; rest vault
    const { meta: next, breakdown } = settleRunCoins(meta, 250)
    expect(breakdown.coinsSpentOnEnergy).toBe(0)
    expect(breakdown.xpGained).toBe(XP_PER_LEVEL) // one level only
    expect(breakdown.leveledUp).toBe(true)
    expect(breakdown.vaultGained).toBe(150) // 250 - 0 - 100
    expect(next.vault).toBe(200) // 50 + 150
    // No halving anywhere
    expect(breakdown.vaultGained + breakdown.coinsSpentOnXp + breakdown.coinsSpentOnEnergy).toBe(250)
  })

  it("limits XP conversion to completing the current level only", () => {
    const meta = { ...initialMeta("Recon"), energy: XOE_ENERGY_MAX, xp: 0, level: 3 }
    expect(xpNeededToCompleteLevel(meta)).toBe(XP_PER_LEVEL * 3)
    const { meta: next, breakdown } = settleRunCoins(meta, 9999)
    expect(breakdown.leveledUp).toBe(true)
    expect(next.level).toBe(4)
    expect(breakdown.xpGained).toBe(XP_PER_LEVEL * 3)
    // Huge remainder goes to vault, not a second level
    expect(breakdown.vaultGained).toBe(9999 - XP_PER_LEVEL * 3)
    expect(next.def).toBe(statsAtLevel("Recon", 4).def)
  })

  it("keeps pocket coin cap at 9999 and never expires flag semantics", () => {
    expect(XOE_COIN_CAP).toBe(9999)
    expect(ENERGY_REFILL_COIN_COST).toBeGreaterThan(0)
  })
})
