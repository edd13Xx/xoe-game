import { describe, expect, it } from "vitest"
import {
  CHAPTER_MILESTONE,
  FOUNDER_DAILY_CAP,
  MONTHLY_POOL,
  NEW_PLAYER_DAILY_CAP,
  TOP10_SPLIT_XOE,
  XOE_TOTAL_SUPPLY_STROOPS,
  chaptersCleared,
  claimMilestone,
  creditedFor,
  earn,
  emptyLedger,
  evaluateFounderBadge,
  readLedger,
  recordColonyProgress,
  rowHasFounderBadge,
  setFoundingSlotPlaceholder,
  writeLedger,
  type RewardLedger,
} from "./reward-plan.ts"
import { formatXoe } from "./stellar-wallet.ts"
import { createMockLeaderboardAdapter, renamePlayerRows, __resetLeaderboardCooldownForTests } from "./leaderboard-remote.ts"

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const DAY = 86_400_000
const t0 = Date.parse("2026-11-09T15:00:00Z")
const playDays = (l: RewardLedger, days: number, colonyClears: number) => {
  let cur = l
  let total = 0
  for (let d = 0; d < days; d++)
    for (let i = 0; i < colonyClears; i++) {
      const r = earn(cur, "colony_clear", t0 + d * DAY)
      cur = r.ledger
      total += r.credited
    }
  return { ledger: cur, total }
}

describe("v14 locked reward plan numbers", () => {
  it("supply, caps, pool and top-10 split are exact", () => {
    expect(formatXoe(XOE_TOTAL_SUPPLY_STROOPS)).toBe("123456789.9999999")
    expect(formatXoe(FOUNDER_DAILY_CAP)).toBe("8.8880000")
    expect(formatXoe(NEW_PLAYER_DAILY_CAP)).toBe("4.4440000")
    expect(formatXoe(CHAPTER_MILESTONE)).toBe("25.0000000")
    expect(TOP10_SPLIT_XOE.reduce((a, b) => a + b, 0)).toBe(888)
    expect(MONTHLY_POOL).toBe(888 * 10_000_000)
  })

  it("streak doubles but never exceeds the cap", () => {
    expect(creditedFor(20_000_000, 6, NEW_PLAYER_DAILY_CAP)).toBe(20_000_000)
    expect(creditedFor(20_000_000, 7, NEW_PLAYER_DAILY_CAP)).toBe(40_000_000)
    expect(creditedFor(30_000_000, 7, NEW_PLAYER_DAILY_CAP)).toBe(NEW_PLAYER_DAILY_CAP)
    expect(creditedFor(50_000_000, 1, NEW_PLAYER_DAILY_CAP)).toBe(NEW_PLAYER_DAILY_CAP)
    expect(creditedFor(50_000_000, 9, FOUNDER_DAILY_CAP)).toBe(FOUNDER_DAILY_CAP)
  })

  it("new player: 2 colony clears/day for 7 days → day 7 doubles to the cap", () => {
    const { ledger, total } = playDays(emptyLedger("p1"), 7, 2)
    expect(ledger.streak).toBe(7)
    // 6 days × 2.222 + day 7 min(4.444, 4.444)
    expect(total).toBe(6 * 22_220_000 + 44_440_000)
    expect(ledger.unclaimed).toBe(total)
  })

  it("a missed day resets the streak", () => {
    let l = earn(emptyLedger("p1"), "lesson", t0).ledger
    l = earn(l, "lesson", t0 + DAY).ledger
    expect(l.streak).toBe(2)
    l = earn(l, "lesson", t0 + 3 * DAY).ledger
    expect(l.streak).toBe(1)
  })

  it("daily cap binds a heavy day; founders get 8.888", () => {
    const heavy = playDays(emptyLedger("p1"), 1, 10)
    expect(heavy.total).toBe(NEW_PLAYER_DAILY_CAP)
    const f = playDays({ ...emptyLedger("f"), founderBadge: true }, 1, 10)
    expect(f.total).toBe(FOUNDER_DAILY_CAP)
  })

  it("milestones are one-time and outside the daily cap", () => {
    const capped = playDays(emptyLedger("p1"), 1, 10).ledger
    const a = claimMilestone(capped, "chapter-1")
    expect(a.credited).toBe(CHAPTER_MILESTONE)
    expect(a.ledger.unclaimed).toBe(NEW_PLAYER_DAILY_CAP + CHAPTER_MILESTONE)
    expect(claimMilestone(a.ledger, "chapter-1").credited).toBe(0)
    expect(chaptersCleared(["a", "b", "c", "d"], ["a", "b", "c", "d", "e", "f", "g"])).toEqual(["chapter-1"])
  })

  it("all amounts stay integer stroops", () => {
    const { ledger } = playDays(emptyLedger("p1"), 9, 3)
    expect(Number.isInteger(ledger.unclaimed)).toBe(true)
  })
})

describe("v14 Founding Pilot badge (locked)", () => {
  it("needs the founding slot placeholder AND one colony clear; never revoked", () => {
    const l = emptyLedger("p")
    expect(evaluateFounderBadge(l, 1).founderBadge).toBe(false)
    expect(evaluateFounderBadge({ ...l, foundingSlotPlaceholder: true }, 0).founderBadge).toBe(false)
    const got = evaluateFounderBadge({ ...l, foundingSlotPlaceholder: true }, 1)
    expect(got.founderBadge).toBe(true)
    expect(evaluateFounderBadge({ ...got, foundingSlotPlaceholder: false }, 0).founderBadge).toBe(true)
  })

  it("colony progress earns the badge, the clear reward and chapter milestones", () => {
    const s = mem()
    setFoundingSlotPlaceholder(s, true, 0)
    const l = recordColonyProgress(s, ["a", "b", "c"], ["a", "b", "c", "d"], t0)
    expect(l.founderBadge).toBe(true)
    expect(l.milestones).toEqual(["chapter-1"])
    expect(l.unclaimed).toBe(11_110_000 + CHAPTER_MILESTONE)
    expect(readLedger(s).founderBadge).toBe(true)
  })

  it("badge is tied to the player id and survives a rename on the leaderboard", async () => {
    const s = mem()
    const me = { ...readLedger(s), founderBadge: true }
    writeLedger(s, me)
    __resetLeaderboardCooldownForTests()
    const api = createMockLeaderboardAdapter(s)
    await api.submit({ displayName: "Eddie", score: 300, kind: "arcade", playerId: me.playerId, founder: true })
    expect(renamePlayerRows(s, me.playerId, "Captain E")).toBe(1)
    const rows = await api.list()
    const mine = rows.find((r) => r.playerId === me.playerId)!
    expect(mine.displayName).toBe("Captain E")
    expect(rowHasFounderBadge(mine, me)).toBe(true)
    expect(rowHasFounderBadge({ playerId: "someone-else" }, me)).toBe(false)
    expect(rowHasFounderBadge({ playerId: me.playerId }, me)).toBe(true)
  })

  it("is never mirrored on Stellar (no wallet/Horizon calls in the badge code)", async () => {
    const fs = await import("node:fs")
    const src = fs.readFileSync(new URL("./reward-plan.ts", import.meta.url), "utf8")
    expect(src).not.toMatch(/horizon|stellar-sdk|changeTrust|payment\(/i)
  })
})
