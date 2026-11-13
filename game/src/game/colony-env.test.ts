import { describe, expect, it } from "vitest"
import { COLONIES } from "./colonies.ts"
import { COLONY_BIOMES, biomeFor, biomeParticles } from "./colony-env.ts"

describe("colony biomes", () => {
  it("gives every colony its own named environment", () => {
    const ids = COLONIES.map((c) => c.id)
    for (const id of ids) expect(COLONY_BIOMES[id]?.id).toBe(id)
    const biomes = ids.map((id) => biomeFor(id))
    expect(new Set(biomes.map((b) => b.name)).size).toBe(ids.length)
    expect(new Set(biomes.map((b) => b.terrain)).size).toBe(ids.length)
    expect(new Set(biomes.map((b) => b.sky.join())).size).toBe(ids.length)
    expect(new Set(biomes.map((b) => `${b.particle.motion}-${b.particle.shape}-${b.particle.color}`)).size).toBe(ids.length)
  })

  it("covers the practice exam and the bonus fees lesson, and falls back safely", () => {
    expect(biomeFor("practice-exam").terrain).toBe("exam-grid")
    expect(biomeFor("fees-leverage").terrain).toBe("fulcrum-mesa")
    expect(biomeFor("nope").id).toBe("orbit")
    expect(biomeFor(null).id).toBe("orbit")
  })

  it("places ambient particles deterministically inside the field", () => {
    const a = biomeParticles("wallet")
    expect(a).toEqual(biomeParticles("wallet"))
    expect(a).not.toEqual(biomeParticles("keys"))
    expect(a).toHaveLength(12)
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(320)
      expect(p.y).toBeGreaterThanOrEqual(20)
      expect(p.y).toBeLessThanOrEqual(248)
    }
  })

  it("stays original and visual-only", () => {
    const text = JSON.stringify(COLONY_BIOMES).toLowerCase()
    expect(text).not.toMatch(/zone of the enders|jehuty|anubis/)
  })
})
