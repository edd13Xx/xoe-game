import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { buildOverworldNodes } from "../game/overworld.ts"
import { listMapEnvironments, moonSceneryIds } from "./overworld-scenery.ts"

describe("overworld scenery", () => {
  it("gives every colony, hub and both moons a unique environment", () => {
    const envs = listMapEnvironments()
    const ids = envs.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(["wallet", "keys", "blocks", "fees", "stroops", "scams", "trustline", "volatility", "phishing", "seed-backup", "daily-practice", "weekly-practice", "fees-leverage", "sol", "xelm", "harbor-commons", "aurora-port"]))
    expect(envs).toHaveLength(17)
    expect(new Set(envs.map((e) => e.look)).size).toBe(17)
  })

  it("keeps Sol and Xelm as scenery, not gameplay nodes", () => {
    const nodeIds = buildOverworldNodes().map((n) => n.id)
    for (const id of moonSceneryIds()) {
      expect(nodeIds).not.toContain(id)
    }
  })

  it("does not move existing overworld node coordinates", () => {
    const nodes = buildOverworldNodes()
    const envs = listMapEnvironments()
    for (const n of nodes) {
      const env = envs.find((e) => e.id === n.id)
      expect(env?.x).toBe(n.x)
      expect(env?.y).toBe(n.y)
    }
  })

  it("stops scenery motion when reduced motion is set", () => {
    const css = readFileSync(new URL("../index.css", import.meta.url), "utf8")
    expect(css).toMatch(/prefers-reduced-motion: reduce/)
    expect(css).toMatch(/#scene\[data-reduced-motion="true"\]/)
    expect(css).toMatch(/\.map-star-twinkle/)
  })
})
