export interface MinimapModel {
  fade: "into-space"
  revealed: readonly string[]
  boss: {
    revealed: false
    labeled: false
    coordinatesPublished: false
    hint: "Unmarked density in the spinward fog"
    sector: "spinward"
  }
}

export function buildMinimap(explored: readonly string[]): MinimapModel {
  return {
    fade: "into-space",
    revealed: explored,
    boss: {
      revealed: false,
      labeled: false,
      coordinatesPublished: false,
      hint: "Unmarked density in the spinward fog",
      sector: "spinward",
    },
  }
}

export function bossRevealed(model: MinimapModel): boolean {
  const boss: object = model.boss
  return (
    model.boss.revealed ||
    model.boss.labeled ||
    model.boss.coordinatesPublished ||
    "x" in boss ||
    "y" in boss
  )
}

/* ---------------------------------------------------------------------------
 * v13 HUD mini map: pure projection (world → mini map pixels and back).
 * Shows the player, colonies/lessons + hubs, enemy units and Gestalt pickups.
 * ------------------------------------------------------------------------- */

export type MinimapDotKind = "player" | "colony" | "colony-done" | "colony-next" | "colony-locked" | "hub" | "enemy" | "pickup"

export interface MinimapDot {
  kind: MinimapDotKind
  x: number
  y: number
  r: number
  id?: string
}

export interface MinimapSize {
  w: number
  h: number
  pad: number
}

export interface MinimapInput {
  world: { w: number; h: number }
  player: { x: number; y: number }
  nodes: readonly { id: string; x: number; y: number; kind: string; done?: boolean; next?: boolean; locked?: boolean }[]
  enemies: readonly { id?: string; x: number; y: number }[]
  pickups: readonly { id?: string; x: number; y: number }[]
}

/** Uniform fit (keeps aspect), centered inside the padded box. */
export function minimapFit(world: { w: number; h: number }, size: MinimapSize): { s: number; ox: number; oy: number } {
  const iw = Math.max(1, size.w - size.pad * 2)
  const ih = Math.max(1, size.h - size.pad * 2)
  const s = Math.min(iw / world.w, ih / world.h)
  return { s, ox: (size.w - world.w * s) / 2, oy: (size.h - world.h * s) / 2 }
}

export function projectToMinimap(pt: { x: number; y: number }, world: { w: number; h: number }, size: MinimapSize) {
  const { s, ox, oy } = minimapFit(world, size)
  const cx = Math.min(world.w, Math.max(0, pt.x))
  const cy = Math.min(world.h, Math.max(0, pt.y))
  return { x: ox + cx * s, y: oy + cy * s }
}

/** Inverse of projectToMinimap (tap on the expanded map → fly target). Clamped to the world. */
export function minimapToWorld(pt: { x: number; y: number }, world: { w: number; h: number }, size: MinimapSize) {
  const { s, ox, oy } = minimapFit(world, size)
  return {
    x: Math.min(world.w, Math.max(0, (pt.x - ox) / s)),
    y: Math.min(world.h, Math.max(0, (pt.y - oy) / s)),
  }
}

/** Dots in draw order: nodes, pickups, enemies, then the player on top. Radius scales with map size. */
export function projectMinimap(input: MinimapInput, size: MinimapSize): MinimapDot[] {
  const base = Math.max(2, Math.round(Math.min(size.w, size.h) / 40))
  const dots: MinimapDot[] = []
  for (const n of input.nodes) {
    const p = projectToMinimap(n, input.world, size)
    const kind: MinimapDotKind =
      n.kind !== "colony" ? "hub" : n.done ? "colony-done" : n.next ? "colony-next" : n.locked ? "colony-locked" : "colony"
    dots.push({ kind, ...p, r: base + 1, id: n.id })
  }
  for (const it of input.pickups) dots.push({ kind: "pickup", ...projectToMinimap(it, input.world, size), r: base, id: it.id })
  for (const it of input.enemies) dots.push({ kind: "enemy", ...projectToMinimap(it, input.world, size), r: base, id: it.id })
  dots.push({ kind: "player", ...projectToMinimap(input.player, input.world, size), r: base + 2 })
  return dots
}
