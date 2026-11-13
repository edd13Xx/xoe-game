import { describe, expect, it } from "vitest"
import { playDangerAlarm } from "./danger-sfx.ts"
import { writeSfxPreference } from "./music.ts"

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

describe("danger sfx", () => {
  it("no-ops when SFX off", () => {
    const store = mem()
    writeSfxPreference(store, { enabled: false })
    expect(playDangerAlarm(store)).toBe(false)
  })
})
