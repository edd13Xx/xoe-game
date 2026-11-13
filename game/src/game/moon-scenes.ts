/**
 * Visual-only moon environments for the Sol / Xelm approach (and the small previews on the moon choice).
 * Original sleek sci-fi art: Xelm is cold (aurora, frost key-spires, ashglass craters, falling frost),
 * Sol is hot (corona, prominence arcs, molten ember ridges, rising embers). No gameplay, rewards,
 * economy, caps or network. Deterministic (no Math.random) so renders and screenshots are stable.
 */
import type { MoonId } from "./moons.ts"

export const MOON_SCENE_W = 320
export const MOON_SCENE_H = 160
export const MOON_HORIZON = 98

export type MoonSkyPhenomenon = "aurora" | "corona"
export type MoonTerrain = "frost-spires" | "ember-ridges"

export interface MoonScene {
  id: MoonId
  /** Short player-facing place name for the tag. */
  place: string
  /** Sky gradient, top → horizon. */
  sky: readonly [string, string, string]
  /** Far / near ground fills. */
  ground: readonly [string, string]
  /** Hard-light accent (lane edges, cracks, spire glints). */
  accent: string
  /** Accent used once the moon power lights the path. */
  powered: string
  phenomenon: MoonSkyPhenomenon
  terrain: MoonTerrain
  particle: { color: string; motion: "fall" | "rise"; shape: "flake" | "ember" }
}

export const MOON_SCENES: Record<MoonId, MoonScene> = {
  "moon-pair-a": {
    id: "moon-pair-a",
    place: "Frost Key Spires",
    sky: ["#03060f", "#0c1c33", "#3a6a8e"],
    ground: ["#1a2a3c", "#0d1724"],
    accent: "#9fe8ff",
    powered: "#b8f4ff",
    phenomenon: "aurora",
    terrain: "frost-spires",
    particle: { color: "#e6f6ff", motion: "fall", shape: "flake" },
  },
  "moon-pair-b": {
    id: "moon-pair-b",
    place: "Ember Ridge",
    sky: ["#0e0405", "#3a0f08", "#c2461a"],
    ground: ["#2a0e08", "#160705"],
    accent: "#ff8a3c",
    powered: "#ffd09a",
    phenomenon: "corona",
    terrain: "ember-ridges",
    particle: { color: "#ffb35a", motion: "rise", shape: "ember" },
  },
}

export function moonSceneFor(id: MoonId | string | null | undefined): MoonScene {
  return (id && MOON_SCENES[id as MoonId]) || MOON_SCENES["moon-pair-a"]
}

function rng(key: string) {
  let seed = 0
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export interface MoonParticle {
  x: number
  y: number
  size: number
  delay: number
  dur: number
}

/** Ambient particles: frost falls from the sky on Xelm, embers rise off the ridges on Sol. */
export function moonParticles(id: MoonId, count = 16, w = MOON_SCENE_W, h = MOON_SCENE_H): MoonParticle[] {
  const next = rng(`p:${id}`)
  const fall = moonSceneFor(id).particle.motion === "fall"
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * w),
    y: Math.round(fall ? 6 + next() * (h * 0.55) : MOON_HORIZON - 10 + next() * (h - MOON_HORIZON)),
    size: 0.8 + Math.round(next() * 16) / 10,
    delay: Math.round(next() * 50) / 10,
    dur: 3.2 + Math.round(next() * 30) / 10,
  }))
}

export interface MoonStar {
  x: number
  y: number
  r: number
  color: string
  delay: number
}

/** Irregular multicolored twinkling stars above the horizon (fewer on Sol, where the corona washes them out). */
export function moonStars(id: MoonId, w = MOON_SCENE_W): MoonStar[] {
  const next = rng(`s:${id}`)
  const count = id === "moon-pair-a" ? 22 : 10
  const colors = ["#ffffff", "#cfe4ff", "#ffe6b0", "#e0c8ff", "#a8f0ff"]
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * w),
    y: Math.round(4 + next() * (MOON_HORIZON - 30)),
    r: Math.round((0.4 + next() * 1.1) * 10) / 10,
    color: colors[Math.floor(next() * colors.length)],
    delay: Math.round(next() * 40) / 10,
  }))
}

/**
 * Far skyline: jagged crystalline spires on Xelm, rolling molten ridges on Sol.
 * Always starts at x=0 and ends at x=w, never rises above y=30 and closes along the bottom edge.
 */
export function moonSkylinePath(id: MoonId, w = MOON_SCENE_W, h = MOON_SCENE_H): string {
  const next = rng(`t:${id}`)
  const pts: string[] = [`M0 ${MOON_HORIZON}`]
  if (moonSceneFor(id).terrain === "frost-spires") {
    let x = 0
    while (x < w) {
      const step = 14 + Math.round(next() * 18)
      const peakX = Math.min(w, x + Math.round(step / 2))
      const tall = next() > 0.72
      const peakY = Math.max(30, Math.round(MOON_HORIZON - (tall ? 34 + next() * 26 : 6 + next() * 16)))
      x = Math.min(w, x + step)
      pts.push(`L${peakX} ${peakY}`, `L${x} ${MOON_HORIZON - Math.round(next() * 4)}`)
    }
  } else {
    let x = 0
    while (x < w) {
      const step = 40 + Math.round(next() * 30)
      const cx = Math.min(w, x + step / 2)
      const peakY = Math.max(30, Math.round(MOON_HORIZON - 10 - next() * 20))
      x = Math.min(w, x + step)
      pts.push(`Q${Math.round(cx)} ${peakY} ${x} ${MOON_HORIZON - Math.round(next() * 6)}`)
    }
  }
  pts.push(`L${w} ${h}`, `L0 ${h}Z`)
  return pts.join(" ")
}

export interface PathLight {
  x: number
  y: number
  r: number
  delay: number
}

/**
 * Guide lights along the approach lane, from XO in the foreground up to the gate at the horizon.
 * Perspective: lights shrink and pinch toward the vanishing point. Both edges get a light per step.
 */
export function pathLights(steps = 6, w = MOON_SCENE_W, h = MOON_SCENE_H): PathLight[] {
  const cx = w / 2
  const out: PathLight[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1) // 0 near → 1 far
    const y = Math.round((h - 6 - t * (h - 6 - (MOON_HORIZON + 4))) * 10) / 10
    const half = 70 * (1 - t) + 8 * t
    const r = Math.round((3 * (1 - t) + 1 * t) * 10) / 10
    const delay = Math.round(i * 0.12 * 100) / 100
    out.push({ x: Math.round((cx - half) * 10) / 10, y, r, delay }, { x: Math.round((cx + half) * 10) / 10, y, r, delay })
  }
  return out
}

/** One-line screen-reader / caption description of the moon environment. */
export function moonSceneLabel(id: MoonId, powered: boolean): string {
  const s = moonSceneFor(id)
  const base =
    s.terrain === "frost-spires"
      ? `${s.place}: aurora over frost-lit key-spires, ashglass craters and falling frost`
      : `${s.place}: a blazing corona over molten ridges, glowing cracks and rising embers`
  return powered ? `${base}. The lane lights are on and the gate is open.` : `${base}. The gate waits at the end of the lane.`
}
