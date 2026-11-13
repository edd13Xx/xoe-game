import { boundedFetch } from "./bounded-fetch.ts"
/**
 * Read-only XLM (Stellar) market quotes for learning.
 * Coinbase PUBLIC unauthenticated endpoints only. No keys. No account. No connector.
 */
import { publicHttpsUrl } from "./public-url.ts"


export const MARKET_REFRESH_MS = 60_000

/** Player-facing ticker name. Feed stays Coinbase XLM-USD; swap this for a later Solana label. */
export const TICKER_LABEL = "XOE"

export const XOE_MARKET_LINE =
  "XOE: This Market panel is for learning only — not financial advice. Live quotes can fail offline."

/** Shown on the market panel UI (iPhone-readable). */
export const PRICE_SOURCE_RULE =
  "Price source: Coinbase public price only. No account used."

/** Coinbase retail public spot — no auth. */
export const COINBASE_SPOT_URL = publicHttpsUrl("api.coinbase.com/v2/prices/XLM-USD/spot")

/** Coinbase Exchange public candles (15m) for ~24h sparkline — no auth. */
export const COINBASE_CANDLES_URL = publicHttpsUrl(
  "api.exchange.coinbase.com/products/XLM-USD/candles?granularity=900",
)

/** Hosts this module is allowed to fetch. Tests assert no others. */
export const ALLOWED_MARKET_HOSTS = ["api.coinbase.com", "api.exchange.coinbase.com"] as const

export type MarketFetcher = (url: string, init?: RequestInit) => Promise<Response>

export interface MarketPoint {
  t: number
  price: number
}

export type MarketQuote =
  | {
      ok: true
      symbol: "XLM"
      priceUsd: number
      change24hPct: number | null
      source: "Coinbase"
      updatedAt: number
      points: MarketPoint[]
    }
  | {
      ok: false
      message: "Live price unavailable (offline)"
      detail: string
      updatedAt: number
    }

export function downsamplePoints(points: MarketPoint[], maxPoints = 48): MarketPoint[] {
  if (points.length <= maxPoints) return points
  const out: MarketPoint[] = []
  const step = (points.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round(i * step)
    const point = points[idx]
    if (point) out.push(point)
  }
  return out
}

export function parseCoinbaseSpot(json: unknown): number | null {
  if (!json || typeof json !== "object") return null
  const data = (json as { data?: { amount?: unknown } }).data
  if (!data || typeof data.amount !== "string") return null
  const price = Number(data.amount)
  return Number.isFinite(price) && price > 0 ? price : null
}

/**
 * Coinbase Exchange candles: [ time, low, high, open, close, volume ] oldest→newest or newest→oldest.
 * We sort by time ascending and use close as the price point.
 */
export function parseCoinbaseCandles(json: unknown): MarketPoint[] {
  if (!Array.isArray(json)) return []
  const points: MarketPoint[] = []
  for (const row of json) {
    if (!Array.isArray(row) || row.length < 5) continue
    const timeSec = row[0]
    const close = row[4]
    if (typeof timeSec !== "number" || typeof close !== "number") continue
    if (!Number.isFinite(timeSec) || !Number.isFinite(close)) continue
    points.push({ t: timeSec * 1000, price: close })
  }
  points.sort((a, b) => a.t - b.t)
  return downsamplePoints(points)
}

export function change24hFromPoints(points: MarketPoint[], spot: number): number | null {
  if (points.length < 2) return null
  const first = points[0]!.price
  if (!Number.isFinite(first) || first === 0) return null
  return ((spot - first) / first) * 100
}

function assertAllowedUrl(url: string): void {
  let host = ""
  try {
    host = new URL(url).host
  } catch {
    throw new Error("Invalid market URL")
  }
  if (!(ALLOWED_MARKET_HOSTS as readonly string[]).includes(host)) {
    throw new Error(`Blocked non-Coinbase market host: ${host}`)
  }
}

export async function fetchMarketQuote(fetcher: MarketFetcher = fetch): Promise<MarketQuote> {
  const updatedAt = Date.now()
  try {
    assertAllowedUrl(COINBASE_SPOT_URL)
    const spotRes = await boundedFetch(fetcher, COINBASE_SPOT_URL)
    if (!spotRes.ok) {
      return {
        ok: false,
        message: "Live price unavailable (offline)",
        detail: `Coinbase spot HTTP ${spotRes.status}`,
        updatedAt,
      }
    }
    const spotJson: unknown = await spotRes.json()
    const price = parseCoinbaseSpot(spotJson)
    if (price === null) {
      return {
        ok: false,
        message: "Live price unavailable (offline)",
        detail: "Coinbase spot payload missing amount.",
        updatedAt,
      }
    }

    let points: MarketPoint[] = []
    try {
      assertAllowedUrl(COINBASE_CANDLES_URL)
      const candleRes = await boundedFetch(fetcher, COINBASE_CANDLES_URL)
      if (candleRes.ok) {
        const candleJson: unknown = await candleRes.json()
        points = parseCoinbaseCandles(candleJson)
      }
    } catch {
      points = []
    }

    return {
      ok: true,
      symbol: "XLM",
      priceUsd: price,
      change24hPct: change24hFromPoints(points, price),
      source: "Coinbase",
      updatedAt,
      points,
    }
  } catch (err) {
    return {
      ok: false,
      message: "Live price unavailable (offline)",
      detail: err instanceof Error ? err.message : "Coinbase public quotes failed or were blocked.",
      updatedAt,
    }
  }
}

export function formatUsd(price: number): string {
  if (!Number.isFinite(price)) return "—"
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

export function formatUpdatedAt(ms: number, now = Date.now()): string {
  const d = new Date(ms)
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const ageSec = Math.max(0, Math.round((now - ms) / 1000))
  return `${time} (${ageSec}s ago)`
}

export function sparklinePath(points: MarketPoint[], width: number, height: number, pad = 4): string {
  if (points.length < 2) return ""
  let min = points[0]!.price
  let max = points[0]!.price
  for (const p of points) {
    min = Math.min(min, p.price)
    max = Math.max(max, p.price)
  }
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  return points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * innerW
      const y = pad + (1 - (p.price - min) / span) * innerH
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}
