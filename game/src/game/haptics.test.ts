import { describe, expect, it } from "vitest"
import {
  canVibrate,
  hapticCorrectGate,
  hapticPulse,
  readHapticsPreference,
  writeHapticsPreference,
} from "./haptics.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
  }
}

describe("haptics", () => {
  it("persists preference and no-ops when reduced motion or disabled", () => {
    const store = mem()
    expect(readHapticsPreference(store).saved.enabled).toBe(true)
    writeHapticsPreference(store, { enabled: false })
    expect(readHapticsPreference(store).saved.enabled).toBe(false)
    expect(hapticPulse(store, 10)).toBe(false)
    writeHapticsPreference(store, { enabled: true })
    expect(hapticCorrectGate(store, { reducedMotion: true })).toBe(false)
    expect(typeof canVibrate()).toBe("boolean")
  })
})
