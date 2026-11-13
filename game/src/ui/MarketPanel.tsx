import { useCallback, useEffect, useState } from "react"
import {
  MARKET_REFRESH_MS,
  PRICE_SOURCE_RULE,
  TICKER_LABEL,
  XOE_MARKET_LINE,
  fetchMarketQuote,
  formatUsd,
  formatUpdatedAt,
  sparklinePath,
  type MarketQuote,
} from "../game/market.ts"
import { DrawerShell } from "./DrawerShell.tsx"

export function MarketPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [quote, setQuote] = useState<MarketQuote | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchMarketQuote()
      setQuote(next)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, MARKET_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [open, refresh])

  const path =
    quote && quote.ok && quote.points.length >= 2 ? sparklinePath(quote.points, 320, 96) : ""

  return (
    <DrawerShell open={open} title={`Market · ${TICKER_LABEL}`} onClose={onClose} labelledBy="drawer-market-title">
      <section className="market-panel" aria-label={`Market ${TICKER_LABEL} read-only`}>
      <p className="bubble">{XOE_MARKET_LINE}</p>
      <p className="price-source-rule" role="note">
        {PRICE_SOURCE_RULE}
      </p>
      <p className="fine">Read-only. Public APIs. No keys. Not trading. Not advice.</p>
      {loading && !quote ? <p role="status">Loading live quote…</p> : null}
      {quote && !quote.ok ? (
        <p className="bad" role="alert">
          {quote.message}
        </p>
      ) : null}
      {quote && quote.ok ? (
        <div>
          <p className="market-price">
            <b>{formatUsd(quote.priceUsd)}</b> USD / XLM · Coinbase reference, not an XOE market price
          </p>
          <p className="fine">
            Source: {quote.source}
            {quote.change24hPct !== null
              ? ` · 24h ${quote.change24hPct >= 0 ? "+" : ""}${quote.change24hPct.toFixed(2)}%`
              : ""}
          </p>
          <p className="fine">Last updated: {formatUpdatedAt(quote.updatedAt)}</p>
          {path ? (
            <div className="chart-row">
              <svg
                className="market-chart"
                viewBox="0 0 320 96"
                width="100%"
                height="96"
                role="img"
                aria-label={`${TICKER_LABEL} price sparkline last day`}
              >
                <path d={path} fill="none" stroke="#6cf0ff" strokeWidth="2" />
              </svg>
              <span className="chart-price-right">{formatUsd(quote.priceUsd)}</span>
            </div>
          ) : (
            <p className="fine">Chart points unavailable; price above is still live from {quote.source}.</p>
          )}
        </div>
      ) : null}
      <button type="button" className="touch-btn" onClick={() => void refresh()} disabled={loading}>
        Refresh now
      </button>
    </section>
    </DrawerShell>
  )
}
