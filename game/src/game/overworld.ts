/**
 * Flat Mars-like overworld layout + chapter level gates.
 * Ch1 L1, Ch2 L3, Ch3 L5 — path highlights next unlock.
 */
import { COLONIES } from "./colonies.ts"
import { FEES_LEVERAGE_ID, FEES_LEVERAGE_NAME } from "./fees-leverage.ts"
import { TOWNS } from "./towns.ts"

export const WORLD_W = 1200
export const WORLD_H = 800
export const XO_SPEED = 210
export const ENTER_RADIUS = 42

/** v18: "bonus" = optional lesson dome (not a story colony; never locked; not needed for the moons). */
export type OverworldNodeKind = "colony" | "daily" | "weekly" | "bonus" | "town"

export interface OverworldNode {
  id: string
  label: string
  kind: OverworldNodeKind
  x: number
  y: number
  /** Required pilot level to enter (colonies). */
  requiredLevel: number
  chapter: 1 | 2 | 3 | null
  storyOrder: number
}

/** Story-order path through colonies, then daily/weekly hubs. */
export function buildOverworldNodes(): OverworldNode[] {
  const colonyNodes: OverworldNode[] = COLONIES.map((c, i) => {
    const chapter = (i < 3 ? 1 : i < 6 ? 2 : 3) as 1 | 2 | 3
    const requiredLevel = chapter === 1 ? 1 : chapter === 2 ? 3 : 5
    // Path snakes across the map
    const x = 140 + (i % 4) * 220 + (i % 2) * 30
    const y = 160 + Math.floor(i / 4) * 240 + (i % 2) * 28
    return {
      id: c.id,
      label: c.name,
      kind: "colony",
      x,
      y,
      requiredLevel,
      chapter,
      storyOrder: i,
    }
  })
  return [
    ...colonyNodes,
    {
      id: "daily-practice",
      label: "Daily practice",
      kind: "daily",
      x: 980,
      y: 220,
      requiredLevel: 1,
      chapter: null,
      storyOrder: colonyNodes.length,
    },
    {
      id: "weekly-practice",
      label: "Weekly practice",
      kind: "weekly",
      x: 1000,
      y: 480,
      requiredLevel: 1,
      chapter: null,
      storyOrder: colonyNodes.length + 1,
    },
    {
      id: FEES_LEVERAGE_ID,
      label: `${FEES_LEVERAGE_NAME} (bonus)`,
      kind: "bonus",
      x: 1040,
      y: 680,
      requiredLevel: 1,
      chapter: null,
      storyOrder: colonyNodes.length + 2,
    },
    ...TOWNS.map((town, i) => ({
      id: town.id,
      label: town.name,
      kind: "town" as const,
      x: town.x,
      y: town.y,
      requiredLevel: 1,
      chapter: null,
      storyOrder: colonyNodes.length + 3 + i,
    })),
  ]
}

export function chapterLockLabel(node: OverworldNode): string {
  if (node.kind !== "colony" || !node.chapter) return ""
  return `Ch${node.chapter} L${node.requiredLevel}`
}

export function isNodeLocked(node: OverworldNode, pilotLevel: number, cleared: readonly string[]): boolean {
  if (node.kind !== "colony") return false
  if (cleared.includes(node.id)) return false
  return pilotLevel < node.requiredLevel
}

/** Next unlocked colony in story order (for path highlight). */
export function nextUnlockedColonyId(
  nodes: readonly OverworldNode[],
  pilotLevel: number,
  cleared: readonly string[],
): string | null {
  const colonies = nodes.filter((n) => n.kind === "colony").sort((a, b) => a.storyOrder - b.storyOrder)
  for (const n of colonies) {
    if (cleared.includes(n.id)) continue
    if (!isNodeLocked(n, pilotLevel, cleared)) return n.id
  }
  return null
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
