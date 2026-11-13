import { boundedFetch } from "./bounded-fetch.ts"
/**
 * Slim multi-asset live ticker — Coinbase PUBLIC API only (spot + 24h stats). No keys, no account.
 * Fails soft offline / CORS (cache, then simulated prices). Testnet XOE · no real money.
 */
import { publicHttpsUrl } from "./public-url.ts"

export const TICKER_PREF_KEY = "xoe.liveTicker.v1"
export const TICKER_CACHE_KEY = "xoe.liveTickerCache.v1"
export const TICKER_REFRESH_MS = 30_000
/** v15: 24h open refresh (public stats endpoint), much slower than spot. */
export const TICKER_STATS_MS = 5 * 60_000
export const TICKER_HISTORY_MAX = 48

export const TICKER_PAIRS = ["XLM-USD", "BTC-USD", "ETH-USD", "ADA-USD"] as const
export const LIVE_TICKER_PAIRS = ["XLM-USD"] as const
export type TickerPair = (typeof TICKER_PAIRS)[number] | "XOE-USD"
/** Switcher order: XOE/USD sim first, then the Coinbase public coins. */
export const TICKER_SYMBOLS = ["XOE", ...TICKER_PAIRS.map((p) => p.split("-")[0]!)]
export const TICKER_DEFAULT_FOCUS = "XOE"

export interface TickerQuote {
  pair: TickerPair
  symbol: string
  priceUsd: number
  /** v15: real 24h change (needs the 24h open); null when unknown. v14 put the 30s step here by mistake. */
  change24hPct: number | null
  /** v15: move since the previous snapshot (percent). */
  stepPct?: number | null
  /** v15: 24h open from the public stats endpoint. */
  open24h?: number | null
  updatedAt: number
  simulated?: boolean
}

export interface TickerSnapshot {
  quotes: TickerQuote[]
  live: boolean
  message: string | null
  updatedAt: number
}

export type TickerMode = "live" | "cached" | "sim" | "off"
type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }
export type TickerFetcher = (url: string, init?: RequestInit) => Promise<Response>
export interface TickerPref {
  enabled: boolean
  focus: string
}

export const spotUrl = (pair: TickerPair) => publicHttpsUrl(`api.coinbase.com/v2/prices/${pair}/spot`)
export const statsUrl = (pair: TickerPair) => publicHttpsUrl(`api.exchange.coinbase.com/products/${pair}/stats`)

function readJson<T>(store: Store | null, key: string): T | null {
  try {
    const raw = store?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function writeJson(store: Store | null, key: string, v: unknown): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

export function readTickerPrefs(store: Store | null): TickerPref {
  const p = readJson<Partial<TickerPref>>(store, TICKER_PREF_KEY)
  return {
    enabled: p?.enabled !== false,
    focus: typeof p?.focus === "string" && TICKER_SYMBOLS.includes(p.focus) ? p.focus : TICKER_DEFAULT_FOCUS,
  }
}
export const readTickerPref = (store: Store | null) => readTickerPrefs(store).enabled
export const writeTickerPref = (store: Store | null, enabled: boolean) =>
  writeJson(store, TICKER_PREF_KEY, { ...readTickerPrefs(store), enabled: enabled === true })
export const writeTickerFocus = (store: Store | null, focus: string) =>
  writeJson(store, TICKER_PREF_KEY, { ...readTickerPrefs(store), focus })
/** Coin switcher: next coin in ticker order. */
export const nextFocus = (cur: string) => TICKER_SYMBOLS[(TICKER_SYMBOLS.indexOf(cur) + 1) % TICKER_SYMBOLS.length]!

export const readTickerCache = (store: Store | null) => readJson<TickerSnapshot>(store, TICKER_CACHE_KEY)
export const writeTickerCache = (store: Store | null, snap: TickerSnapshot) => void writeJson(store, TICKER_CACHE_KEY, snap)

function num(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}
export const parseSpotAmount = (json: unknown) => num((json as { data?: { amount?: unknown } } | null)?.data?.amount)
export function parseStatsOpen(json: unknown): number | null {
  const n = num((json as { open?: unknown } | null)?.open)
  return n != null && n > 0 ? n : null
}
export const pctChange = (from: number | null | undefined, to: number) =>
  from != null && from > 0 && to > 0 ? ((to - from) / from) * 100 : null

/** Fetch the 24h opens (one public request per pair). Missing ones are just left out. */
/** v18: one small request to see if Coinbase is reachable again (used by the offline backoff). */
export async function probeSpot(fetcher: TickerFetcher = fetch): Promise<boolean> {
  try {
    return (await boundedFetch(fetcher, spotUrl("XLM-USD"))).ok
  } catch {
    return false
  }
}

export async function fetchOpens(fetcher: TickerFetcher = fetch): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  await Promise.all(
    LIVE_TICKER_PAIRS.map(async (pair) => {
      try {
        const res = await boundedFetch(fetcher, statsUrl(pair))
        const open = res.ok ? parseStatsOpen(await res.json()) : null
        if (open) out[pair.split("-")[0]!] = open
      } catch {
        /* soft fail */
      }
    }),
  )
  return out
}

export async function fetchTickerSnapshot(
  fetcher: TickerFetcher = fetch,
  store: Store | null = null,
  opens: Record<string, number> = {},
): Promise<TickerSnapshot> {
  const cached = readTickerCache(store)
  const results = await Promise.all(
    LIVE_TICKER_PAIRS.map(async (pair) => {
      try {
        const res = await boundedFetch(fetcher, spotUrl(pair))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return parseSpotAmount(await res.json())
      } catch {
        return null
      }
    }),
  )
  const quotes: TickerQuote[] = []
  LIVE_TICKER_PAIRS.forEach((pair, i) => {
    const symbol = pair.split("-")[0]!
    const prev = cached?.quotes.find((q) => q.pair === pair)
    const price = results[i]
    if (price == null) {
      if (prev) quotes.push(prev)
      return
    }
    const open24h = opens[symbol] ?? prev?.open24h ?? null
    quotes.push({
      pair,
      symbol,
      priceUsd: price,
      change24hPct: pctChange(open24h, price),
      stepPct: pctChange(prev?.priceUsd, price),
      open24h,
      updatedAt: Date.now(),
    })
  })
  const anyOk = results.some((r) => r != null)
  if (anyOk) {
    const snap = { quotes, live: true, message: null, updatedAt: Date.now() }
    writeTickerCache(store, snap)
    return snap
  }
  if (cached) return { ...cached, quotes: cached.quotes.filter((q) => q.pair === "XLM-USD"), live: false, message: "Prices paused · offline. Open in Safari for live prices" }
  return { quotes, live: false, message: "Prices paused · offline. Open in Safari for live prices", updatedAt: Date.now() }
}

/** Which label the ticker shows. "cached" = last live prices, now offline. */
export function tickerMode(snap: TickerSnapshot | null, enabled: boolean): TickerMode {
  if (!snap) return enabled ? "cached" : "off"
  if (snap.live) return "live"
  return /simulated/i.test(snap.message ?? "") ? "sim" : "cached"
}
export const TICKER_MODE_LABEL: Record<TickerMode, string> = {
  live: "Live",
  cached: "Last prices · offline",
  sim: "Simulated walk · offline",
  off: "Ticker off",
}

export const TICKER_SAFARI_HINT = "Open in Safari for live prices"

export function tickerStatusText(mode: TickerMode, hasQuotes: boolean, hintSafari: boolean): string {
  if (!hasQuotes && mode !== "off") {
    return hintSafari ? `Prices paused · offline. ${TICKER_SAFARI_HINT}` : "Prices paused · offline · using a stand-in walk"
  }
  const base = TICKER_MODE_LABEL[mode]
  if (mode === "live" || mode === "off") return `${base} · testnet`
  return hintSafari ? `${base} · ${TICKER_SAFARI_HINT}` : `${base} · testnet`
}

/** v15 sparkline: keep the last N prices per coin. Pure. */
export function pushHistory(
  hist: Record<string, number[]>,
  snap: TickerSnapshot,
  max = TICKER_HISTORY_MAX,
): Record<string, number[]> {
  const out: Record<string, number[]> = { ...hist }
  for (const q of snap.quotes) {
    if (!(q.priceUsd > 0)) continue
    const cur = out[q.symbol] ?? []
    out[q.symbol] = cur.at(-1) === q.priceUsd && cur.length > 1 ? cur : [...cur, q.priceUsd].slice(-max)
  }
  return out
}

/** SVG polyline points for a sparkline in a w×h box (flat line if no range). */
export function sparkPoints(values: readonly number[], w = 60, h = 18): string {
  if (values.length < 2) return ""
  const lo = Math.min(...values)
  const span = Math.max(...values) - lo
  const step = w / (values.length - 1)
  return values
    .map((v, i) => `${+(i * step).toFixed(1)},${+(span ? h - ((v - lo) / span) * h : h / 2).toFixed(1)}`)
    .join(" ")
}

export function formatTickerPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(2)
  return n.toPrecision(4)
}
export const formatPct = (p: number | null | undefined) => (p == null ? "" : `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`)

/**
 * v18: short chip price so the XLM/BTC/ETH row fits a 393px phone without clipping
 * (QA saw "▼ ETH $2,06…"). 75009 → "75.0k", 2090.8 → "2,091", 0.28761 → "0.288".
 */
export function formatChipPrice(n: number): string {
  if (!(n > 0)) return "—"
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 100) return Math.round(n).toLocaleString("en-US")
  if (n >= 1) return n.toFixed(2)
  return n.toPrecision(3)
}

/** v18: one mode line, no doubled "testnet" when the XOE sim label already says it. */
export function tickerModeLine(simLabel: string | null, status: string): string {
  if (!simLabel) return status
  const trimmed = /testnet/i.test(simLabel) ? status.replace(/\s·\stestnet$/i, "") : status
  return `${simLabel} · ${trimmed}`
}
