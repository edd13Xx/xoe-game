import { describe, expect, it } from "vitest"
import {
  TICKER_SYMBOLS,
  fetchOpens,
  fetchTickerSnapshot,
  formatPct,
  nextFocus,
  parseStatsOpen,
  pushHistory,
  readTickerPrefs,
  sparkPoints,
  statsUrl,
  tickerMode,
  writeTickerFocus,
  writeTickerPref,
  type TickerSnapshot,
} from "./live-ticker.ts"
import {
  COIN_STROOPS_PER_POINT,
  MINI_COIN_STROOPS,
  TICKER_BIG_TTL_MS,
  TICKER_CADENCE_MS,
  TICKER_ITEM_TTL_MS,
  TICKER_MAX_ITEMS,
  TICKER_MIN_THRESHOLD_PCT,
  TICKER_MOVE_THRESHOLD_PCT,
  adaptiveThreshold,
  cadenceItem,
  isBigMove,
  itemsFromMoves,
  mergeTickerItems,
  orbPoints,
  pushRecent,
} from "./ticker-play.ts"
import {
  FIGHT_ENERGY_SHIELD,
  FIGHT_SURGE_DAMAGE,
  expireFightTick,
  makeFightTick,
  startFight,
  tapFightTick,
} from "./combat.ts"

function mem() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const res = (body: unknown) => ({ ok: true, json: async () => body }) as Response

describe("v15 calm-market ticker gameplay", () => {
  it("trigger scales down with calm volatility but never above 0.02% or below 0.004%", () => {
    expect(adaptiveThreshold([])).toBe(TICKER_MOVE_THRESHOLD_PCT)
    expect(adaptiveThreshold([0.001, 0.001, 0.001])).toBe(TICKER_MIN_THRESHOLD_PCT)
    expect(adaptiveThreshold([0.008, 0.008, 0.008])).toBeCloseTo(0.012)
    expect(adaptiveThreshold([1, 1, 1])).toBe(TICKER_MOVE_THRESHOLD_PCT)
  })

  it("calm market: a 0.01% move spawns a normal coin once history is quiet; tiny moves make one mini item", () => {
    const calm = [0.005, 0.004, 0.006, 0.005]
    const [n] = itemsFromMoves([{ symbol: "XLM", pct: 0.01 }], 1, calm)
    expect(n!.size).toBe("normal")
    expect(n!.stroops).toBe(orbPoints(0.01) * COIN_STROOPS_PER_POINT)
    const minis = itemsFromMoves([{ symbol: "XLM", pct: 0.001 }, { symbol: "BTC", pct: -0.003 }], 2, calm)
    expect(minis).toHaveLength(1)
    expect(minis[0]!.symbol).toBe("BTC")
    expect(minis[0]!.kind).toBe("hazard")
    expect(minis[0]!.size).toBe("mini")
    expect(minis[0]!.stroops).toBe(0)
    expect(itemsFromMoves([{ symbol: "XLM", pct: 0.0001 }], 3, calm)).toEqual([])
  })

  it("big moves stay special: gold size, double coin value, longer life, never crowded out by minis", () => {
    expect(isBigMove(0.2, [0.01, 0.01])).toBe(true)
    expect(isBigMove(0.2, [0.1, 0.1])).toBe(false)
    const [big] = itemsFromMoves([{ symbol: "ETH", pct: 0.3 }], 10, [0.01, 0.01, 0.01])
    expect(big!.size).toBe("big")
    expect(big!.stroops).toBe(orbPoints(0.3) * COIN_STROOPS_PER_POINT * 2)
    expect(big!.ttl).toBe(TICKER_BIG_TTL_MS)
    const minis = Array.from({ length: 8 }, (_, i) => itemsFromMoves([{ symbol: "XLM", pct: 0.001 }], 20 + i)[0]!)
    const merged = mergeTickerItems([big!], minis, 30)
    expect(merged).toHaveLength(TICKER_MAX_ITEMS)
    expect(merged.some((it) => it.id === big!.id)).toBe(true)
    expect(mergeTickerItems([big!], [], 10 + TICKER_ITEM_TTL_MS)).toHaveLength(1)
    expect(mergeTickerItems([big!], [], 10 + TICKER_BIG_TTL_MS)).toHaveLength(0)
  })

  it("minimum cadence: a drift mini item when nothing spawned for 9s, following the coin's last move", () => {
    expect(cadenceItem(null, 0, TICKER_CADENCE_MS - 1, 0)).toBeNull()
    const d = cadenceItem(null, 0, TICKER_CADENCE_MS, 0)!
    expect(d.size).toBe("mini")
    expect(d.kind).toBe("orb")
    expect(d.stroops).toBe(MINI_COIN_STROOPS)
    const snap: TickerSnapshot = {
      quotes: [{ pair: "XLM-USD", symbol: "XLM", priceUsd: 0.15, change24hPct: null, stepPct: -0.01, updatedAt: 0 }],
      live: true,
      message: null,
      updatedAt: 0,
    }
    expect(cadenceItem(snap, 0, 20_000, 5)!.kind).toBe("hazard")
    expect(pushRecent([], [{ symbol: "X", pct: -0.5 }])).toEqual([0.5])
  })
})

describe("v15 ticker display", () => {
  it("24h % from the public stats open; step % kept separately; offline keeps cache", async () => {
    expect(parseStatsOpen({ open: "0.147678" })).toBeCloseTo(0.147678)
    expect(parseStatsOpen({ open: "0" })).toBeNull()
    expect(statsUrl("XLM-USD")).toMatch(/exchange\.coinbase\.com\/products\/XLM-USD\/stats$/)
    const opens = await fetchOpens(async (u: string) => res({ open: u.includes("XLM") ? "0.10" : "1" }))
    expect(opens.XLM).toBe(0.1)
    const store = mem()
    const s1 = await fetchTickerSnapshot(async () => res({ data: { amount: "0.11" } }), store, opens)
    const xlm = s1.quotes.find((q) => q.symbol === "XLM")!
    expect(xlm.change24hPct).toBeCloseTo(10)
    expect(xlm.stepPct).toBeNull()
    const s2 = await fetchTickerSnapshot(async () => res({ data: { amount: "0.121" } }), store)
    expect(s2.quotes.find((q) => q.symbol === "XLM")!.stepPct).toBeCloseTo(10)
    expect(s2.quotes.find((q) => q.symbol === "XLM")!.change24hPct).toBeCloseTo(21) // open kept from cache
    const off = await fetchTickerSnapshot(async () => {
      throw new Error("offline")
    }, store)
    expect(off.live).toBe(false)
    expect(tickerMode(off, true)).toBe("cached")
    expect(tickerMode({ ...off, message: "Simulated prices (offline)" }, true)).toBe("sim")
    expect(tickerMode(s2, true)).toBe("live")
    expect(formatPct(1.234)).toBe("+1.23%")
    expect(formatPct(-0.5)).toBe("-0.50%")
  })

  it("sparkline history is bounded; points fit the box; coin switcher cycles and persists", () => {
    let h: Record<string, number[]> = {}
    for (let i = 1; i <= 30; i++)
      h = pushHistory(h, { quotes: [{ pair: "XLM-USD", symbol: "XLM", priceUsd: i, change24hPct: null, updatedAt: 0 }], live: true, message: null, updatedAt: 0 }, 24)
    expect(h.XLM).toHaveLength(24)
    expect(sparkPoints([1], 56, 18)).toBe("")
    const pts = sparkPoints([1, 3, 2], 56, 18).split(" ").map((p) => p.split(",").map(Number))
    expect(pts[0]).toEqual([0, 18])
    expect(pts[1]).toEqual([28, 0])
    expect(pts[2]![0]).toBe(56)
    expect(nextFocus("XLM")).toBe("BTC")
    expect(nextFocus(TICKER_SYMBOLS.at(-1)!)).toBe("XOE")
    const store = mem()
    writeTickerFocus(store, "ETH")
    writeTickerPref(store, false)
    expect(readTickerPrefs(store)).toEqual({ enabled: false, focus: "ETH" })
    expect(readTickerPrefs(null)).toEqual({ enabled: true, focus: "XOE" })
  })
})

describe("v15 ticker in fights", () => {
  it("green tick = shield, red tick = surge (defuse by tap, blocked by dodge, else damage)", () => {
    const f = startFight("colony", "normal")
    const low = { ...f, mech: { ...f.mech, shield: 0 } }
    const e = makeFightTick("XLM", 0.05, 0, 1000)
    expect(e.kind).toBe("energy")
    expect(tapFightTick(low, e).mech.shield).toBe(FIGHT_ENERGY_SHIELD)
    const s = makeFightTick("BTC", -0.05, 1, 1000)
    expect(s.kind).toBe("surge")
    expect(tapFightTick(low, s).mech.hp).toBe(low.mech.hp)
    expect(expireFightTick(low, s, 5000).mech.hp).toBe(low.mech.hp - FIGHT_SURGE_DAMAGE)
    const dodging = { ...low, mech: { ...low.mech, dodgeUntilMs: 9999 } }
    expect(expireFightTick(dodging, s, 5000).mech.hp).toBe(low.mech.hp)
    expect(expireFightTick(low, e, 5000)).toBe(low)
    expect(makeFightTick("ETH", null, 0, 0).kind).toBe("energy")
    expect(makeFightTick("ETH", null, 1, 0).kind).toBe("surge")
    expect(makeFightTick("ETH", 0.2, 0, 0).big).toBe(true)
  })
})

describe("v15 spawn near XO", () => {
  it("items land in a box around XO, never on XO, never under the mini map, inside the world", async () => {
    const { spawnPos } = await import("./ticker-play.ts")
    const { WORLD_W, WORLD_H } = await import("./overworld.ts")
    for (let h = 0; h < 5000; h += 7) {
      const p = spawnPos(h * 2654435761, { x: 600, y: 400 })
      const dx = p.x - 600, dy = p.y - 400
      expect(Math.abs(dx)).toBeLessThanOrEqual(230)
      expect(Math.abs(dy)).toBeLessThanOrEqual(160)
      expect(Math.abs(dx) < 50 && Math.abs(dy) < 50).toBe(false)
      expect(dx < -60 && dy < -110).toBe(false)
      const edge = spawnPos(h, { x: 10, y: 10 })
      expect(edge.x).toBeGreaterThanOrEqual(60)
      expect(edge.y).toBeLessThanOrEqual(WORLD_H - 60)
      expect(edge.x).toBeLessThanOrEqual(WORLD_W - 60)
    }
  })
})
