import { describe, expect, it } from "vitest"
import { buildOverworldNodes, chapterLockLabel, isNodeLocked, nextUnlockedColonyId } from "./overworld.ts"

describe("overworld gates", () => {
  it("locks colonies by Ch1 L1 / Ch2 L3 / Ch3 L5", () => {
    const nodes = buildOverworldNodes()
    const colonies = nodes.filter((n) => n.kind === "colony")
    expect(colonies.length).toBeGreaterThanOrEqual(8)
    expect(colonies[0]!.requiredLevel).toBe(1)
    // first three are Ch1; index 3 starts Ch2 L3
    expect(chapterLockLabel(colonies[3]!)).toMatch(/Ch2 L3/)
    expect(isNodeLocked(colonies[3]!, 1, [])).toBe(true)
    expect(isNodeLocked(colonies[3]!, 3, [])).toBe(false)
    expect(nodes.some((n) => n.kind === "daily")).toBe(true)
    expect(nodes.some((n) => n.kind === "weekly")).toBe(true)
    expect(nextUnlockedColonyId(nodes, 1, [])).toBe(colonies[0]!.id)
  })
})
