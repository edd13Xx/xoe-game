import { describe, expect, it, beforeEach } from "vitest"
import {
  __resetLeaderboardCooldownForTests,
  createMockLeaderboardAdapter,
  readLeaderboardOptIn,
  sanitizeDisplayName,
  scoreLooksSane,
  writeLeaderboardOptIn,
  writeDisplayName,
  readDisplayName,
  LEADERBOARD_BACKEND_HOOK,
} from "./leaderboard-remote.ts"

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

describe("test leaderboard adapter", () => {
  beforeEach(() => __resetLeaderboardCooldownForTests())

  it("defaults opt-out, sanitizes names, and rejects bad scores", async () => {
    const store = mem()
    expect(readLeaderboardOptIn(store)).toBe(false)
    writeLeaderboardOptIn(store, true)
    expect(readLeaderboardOptIn(store)).toBe(true)
    expect(sanitizeDisplayName("Ada@mail.com")).not.toMatch(/@/)
    expect(sanitizeDisplayName("Cool Pilot!!!")).toBe("Cool Pilot")
    expect(scoreLooksSane(50)).toBe(true)
    expect(scoreLooksSane(0)).toBe(false)
    expect(scoreLooksSane(1.5)).toBe(false)
    writeDisplayName(store, "Eddie")
    expect(readDisplayName(store)).toBe("Eddie")
    expect(LEADERBOARD_BACKEND_HOOK.provider).toBe("mock")
  })

  it("mock list/submit with anti-spam cooldown", async () => {
    const store = mem()
    const api = createMockLeaderboardAdapter(store)
    expect(api.isTest).toBe(true)
    expect(api.label).toMatch(/test leaderboard/i)
    const bad = await api.submit({ displayName: "a@b.com", score: 10, kind: "arcade" })
    expect(bad.ok).toBe(false)
    const ok = await api.submit({ displayName: "Flyer", score: 55, kind: "arcade" })
    expect(ok.ok).toBe(true)
    const spam = await api.submit({ displayName: "Flyer", score: 56, kind: "arcade" })
    expect(spam.ok).toBe(false)
    const list = await api.list(5)
    expect(list[0]!.test).toBe(true)
    expect(list.some((e) => e.displayName === "Flyer")).toBe(true)
  })
})
