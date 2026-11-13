import { bookDecimals, bookLevelKey, withCumulative, type BookLevel } from "../game/paper-advanced.ts"

const ROWS = 8

function fmtSize(n: number): string {
  if (n >= 1000) return n.toFixed(0)
  if (n >= 100) return n.toFixed(1)
  return n.toFixed(2)
}

/**
 * Exchange-style ladder for the testnet sim book: asks on top (best ask nearest the middle),
 * spread + mid in between, bids below. Each row shows price, size and running total, with a
 * depth bar scaled to the deepest running total on screen. Rows whose size just changed get a
 * short highlight (skipped when reduced motion is on). Testnet XOE · no real money.
 */
export function OrderBookLadder({
  bids,
  asks,
  mid,
  spread,
  step,
  tick,
  changed = [],
  reducedMotion = false,
  onPick,
}: {
  bids: readonly BookLevel[]
  asks: readonly BookLevel[]
  mid: number
  spread: number
  step: number
  tick: number
  changed?: readonly string[]
  reducedMotion?: boolean
  onPick: (level: BookLevel) => void
}) {
  const dp = bookDecimals(step)
  const bidRows = withCumulative(bids.slice(0, ROWS))
  const askRows = withCumulative(asks.slice(0, ROWS))
  const maxCum = Math.max(bidRows[bidRows.length - 1]?.cum ?? 0, askRows[askRows.length - 1]?.cum ?? 0, 1e-9)
  const changedSet = new Set(changed)
  const flashClass = reducedMotion ? "" : tick % 2 === 0 ? " chg-a" : " chg-b"
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 0

  const row = (l: BookLevel & { cum: number }) => {
    const key = bookLevelKey(l)
    const pct = Math.min(100, (l.cum / maxCum) * 100)
    return (
      <button
        key={key}
        type="button"
        className={`ob-row ${l.side}${changedSet.has(key) ? flashClass : ""}`}
        style={{ ["--depth" as string]: `${pct.toFixed(1)}%` }}
        onClick={() => onPick(l)}
      >
        <span className="sr-only">{l.side === "bid" ? "Bid " : "Ask "}</span>
        <span className="ob-px">{l.price.toFixed(dp)}</span>
        <span className="sr-only"> size </span>
        <span className="ob-sz">{fmtSize(l.size)}</span>
        <span className="sr-only"> total </span>
        <span className="ob-cum">{fmtSize(l.cum)}</span>
      </button>
    )
  }

  return (
    <div className="ob-ladder" data-testid="order-book">
      <div className="ob-head fine" aria-hidden="true">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>
      <div className="ob-side ob-asks">{[...askRows].reverse().map(row)}</div>
      <p className="ob-mid fine" aria-live="off">
        <span>
          Mid <strong>{mid.toFixed(dp)}</strong>
        </span>
        <span>
          Spread {spread.toFixed(dp)} ({spreadPct.toFixed(2)}%)
        </span>
      </p>
      <div className="ob-side ob-bids">{bidRows.map(row)}</div>
      <p className="fine ob-note">Sim book · testnet XOE · no real money</p>
    </div>
  )
}
