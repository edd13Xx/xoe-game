import { describe, expect, it } from "vitest"
import { buildOverworldNodes } from "./overworld.ts"
import { TOWNS, isTownId, townById } from "./towns.ts"
import { qaCreditsFromUrl, qaModeFromUrl, qaTownFromUrl } from "./qa-flags.ts"

describe("colony-route towns", () => {
  it("names both towns and keeps them off the story-colony list", () => {
    expect(TOWNS.map((t) => t.id).sort()).toEqual(["aurora-port", "harbor-commons"])
    expect(townById("harbor-commons")?.name).toBe("Harbor Commons")
    expect(townById("aurora-port")?.name).toBe("Aurora Port")
    expect(isTownId("wallet")).toBe(false)
  })

  it("places both towns as enterable overworld nodes that do not overlap colonies", () => {
    const nodes = buildOverworldNodes()
    const towns = nodes.filter((n) => n.kind === "town")
    expect(towns.map((n) => n.id).sort()).toEqual(["aurora-port", "harbor-commons"])
    const others = nodes.filter((n) => n.kind !== "town")
    for (const town of towns) {
      for (const other of others) {
        const dx = town.x - other.x
        const dy = town.y - other.y
        expect(Math.hypot(dx, dy)).toBeGreaterThan(80)
      }
    }
  })

  it("gives each town a notice board and named NPCs to talk to", () => {
    for (const town of TOWNS) {
      expect(town.board.length).toBeGreaterThanOrEqual(3)
      expect(town.npcs.length).toBeGreaterThanOrEqual(3)
      expect(new Set(town.npcs.map((n) => n.id)).size).toBe(town.npcs.length)
      for (const npc of town.npcs) {
        expect(npc.lines.length).toBeGreaterThanOrEqual(2)
        expect(npc.name.length).toBeGreaterThan(1)
      }
    }
    expect(TOWNS.flatMap((t) => t.board).join(" ")).toMatch(/paper|practice|sim/i)
  })
})

describe("review-only town and credits flags", () => {
  it("parses town and credits query hooks without treating them as qa=1", () => {
    expect(qaTownFromUrl("?town=harbor-commons")).toBe("harbor-commons")
    expect(qaTownFromUrl("?town=aurora-port")).toBe("aurora-port")
    expect(qaTownFromUrl("?town=wallet")).toBe(null)
    expect(qaCreditsFromUrl("?credits=1")).toBe(true)
    expect(qaCreditsFromUrl("?qa=credits")).toBe(true)
    expect(qaCreditsFromUrl("?qa=1")).toBe(false)
    expect(qaModeFromUrl("?qa=credits")).toBe(false)
    expect(qaModeFromUrl("?town=harbor-commons")).toBe(false)
  })
})
