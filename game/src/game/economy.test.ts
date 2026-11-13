import { describe, expect, it } from "vitest"
import { SIM_USD_PER_XOE, ECONOMY_DISPLAY_UNIT, PLAY_UNIT, formatPlay, formatPlayAmount, formatPnlSim, formatSimUsd, formatXoe7, stroopsToSimUsd, sumSources } from "./economy.ts"
import {
  FOUNDER_DAILY_CAP,
  NEW_PLAYER_DAILY_CAP,
  STREAK_DAYS,
  earn,
  earnStroops,
  emptyLedger,
  readLedger,
  recordCoin,
  REWARD_PLAN_KEY,
  claimMilestone,
} from "./reward-plan.ts"
import { COIN_STROOPS_PER_POINT, itemsFromMoves, orbPoints } from "./ticker-play.ts"
import { createOpening, openingReducer, type GameState } from "./opening.ts"

const t0 = new Date(2026, 10, 9, 12).getTime()
const DAY = 86_400_000
function mem() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe("v15 simulated USD display ($10 per XOE, game only)", () => {
  it("one named constant, default unit sim-usd", () => {
    expect(SIM_USD_PER_XOE).toBe(10)
    expect(ECONOMY_DISPLAY_UNIT).toBe("sim-usd")
    expect(stroopsToSimUsd(10_000_000)).toBe(10)
  })
  it("caps show as $44.44 / $88.88 sim; coins show cents to 3 decimals when needed", () => {
    expect(formatSimUsd(NEW_PLAYER_DAILY_CAP)).toBe("$44.44 sim")
    expect(formatSimUsd(FOUNDER_DAILY_CAP)).toBe("$88.88 sim")
    expect(formatSimUsd(25_000, true)).toBe("+$0.025 sim")
    expect(formatSimUsd(10_000)).toBe("$0.01 sim")
    expect(formatSimUsd(0)).toBe("$0.00 sim")
    expect(formatSimUsd(1)).toBe("<$0.001 sim")
    expect(formatSimUsd(1, true)).toBe("<$0.001 sim")
    expect(formatSimUsd(-1, true)).toBe("- <$0.001 sim")
    expect(formatPnlSim(0.0004, true)).toBe("<$0.001 sim")
    expect(formatPnlSim(-0.0004, true)).toBe("- <$0.001 sim")
    expect(formatPnlSim(1.5, true)).toBe("+$1.50 sim")
    expect(formatSimUsd(1_499)).toBe("$0.001 sim") // rounds to nearest $0.001
    expect(formatSimUsd(1_500)).toBe("$0.002 sim")
    expect(formatSimUsd(123_456_789_999_999_9)).toBe("$1,234,567,900.00 sim")
    expect(formatSimUsd(-5_000)).toBe("-$0.005 sim")
    expect(formatPlay(25_000, true)).toBe("+$0.025 sim")
    expect(formatPlayAmount(0)).toBe("$0.00")
    expect(formatPlayAmount(44_440_000)).toBe("$44.44")
    expect(formatPlayAmount(25_000, true)).toBe("+$0.025")
    expect(PLAY_UNIT).toBe("sim")
  })
  it("XOE shown with 7 decimals", () => {
    expect(formatXoe7(25_000, true)).toBe("+0.0025000 XOE")
    expect(formatXoe7(1)).toBe("0.0000001 XOE")
    expect(formatXoe7(1_234_567_899_999_999)).toBe("123,456,789.9999999 XOE")
  })
})

describe("v15 XOE coins credit the v14 ledger with the locked caps", () => {
  it("coin value: 1,000 stroops per point (a 0.15% move = 25 pts = 0.0025 XOE = $0.025 sim)", () => {
    const [c] = itemsFromMoves([{ symbol: "XLM", pct: 0.15 }], 1, [0.1, 0.1, 0.1])
    expect(c!.size).toBe("normal")
    expect(c!.points).toBe(orbPoints(0.15))
    expect(c!.stroops).toBe(25 * COIN_STROOPS_PER_POINT)
    expect(formatSimUsd(c!.stroops!)).toBe("$0.025 sim")
  })
  it("new player: coins stop at 4.444 XOE ($44.44 sim) per day; next day starts fresh", () => {
    let l = emptyLedger("p")
    let total = 0
    for (let i = 0; i < 2000; i++) {
      const r = earnStroops(l, "coin", 50_000, t0)
      l = r.ledger
      total += r.credited
    }
    expect(total).toBe(NEW_PLAYER_DAILY_CAP)
    expect(l.todayCredited).toBe(NEW_PLAYER_DAILY_CAP)
    expect(l.bySource.coin).toBe(NEW_PLAYER_DAILY_CAP)
    expect(earnStroops(l, "coin", 50_000, t0).credited).toBe(0)
    expect(earnStroops(l, "coin", 50_000, t0 + DAY).credited).toBe(50_000)
  })
  it("founder cap 8.888; 7-day streak doubles: credited = min(base × 2, cap)", () => {
    let l = { ...emptyLedger("f"), founderBadge: true }
    for (let d = 0; d < STREAK_DAYS; d++) l = earnStroops(l, "coin", 1, t0 + d * DAY).ledger
    expect(l.streak).toBe(STREAK_DAYS)
    const r = earnStroops(l, "coin", 25_000, t0 + (STREAK_DAYS - 1) * DAY)
    expect(r.credited).toBe(25_000 * 2) // day 7: base 1 (×2 = 2 already credited) + 25,000 → 50,002 − 2
    let big = { ...emptyLedger("f2"), founderBadge: true }
    big = earnStroops(big, "coin", FOUNDER_DAILY_CAP * 3, t0).ledger
    expect(big.todayCredited).toBe(FOUNDER_DAILY_CAP)
  })
  it("coins share the daily cap with other sources; milestones stay outside; lifetime + by-source tallies", () => {
    let l = emptyLedger("s")
    l = earn(l, "colony_clear", t0).ledger
    l = earnStroops(l, "coin", 25_000, t0).ledger
    l = claimMilestone(l, "chapter-1").ledger
    expect(sumSources(l.bySource, ["colony_clear"])).toBe(11_110_000)
    expect(l.bySource.coin).toBe(25_000)
    expect(l.bySource.milestone).toBe(250_000_000)
    expect(l.lifetime).toBe(11_110_000 + 25_000 + 250_000_000)
    expect(l.unclaimed).toBe(l.lifetime)
    expect(Number.isInteger(l.unclaimed)).toBe(true)
  })
  it("recordCoin writes the store; a v14 ledger (no bySource/lifetime) upgrades safely", () => {
    const store = mem()
    store.setItem(REWARD_PLAN_KEY, JSON.stringify({ playerId: "old", unclaimed: 123, todayCredited: 0 }))
    expect(readLedger(store).lifetime).toBe(123)
    expect(recordCoin(store, 25_000, t0)).toBe(25_000)
    expect(readLedger(store).bySource.coin).toBe(25_000)
    expect(recordCoin(null, 25_000, t0)).toBe(25_000) // no storage (locked-down preview) never throws
  })
  it("reducer: coin pop shows the credited sim USD; a hazard never takes XOE", () => {
    const [coin, hz] = itemsFromMoves([{ symbol: "XLM", pct: 0.15 }, { symbol: "BTC", pct: -0.1 }], 1)
    const map: GameState = { ...createOpening(), phase: "colony-map" }
    const s1 = openingReducer(map, { type: "ticker-spawn", items: [coin!, hz!], now: 1 })
    const s2 = openingReducer(s1, { type: "ticker-collect", id: coin!.id, how: "touch", credited: 25_000 })
    expect(s2.tickerPop?.text).toBe("+$0.025 sim")
    expect(s2.tickerNote).toMatch(/0\.0025000 XOE testnet/)
    const s3 = openingReducer(s2, { type: "ticker-collect", id: hz!.id, how: "touch" })
    expect(s3.tickerNote).toMatch(/XOE is safe/)
    const capped = openingReducer(s1, { type: "ticker-collect", id: coin!.id, how: "touch", credited: 0 })
    expect(capped.tickerPop?.text).toBe("cap reached")
  })
})
