import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { shouldAnimate } from "./dialogue.ts"

describe("pause freezes play + menu coverage", () => {
  it("storyPaused freezes animation loop", () => {
    expect(shouldAnimate({ hidden: false, reducedMotion: false, storyPaused: false })).toBe(true)
    expect(shouldAnimate({ hidden: false, reducedMotion: false, storyPaused: true })).toBe(false)
  })

  it("X Orbital menu lists every required item including Account & Wallet and Upgrade & Shop", () => {
    const src = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    for (const label of [
      "Resume",
      "Settings",
      "Grok Bot",
      "High scores",
      "Tutorial",
      "Report",
      "XOE trade desk",
      "Market",
      "Account & Wallet",
      "Quit to start",
      "Start",
      "Continue",
      "Pilot select",
      "Upgrade & Shop",
    ]) {
      expect(src).toMatch(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    }
    const app = readFileSync("src/App.tsx", "utf8")
    expect(app).toMatch(/playFrozen|pauseOpen/)
    expect(app).toMatch(/data-paused/)
    expect(app).toMatch(/XOrbitalMenu/)
  })
})
