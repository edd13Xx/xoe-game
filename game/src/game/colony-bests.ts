/** Per-colony best score / time. Device-only via safe storage. Never networked. */

export const COLONY_BESTS_STORAGE_KEY = "xoe.colonyBests.v1"

export interface ColonyBest {
  colonyId: string
  bestScore: number
  /** Best (lowest) clear time in ms, if recorded. */
  bestTimeMs: number | null
  atMs: number
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem?: (k: string) => void
}

export function readColonyBests(store: Store | null): Record<string, ColonyBest> {
  if (!store) return {}
  try {
    const raw = store.getItem(COLONY_BESTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<ColonyBest>>
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, ColonyBest> = {}
    for (const [id, row] of Object.entries(parsed)) {
      if (!row || typeof row.bestScore !== "number") continue
      out[id] = {
        colonyId: id,
        bestScore: Math.max(0, Math.floor(row.bestScore)),
        bestTimeMs:
          typeof row.bestTimeMs === "number" && row.bestTimeMs > 0
            ? Math.floor(row.bestTimeMs)
            : null,
        atMs: typeof row.atMs === "number" ? row.atMs : 0,
      }
    }
    return out
  } catch {
    return {}
  }
}

export function readColonyBest(store: Store | null, colonyId: string): ColonyBest | null {
  return readColonyBests(store)[colonyId] ?? null
}

/** Keep higher score; for time keep the lower (faster) when both present. */
export function recordColonyBest(
  store: Store | null,
  colonyId: string,
  score: number,
  timeMs: number | null = null,
): ColonyBest {
  const cleanScore = Math.max(0, Math.floor(score))
  const cleanTime =
    typeof timeMs === "number" && Number.isFinite(timeMs) && timeMs > 0
      ? Math.floor(timeMs)
      : null
  const all = readColonyBests(store)
  const prev = all[colonyId]
  const next: ColonyBest = {
    colonyId,
    bestScore: prev ? Math.max(prev.bestScore, cleanScore) : cleanScore,
    bestTimeMs:
      cleanTime == null
        ? (prev?.bestTimeMs ?? null)
        : prev?.bestTimeMs != null
          ? Math.min(prev.bestTimeMs, cleanTime)
          : cleanTime,
    atMs: Date.now(),
  }
  all[colonyId] = next
  if (store) {
    try {
      store.setItem(COLONY_BESTS_STORAGE_KEY, JSON.stringify(all))
    } catch {
      /* ignore */
    }
  }
  return next
}

export function formatColonyBestLabel(best: ColonyBest | null): string {
  if (!best || best.bestScore <= 0) return ""
  const parts = [`Best ${best.bestScore}`]
  if (best.bestTimeMs != null && best.bestTimeMs > 0) {
    const sec = best.bestTimeMs / 1000
    parts.push(sec >= 10 ? `${sec.toFixed(0)}s` : `${sec.toFixed(1)}s`)
  }
  return parts.join(" · ")
}
