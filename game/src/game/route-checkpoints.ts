import { applyClassLevelBoost, readMeta, writeMeta, type MetaProgress } from "./meta-progress.ts"

export const ROUTE_CHECKPOINT_KEY = "xoe.routeCheckpoints.v1"
const CHECKPOINTS = [["blocks", 3], ["scams", 5]] as const

/** Approved option B: level floors only. No coins, ledger calls or XP formula changes. */
export function routeCheckpoint(meta: MetaProgress, colony: string): MetaProgress {
  const target = CHECKPOINTS.find(([id]) => id === colony)?.[1]
  if (!target || meta.level >= target) return meta
  let next = meta
  for (let level = meta.level + 1; level <= target; level++) next = applyClassLevelBoost(next, level)
  return { ...next, xp: 0 }
}

/** Idempotent first-clear settlement; also repairs a previously blocked local save. */
export function settleRouteCheckpoints(store: Parameters<typeof readMeta>[0], cleared: readonly string[]): MetaProgress {
  let meta = readMeta(store)
  let recorded: string[] = []
  try { const parsed: unknown = JSON.parse(store?.getItem(ROUTE_CHECKPOINT_KEY) ?? "[]"); if (Array.isArray(parsed)) recorded = parsed.filter((v): v is string => typeof v === "string") } catch { /* safe local fallback */ }
  let changed = false
  for (const [id] of CHECKPOINTS) {
    if (!cleared.includes(id) || recorded.includes(id)) continue
    meta = routeCheckpoint(meta, id)
    recorded.push(id)
    changed = true
  }
  if (changed) {
    writeMeta(store, meta)
    try { store?.setItem(ROUTE_CHECKPOINT_KEY, JSON.stringify(recorded)) } catch { /* safe-storage handles unavailable persistence */ }
  }
  return meta
}
