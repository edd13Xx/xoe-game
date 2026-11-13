/**
 * Persistent meta progress (this device only).
 * Practice coins only — nothing real. Scoring math stays out of public notes.
 *
 * On return to map, remaining RUN coins are spent in order (NO halving):
 *  1) refill XO energy to 100%
 *  2) convert to XP up to completing the current level (at most one level-up)
 *  3) any coins still left go into the XOE Vault automatically
 */

import {
  CLASS_COMBAT_TABLE,
  statsAtLevel,
  type ClassCombatStats,
} from "./class-stats.ts"
import type { PlayerClassName } from "./content.ts"

export const XOE_COIN_CAP = 9999
export const XOE_COINS_NEVER_EXPIRE = true
export const XOE_ENERGY_MAX = 100
/** Coins spent to refill from 0 → 100 energy. */
export const ENERGY_REFILL_COIN_COST = 20
export const MAX_RUN_ATTEMPTS = 2
export const ATTEMPT_BANNER_SEC = 1.2
export const ATTEMPT_BANNER_TEXT = "Attempt 2 of 2"
export const LEADERBOARD_TOP = 5
export const META_STORAGE_KEY = "xoe.metaProgress.v1"
export const LEADERBOARD_STORAGE_KEY = "xoe.personalBestRuns.v1"
export const XP_PER_LEVEL = 100

export type StatId = "hull" | "focus" | "dash" | "luck"

export interface StatCard {
  id: StatId
  label: string
  level: number
  maxLevel: number
  cost: number
}

export interface MetaProgress {
  /** Spendable pocket — capped at 9,999. */
  coins: number
  /** XOE Vault — practice coins, uncapped, local only. */
  vault: number
  xp: number
  /** Pilot level (1-based). */
  level: number
  energy: number
  pilotClass: PlayerClassName
  stats: Record<StatId, number>
  def: number
  off: number
}

export interface PersonalBestRun {
  score: number
  atMs: number
  label: string
}

export interface RunSession {
  attempt: number
  runPoints: number
  /** Practice coins earned this run (not yet settled). */
  runCoins: number
  bannerUntilMs: number | null
}

export interface ReturnBreakdown {
  energyGained: number
  coinsSpentOnEnergy: number
  xpGained: number
  coinsSpentOnXp: number
  vaultGained: number
  leveledUp: boolean
  newLevel: number
  summary: string
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem?: (k: string) => void
}

const DEFAULT_STATS: Record<StatId, number> = {
  hull: 1,
  focus: 1,
  dash: 1,
  luck: 1,
}

export const STAT_DEFS: { id: StatId; label: string; maxLevel: number; baseCost: number }[] = [
  { id: "hull", label: "Hull", maxLevel: 5, baseCost: 40 },
  { id: "focus", label: "Focus", maxLevel: 5, baseCost: 35 },
  { id: "dash", label: "Dash", maxLevel: 5, baseCost: 45 },
  { id: "luck", label: "Luck", maxLevel: 5, baseCost: 50 },
]

export function initialMeta(pilotClass: PlayerClassName = "Sentinel"): MetaProgress {
  const combat = statsAtLevel(pilotClass, 1)
  return {
    coins: 0,
    vault: 0,
    xp: 0,
    level: 1,
    energy: XOE_ENERGY_MAX,
    pilotClass,
    stats: { ...DEFAULT_STATS },
    def: combat.def,
    off: combat.off,
  }
}

export function initialRunSession(): RunSession {
  return { attempt: 1, runPoints: 0, runCoins: 0, bannerUntilMs: null }
}

export function clampCoins(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(XOE_COIN_CAP, Math.floor(n))
}

export function xpToNextLevel(level: number): number {
  return XP_PER_LEVEL * Math.max(1, Math.floor(level))
}

export function xpNeededToCompleteLevel(meta: MetaProgress): number {
  return Math.max(0, xpToNextLevel(meta.level) - meta.xp)
}

export function readMeta(store: Store | null): MetaProgress {
  if (!store) return initialMeta()
  try {
    const raw = store.getItem(META_STORAGE_KEY)
    if (!raw) return initialMeta()
    const parsed = JSON.parse(raw) as Partial<MetaProgress>
    const pilotClass =
      parsed.pilotClass === "Striker" || parsed.pilotClass === "Recon" || parsed.pilotClass === "Sentinel"
        ? parsed.pilotClass
        : "Sentinel"
    const level = Math.max(1, Math.floor(typeof parsed.level === "number" ? parsed.level : 1))
    const combat = statsAtLevel(pilotClass, level)
    return {
      coins: clampCoins(typeof parsed.coins === "number" ? parsed.coins : 0),
      vault: Math.max(0, Math.floor(typeof parsed.vault === "number" ? parsed.vault : 0)),
      xp: Math.max(0, Math.floor(typeof parsed.xp === "number" ? parsed.xp : 0)),
      level,
      energy: Math.max(0, Math.min(XOE_ENERGY_MAX, Math.floor(typeof parsed.energy === "number" ? parsed.energy : XOE_ENERGY_MAX))),
      pilotClass,
      stats: {
        hull: levelOf(parsed.stats?.hull),
        focus: levelOf(parsed.stats?.focus),
        dash: levelOf(parsed.stats?.dash),
        luck: levelOf(parsed.stats?.luck),
      },
      def: typeof parsed.def === "number" ? parsed.def : combat.def,
      off: typeof parsed.off === "number" ? parsed.off : combat.off,
    }
  } catch {
    return initialMeta()
  }
}

function levelOf(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1
  return Math.max(1, Math.min(5, Math.floor(n)))
}

export function writeMeta(store: Store | null, meta: MetaProgress): boolean {
  if (!store) return false
  try {
    store.setItem(
      META_STORAGE_KEY,
      JSON.stringify({
        coins: clampCoins(meta.coins),
        vault: Math.max(0, Math.floor(meta.vault)),
        xp: Math.max(0, Math.floor(meta.xp)),
        level: Math.max(1, Math.floor(meta.level)),
        energy: Math.max(0, Math.min(XOE_ENERGY_MAX, Math.floor(meta.energy))),
        pilotClass: meta.pilotClass,
        stats: meta.stats,
        def: meta.def,
        off: meta.off,
        neverExpire: XOE_COINS_NEVER_EXPIRE,
      }),
    )
    return true
  } catch {
    return false
  }
}

export function addCoins(meta: MetaProgress, amount: number): MetaProgress {
  return { ...meta, coins: clampCoins(meta.coins + amount) }
}

export function setPilotClass(meta: MetaProgress, pilotClass: PlayerClassName): MetaProgress {
  const combat = statsAtLevel(pilotClass, meta.level)
  return { ...meta, pilotClass, def: combat.def, off: combat.off }
}

export function applyClassLevelBoost(meta: MetaProgress, newLevel: number): MetaProgress {
  const combat = statsAtLevel(meta.pilotClass, newLevel)
  return { ...meta, level: newLevel, def: combat.def, off: combat.off }
}

export function upgradeCost(statId: StatId, level: number): number {
  const def = STAT_DEFS.find((d) => d.id === statId)!
  return def.baseCost * level
}

export function statCards(meta: MetaProgress): StatCard[] {
  return STAT_DEFS.map((d) => ({
    id: d.id,
    label: d.label,
    level: meta.stats[d.id],
    maxLevel: d.maxLevel,
    cost: upgradeCost(d.id, meta.stats[d.id]),
  }))
}

export function buyUpgrade(meta: MetaProgress, statId: StatId): MetaProgress | null {
  const card = statCards(meta).find((c) => c.id === statId)
  if (!card) return null
  if (card.level >= card.maxLevel) return null
  const need = card.cost
  let next = meta
  if (meta.coins >= need) {
    next = { ...meta, coins: clampCoins(meta.coins - need) }
  } else {
    const fromVault = need - meta.coins
    if (meta.vault < fromVault) return null
    next = { ...meta, coins: 0, vault: meta.vault - fromVault }
  }
  return {
    ...next,
    stats: { ...next.stats, [statId]: card.level + 1 },
  }
}

/**
 * Three-step split of remaining run coins on return to map.
 * NO half-coins rule. All remaining run coins are used in order.
 */
export function settleRunCoins(
  meta: MetaProgress,
  runCoins: number,
): { meta: MetaProgress; breakdown: ReturnBreakdown } {
  let coins = Math.max(0, Math.floor(runCoins))
  let next = { ...meta }

  // 1) Refill energy to 100%
  const energyMissing = Math.max(0, XOE_ENERGY_MAX - next.energy)
  const coinsForFullEnergy =
    energyMissing <= 0
      ? 0
      : Math.ceil((energyMissing / XOE_ENERGY_MAX) * ENERGY_REFILL_COIN_COST)
  const coinsSpentOnEnergy = Math.min(coins, coinsForFullEnergy)
  const energyGained =
    coinsForFullEnergy === 0
      ? 0
      : Math.round((coinsSpentOnEnergy / ENERGY_REFILL_COIN_COST) * XOE_ENERGY_MAX)
  next = {
    ...next,
    energy: Math.min(XOE_ENERGY_MAX, next.energy + energyGained),
  }
  if (coinsSpentOnEnergy >= coinsForFullEnergy && coinsForFullEnergy > 0) {
    next = { ...next, energy: XOE_ENERGY_MAX }
  }
  coins -= coinsSpentOnEnergy

  // 2) Convert to XP up to completing current level (at most one level-up)
  const xpNeeded = xpNeededToCompleteLevel(next)
  const coinsSpentOnXp = Math.min(coins, xpNeeded)
  const xpGained = coinsSpentOnXp // 1 coin → 1 XP toward current level
  let leveledUp = false
  next = { ...next, xp: next.xp + xpGained }
  coins -= coinsSpentOnXp
  if (xpNeeded > 0 && next.xp >= xpToNextLevel(next.level)) {
    leveledUp = true
    next = { ...next, xp: 0 }
    next = applyClassLevelBoost(next, next.level + 1)
  }

  // 3) Remainder → XOE Vault (uncapped). Pocket coins unchanged here.
  const vaultGained = coins
  next = { ...next, vault: next.vault + vaultGained }
  coins = 0

  const breakdown: ReturnBreakdown = {
    energyGained: next.energy === XOE_ENERGY_MAX && energyGained > 0 ? energyGained : Math.max(0, energyGained),
    coinsSpentOnEnergy,
    xpGained,
    coinsSpentOnXp,
    vaultGained,
    leveledUp,
    newLevel: next.level,
    summary: `Energy +${energyGained}, XP +${xpGained}, Vault +${vaultGained}`,
  }

  // Ensure energy fully 100 when we paid for full refill
  if (coinsSpentOnEnergy >= coinsForFullEnergy && coinsForFullEnergy > 0) {
    breakdown.energyGained = energyMissing
    next = { ...next, energy: XOE_ENERGY_MAX }
    breakdown.summary = `Energy +${energyMissing}, XP +${xpGained}, Vault +${vaultGained}`
  }

  return { meta: next, breakdown }
}

/** End a run: settle run coins → energy/XP/vault; save PB; reset run session. */
export function returnToOverworld(
  meta: MetaProgress,
  run: RunSession,
  store: Store | null,
): { meta: MetaProgress; run: RunSession; board: PersonalBestRun[]; breakdown: ReturnBreakdown } {
  const settled = settleRunCoins(meta, run.runCoins)
  writeMeta(store, settled.meta)
  const board = recordPersonalBest(store, run.runPoints)
  return {
    meta: settled.meta,
    run: initialRunSession(),
    board,
    breakdown: settled.breakdown,
  }
}

export function readLeaderboard(store: Store | null): PersonalBestRun[] {
  if (!store) return []
  try {
    const raw = store.getItem(LEADERBOARD_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersonalBestRun[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r) => r && typeof r.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, LEADERBOARD_TOP)
  } catch {
    return []
  }
}

export function recordPersonalBest(
  store: Store | null,
  score: number,
  label = "Personal best run",
): PersonalBestRun[] {
  const clean = Math.max(0, Math.floor(score))
  const current = readLeaderboard(store)
  if (clean <= 0) return current
  const next = [...current, { score: clean, atMs: Date.now(), label: label || "Personal best run" }]
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_TOP)
  if (store) {
    try {
      store.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

/** Wipe private high scores on this device only. Never networked. */
export function resetLeaderboard(store: Store | null): void {
  if (!store) return
  try {
    store.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify([]))
  } catch {
    try {
      store.removeItem?.(LEADERBOARD_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}

export function beginSecondAttempt(run: RunSession, nowMs: number): RunSession {
  return {
    attempt: Math.min(MAX_RUN_ATTEMPTS, run.attempt + 1),
    runPoints: run.runPoints,
    runCoins: run.runCoins,
    bannerUntilMs: nowMs + ATTEMPT_BANNER_SEC * 1000,
  }
}

export function attemptBannerVisible(run: RunSession, nowMs: number): boolean {
  return run.attempt === 2 && run.bannerUntilMs != null && nowMs < run.bannerUntilMs
}

export const DEATH_COACH_TIPS = [
  "XO: Breathe. Wait for the next clean entry — no chase.",
  "XO: Size down. One calm call beats three rushed ones.",
  "XO: If price tags Total Liquidation, step off. Lives are practice.",
  "XO: Ride with the move you called. Flat is fine too.",
  "XO: You’re learning the tape. Reset, blink in, try once more.",
] as const

export function deathCoachTip(seed = Date.now()): string {
  const i = Math.abs(Math.floor(seed)) % DEATH_COACH_TIPS.length
  return DEATH_COACH_TIPS[i]!
}

export function classTableFor(meta: MetaProgress): ClassCombatStats {
  return CLASS_COMBAT_TABLE[meta.pilotClass]
}


export const DAILY_BONUS_COINS = 25
export const DAILY_BONUS_KEY = "xoe.dailyPractice.v1"

/** Spend vault coins into the pocket (capped) or directly for a shop cost. Vault is spendable. */
export function spendFromVault(meta: MetaProgress, amount: number): MetaProgress | null {
  const need = Math.max(0, Math.floor(amount))
  if (need <= 0) return meta
  if (meta.vault < need) return null
  return { ...meta, vault: meta.vault - need }
}

/** Prefer pocket, then vault, for a shop purchase. */
export function payShopCost(meta: MetaProgress, cost: number): MetaProgress | null {
  const need = Math.max(0, Math.floor(cost))
  if (need <= 0) return meta
  if (meta.coins >= need) return { ...meta, coins: clampCoins(meta.coins - need) }
  const fromPocket = meta.coins
  const fromVault = need - fromPocket
  if (meta.vault < fromVault) return null
  return { ...meta, coins: 0, vault: meta.vault - fromVault }
}

export function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function canClaimDailyBonus(store: Store | null, now = new Date()): boolean {
  if (!store) return true
  try {
    return store.getItem(DAILY_BONUS_KEY) !== localDayKey(now)
  } catch {
    return true
  }
}

export function claimDailyBonus(meta: MetaProgress, store: Store | null, now = new Date()): MetaProgress | null {
  if (!canClaimDailyBonus(store, now)) return null
  const next = addCoins(meta, DAILY_BONUS_COINS)
  if (store) {
    try {
      store.setItem(DAILY_BONUS_KEY, localDayKey(now))
    } catch { /* ignore */ }
  }
  writeMeta(store, next)
  return next
}


export const WEEKLY_BONUS_COINS = 100
export const WEEKLY_BONUS_KEY = "xoe.weeklyPractice.v1"

/** Monday 00:00 local as week start key YYYY-MM-DD of that Monday. */
export function localWeekKey(d = new Date()): string {
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7 // days since Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
  return localDayKey(monday)
}

export function canClaimWeeklyBonus(store: Store | null, now = new Date()): boolean {
  if (!store) return true
  try {
    return store.getItem(WEEKLY_BONUS_KEY) !== localWeekKey(now)
  } catch {
    return true
  }
}

export function claimWeeklyBonus(meta: MetaProgress, store: Store | null, now = new Date()): MetaProgress | null {
  if (!canClaimWeeklyBonus(store, now)) return null
  const next = addCoins(meta, WEEKLY_BONUS_COINS)
  if (store) {
    try {
      store.setItem(WEEKLY_BONUS_KEY, localWeekKey(now))
    } catch { /* ignore */ }
  }
  writeMeta(store, next)
  return next
}
