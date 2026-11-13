import { usePrefersReducedMotion } from "./runtime.ts"
import { useEffect, useRef, useState } from "react"
import {
  formatPct,
  formatChipPrice,
  formatTickerPrice,
  nextFocus,
  readTickerPrefs,
  sparkPoints,
  tickerMode,
  tickerModeLine,
  tickerStatusText,
  writeTickerFocus,
  type TickerSnapshot,
} from "../game/live-ticker.ts"
import { XOE_SIM_LABEL, XOE_SIM_SYMBOL, formatXoeTickPrice, lerpPrice } from "../game/xoe-sim-price.ts"
import { inRestrictedPreview } from "../game/sandbox.ts"
import { getLocalStore } from "../game/safe-storage.ts"

/** v16 ticker: XOE/USD sim is the default focus; other coins stay in the switcher. */
export function LiveTicker({
  enabled = true,
  snap,
  history = {},
}: {
  enabled?: boolean
  snap: TickerSnapshot | null
  history?: Record<string, number[]>
}) {
  const reduced = usePrefersReducedMotion()
  const [focus, setFocus] = useState(() => readTickerPrefs(getLocalStore()).focus)
  const [flash, setFlash] = useState<"up" | "down" | "">("")
  const [shown, setShown] = useState<number | null>(null)
  const fromRef = useRef(0)
  const mode = tickerMode(snap, enabled)
  const quotes = snap?.quotes ?? []
  const fq = quotes.find((q) => q.symbol === focus)
  const targetPx = fq?.priceUsd ?? null
  useEffect(() => {
    if (targetPx == null) return
    if (reduced) { setShown(targetPx); return }
    const prev = shown ?? targetPx
    if (prev === targetPx) return
    fromRef.current = prev
    const start = performance.now()
    const dur = 700
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      setShown(focus === XOE_SIM_SYMBOL ? lerpPrice(fromRef.current, targetPx, k) : fromRef.current + (targetPx - fromRef.current) * k)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPx, focus, reduced])
  const displayPx = shown ?? targetPx
  const pct = fq?.change24hPct ?? null
  const dir = (p: number | null | undefined) => (p == null ? "" : p >= 0 ? " up" : " down")
  const pts = sparkPoints(history[focus] ?? [], focus === XOE_SIM_SYMBOL ? 88 : 56, 18)
  const isXoe = focus === XOE_SIM_SYMBOL
  const pctLabel = pct == null ? "" : `${formatPct(pct)} ${isXoe || fq?.simulated || mode === "sim" ? "sim" : "24h"}`
  const hintSafari = inRestrictedPreview() && mode !== "live"
  const status = tickerStatusText(mode, quotes.length > 0, hintSafari)

  useEffect(() => {
    const step = fq?.stepPct
    if (step == null || step === 0) return
    setFlash(step >= 0 ? "up" : "down")
    const id = window.setTimeout(() => setFlash(""), 700)
    return () => window.clearTimeout(id)
  }, [fq?.priceUsd, fq?.stepPct])

  return (
    <div className="live-ticker" data-live={snap?.live ? "1" : "0"} data-mode={mode} aria-label="Live price ticker">
      <button
        type="button"
        className={`ticker-focus${dir(pct)}${flash ? ` flash-${flash}` : ""}`}
        title="Switch chart asset"
        onClick={() => {
          const n = nextFocus(focus)
          setShown(null)
          setFocus(n)
          writeTickerFocus(getLocalStore(), n)
        }}
      >
        <strong>{focus}</strong>
        {/* v18: chart first, price labels on the RIGHT (Eddie's pick) */}
        {pts ? (
          <svg className="ticker-spark" viewBox={isXoe ? "0 0 88 18" : "0 0 56 18"} width={isXoe ? 88 : 56} height="18" aria-hidden="true">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ) : null}
        <span className="ticker-price">{displayPx != null ? (focus === XOE_SIM_SYMBOL ? formatXoeTickPrice(displayPx) : formatTickerPrice(displayPx)) : "—"}</span>
        {pctLabel ? <span className="ticker-pct">{pctLabel}</span> : null}
        <span className="ticker-switch" aria-hidden="true">⇄</span>
      </button>
      <div className="ticker-track" aria-hidden="true">
        <div className="ticker-scroll">
          {[0, 1].map((dup) =>
            quotes
              .filter((q) => q.symbol !== focus)
              .map((q) => (
                <span key={`${dup}${q.pair}`} className={`ticker-chip${dir(q.change24hPct ?? q.stepPct)}${dup ? " dup" : ""}`}>
                  <strong>{q.symbol}{q.simulated ? " sim" : ""}</strong> <span className="chip-px">{formatTickerPrice(q.priceUsd)}</span>
                  <span className="chip-px-short">{formatChipPrice(q.priceUsd)}</span>{" "}
                  <span className="chip-pct">{formatPct(q.change24hPct ?? q.stepPct)}</span>
                </span>
              )),
          )}
        </div>
      </div>
      <span className={`ticker-mode fine${mode === "live" ? " on" : ""}`}>
        <span className={`live-dot${mode === "live" ? " on" : ""}`} />
        {tickerModeLine(isXoe ? XOE_SIM_LABEL : fq?.simulated ? "Simulated price · not a live market" : null, fq?.simulated ? "Device-only · testnet" : status)}
      </span>
    </div>
  )
}
