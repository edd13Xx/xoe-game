import { describe, expect, it } from "vitest"
import type { TickerSnapshot } from "./live-ticker.ts"
import {
  TICKER_HAZARD_PENALTY,
  TICKER_ITEM_TTL_MS,
  TICKER_MAX_ITEMS,
  TICKER_MOVE_THRESHOLD_PCT,
  TICKER_SHIELD_BONUS,
  itemsFromMoves,
  laneForSymbol,
  mergeTickerItems,
  orbPoints,
  seededRng,
  simulateSnapshot,
  tickerMoves,
  touchedItems,
} from "./ticker-play.ts"
import { WORLD_H, WORLD_W } from "./overworld.ts"
import { createOpening, openingReducer, type GameState } from "./opening.ts"

const snap = (prices: Record<string, number>, live = true): TickerSnapshot => ({
  quotes: Object.entries(prices).map(([symbol, priceUsd]) => ({
    pair: `${symbol}-USD` as "XLM-USD",
    symbol,
    priceUsd,
    change24hPct: null,
    updatedAt: 0,
  })),
  live,
  message: null,
  updatedAt: 0,
})

describe("v13 ticker → gameplay mapping", () => {
  it("computes percent moves between snapshots, skipping missing/zero prices", () => {
    expect(tickerMoves(null, snap({ XLM: 1 }))).toEqual([])
    const moves = tickerMoves(snap({ XLM: 0.15, BTC: 75000, ETH: 0 }), snap({ XLM: 0.1503, BTC: 74925, ETH: 2000, ADA: 1 }))
    expect(moves).toHaveLength(2)
    expect(moves[0]!.symbol).toBe("XLM")
    expect(moves[0]!.pct).toBeCloseTo(0.2)
    expect(moves[1]!.pct).toBeCloseTo(-0.1)
  })

  it("price up → bonus orb, price down → hazard, tiny moves → nothing; lanes by coin", () => {
    const items = itemsFromMoves(
      [
        { symbol: "XLM", pct: 0.2 },
        { symbol: "BTC", pct: -0.1 },
        { symbol: "ETH", pct: TICKER_MOVE_THRESHOLD_PCT / 2 },
      ],
      1000,
    )
    expect(items.map((i) => i.kind)).toEqual(["orb", "hazard"])
    expect(items[0]!.points).toBe(orbPoints(0.2))
    expect(items[1]!.points).toBe(-TICKER_HAZARD_PENALTY)
    expect(items[0]!.lane).toBe(laneForSymbol("XLM"))
    expect(laneForSymbol("XLM")).toBe(0)
    expect(laneForSymbol("BTC")).toBe(1)
    expect(laneForSymbol("ADA")).toBe(1)
    for (const it of items) {
      expect(it.wx).toBeGreaterThanOrEqual(80)
      expect(it.wx).toBeLessThanOrEqual(WORLD_W - 80)
      expect(it.wy).toBeGreaterThanOrEqual(80)
      expect(it.wy).toBeLessThanOrEqual(WORLD_H - 80)
    }
    // deterministic
    expect(itemsFromMoves([{ symbol: "XLM", pct: 0.2 }], 1000)).toEqual([items[0]])
  })

  it("orb points scale with move size and cap at 50", () => {
    expect(orbPoints(0.02)).toBe(12)
    expect(orbPoints(0.25)).toBe(35)
    expect(orbPoints(5)).toBe(50)
  })

  it("merges, expires after TTL and caps the field", () => {
    const many = Array.from({ length: 10 }, (_, i) => itemsFromMoves([{ symbol: "XLM", pct: 0.1 }], i)[0]!)
    const merged = mergeTickerItems([], many, 10)
    expect(merged).toHaveLength(TICKER_MAX_ITEMS)
    expect(merged.at(-1)!.bornAt).toBe(9)
    expect(mergeTickerItems(merged, [], 10 + TICKER_ITEM_TTL_MS)).toHaveLength(0)
  })

  it("offline fallback simulates bounded, repeatable prices for all ticker coins", () => {
    const a = simulateSnapshot(null, seededRng(7), 5)
    const b = simulateSnapshot(null, seededRng(7), 5)
    expect(a).toEqual(b)
    expect(a.live).toBe(false)
    expect(a.message).toMatch(/Simulated/)
    expect(a.quotes.map((q) => q.symbol)).toEqual(["XLM", "BTC", "ETH", "ADA"])
    const next = simulateSnapshot(a, seededRng(9), 6)
    for (const m of tickerMoves(a, next)) expect(Math.abs(m.pct)).toBeLessThanOrEqual(0.6 + 1e-9)
  })

  it("XO touches items within radius on the map", () => {
    const [it] = itemsFromMoves([{ symbol: "XLM", pct: 0.2 }], 42)
    expect(touchedItems([it!], it!.wx + 10, it!.wy, 36)).toHaveLength(1)
    expect(touchedItems([it!], it!.wx + 100, it!.wy, 36)).toHaveLength(0)
  })

  it("reducer: spawn only on map/lesson; orb adds pts; hazard hit costs, shield pays", () => {
    const front = createOpening()
    const items = itemsFromMoves([{ symbol: "XLM", pct: 0.2 }, { symbol: "BTC", pct: -0.1 }], 1)
    expect(openingReducer(front, { type: "ticker-spawn", items, now: 1 }).tickerItems).toEqual([])
    const map: GameState = { ...front, phase: "colony-map" }
    const s1 = openingReducer(map, { type: "ticker-spawn", items, now: 1 })
    expect(s1.tickerItems).toHaveLength(2)
    const s2 = openingReducer(s1, { type: "ticker-collect", id: items[0]!.id, how: "touch" })
    expect(s2.tickerScore).toBe(orbPoints(0.2))
    expect(s2.tickerItems).toHaveLength(1)
    const s3 = openingReducer(s2, { type: "ticker-collect", id: items[1]!.id, how: "touch" })
    expect(s3.tickerScore).toBe(orbPoints(0.2) - TICKER_HAZARD_PENALTY)
    expect(s3.tickerNote).toMatch(/enemy hit/)
    const lesson: GameState = { ...s1, phase: "colony-lesson", arcadeScore: 0 }
    const s4 = openingReducer(lesson, { type: "ticker-collect", id: items[1]!.id, how: "shield" })
    expect(s4.tickerScore).toBe(TICKER_SHIELD_BONUS)
    expect(s4.arcadeScore).toBe(TICKER_SHIELD_BONUS)
  })
})
