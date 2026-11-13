import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import type { SimCandle } from "../game/sim-candles.ts"
import { depthSeries, fmtPx, fmtVol } from "../game/pro-desk.ts"
import type { BookLevel } from "../game/paper-advanced.ts"
import { EMA_FAST, EMA_SLOW, emaSeries, seriesPaths, trendLabel, trendRead, vwapSeries } from "../game/chart-indicators.ts"

const UP = "#2ee6c9"
const DOWN = "#ff6b8b"

/** Measured size of an element (falls back to a sensible box where ResizeObserver is missing). */
export function useBox(fallbackW = 320, fallbackH = 260) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: fallbackW, h: fallbackH })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 20 && r.height > 20) setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: Math.round(r.width), h: Math.round(r.height) }))
    }
    read()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ...box }
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** Axis label: clock time for frames up to 4h, a date for 1D and longer (spacing > 12h between bars). */
function fmtTime(t: number, spanMs: number) {
  const d = new Date(t)
  if (spanMs >= 20 * 86_400_000) return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
  if (spanMs >= 12 * 3_600_000) return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const AXIS_W = 52
const TIME_H = 18

/**
 * Candlestick chart with volume bars, a last-price tag and a tap/hover crosshair.
 * Sim candles only. New and moving candles ease in (CSS; off with reduced motion).
 */
export function ProCandleChart({
  candles,
  marks = [],
  width,
  height,
  reducedMotion,
  indicators = false,
}: {
  candles: readonly SimCandle[]
  /** Draw EMA 9, EMA 21 and VWAP over the candles (sim only). */
  indicators?: boolean
  /** Horizontal price markers for the sim position: entry, take profit, stop loss. */
  marks?: readonly { price: number; kind: "entry" | "tp" | "sl" | "alert"; label: string }[]
  width: number
  height: number
  reducedMotion: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = Math.max(200, width)
  const H = Math.max(160, height)
  const plotW = W - AXIS_W
  const volH = Math.round((H - TIME_H) * 0.18)
  const priceH = H - TIME_H - volH - 6
  const n = Math.max(1, candles.length)
  const slot = plotW / n
  let hi = -Infinity
  let lo = Infinity
  let maxV = 1
  for (const c of candles) {
    if (c.h > hi) hi = c.h
    if (c.l < lo) lo = c.l
    if (c.v > maxV) maxV = c.v
  }
  if (!Number.isFinite(hi)) {
    hi = 10.1
    lo = 9.9
  }
  for (const m of marks) {
    if (m.kind === "alert") continue // alerts never squash the candles; drawn only when in view
    if (m.price > hi) hi = m.price
    if (m.price < lo) lo = m.price
  }
  const padPx = Math.max(0.01, (hi - lo) * 0.1)
  hi += padPx
  lo -= padPx
  const span = Math.max(0.02, hi - lo)
  const y = (p: number) => 4 + (1 - (p - lo) / span) * priceH
  const last = candles[candles.length - 1]
  const lastUp = last ? last.c >= last.o : true
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + span * f)

  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const i = Math.min(n - 1, Math.max(0, Math.floor(x / slot)))
    setHover(x > plotW ? null : i)
  }
  const hc = hover != null ? candles[hover] : undefined
  const shown = hc ?? last
  const barSpan = candles.length > 1 ? candles[candles.length - 1]!.t - candles[candles.length - 2]!.t : 60_000
  const labelEvery = Math.max(1, Math.round(70 / Math.max(slot, 1)))
  const emaF = indicators ? emaSeries(candles, EMA_FAST) : []
  const emaS = indicators ? emaSeries(candles, EMA_SLOW) : []
  const vwap = indicators ? vwapSeries(candles) : []
  const at = hover ?? n - 1
  const cxAt = (i: number) => (i + 0.5) * slot
  const trend = indicators ? trendRead(last?.c, emaF[n - 1], emaS[n - 1]) : "warming"
  const fmtI = (v: number | null | undefined) => (v == null ? "—" : fmtPx(v))

  return (
    <div className="pd-chart-wrap">
      <div className="pd-ohlc" aria-live="off">
        {shown ? (
          <>
            <span>O <b>{fmtPx(shown.o)}</b></span>
            <span>H <b>{fmtPx(shown.h)}</b></span>
            <span>L <b>{fmtPx(shown.l)}</b></span>
            <span>C <b className={shown.c >= shown.o ? "up" : "down"}>{fmtPx(shown.c)}</b></span>
            <span>Vol <b>{fmtVol(shown.v)}</b></span>
            {indicators ? (
              <>
                <span className="pd-ind-k pd-ind-fast">EMA {EMA_FAST} <b>{fmtI(emaF[at])}</b></span>
                <span className="pd-ind-k pd-ind-slow">EMA {EMA_SLOW} <b>{fmtI(emaS[at])}</b></span>
                <span className="pd-ind-k pd-ind-vwap">VWAP <b>{fmtI(vwap[at])}</b></span>
                <span className={`pd-trend pd-trend-${trend}`} data-trend={trend}>{trendLabel(trend)}</span>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      <svg
        className={`pd-chart${reducedMotion ? " is-reduced" : ""}`}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        data-snl-chart="1"
        data-candles={candles.length}
        data-indicators={indicators ? "1" : "0"}
        aria-label={`XOE/USD simulated candlestick chart, last ${last ? fmtPx(last.c) : "n/a"}${indicators ? `, EMA ${EMA_FAST} ${fmtI(emaF[n - 1])}, EMA ${EMA_SLOW} ${fmtI(emaS[n - 1])}, VWAP ${fmtI(vwap[n - 1])}, ${trendLabel(trend)}` : ""}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHover(null)
        }}
      >
        <defs>
          <linearGradient id="pd-tag-up" x1="0" x2="1">
            <stop offset="0" stopColor="#1fbfa6" />
            <stop offset="1" stopColor={UP} />
          </linearGradient>
          <linearGradient id="pd-tag-down" x1="0" x2="1">
            <stop offset="0" stopColor="#e0506e" />
            <stop offset="1" stopColor={DOWN} />
          </linearGradient>
        </defs>
        {ticks.map((p) => (
          <g key={p.toFixed(5)}>
            <line x1={0} x2={plotW} y1={y(p)} y2={y(p)} className="pd-gl" />
            <text x={W - 4} y={y(p) + 3} textAnchor="end" className="pd-axis">
              {fmtPx(p)}
            </text>
          </g>
        ))}
        {candles.map((c, i) => {
          const up = c.c >= c.o
          const color = up ? UP : DOWN
          const cx = (i + 0.5) * slot
          const bw = Math.max(1.5, slot * 0.62)
          const top = y(Math.max(c.o, c.c))
          const bodyH = Math.max(1.4, y(Math.min(c.o, c.c)) - top)
          const wickTop = y(c.h)
          const wickH = Math.max(1, y(c.l) - wickTop)
          const vh = Math.max(1, (c.v / maxV) * (volH - 2))
          const isLast = i === n - 1
          return (
            <g key={c.t} className={`pd-candle${isLast ? " is-live" : ""}`} data-up={up ? "1" : "0"}>
              <rect className="pd-wick" x={cx - 0.5} y={wickTop} width={1} height={wickH} fill={color} style={{ y: `${wickTop}px`, height: `${wickH}px` }} />
              <rect className="pd-body" x={cx - bw / 2} y={top} width={bw} height={bodyH} rx={Math.min(1.5, bw / 3)} fill={color} style={{ y: `${top}px`, height: `${bodyH}px` }} />
              <rect
                className="pd-vol"
                x={cx - bw / 2}
                y={H - TIME_H - vh}
                width={bw}
                height={vh}
                fill={color}
                opacity={0.38}
                style={{ y: `${H - TIME_H - vh}px`, height: `${vh}px` }}
              />
            </g>
          )
        })}
        {indicators ? (
          <g className="pd-ind" pointerEvents="none" data-ind="1">
            <path className="pd-ind-line pd-ind-vwap" d={seriesPaths(vwap, cxAt, y)} />
            <path className="pd-ind-line pd-ind-slow" d={seriesPaths(emaS, cxAt, y)} />
            <path className="pd-ind-line pd-ind-fast" d={seriesPaths(emaF, cxAt, y)} />
          </g>
        ) : null}
        {candles.map((c, i) =>
          i % labelEvery === 0 && (i + 0.5) * slot < plotW - 20 && (i + 0.5) * slot > 22 ? (
            <text key={`x${c.t}`} x={(i + 0.5) * slot} y={H - 4} textAnchor="middle" className="pd-axis">
              {fmtTime(c.t, barSpan)}
            </text>
          ) : null,
        )}
        {[...marks].filter((m) => m.kind !== "alert" || (m.price >= lo && m.price <= hi)).sort((a, b) => (a.kind === "entry" ? -1 : b.kind === "entry" ? 1 : 0)).map((m) => (
          <g key={`${m.kind}-${m.price}`} className={`pd-mark pd-mark-${m.kind}`} data-mark={m.kind} pointerEvents="none" style={{ isolation: "isolate" }}>
            <line x1={0} x2={plotW} y1={y(m.price)} y2={y(m.price)} strokeDasharray={m.kind === "entry" ? "2 3" : m.kind === "alert" ? "1 4" : "6 4"} />
            <rect x={plotW - 70} y={y(m.price) - 8} width={66} height={15} rx={3} />
            <text x={plotW - 66} y={y(m.price) + 3} className="pd-mark-text">
              {m.label} {fmtPx(m.price)}
            </text>
          </g>
        ))}
        {last ? (
          <g className="pd-lastline">
            <line x1={0} x2={plotW} y1={y(last.c)} y2={y(last.c)} stroke={lastUp ? UP : DOWN} strokeDasharray="3 4" strokeWidth={1} opacity={0.75} />
            <rect x={plotW + 1} y={y(last.c) - 8} width={AXIS_W - 2} height={16} rx={4} fill={lastUp ? "url(#pd-tag-up)" : "url(#pd-tag-down)"} />
            <text x={plotW + AXIS_W / 2} y={y(last.c) + 3.5} textAnchor="middle" className="pd-tag-text">
              {fmtPx(last.c)}
            </text>
          </g>
        ) : null}
        {hover != null && hc ? (
          <g className="pd-cross" pointerEvents="none">
            <line x1={(hover + 0.5) * slot} x2={(hover + 0.5) * slot} y1={0} y2={H - TIME_H} />
            <line x1={0} x2={plotW} y1={y(hc.c)} y2={y(hc.c)} />
            <rect x={plotW + 1} y={y(hc.c) - 8} width={AXIS_W - 2} height={16} rx={4} className="pd-cross-tag" />
            <text x={plotW + AXIS_W / 2} y={y(hc.c) + 3.5} textAnchor="middle" className="pd-cross-text">
              {fmtPx(hc.c)}
            </text>
            <rect x={Math.min(plotW - 40, Math.max(0, (hover + 0.5) * slot - 20))} y={H - TIME_H + 1} width={40} height={16} rx={4} className="pd-cross-tag" />
            <text x={Math.min(plotW - 20, Math.max(20, (hover + 0.5) * slot))} y={H - 6} textAnchor="middle" className="pd-cross-text">
              {fmtTime(hc.t, barSpan)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

/** Cumulative bid/ask area chart from the live sim book. */
export function ProDepthChart({
  bids,
  asks,
  mid,
  width,
  height,
}: {
  bids: readonly BookLevel[]
  asks: readonly BookLevel[]
  mid: number
  width: number
  height: number
}) {
  const W = Math.max(200, width)
  const H = Math.max(160, height)
  const d = depthSeries(bids, asks)
  const lo = d.bids[d.bids.length - 1]?.price ?? mid * 0.99
  const hi = d.asks[d.asks.length - 1]?.price ?? mid * 1.01
  const spanP = Math.max(1e-6, hi - lo)
  const x = (p: number) => ((p - lo) / spanP) * W
  const yy = (c: number) => 6 + (1 - c / d.maxCum) * (H - 30)
  const base = H - 24
  const area = (pts: { price: number; cum: number }[], toward: number) => {
    if (!pts.length) return ""
    let s = `M ${x(pts[0]!.price).toFixed(1)} ${base}`
    let prevC = 0
    for (const p of pts) {
      s += ` L ${x(p.price).toFixed(1)} ${yy(prevC).toFixed(1)} L ${x(p.price).toFixed(1)} ${yy(p.cum).toFixed(1)}`
      prevC = p.cum
    }
    s += ` L ${toward.toFixed(1)} ${yy(prevC).toFixed(1)} L ${toward.toFixed(1)} ${base} Z`
    return s
  }
  const line = (pts: { price: number; cum: number }[], toward: number) => {
    if (!pts.length) return ""
    let s = `M ${x(pts[0]!.price).toFixed(1)} ${yy(0).toFixed(1)}`
    let prevC = 0
    for (const p of pts) {
      s += ` L ${x(p.price).toFixed(1)} ${yy(prevC).toFixed(1)} L ${x(p.price).toFixed(1)} ${yy(p.cum).toFixed(1)}`
      prevC = p.cum
    }
    return s + ` L ${toward.toFixed(1)} ${yy(prevC).toFixed(1)}`
  }
  return (
    <svg className="pd-depth" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" data-depth="1" aria-label="XOE/USD simulated depth chart, cumulative bids and asks">
      <defs>
        <linearGradient id="pd-dg-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={UP} stopOpacity="0.5" />
          <stop offset="1" stopColor={UP} stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="pd-dg-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={DOWN} stopOpacity="0.5" />
          <stop offset="1" stopColor={DOWN} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={6 + f * (H - 30)} y2={6 + f * (H - 30)} className="pd-gl" />
      ))}
      <path d={area(d.bids, 0)} fill="url(#pd-dg-b)" />
      <path d={area(d.asks, W)} fill="url(#pd-dg-a)" />
      <path d={line(d.bids, 0)} fill="none" stroke={UP} strokeWidth={1.6} />
      <path d={line(d.asks, W)} fill="none" stroke={DOWN} strokeWidth={1.6} />
      <line x1={x(mid)} x2={x(mid)} y1={4} y2={base} className="pd-mid-line" />
      <text x={4} y={H - 8} className="pd-axis">{fmtPx(lo)}</text>
      <text x={x(mid)} y={H - 8} textAnchor="middle" className="pd-axis">{fmtPx(mid)}</text>
      <text x={W - 4} y={H - 8} textAnchor="end" className="pd-axis">{fmtPx(hi)}</text>
      <text x={4} y={16} className="pd-axis">Bids {d.bids[d.bids.length - 1]?.cum.toFixed(1) ?? "0"}</text>
      <text x={W - 4} y={16} textAnchor="end" className="pd-axis">Asks {d.asks[d.asks.length - 1]?.cum.toFixed(1) ?? "0"}</text>
    </svg>
  )
}
