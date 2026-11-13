/**
 * Online leaderboard — pluggable adapter.
 * Default: local/test mock (device-only). Marked "test leaderboard".
 * Sim/arcade scores only. Display name (no email). Opt-in.
 *
 * Later: swap createLeaderboardAdapter() to Supabase/Firebase — see LEADERBOARD_BACKEND_HOOK.
 */

export const LEADERBOARD_OPT_IN_KEY = "xoe.leaderboardOptIn.v1"
export const LEADERBOARD_NAME_KEY = "xoe.leaderboardDisplayName.v1"
export const LEADERBOARD_MOCK_KEY = "xoe.leaderboardMock.v1"
export const LEADERBOARD_MAX_SCORE = 1_000_000
export const LEADERBOARD_MIN_SCORE = 1
export const LEADERBOARD_NAME_MAX = 24
export const LEADERBOARD_SUBMIT_COOLDOWN_MS = 8_000
export const LEADERBOARD_TOP_N = 10

/** Documented hook for a future real backend (not wired). */
export const LEADERBOARD_BACKEND_HOOK = {
  provider: "mock" as "mock" | "supabase" | "firebase",
  note: "Set provider and pass env/config into createLeaderboardAdapter. No accounts created in this build.",
  supabase: { urlEnv: "VITE_SUPABASE_URL", anonKeyEnv: "VITE_SUPABASE_ANON_KEY", table: "xoe_paper_scores" },
  firebase: { configEnv: "VITE_FIREBASE_CONFIG", collection: "xoe_paper_scores" },
}

export type LeaderboardKind = "paper" | "arcade"

export interface LeaderboardEntry {
  id: string
  displayName: string
  score: number
  kind: LeaderboardKind
  atMs: number
  test: true
  /** v14: stable local player id — badge + rows follow it across renames. */
  playerId?: string
  /** v14: Founding Pilot badge (cosmetic, never on Stellar). */
  founder?: boolean
}

export interface LeaderboardSubmitInput {
  displayName: string
  score: number
  kind: LeaderboardKind
  atMs?: number
  playerId?: string
  founder?: boolean
}

export interface LeaderboardAdapter {
  readonly label: string
  readonly isTest: true
  list(topN?: number): Promise<LeaderboardEntry[]>
  submit(input: LeaderboardSubmitInput): Promise<{ ok: true; entry: LeaderboardEntry } | { ok: false; error: string }>
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export function readLeaderboardOptIn(store: Store | null): boolean {
  if (!store) return false
  try {
    const raw = store.getItem(LEADERBOARD_OPT_IN_KEY)
    if (!raw) return false
    const p = JSON.parse(raw) as { enabled?: boolean }
    return p.enabled === true
  } catch {
    return false
  }
}

export function writeLeaderboardOptIn(store: Store | null, enabled: boolean): boolean {
  if (!store) return false
  try {
    store.setItem(LEADERBOARD_OPT_IN_KEY, JSON.stringify({ enabled: enabled === true }))
    return true
  } catch {
    return false
  }
}

export function readDisplayName(store: Store | null): string {
  if (!store) return "Pilot"
  try {
    const n = (store.getItem(LEADERBOARD_NAME_KEY) || "").trim()
    return sanitizeDisplayName(n) || "Pilot"
  } catch {
    return "Pilot"
  }
}

export function writeDisplayName(store: Store | null, name: string): boolean {
  if (!store) return false
  try {
    store.setItem(LEADERBOARD_NAME_KEY, sanitizeDisplayName(name))
    return true
  } catch {
    return false
  }
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw
    .replace(/@/g, "")
    .replace(/https?:\/\//gi, "")
    .replace(/[^\p{L}\p{N} _.\-']/gu, "")
    .trim()
    .slice(0, LEADERBOARD_NAME_MAX)
  return cleaned
}

export function scoreLooksSane(score: number): boolean {
  if (!Number.isFinite(score)) return false
  if (score !== Math.floor(score)) return false
  return score >= LEADERBOARD_MIN_SCORE && score <= LEADERBOARD_MAX_SCORE
}

let lastSubmitAt = 0

export function createMockLeaderboardAdapter(store: Store | null): LeaderboardAdapter {
  function readAll(): LeaderboardEntry[] {
    if (!store) return []
    try {
      const raw = store.getItem(LEADERBOARD_MOCK_KEY)
      if (!raw) return seedDefaults()
      const arr = JSON.parse(raw) as LeaderboardEntry[]
      return Array.isArray(arr) ? arr.filter((e) => e && e.test === true) : seedDefaults()
    } catch {
      return seedDefaults()
    }
  }
  function writeAll(rows: LeaderboardEntry[]) {
    if (!store) return
    try {
      store.setItem(LEADERBOARD_MOCK_KEY, JSON.stringify(rows.slice(0, 40)))
    } catch {
      /* ignore */
    }
  }
  function seedDefaults(): LeaderboardEntry[] {
    const now = Date.now()
    return [
      { id: "seed-1", displayName: "XO", score: 120, kind: "arcade", atMs: now - 86400000, test: true },
      { id: "seed-2", displayName: "Testnet Pilot", score: 90, kind: "paper", atMs: now - 43200000, test: true },
    ]
  }

  return {
    label: "Test leaderboard (local mock)",
    isTest: true,
    async list(topN = LEADERBOARD_TOP_N) {
      return [...readAll()].sort((a, b) => b.score - a.score || b.atMs - a.atMs).slice(0, topN)
    },
    async submit(input) {
      const name = sanitizeDisplayName(input.displayName)
      if (!name) return { ok: false, error: "Enter a display name (no email)." }
      if (/@/.test(input.displayName)) return { ok: false, error: "No email addresses." }
      if (!scoreLooksSane(input.score)) return { ok: false, error: "Score failed sanity check." }
      const now = Date.now()
      if (now - lastSubmitAt < LEADERBOARD_SUBMIT_COOLDOWN_MS) {
        return { ok: false, error: "Slow down — wait a few seconds between submits." }
      }
      lastSubmitAt = now
      const entry: LeaderboardEntry = {
        id: `m-${now}-${Math.floor(Math.random() * 9999)}`,
        displayName: name,
        score: Math.floor(input.score),
        kind: input.kind === "paper" ? "paper" : "arcade",
        atMs: input.atMs ?? now,
        test: true,
        ...(input.playerId ? { playerId: input.playerId } : {}),
        ...(input.founder ? { founder: true } : {}),
      }
      const next = [entry, ...readAll()].sort((a, b) => b.score - a.score).slice(0, 40)
      writeAll(next)
      return { ok: true, entry }
    },
  }
}

/** v14: a rename carries this player's rows (and their badge) to the new name. */
export function renamePlayerRows(store: Store | null, playerId: string, raw: string): number {
  const name = sanitizeDisplayName(raw)
  if (!store || !name || !playerId) return 0
  try {
    const rows = JSON.parse(store.getItem(LEADERBOARD_MOCK_KEY) ?? "[]") as LeaderboardEntry[]
    if (!Array.isArray(rows)) return 0
    let n = 0
    for (const r of rows) {
      if (r && r.playerId === playerId) {
        r.displayName = name
        n++
      }
    }
    if (n) store.setItem(LEADERBOARD_MOCK_KEY, JSON.stringify(rows))
    return n
  } catch {
    return 0
  }
}

/** Factory — today always mock. Future: branch on LEADERBOARD_BACKEND_HOOK.provider. */
export function createLeaderboardAdapter(store: Store | null): LeaderboardAdapter {
  void LEADERBOARD_BACKEND_HOOK
  return createMockLeaderboardAdapter(store)
}

/** Test helper: reset submit cooldown. */
export function __resetLeaderboardCooldownForTests() {
  lastSubmitAt = 0
}
