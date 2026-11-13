import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import {
  TUTORIAL_STEPS,
  markTutorialComplete,
  nextTutorialStep,
  readTutorialProgress,
  resetTutorialForReplay,
  shouldShowTutorial,
  writeTutorialProgress,
} from "./tutorial.ts"

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

describe("tutorial", () => {
  it("has five skippable steps covering fly, lessons, moons, paper", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(6)
    const blob = TUTORIAL_STEPS.map((s) => `${s.title} ${s.body}`).join(" ")
    expect(blob).toMatch(/fly/i)
    expect(blob).toMatch(/gate/i)
    expect(blob).toMatch(/Frost Lock|Flare Dash/)
    expect(blob).toMatch(/[Pp]aper/)
    expect(blob).toMatch(/[Tt]ap|[Cc]lick/)
    expect(blob).toMatch(/cold storage/i)
    expect(blob).toMatch(/side mission/i)
    expect(blob).not.toMatch(/TODO|placeholder/i)
  })

  it("includes a skippable show-me demo on the How to fly step", () => {
    const fly = TUTORIAL_STEPS.find((s) => s.id === "fly")
    expect(fly).toBeTruthy()
    const panel = readFileSync("src/ui/TutorialPanel.tsx", "utf8")
    const demo = readFileSync("src/ui/TutorialDemo.tsx", "utf8")
    expect(panel).toMatch(/TutorialDemo/)
    expect(demo).toMatch(/Skip demo/)
    expect(demo).toMatch(/sample gate|Correct gate/i)
  })

  it("persists complete and replay via safe store", () => {
    const store = mem()
    expect(shouldShowTutorial(store)).toBe(true)
    writeTutorialProgress(store, { completed: false, step: 2 })
    expect(readTutorialProgress(store).step).toBe(2)
    markTutorialComplete(store)
    expect(shouldShowTutorial(store)).toBe(false)
    resetTutorialForReplay(store)
    expect(shouldShowTutorial(store)).toBe(true)
    expect(nextTutorialStep(TUTORIAL_STEPS.length - 1)).toBeNull()
    expect(nextTutorialStep(0)).toBe(1)
  })
})
