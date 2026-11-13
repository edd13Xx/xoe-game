/**
 * Visual-only overworld environments and moon landmarks.
 * Positions for colonies come from buildOverworldNodes(); moons are scenery, not gameplay nodes.
 */
import { buildOverworldNodes } from "../game/overworld.ts"

export type EnvKind = "colony" | "daily" | "weekly" | "bonus" | "moon" | "town"

export interface MapEnvironment {
  id: string
  name: string
  kind: EnvKind
  x: number
  y: number
  /** Short note for review / help copy. */
  look: string
}

/** Sol and Xelm as fly-over landmarks only. Unlock and powers stay on the existing moon-choice beat. */
export const MOON_SCENERY = [
  { id: "sol", name: "Sol", kind: "moon" as const, x: 640, y: 700, look: "Fiery ridge-glow, solar crown and a flare column." },
  { id: "xelm", name: "Xelm", kind: "moon" as const, x: 880, y: 720, look: "Ashglass craters and frost-lit key-spires." },
] as const

const LOOK: Record<string, string> = {
  wallet: "Lush kidney isle, mushroom houses, teal tree-lights and a beacon tower.",
  keys: "Key-shaped ridge, crystal key-spires and a crescent lock-ring.",
  blocks: "Stepped amber terraces chained into a block ziggurat.",
  fees: "Copper toll-bridge isle with coin-arch gates and reed grass.",
  stroops: "A cluster of mint droplet islets around a dew fountain.",
  scams: "Cracked crimson atoll, a false-front temple and thorn vines.",
  trustline: "Twin pale isles joined by a glowing trust bridge.",
  volatility: "Storm-torn wave isle with a lightning-rod spire.",
  phishing: "Hook-shaped cove, a bait lantern and drooping lure-kelp.",
  "seed-backup": "Armored forest mesa, vault door and a quiet lighthouse beam.",
  "daily-practice": "Circular sun-disk training ring with gold flags.",
  "weekly-practice": "Violet week-dial crescent and night lilies.",
  "fees-leverage": "Tilted bronze mesa with a lever-and-fulcrum landmark.",
  "harbor-commons": "Lantern piers, teal moorings and a harbor notice board.",
  "aurora-port": "Violet dock-spires under Sol and Xelm, strung with aurora cables.",
}

export function listMapEnvironments(): MapEnvironment[] {
  const nodes = buildOverworldNodes().map((n) => ({
    id: n.id,
    name: n.label,
    kind: n.kind as EnvKind,
    x: n.x,
    y: n.y,
    look: LOOK[n.id] ?? "Original floating colony isle.",
  }))
  return [...nodes, ...MOON_SCENERY.map((m) => ({ ...m }))]
}

export function moonSceneryIds(): readonly string[] {
  return MOON_SCENERY.map((m) => m.id)
}
