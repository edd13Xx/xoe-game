import { TradeResultCard } from "./TradeResultCard.tsx"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { sparkPoints } from "../game/live-ticker.ts"
import { formatPnlSim as formatPnlSimRaw, formatXoe7 } from "../game/economy.ts"
import {
  canBuy,
  canSell,
  lotCostUsd,
  paperResult,
  type PracticeState,
} from "../game/practice.ts"
import {
  XOE_SIM_LABEL,
  XOE_SIM_SAFETY,
  formatXoeTickPrice,
  lerpPrice,
} from "../game/xoe-sim-price.ts"
/** Sim ticker numbers are plain numbers: no dollar sign (hard rule). */
const formatPnlSim = (n: number, sign = true): string => formatPnlSimRaw(n, sign).replace(/\$/g, "")

/**
 * Always-visible XOE/USD sim HUD for the flying world: ticking price, scrolling
 * chart, live P/L, and thumb-reachable Buy/Sell at the bottom.
 */
export function LiveTradeHud({
  price,
  history,
  desk,
  onBuy,
  onSell,
  compactChart = false,
  dockExtra = null,
  onOpenDesk,
}: {
  price: number
  history: readonly number[]
  desk: PracticeState
  onBuy: (price: number) => void
  onSell: (price: number) => void
  compactChart?: boolean
  /** v18.3: the map's small Enter chip rides in the same row as Buy/Sell (phones). */
  dockExtra?: ReactNode
  /** Opens the paper/SNL trade desk as a bottom sheet; map stays in view. */
  onOpenDesk?: () => void
}) {
  const [shown, setShown] = useState(price)
  const [flash, setFlash] = useState<"up" | "down" | "">("")
  const fromRef = useRef(price)
  const toRef = useRef(price)

  useEffect(() => {
    if (toRef.current === price) return
    const prev = shown
    fromRef.current = prev
    toRef.current = price
    const dir: "up" | "down" | "" = price > prev ? "up" : price < prev ? "down" : ""
    if (dir) setFlash(dir)
    const start = performance.now()
    const dur = 700
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      setShown(lerpPrice(fromRef.current, toRef.current, k))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const clear = window.setTimeout(() => setFlash(""), 650)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(clear)
    }
    // shown is the animated value; we only re-run when the target tick changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price])

  const pts = sparkPoints(history.length >= 2 ? history : [shown, price], compactChart ? 96 : 160, compactChart ? 28 : 40)
  const pnl = paperResult(desk, price)
  const last = history.length >= 2 ? history[history.length - 2]! : price
  const tickUp = price >= last
  const w = compactChart ? 96 : 160
  const h = compactChart ? 28 : 40

  return (
    <>
    {/* v18.3 (XOE-004): result card shows only after a trade closes, above the dock (never over Buy/Sell) */}
    <TradeResultCard desk={desk} compact />
    <div className="live-trade-hud" data-flash={flash} aria-label="XOE live trade">
      {/* v18: chart on the left, price labels on the RIGHT (Eddie's pick) */}
      <div className={`live-trade-row ${tickUp ? "up" : "down"}`}>
        {pts ? (
          <svg className="live-trade-chart" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ) : null}
        <div className={`live-trade-quote${flash ? ` flash-${flash}` : tickUp ? " up" : " down"}`}>
          <strong>XOE · sim</strong>
          <span className="live-trade-price">
            {formatXoeTickPrice(shown)}
            <span className="live-trade-dir" aria-hidden="true">{tickUp ? " ▲" : " ▼"}</span>
          </span>
        </div>
      </div>
      <p className="fine live-trade-bal">
        {formatXoe7(desk.xoeStroops)} · P/L {formatPnlSim(pnl, true)}
      </p>
      <p className="fine live-trade-tag">{XOE_SIM_SAFETY} · {XOE_SIM_LABEL}</p>
      <div className="live-trade-dock menu-row">
        <button
          type="button"
          className="touch-btn primary"
          disabled={!canBuy(desk, price)}
          onClick={() => onBuy(price)}
          aria-label={`Buy XOE — 0.1 at ${formatXoeTickPrice(price)} sim`}
        >
          Buy<span className="btn-rest"> XOE</span>
        </button>
        <button
          type="button"
          className="touch-btn"
          disabled={!canSell(desk, price)}
          onClick={() => onSell(price)}
          aria-label={`Sell XOE — 0.1 at ${formatXoeTickPrice(price)} sim`}
        >
          Sell<span className="btn-rest"> XOE</span>
        </button>
        {onOpenDesk ? (
          <button
            type="button"
            className="touch-btn live-trade-desk"
            onClick={onOpenDesk}
            aria-label="Open SNL paper trade desk"
          >
            Desk
          </button>
        ) : null}
        {dockExtra}
      </div>
      <p className="fine live-trade-lot">
        {desk.position > 0 && desk.lastAction === "buy" && desk.step === 1
          ? "Starter long · 0.1 XOE · sim only"
          : `0.1 XOE · ${lotCostUsd(price).toFixed(2)} sim`}
      </p>
    </div>
    </>
  )
}
