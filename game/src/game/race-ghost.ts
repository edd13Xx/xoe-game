/** Faint path of your fastest colony clear. Device-only. */

export const RACE_GHOST_STORAGE_KEY = "xoe.raceGhosts.v1"
export const RACE_GHOST_PREF_KEY = "xoe.raceGhostPref.v1"

export interface GhostPoint {
  x: number
  y: number
}

export interface RaceGhost {
  colonyId: string
  timeMs: number
  path: GhostPoint[]
  atMs: number
}

export interface RaceGhostPreference {
  enabled: boolean
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
}

const MAX_POINTS = 48

export function readGhostPreference(store: Store | null): RaceGhostPreference {
  const fallback = { enabled: true }
  if (!store) return fallback
  try {
    const raw = store.getItem(RACE_GHOST_PREF_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<RaceGhostPreference>
    return { enabled: parsed.enabled !== false }
  } catch {
    return fallback
  }
}

export function writeGhostPreference(store: Store | null, pref: RaceGhostPreference): boolean {
  if (!store) return false
  try {
    store.setItem(RACE_GHOST_PREF_KEY, JSON.stringify({ enabled: pref.enabled === true }))
    return true
  } catch {
    return false
  }
}

export function readRaceGhosts(store: Store | null): Record<string, RaceGhost> {
  if (!store) return {}
  try {
    const raw = store.getItem(RACE_GHOST_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<RaceGhost>>
    const out: Record<string, RaceGhost> = {}
    for (const [id, row] of Object.entries(parsed)) {
      if (!row || !Array.isArray(row.path) || typeof row.timeMs !== "number") continue
      out[id] = {
        colonyId: id,
        timeMs: Math.max(1, Math.floor(row.timeMs)),
        path: row.path
          .filter((p): p is GhostPoint => !!p && typeof p.x === "number" && typeof p.y === "number")
          .slice(0, MAX_POINTS),
        atMs: typeof row.atMs === "number" ? row.atMs : 0,
      }
    }
    return out
  } catch {
    return {}
  }
}

export function readRaceGhost(store: Store | null, colonyId: string): RaceGhost | null {
  return readRaceGhosts(store)[colonyId] ?? null
}

/** Keep ghost only when this clear is strictly faster (or first). */
export function recordRaceGhost(
  store: Store | null,
  colonyId: string,
  timeMs: number,
  path: readonly GhostPoint[],
): RaceGhost | null {
  const cleanTime = Math.max(1, Math.floor(timeMs))
  const cleanPath = downsample(path, MAX_POINTS)
  if (cleanPath.length < 2) return readRaceGhost(store, colonyId)
  const all = readRaceGhosts(store)
  const prev = all[colonyId]
  if (prev && prev.timeMs <= cleanTime) return prev
  const next: RaceGhost = { colonyId, timeMs: cleanTime, path: cleanPath, atMs: Date.now() }
  all[colonyId] = next
  if (store) {
    try {
      store.setItem(RACE_GHOST_STORAGE_KEY, JSON.stringify(all))
    } catch {
      /* ignore */
    }
  }
  return next
}

export function downsample(path: readonly GhostPoint[], max: number): GhostPoint[] {
  if (path.length <= max) return path.map((p) => ({ x: p.x, y: p.y }))
  const out: GhostPoint[] = []
  const step = (path.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) {
    const p = path[Math.round(i * step)]!
    out.push({ x: p.x, y: p.y })
  }
  return out
}

export function shouldShowGhost(store: Store | null, reducedMotion: boolean): boolean {
  if (reducedMotion) return false
  return readGhostPreference(store).enabled
}
