import { describe, expect, it } from "vitest"
import { HEALTH_ITEMS, vaultBonusFraction, VAULT_BONUS_CAP, buyHealthItem } from "./health-shop.ts"
import { initialMeta } from "./meta-progress.ts"

describe("health shop + vault bonus", () => {
  it("sells health items only and caps vault bonus at 50%", () => {
    expect(HEALTH_ITEMS.every((i) => i.heal > 0 && !/weapon|gun|sword/i.test(i.label))).toBe(true)
    expect(vaultBonusFraction(0)).toBe(0)
    expect(vaultBonusFraction(100)).toBe(0.01)
    expect(vaultBonusFraction(5000)).toBe(VAULT_BONUS_CAP)
    expect(vaultBonusFraction(99999)).toBe(0.5)
  })

  it("buys heal from pocket or vault", () => {
    let meta = { ...initialMeta("Striker"), coins: 15, energy: 40 }
    const a = buyHealthItem(meta, "stim-small")
    expect(a?.meta.coins).toBe(0)
    expect(a!.meta.energy).toBeGreaterThan(40)
    meta = { ...initialMeta("Recon"), coins: 0, vault: 60, energy: 10 }
    const b = buyHealthItem(meta, "stim-full")
    expect(b?.meta.vault).toBe(0)
    expect(b!.meta.energy).toBe(100)
  })
})
