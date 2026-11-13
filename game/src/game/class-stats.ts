/**
 * Pilot class combat balance: DEF / OFF base + per-level auto growth.
 * Classes map 1:1 to PLAYER_CLASSES: Sentinel, Striker, Recon.
 */
import type { PlayerClassName } from "./content.ts"

export const CLASS_STAT_MAX_DISPLAY = 10

export interface ClassCombatStats {
  className: PlayerClassName
  /** Base defense at level 1 */
  defBase: number
  /** Base offense at level 1 */
  offBase: number
  /** DEF gained each level after 1 */
  defGrowth: number
  /** OFF gained each level after 1 */
  offGrowth: number
  /** Base max HEALTH (XOE lifeblood) at level 1 */
  healthBase: number
  /** Max HEALTH gained each level after 1 (keeps class gap noticeable) */
  healthGrowth: number
  blurb: string
}

/** Suggested Eddie balance: Sentinel tank, Striker even, Recon glass cannon. */
export const CLASS_COMBAT_TABLE: Record<PlayerClassName, ClassCombatStats> = {
  Sentinel: {
    className: "Sentinel",
    defBase: 7,
    offBase: 3,
    defGrowth: 1.4,
    offGrowth: 0.6,
    healthBase: 120,
    healthGrowth: 12,
    blurb: "High defense, low offense.",
  },
  Striker: {
    className: "Striker",
    defBase: 5,
    offBase: 5,
    defGrowth: 1.0,
    offGrowth: 1.0,
    healthBase: 100,
    healthGrowth: 10,
    blurb: "Even defense and offense.",
  },
  Recon: {
    className: "Recon",
    defBase: 3,
    offBase: 7,
    defGrowth: 0.6,
    offGrowth: 1.4,
    healthBase: 75,
    healthGrowth: 7.5,
    blurb: "Low defense, high offense.",
  },
}

export function classCombatStats(name: PlayerClassName): ClassCombatStats {
  return CLASS_COMBAT_TABLE[name]
}

/** Level is 1-based. Growth applies for each level above 1. */
export function statsAtLevel(
  name: PlayerClassName,
  level: number,
): { def: number; off: number; maxHealth: number } {
  const row = CLASS_COMBAT_TABLE[name]
  const lv = Math.max(1, Math.floor(level))
  const steps = lv - 1
  return {
    def: round1(row.defBase + row.defGrowth * steps),
    off: round1(row.offBase + row.offGrowth * steps),
    maxHealth: round1(row.healthBase + row.healthGrowth * steps),
  }
}

export function maxHealthAtLevel(name: PlayerClassName, level: number): number {
  return statsAtLevel(name, level).maxHealth
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function defOffBarPercent(value: number, max = CLASS_STAT_MAX_DISPLAY): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

/** Map roster character class name → player class (identity mapping). */
export function mapRosterClassToPlayerClass(name: string): PlayerClassName | null {
  if (name === "Sentinel" || name === "Striker" || name === "Recon") return name
  return null
}
