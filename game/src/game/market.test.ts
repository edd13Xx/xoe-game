import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import {
  ALLOWED_MARKET_HOSTS,
  COINBASE_CANDLES_URL,
  COINBASE_SPOT_URL,
  PRICE_SOURCE_RULE,
  TICKER_LABEL,
  XOE_MARKET_LINE,
  change24hFromPoints,
  fetchMarketQuote,
  formatUsd,
  parseCoinbaseCandles,
  parseCoinbaseSpot,
  sparklinePath,
} from "./market.ts"

describe("market quote — Coinbase public only", () => {
  it("exposes only Coinbase public hosts and the on-screen price rule", () => {
    expect(PRICE_SOURCE_RULE).toBe("Price source: Coinbase public price only. No account used.")
    expect(TICKER_LABEL).toBe("XOE")
    expect(XOE_MARKET_LINE).toMatch(/not financial advice/i)
    expect(ALLOWED_MARKET_HOSTS).toEqual(["api.coinbase.com", "api.exchange.coinbase.com"])
    expect(COINBASE_SPOT_URL).toBe("https://api.coinbase.com/v2/prices/XLM-USD/spot")
    expect(COINBASE_CANDLES_URL).toContain("api.exchange.coinbase.com/products/XLM-USD/candles")
    expect(COINBASE_CANDLES_URL).toContain("granularity=900")
    const src = readFileSync("src/game/market.ts", "utf8")
    expect(src).not.toMatch(/coingecko/i)
    expect(src).not.toMatch(/Authorization/)
    expect(src).not.toMatch(/api[_-]?key/i)
    const panel = readFileSync("src/ui/MarketPanel.tsx", "utf8")
    expect(panel).toContain("PRICE_SOURCE_RULE")
    expect(panel).toContain("price-source-rule")
  })

  it("parses Coinbase spot and candles without inventing values", () => {
    expect(parseCoinbaseSpot({ data: { amount: "0.15", base: "XLM", currency: "USD" } })).toBe(0.15)
    expect(parseCoinbaseSpot({ data: { amount: "nope" } })).toBeNull()
    const points = parseCoinbaseCandles([
      [300, 0.14, 0.16, 0.15, 0.145, 10],
      [200, 0.13, 0.15, 0.14, 0.14, 9],
      [100, 0.12, 0.14, 0.13, 0.13, 8],
    ])
    expect(points.map((p) => p.t)).toEqual([100000, 200000, 300000])
    expect(points.map((p) => p.price)).toEqual([0.13, 0.14, 0.145])
    expect(sparklinePath(points, 100, 40).startsWith("M")).toBe(true)
    expect(change24hFromPoints(points, 0.145)).toBeCloseTo(((0.145 - 0.13) / 0.13) * 100, 5)
    expect(formatUsd(0.144423)).toBe("0.144423")
  })

  it("fetches Coinbase only and never fakes a price on failure", async () => {
    const hosts: string[] = []
    const fetcher = vi.fn(async (url: string) => {
      hosts.push(new URL(url).host)
      if (url.includes("api.coinbase.com") && url.includes("/spot")) {
        return new Response(JSON.stringify({ data: { amount: "0.144", base: "XLM", currency: "USD" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      if (url.includes("api.exchange.coinbase.com") && url.includes("candles")) {
        return new Response(
          JSON.stringify([
            [1000, 0.14, 0.15, 0.14, 0.14, 1],
            [2000, 0.14, 0.15, 0.14, 0.145, 1],
            [3000, 0.14, 0.15, 0.145, 0.144, 1],
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      return new Response("no", { status: 404 })
    })
    const quote = await fetchMarketQuote(fetcher)
    expect(quote.ok).toBe(true)
    if (quote.ok) {
      expect(quote.source).toBe("Coinbase")
      expect(quote.priceUsd).toBe(0.144)
      expect(quote.points.length).toBe(3)
    }
    expect(hosts.every((h) => (ALLOWED_MARKET_HOSTS as readonly string[]).includes(h))).toBe(true)
    expect(hosts.some((h) => h.includes("coingecko"))).toBe(false)

    const allFail = vi.fn(async () => {
      throw new Error("offline")
    })
    const dead = await fetchMarketQuote(allFail)
    expect(dead.ok).toBe(false)
    if (!dead.ok) expect(dead.message).toBe("Live price unavailable (offline)")
  })
})
