import { describe, expect, it } from "vitest"
import {
  formatColonyBestLabel,
  readColonyBest,
  recordColonyBest,
} from "./colony-bests.ts"

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

describe("per-colony bests", () => {
  it("keeps higher score and faster time on device only", () => {
    const store = mem()
    recordColonyBest(store, "wallet", 100, 20000)
    recordColonyBest(store, "wallet", 80, 15000)
    recordColonyBest(store, "wallet", 120, 18000)
    const best = readColonyBest(store, "wallet")
    expect(best!.bestScore).toBe(120)
    expect(best!.bestTimeMs).toBe(15000)
    expect(formatColonyBestLabel(best)).toMatch(/Best 120/)
    expect(formatColonyBestLabel(best)).toMatch(/15/)
  })
})
