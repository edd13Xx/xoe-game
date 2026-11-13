import { describe, expect, it } from "vitest"
import { minimapFit, minimapToWorld, projectMinimap, projectToMinimap } from "./minimap.ts"

const world = { w: 1200, h: 800 }
const small = { w: 120, h: 80, pad: 4 }

describe("v13 mini map projection", () => {
  it("fits the world uniformly inside the padded box", () => {
    const f = minimapFit(world, small)
    expect(f.s).toBeCloseTo(112 / 1200 < 72 / 800 ? 112 / 1200 : 72 / 800)
    const tl = projectToMinimap({ x: 0, y: 0 }, world, small)
    const br = projectToMinimap({ x: 1200, y: 800 }, world, small)
    expect(tl.x).toBeGreaterThanOrEqual(4)
    expect(tl.y).toBeGreaterThanOrEqual(4)
    expect(br.x).toBeLessThanOrEqual(116)
    expect(br.y).toBeLessThanOrEqual(76)
    // center maps to center
    const c = projectToMinimap({ x: 600, y: 400 }, world, small)
    expect(c.x).toBeCloseTo(60)
    expect(c.y).toBeCloseTo(40)
  })

  it("clamps off-world points and round-trips through minimapToWorld", () => {
    const off = projectToMinimap({ x: -500, y: 9999 }, world, small)
    expect(off).toEqual(projectToMinimap({ x: 0, y: 800 }, world, small))
    const big = { w: 300, h: 200, pad: 8 }
    for (const p of [{ x: 140, y: 160 }, { x: 980, y: 220 }, { x: 1200, y: 0 }]) {
      const back = minimapToWorld(projectToMinimap(p, world, big), world, big)
      expect(back.x).toBeCloseTo(p.x, 6)
      expect(back.y).toBeCloseTo(p.y, 6)
    }
    expect(minimapToWorld({ x: -50, y: 500 }, world, big)).toEqual({ x: 0, y: 800 })
  })

  it("projects player, colonies, hubs, enemies and pickups with player drawn last", () => {
    const dots = projectMinimap(
      {
        world,
        player: { x: 600, y: 400 },
        nodes: [
          { id: "a", x: 140, y: 160, kind: "colony", done: true },
          { id: "b", x: 360, y: 188, kind: "colony", next: true },
          { id: "c", x: 580, y: 160, kind: "colony", locked: true },
          { id: "d", x: 800, y: 188, kind: "colony" },
          { id: "daily", x: 980, y: 220, kind: "daily" },
        ],
        enemies: [{ id: "BTC-1", x: 300, y: 300 }],
        pickups: [{ id: "XLM-1", x: 900, y: 600 }],
      },
      small,
    )
    expect(dots.map((d) => d.kind)).toEqual([
      "colony-done",
      "colony-next",
      "colony-locked",
      "colony",
      "hub",
      "pickup",
      "enemy",
      "player",
    ])
    const player = dots.at(-1)!
    expect(player.x).toBeCloseTo(60)
    expect(player.r).toBeGreaterThan(dots[0]!.r)
    for (const d of dots) {
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThanOrEqual(small.w)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeLessThanOrEqual(small.h)
    }
  })
})
