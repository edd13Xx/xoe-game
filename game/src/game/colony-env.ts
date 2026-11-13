/**
 * Visual-only colony environments ("biomes") for the lesson flight field and the map isles.
 * Original sleek sci-fi palettes and motifs. No gameplay, rewards, economy or network.
 */

export type BiomeTerrain =
  | "spore-hills"
  | "crystal-spires"
  | "block-terraces"
  | "toll-arches"
  | "dew-shoals"
  | "cracked-atoll"
  | "twin-isles"
  | "storm-waves"
  | "kelp-cove"
  | "vault-mesa"
  | "exam-grid"
  | "fulcrum-mesa"
  | "plain-orbit"

export type BiomeMotion = "rise" | "fall" | "drift" | "glint"

export interface ColonyBiome {
  id: string
  /** Short player-facing name of the place. */
  name: string
  /** Sky gradient, top → horizon. */
  sky: readonly [string, string, string]
  /** Rim/hard-light accent used for the horizon line and grid. */
  accent: string
  /** Near and far terrain fills. */
  ground: readonly [string, string]
  /** Body hanging in the sky (planet, moon or star). */
  skyBody: { color: string; ring: boolean; x: number; y: number; r: number }
  terrain: BiomeTerrain
  particle: { color: string; motion: BiomeMotion; shape: "dot" | "shard" | "square" | "streak" }
}

const B = (b: ColonyBiome) => b

export const COLONY_BIOMES: Record<string, ColonyBiome> = {
  wallet: B({
    id: "wallet", name: "Verdant Spore Isle",
    sky: ["#0c2a3a", "#1b5a5a", "#4fd1a8"], accent: "#7dffd6", ground: ["#123d2e", "#1f6a4a"],
    skyBody: { color: "#c4b5fd", ring: true, x: 250, y: 46, r: 18 },
    terrain: "spore-hills", particle: { color: "#9effd8", motion: "rise", shape: "dot" },
  }),
  keys: B({
    id: "keys", name: "Cobalt Key Spires",
    sky: ["#070a24", "#1c2560", "#5a6fd8"], accent: "#a8b4ff", ground: ["#141a3c", "#2a3358"],
    skyBody: { color: "#dbe4ff", ring: false, x: 64, y: 40, r: 12 },
    terrain: "crystal-spires", particle: { color: "#dbe4ff", motion: "glint", shape: "shard" },
  }),
  blocks: B({
    id: "blocks", name: "Amber Block Terraces",
    sky: ["#2a1406", "#7a3d12", "#f0a040"], accent: "#ffd08a", ground: ["#4a2a10", "#8a6230"],
    skyBody: { color: "#ffd27a", ring: false, x: 230, y: 70, r: 24 },
    terrain: "block-terraces", particle: { color: "#ffcf7a", motion: "drift", shape: "square" },
  }),
  fees: B({
    id: "fees", name: "Copper Toll Flats",
    sky: ["#1c0c08", "#5a2614", "#d0703c"], accent: "#f0c070", ground: ["#3a1a10", "#8a4a32"],
    skyBody: { color: "#f0c070", ring: true, x: 70, y: 52, r: 16 },
    terrain: "toll-arches", particle: { color: "#ffd56a", motion: "glint", shape: "dot" },
  }),
  stroops: B({
    id: "stroops", name: "Mint Dew Shoals",
    sky: ["#04202a", "#0e5a66", "#5ee8d0"], accent: "#b8fff0", ground: ["#0c4a48", "#1f7a6a"],
    skyBody: { color: "#e0fff8", ring: false, x: 240, y: 44, r: 14 },
    terrain: "dew-shoals", particle: { color: "#c8fff4", motion: "rise", shape: "dot" },
  }),
  scams: B({
    id: "scams", name: "Crimson False Atoll",
    sky: ["#14040a", "#4a0c18", "#c02a3a"], accent: "#ff5a6a", ground: ["#2a0810", "#4a1520"],
    skyBody: { color: "#ff7a6a", ring: false, x: 80, y: 60, r: 20 },
    terrain: "cracked-atoll", particle: { color: "#ff8a5a", motion: "rise", shape: "square" },
  }),
  trustline: B({
    id: "trustline", name: "Pale Twin Isles",
    sky: ["#16223a", "#4a6a9a", "#cfe4ff"], accent: "#eef8ff", ground: ["#7a90b0", "#dce8ff"],
    skyBody: { color: "#ffffff", ring: true, x: 160, y: 38, r: 12 },
    terrain: "twin-isles", particle: { color: "#ffffff", motion: "drift", shape: "dot" },
  }),
  volatility: B({
    id: "volatility", name: "Stormwave Reach",
    sky: ["#0a0414", "#2a0f44", "#7c3aed"], accent: "#e879f9", ground: ["#1c0a2a", "#3a1548"],
    skyBody: { color: "#f0e68c", ring: false, x: 260, y: 36, r: 8 },
    terrain: "storm-waves", particle: { color: "#c4b5fd", motion: "fall", shape: "streak" },
  }),
  phishing: B({
    id: "phishing", name: "Lure-Kelp Cove",
    sky: ["#060c04", "#1c2a0c", "#5a6b24"], accent: "#d4ff6a", ground: ["#141c08", "#3d4a1a"],
    skyBody: { color: "#d4ff6a", ring: false, x: 70, y: 46, r: 10 },
    terrain: "kelp-cove", particle: { color: "#d4ff6a", motion: "rise", shape: "dot" },
  }),
  "seed-backup": B({
    id: "seed-backup", name: "Vault Forest Mesa",
    sky: ["#05080c", "#1a2430", "#4a5a6a"], accent: "#d7e7ff", ground: ["#1a2218", "#3f4a3a"],
    skyBody: { color: "#d7e7ff", ring: false, x: 60, y: 40, r: 14 },
    terrain: "vault-mesa", particle: { color: "#f5e27a", motion: "glint", shape: "dot" },
  }),
  "practice-exam": B({
    id: "practice-exam", name: "Hard-Light Exam Grid",
    sky: ["#06030f", "#1a1233", "#5b3fd0"], accent: "#a78bfa", ground: ["#0b0820", "#1a1233"],
    skyBody: { color: "#78e6ff", ring: true, x: 250, y: 50, r: 16 },
    terrain: "exam-grid", particle: { color: "#78e6ff", motion: "glint", shape: "shard" },
  }),
  "fees-leverage": B({
    id: "fees-leverage", name: "Bronze Fulcrum Mesa",
    sky: ["#140a04", "#4a2a10", "#c9a227"], accent: "#e8c878", ground: ["#2a1808", "#6a4020"],
    skyBody: { color: "#ffb347", ring: false, x: 240, y: 56, r: 22 },
    terrain: "fulcrum-mesa", particle: { color: "#e8c878", motion: "drift", shape: "dot" },
  }),
}

const FALLBACK: ColonyBiome = {
  id: "orbit", name: "Open Orbit",
  sky: ["#06030f", "#1a1233", "#3a2a70"], accent: "#a78bfa", ground: ["#0b0d12", "#1a1233"],
  skyBody: { color: "#c4b5fd", ring: false, x: 240, y: 50, r: 14 },
  terrain: "plain-orbit", particle: { color: "#c4b5fd", motion: "glint", shape: "dot" },
}

export function biomeFor(id: string | null | undefined): ColonyBiome {
  return (id && COLONY_BIOMES[id]) || FALLBACK
}

export interface BiomeParticle {
  x: number
  y: number
  size: number
  delay: number
  dur: number
}

/** Deterministic ambient particles (no Math.random) so renders and screenshots are stable. */
export function biomeParticles(id: string, count = 12, w = 320, h = 248): BiomeParticle[] {
  let seed = 0
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * w),
    y: Math.round(20 + next() * (h - 60)),
    size: 1.2 + Math.round(next() * 25) / 10,
    delay: Math.round(next() * 40) / 10,
    dur: 3 + Math.round(next() * 40) / 10,
  }))
}
