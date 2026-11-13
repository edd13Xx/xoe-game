import { describe, expect, it } from "vitest"
import {
  FLARE_DASH_COOLDOWN_MS,
  FLARE_DASH_DURATION_MS,
  FROST_LOCK_COOLDOWN_MS,
  FROST_LOCK_DURATION_MS,
  MOON_POWERS,
  MOON_PATHS,
  abilityReady,
  powerById,
  suggestedPowerForMoon,
  suggestedVariantForMoon,
  variantById,
  writeStoredMoonPower,
  readStoredMoonPower,
  readStoredMoonVariant,
} from "./moons.ts"

describe("optional moon powers and variants", () => {
  it("offers Frost Lock variants Freeze/Slow-Mo and Flare Dash Speed Burst/Blink/Flare Shield plus No power", () => {
    const frost = powerById("frost-lock")!
    expect(frost.variants.map((v) => v.id)).toEqual(["freeze", "slow-mo"])
    expect(variantById("frost-lock", "freeze")?.durationMs).toBe(FROST_LOCK_DURATION_MS)
    expect(variantById("frost-lock", "freeze")?.cooldownMs).toBe(FROST_LOCK_COOLDOWN_MS)
    const flare = powerById("flare-dash")!
    expect(flare.variants.map((v) => v.id)).toEqual(["speed-burst", "blink", "flare-shield"])
    expect(variantById("flare-dash", "speed-burst")?.durationMs).toBe(FLARE_DASH_DURATION_MS)
    expect(variantById("flare-dash", "speed-burst")?.cooldownMs).toBe(FLARE_DASH_COOLDOWN_MS)
    expect(MOON_POWERS.some((p) => p.id === "none")).toBe(true)
    expect(suggestedPowerForMoon("moon-pair-a")).toBe("frost-lock")
    expect(suggestedVariantForMoon("moon-pair-a")).toBe("freeze")
    expect(suggestedPowerForMoon("moon-pair-b")).toBe("flare-dash")
    expect(suggestedVariantForMoon("moon-pair-b")).toBe("speed-burst")
    expect(MOON_PATHS).toHaveLength(2)
  })

  it("persists power+variant locally and gates readiness by variant cooldown", () => {
    const mem = new Map<string, string>()
    const store = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
    }
    expect(writeStoredMoonPower(store, "flare-dash", "blink")).toBe(true)
    expect(readStoredMoonPower(store)).toBe("flare-dash")
    expect(readStoredMoonVariant(store)).toBe("blink")
    const power = powerById("flare-dash")!
    const variant = variantById("flare-dash", "blink")!
    expect(abilityReady({ power, variant, lastUsedAtMs: null, nowMs: 1000 })).toBe(true)
    expect(abilityReady({ power, variant, lastUsedAtMs: 1000, nowMs: 1000 + variant.cooldownMs - 1 })).toBe(false)
    expect(abilityReady({ power, variant, lastUsedAtMs: 1000, nowMs: 1000 + variant.cooldownMs })).toBe(true)
  })
})
