import { describe, expect, it, vi } from "vitest"
import { announceAchievement } from "./near-hook.ts"

describe("near-hook", () => {
  it("sends nothing when the game is not embedded", () => {
    vi.stubGlobal("window", { dispatchEvent: () => true })
    ;(globalThis as any).window.parent = (globalThis as any).window
    expect(announceAchievement("colony_cleared", "wallet")).toBe(false)
    vi.unstubAllGlobals()
  })
  it("posts one plain message to the parent page when embedded", () => {
    const post = vi.fn()
    vi.stubGlobal("window", { dispatchEvent: () => true, parent: { postMessage: post } })
    expect(announceAchievement("colony_cleared", "wallet")).toBe(true)
    expect(post).toHaveBeenCalledWith({ source: "xoe-game", type: "xoe:achievement", id: "colony_cleared", detail: "wallet" }, "*")
    vi.unstubAllGlobals()
  })
})
