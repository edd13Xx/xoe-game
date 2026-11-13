import { describe, expect, it } from "vitest"
import { MOON_PATHS } from "./moons.ts"
import {
  MOON_HORIZON,
  MOON_SCENE_H,
  MOON_SCENE_W,
  moonParticles,
  moonSceneFor,
  moonSceneLabel,
  moonSkylinePath,
  moonStars,
  pathLights,
} from "./moon-scenes.ts"

describe("moon scenes (visual only)", () => {
  it("gives every moon path its own environment", () => {
    const scenes = MOON_PATHS.map((m) => moonSceneFor(m.id))
    expect(new Set(scenes.map((s) => s.terrain)).size).toBe(MOON_PATHS.length)
    expect(new Set(scenes.map((s) => s.phenomenon)).size).toBe(MOON_PATHS.length)
    expect(new Set(scenes.map((s) => s.sky.join())).size).toBe(MOON_PATHS.length)
    expect(moonSceneFor("moon-pair-a").particle.motion).toBe("fall")
    expect(moonSceneFor("moon-pair-b").particle.motion).toBe("rise")
    expect(moonSceneFor("unknown").id).toBe("moon-pair-a")
  })

  it("is deterministic and stays in the scene box", () => {
    for (const m of MOON_PATHS) {
      expect(moonParticles(m.id)).toEqual(moonParticles(m.id))
      expect(moonStars(m.id)).toEqual(moonStars(m.id))
      for (const p of moonParticles(m.id)) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(MOON_SCENE_W)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(MOON_SCENE_H)
      }
      for (const st of moonStars(m.id)) expect(st.y).toBeLessThan(MOON_HORIZON)
    }
    expect(moonStars("moon-pair-a").length).toBeGreaterThan(moonStars("moon-pair-b").length)
  })

  it("draws a closed skyline that spans the width and never climbs too high", () => {
    for (const m of MOON_PATHS) {
      const d = moonSkylinePath(m.id)
      expect(d.startsWith(`M0 ${MOON_HORIZON}`)).toBe(true)
      expect(d.endsWith(`L${MOON_SCENE_W} ${MOON_SCENE_H} L0 ${MOON_SCENE_H}Z`)).toBe(true)
      const ys = [...d.matchAll(/[LQM]\s?(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((x) => Number(x[2]))
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(30)
    }
    expect(moonSkylinePath("moon-pair-a")).toContain("L")
    expect(moonSkylinePath("moon-pair-b")).toContain("Q")
  })

  it("lane lights pinch toward the gate and light in order", () => {
    const lights = pathLights(6)
    expect(lights).toHaveLength(12)
    const near = lights[0]
    const far = lights[lights.length - 2]
    expect(near.y).toBeGreaterThan(far.y)
    expect(near.r).toBeGreaterThan(far.r)
    expect(Math.abs(lights[1].x - lights[0].x)).toBeGreaterThan(Math.abs(lights[11].x - lights[10].x))
    expect(far.y).toBeGreaterThan(MOON_HORIZON)
    expect(lights[2].delay).toBeGreaterThan(lights[0].delay)
  })

  it("labels describe the place and the gate state in plain words", () => {
    expect(moonSceneLabel("moon-pair-a", false)).toMatch(/Frost Key Spires.*aurora.*gate waits/i)
    expect(moonSceneLabel("moon-pair-b", true)).toMatch(/Ember Ridge.*corona.*gate is open/i)
    for (const m of MOON_PATHS) expect(moonSceneLabel(m.id, true)).not.toMatch(/XRP/)
  })
})
