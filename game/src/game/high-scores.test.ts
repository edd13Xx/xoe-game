import { describe, expect, it } from "vitest"
import {
  LEADERBOARD_TOP,
  readLeaderboard,
  recordPersonalBest,
  resetLeaderboard,
} from "./meta-progress.ts"

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

describe("private high scores", () => {
  it("stores top scores on device and resets locally", () => {
    const store = mem()
    recordPersonalBest(store, 120, "Arcade · wallet")
    recordPersonalBest(store, 90, "Arcade · keys")
    recordPersonalBest(store, 200, "Arcade · trustline")
    const board = readLeaderboard(store)
    expect(board[0]!.score).toBe(200)
    expect(board.length).toBeLessThanOrEqual(LEADERBOARD_TOP)
    expect(board[0]!.label).toContain("trustline")
    resetLeaderboard(store)
    expect(readLeaderboard(store)).toEqual([])
  })
})
