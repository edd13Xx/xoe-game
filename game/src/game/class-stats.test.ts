import { describe, expect, it } from "vitest"
import { PLAYER_CLASSES } from "./content.ts"
import {
  CLASS_COMBAT_TABLE,
  classCombatStats,
  defOffBarPercent,
  mapRosterClassToPlayerClass,
  statsAtLevel,
} from "./class-stats.ts"

describe("class combat balance table", () => {
  it("covers Sentinel, Striker, Recon with Eddie base DEF/OFF", () => {
    expect(PLAYER_CLASSES).toEqual(["Sentinel", "Striker", "Recon"])
    expect(CLASS_COMBAT_TABLE.Sentinel).toMatchObject({ defBase: 7, offBase: 3, healthBase: 120 })
    expect(CLASS_COMBAT_TABLE.Striker).toMatchObject({ defBase: 5, offBase: 5, healthBase: 100 })
    expect(CLASS_COMBAT_TABLE.Recon).toMatchObject({ defBase: 3, offBase: 7, healthBase: 75 })
    // Growth keeps the same ratio tilt
    expect(CLASS_COMBAT_TABLE.Sentinel.defGrowth).toBeGreaterThan(CLASS_COMBAT_TABLE.Sentinel.offGrowth)
    expect(CLASS_COMBAT_TABLE.Striker.defGrowth).toBe(CLASS_COMBAT_TABLE.Striker.offGrowth)
    expect(CLASS_COMBAT_TABLE.Recon.offGrowth).toBeGreaterThan(CLASS_COMBAT_TABLE.Recon.defGrowth)
  })

  it("grows stats per level in the class ratio", () => {
    expect(statsAtLevel("Sentinel", 1)).toEqual({ def: 7, off: 3, maxHealth: 120 })
    expect(statsAtLevel("Striker", 1)).toEqual({ def: 5, off: 5, maxHealth: 100 })
    expect(statsAtLevel("Recon", 1)).toEqual({ def: 3, off: 7, maxHealth: 75 })
    const s2 = statsAtLevel("Sentinel", 2)
    expect(s2.def).toBe(8.4)
    expect(s2.off).toBe(3.6)
    expect(s2.maxHealth).toBe(132)
    const r3 = statsAtLevel("Recon", 3)
    expect(r3.def).toBe(4.2)
    expect(r3.off).toBe(9.8)
    expect(r3.maxHealth).toBe(90)
    const k2 = statsAtLevel("Striker", 2)
    expect(k2.def).toBe(6)
    expect(k2.off).toBe(6)
    expect(k2.maxHealth).toBe(110)
  })

  it("maps roster class names 1:1 and fills bar percents", () => {
    for (const name of PLAYER_CLASSES) {
      expect(mapRosterClassToPlayerClass(name)).toBe(name)
      expect(classCombatStats(name).className).toBe(name)
    }
    expect(mapRosterClassToPlayerClass("Tank")).toBeNull()
    expect(defOffBarPercent(7)).toBe(70)
    expect(defOffBarPercent(10)).toBe(100)
    expect(defOffBarPercent(0)).toBe(0)
  })
})
