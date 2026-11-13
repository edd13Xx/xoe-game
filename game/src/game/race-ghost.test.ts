import { describe, expect, it } from "vitest"
import {
  readRaceGhost,
  recordRaceGhost,
  shouldShowGhost,
  writeGhostPreference,
} from "./race-ghost.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

describe("race ghost", () => {
  it("keeps only the fastest path and respects toggle / reduced motion", () => {
    const store = mem()
    const path = [
      { x: 10, y: 10 },
      { x: 40, y: 40 },
      { x: 80, y: 30 },
      { x: 160, y: 40 },
    ]
    recordRaceGhost(store, "wallet", 20000, path)
    recordRaceGhost(store, "wallet", 25000, path)
    expect(readRaceGhost(store, "wallet")!.timeMs).toBe(20000)
    recordRaceGhost(store, "wallet", 15000, path)
    expect(readRaceGhost(store, "wallet")!.timeMs).toBe(15000)
    expect(shouldShowGhost(store, false)).toBe(true)
    expect(shouldShowGhost(store, true)).toBe(false)
    writeGhostPreference(store, { enabled: false })
    expect(shouldShowGhost(store, false)).toBe(false)
  })
})
