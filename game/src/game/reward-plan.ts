/**
 * v14 locked XOE reward plan (Eddie, Nov 9 2026) — TESTNET ONLY, never real money, nothing live.
 * Local earned-but-unclaimed ledger in stroops (1 XOE = 10,000,000 stroops). Claim stays disabled.
 * Founding Pilot badge: cosmetic, keyed to the local player id (survives a rename), never on Stellar.
 */

import { getLocalStore } from "./safe-storage.ts"
import { localDayKey } from "./meta-progress.ts"

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export const REWARD_PLAN_KEY = "xoe.rewardPlan.v1"
export const XOE_TOTAL_SUPPLY_STROOPS = 1_234_567_899_999_999
export const XOE_TOTAL_SUPPLY_LABEL = "123,456,789.9999999"
export const FOUNDING_PILOT_SLOTS = 888
export const FOUNDER_DAILY_CAP = 88_880_000 // 8.888 XOE
export const NEW_PLAYER_DAILY_CAP = 44_440_000 // 4.444 XOE
export const STREAK_DAYS = 7
export const STREAK_MULTIPLIER = 2
export const CHAPTER_MILESTONE = 250_000_000 // 25 XOE, one-time, outside the daily cap
export const MONTHLY_POOL = 8_880_000_000 // 888 XOE
/** [EDDIE TO PICK] proposed monthly top-10 split, sums to exactly 888. */
export const TOP10_SPLIT_XOE = [200, 150, 120, 100, 80, 70, 60, 45, 35, 28] as const
/** [EDDIE TO PICK] proposed earn rates (stroops). */
export const EARN_RATES = {
  lesson: 2_222_000,
  colony_clear: 11_110_000,
  fight_win: 444_000,
  daily_practice: 4_444_000,
  side_mission: 2_222_000,
} as const
export type EarnAction = keyof typeof EARN_RATES
export const MILESTONES = [
  { id: "chapter-1", label: "Chapter 1 clear", stroops: CHAPTER_MILESTONE },
  { id: "chapter-2", label: "Chapter 2 clear", stroops: CHAPTER_MILESTONE },
  { id: "chapter-3", label: "Chapter 3 clear", stroops: CHAPTER_MILESTONE },
] as const
export type MilestoneId = (typeof MILESTONES)[number]["id"]

export interface RewardLedger {
  playerId: string
  day: string
  todayBase: number
  todayCredited: number
  streak: number
  lastPlayDay: string | null
  milestones: string[]
  unclaimed: number
  /** Testnet/local stand-in for "one of the first 888 pilots after mainnet launch". */
  foundingSlotPlaceholder: boolean
  founderBadge: boolean
  /** credited stroops by source (coins, colony_clear, fight_win, lesson, daily_practice, side_mission, milestone, trade). */
  bySource: Record<string, number>
  /** v15: lifetime credited stroops (never goes down; claim is disabled anyway). */
  lifetime: number
}
export type EarnSource = EarnAction | "coin" | "milestone" | "trade"

/** Local calendar day (same key as the daily bonus). */
export const dayKey = (ms: number) => localDayKey(new Date(ms))
const prevDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return localDayKey(new Date(y!, m! - 1, d! - 1, 12))
}
function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function emptyLedger(playerId = newId()): RewardLedger {
  return {
    playerId,
    day: "",
    todayBase: 0,
    todayCredited: 0,
    streak: 0,
    lastPlayDay: null,
    milestones: [],
    unclaimed: 0,
    foundingSlotPlaceholder: false,
    founderBadge: false,
    bySource: {},
    lifetime: 0,
  }
}

const int = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0))

export function readLedger(store: Store | null): RewardLedger {
  try {
    const raw = store?.getItem(REWARD_PLAN_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<RewardLedger>
      if (typeof p.playerId === "string" && p.playerId) {
        return {
          ...emptyLedger(p.playerId),
          day: typeof p.day === "string" ? p.day : "",
          todayBase: int(p.todayBase),
          todayCredited: int(p.todayCredited),
          streak: int(p.streak),
          lastPlayDay: typeof p.lastPlayDay === "string" ? p.lastPlayDay : null,
          milestones: Array.isArray(p.milestones) ? p.milestones.filter((m) => typeof m === "string") : [],
          unclaimed: int(p.unclaimed),
          foundingSlotPlaceholder: p.foundingSlotPlaceholder === true,
          founderBadge: p.founderBadge === true,
          bySource: Object.fromEntries(Object.entries(p.bySource ?? {}).map(([k, v]) => [k, int(v)])),
          // v14 ledgers had no lifetime: start from what is unclaimed (nothing was ever claimed).
          lifetime: Math.max(int(p.lifetime), int(p.unclaimed)),
        }
      }
    }
  } catch {
    /* fall through */
  }
  const fresh = emptyLedger()
  writeLedger(store, fresh)
  return fresh
}

export function writeLedger(store: Store | null, l: RewardLedger): void {
  try {
    store?.setItem(REWARD_PLAN_KEY, JSON.stringify(l))
  } catch {
    /* ignore */
  }
}

export const dailyCap = (l: RewardLedger) => (l.founderBadge ? FOUNDER_DAILY_CAP : NEW_PLAYER_DAILY_CAP)
export const streakMultiplier = (streak: number) => (streak >= STREAK_DAYS ? STREAK_MULTIPLIER : 1)
/** credited = min(base × streak multiplier, daily cap) */
export const creditedFor = (base: number, streak: number, cap: number) => Math.min(base * streakMultiplier(streak), cap)

/** Move the ledger onto `day`, updating the streak (a missed day resets it). */
export function rollDay(l: RewardLedger, day: string): RewardLedger {
  if (l.day === day) return l
  const streak = l.lastPlayDay === prevDay(day) ? l.streak + 1 : l.lastPlayDay === day ? l.streak : 1
  return { ...l, day, todayBase: 0, todayCredited: 0, streak, lastPlayDay: day }
}

const addSource = (l: RewardLedger, src: EarnSource, credited: number): RewardLedger =>
  credited > 0
    ? { ...l, bySource: { ...l.bySource, [src]: (l.bySource[src] ?? 0) + credited }, lifetime: l.lifetime + credited }
    : l

/** Earn `base` stroops from `src`; returns stroops credited (cap + streak applied: min(base × streak, cap)). */
export function earnStroops(
  l: RewardLedger,
  src: EarnSource,
  base: number,
  nowMs: number,
): { ledger: RewardLedger; credited: number } {
  const r = rollDay(l, dayKey(nowMs))
  const todayBase = r.todayBase + Math.max(0, Math.floor(base))
  const todayCredited = creditedFor(todayBase, r.streak, dailyCap(r))
  const credited = Math.max(0, todayCredited - r.todayCredited)
  return { ledger: addSource({ ...r, todayBase, todayCredited, unclaimed: r.unclaimed + credited }, src, credited), credited }
}

/** Earn an action's base reward; returns stroops credited (cap + streak applied). */
export const earn = (l: RewardLedger, action: EarnAction, nowMs: number) => earnStroops(l, action, EARN_RATES[action], nowMs)

/** One-time milestone, outside the daily cap. */
export function claimMilestone(l: RewardLedger, id: MilestoneId): { ledger: RewardLedger; credited: number } {
  const m = MILESTONES.find((x) => x.id === id)
  if (!m || l.milestones.includes(id)) return { ledger: l, credited: 0 }
  const next = { ...l, milestones: [...l.milestones, id], unclaimed: l.unclaimed + m.stroops }
  return { ledger: addSource(next, "milestone", m.stroops), credited: m.stroops }
}

/** Badge earned: founding slot (placeholder on testnet) AND at least one colony cleared. Never revoked. */
export function evaluateFounderBadge(l: RewardLedger, coloniesCleared: number): RewardLedger {
  if (l.founderBadge || !l.foundingSlotPlaceholder || coloniesCleared < 1) return l
  return { ...l, founderBadge: true }
}

/** Badge follows the player id, not the name: any row with this id shows it. */
export function rowHasFounderBadge(row: { playerId?: string; founder?: boolean }, me: RewardLedger): boolean {
  return row.founder === true || (!!row.playerId && row.playerId === me.playerId && me.founderBadge)
}

/** Chapter milestones reached for a cleared-colony list (chapter = 3 colonies each, last chapter = the rest). */
export function chaptersCleared(clearedIds: readonly string[], colonyOrder: readonly string[]): MilestoneId[] {
  const groups = [colonyOrder.slice(0, 3), colonyOrder.slice(3, 6), colonyOrder.slice(6)]
  const out: MilestoneId[] = []
  groups.forEach((g, i) => {
    if (g.length && g.every((id) => clearedIds.includes(id))) out.push(MILESTONES[i]!.id)
  })
  return out
}


/** Store-level helpers used by the game (read → update → write). */
export function recordEarn(store: Store | null, action: EarnAction, nowMs = Date.now()): number {
  const { ledger, credited } = earn(readLedger(store), action, nowMs)
  writeLedger(store, ledger)
  return credited
}

/** v15: an XOE coin pickup (ticker gameplay). Same daily cap + streak as everything else. */
export function recordCoin(store: Store | null, stroops: number, nowMs = Date.now()): number {
  const { ledger, credited } = earnStroops(readLedger(store), "coin", stroops, nowMs)
  writeLedger(store, ledger)
  return credited
}

export function recordColonyProgress(
  store: Store | null,
  clearedIds: readonly string[],
  colonyOrder: readonly string[],
  nowMs = Date.now(),
): RewardLedger {
  let l = earn(readLedger(store), "colony_clear", nowMs).ledger
  l = evaluateFounderBadge(l, clearedIds.length)
  for (const id of chaptersCleared(clearedIds, colonyOrder)) l = claimMilestone(l, id).ledger
  writeLedger(store, l)
  return l
}

export function setFoundingSlotPlaceholder(store: Store | null, on: boolean, coloniesCleared: number): RewardLedger {
  const l = evaluateFounderBadge({ ...readLedger(store), foundingSlotPlaceholder: on }, coloniesCleared)
  writeLedger(store, l)
  return l
}

export const hasFounderBadge = () => readLedger(getLocalStore()).founderBadge


/**
 * v16: apply session trading P/L to the testnet ledger.
 * Gains go through earnStroops (daily cap + streak), source "trade".
 * Losses cut unclaimed only, never below 0, and never reduce lifetime.
 * Hazards still never take XOE — this is only for voluntary Buy/Sell XOE.
 */
export function applyTradePnl(
  l: RewardLedger,
  pnlStroops: number,
  nowMs = Date.now(),
): { ledger: RewardLedger; credited: number; deducted: number } {
  const pnl = Math.trunc(pnlStroops)
  if (pnl > 0) {
    const { ledger, credited } = earnStroops(l, "trade", pnl, nowMs)
    return { ledger, credited, deducted: 0 }
  }
  if (pnl < 0) {
    const r = rollDay(l, dayKey(nowMs))
    const deducted = Math.min(r.unclaimed, -pnl)
    return { ledger: { ...r, unclaimed: r.unclaimed - deducted }, credited: 0, deducted }
  }
  return { ledger: l, credited: 0, deducted: 0 }
}

export function recordTradePnl(store: Store | null, pnlStroops: number, nowMs = Date.now()): { credited: number; deducted: number } {
  const { ledger, credited, deducted } = applyTradePnl(readLedger(store), pnlStroops, nowMs)
  writeLedger(store, ledger)
  return { credited, deducted }
}
