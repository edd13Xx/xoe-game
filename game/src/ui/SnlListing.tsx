import { useState } from "react"
import { formatPnlSim } from "../game/economy.ts"
import { formatXoeTickPrice } from "../game/xoe-sim-price.ts"
import { buildSimDepth, buildSimTape, terminalCandles, type CandleInterval, type SimCandle } from "../game/sim-candles.ts"
import {
  SNL_CASH_TIP,
  SNL_DISCLAIMER,
  SNL_EQUITY_TIP,
  SNL_LOT,
  SNL_PAIR_LABEL,
  SNL_SYMBOL,
  applySnlAction,
  canSnl,
  cancelSnlOrder,
  initialSnlBook,
  placeSnlOrder,
  snlFee,
  snlSessionBreakdown,
  tickSnlBook,
  type SnlAction,
  type SnlBook,
  type SnlOrderType,
} from "../game/snl-listing.ts"

const ACTIONS: readonly { id: SnlAction; label: string }[] = [
  { id: "long", label: "Long" },
  { id: "close", label: "Close" },
  { id: "short", label: "Short" },
  { id: "cover", label: "Cover" },
  { id: "reverse", label: "Reverse" },
]

const ORDER_TYPES: readonly { id: SnlOrderType; label: string }[] = [
  { id: "market", label: "Market" },
  { id: "limit", label: "Limit" },
  { id: "stop", label: "Stop" },
  { id: "take-profit", label: "Take profit" },
]

export function SnlListing({
  price,
  history = [],
  disabled = false,
  reducedMotion = false,
  onImpulse,
}: {
  price: number
  history?: readonly number[]
  disabled?: boolean
  reducedMotion?: boolean
  onImpulse?: (action: SnlAction, book: SnlBook) => void
}) {
  const [book, setBook] = useState(initialSnlBook)
  const [interval, setInterval] = useState<CandleInterval>("1m")
  const [lots, setLots] = useState(1)
  const [otype, setOtype] = useState<SnlOrderType>("market")
  const [limit, setLimit] = useState("")
  const [ticketAction, setTicketAction] = useState<SnlAction>("long")
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<"book" | "tape" | "orders" | "fills">("book")
  const [tip, setTip] = useState<"cash" | "equity" | null>(null)
  const liveBook = tickSnlBook(book, price)
  const snap = snlSessionBreakdown(liveBook, price)
  const px = snap.mark
  const candles = terminalCandles(history.length ? history : [px], interval, { price: px, seed: 20261111 })
  const depth = buildSimDepth(px, liveBook.nextId + Math.round(px * 1000))
  const tape = buildSimTape(
    px,
    liveBook.nextId,
    liveBook.fills.map((f) => ({
      price: f.price,
      size: SNL_LOT * f.lots,
      side: f.action === "long" || f.action === "cover" ? "buy" as const : "sell" as const,
      at: f.at,
      player: true,
    })),
  )

  const commit = (next: SnlBook, action: SnlAction) => {
    if (next === liveBook || next === book) return
    setBook(next)
    setErr(null)
    onImpulse?.(action, next)
  }

  const act = (action: SnlAction, qty = 1) => {
    if (disabled) return
    commit(applySnlAction(liveBook, action, px, qty, liveBook.nextId), action)
  }

  const submitOrder = () => {
    if (disabled) return
    const res = placeSnlOrder(
      { ...liveBook, markedPrice: px },
      {
        action: ticketAction,
        type: otype,
        lots,
        price: otype === "market" ? px : Number(limit) || null,
        now: liveBook.nextId,
      },
    )
    if (res.error) {
      setErr(res.error)
      return
    }
    commit(res.book, ticketAction)
  }

  const pct = snap.unrealizedPct
  const openOrders = liveBook.orders.filter((o) => o.status === "open")

  return (
    <section
      className="snl-listing snl-terminal"
      data-snl="1"
      data-side={snap.side}
      data-upnl={snap.unrealized.toFixed(4)}
      data-entry={snap.entry ?? ""}
      data-mark={px.toFixed(3)}
      aria-label="SNL simulated trading terminal"
    >
      <div className="snl-listing-head">
        <span className="snl-pill">{SNL_SYMBOL}</span>
        <p className="snl-price">
          {SNL_PAIR_LABEL} {formatXoeTickPrice(px)}
        </p>
        <span className="fine">Tracks XOE/USD sim · {SNL_LOT} lot</span>
      </div>
      <p className="fine">{SNL_DISCLAIMER}</p>

      <div className="snl-chart-toolbar">
        {(["1m", "5m"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`touch-btn${interval === id ? " primary" : " ghost"}`}
            aria-pressed={interval === id}
            onClick={() => setInterval(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <SnlChart candles={candles} mark={px} entry={snap.entry} liq={snap.liq} side={snap.side} reducedMotion={reducedMotion} />

      <div className="snl-position" role="region" aria-label="SNL position">
        <h3 className="snl-pos-title">Position</h3>
        <dl className="snl-pos-grid">
          <div><dt>Side</dt><dd className={`snl-side-${snap.side}`}>{snap.side}</dd></div>
          <div><dt>Size</dt><dd>{snap.lots} × {SNL_LOT} ({snap.size.toFixed(2)})</dd></div>
          <div><dt>Avg entry</dt><dd>{snap.entry == null ? "—" : formatXoeTickPrice(snap.entry)}</dd></div>
          <div><dt>Mark</dt><dd>{formatXoeTickPrice(snap.mark)}</dd></div>
          <div>
            <dt>Unrealized P/L</dt>
            <dd data-snl-upnl="1">{formatPnlSim(snap.unrealized, true)}{pct == null ? "" : ` (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`}</dd>
          </div>
          <div><dt>Realized P/L</dt><dd>{formatPnlSim(snap.realized, true)}</dd></div>
          <div><dt>Fees (sim)</dt><dd>{formatPnlSim(-snap.fees, true)}</dd></div>
          <div>
            <dt>
              Cash
              <Tip kind="cash" open={tip} onToggle={setTip} label="What is cash?" text={SNL_CASH_TIP} />
            </dt>
            <dd data-snl-cash="1">{formatPnlSim(snap.cash, false)}</dd>
          </div>
          <div>
            <dt>
              Equity
              <Tip kind="equity" open={tip} onToggle={setTip} label="What is equity?" text={SNL_EQUITY_TIP} />
            </dt>
            <dd data-snl-equity="1">{formatPnlSim(snap.equity, false)}</dd>
          </div>
          <div><dt>Liq. (sim)</dt><dd>{snap.liq == null || !Number.isFinite(snap.liq) ? "—" : snap.liq.toFixed(3)}</dd></div>
        </dl>
        {tip ? <p className="snl-tip-copy" role="note">{tip === "cash" ? SNL_CASH_TIP : SNL_EQUITY_TIP}</p> : null}
        <p className="fine">Equity = cash + unrealized P/L. Session P/L {formatPnlSim(snap.session, true)} includes fees. Paper only.</p>
      </div>

      <div className="snl-actions snl-quick-actions">
        {ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`touch-btn${item.id === "short" || item.id === "long" ? " primary" : ""}`}
            disabled={disabled || !canSnl(liveBook, item.id, px, 1)}
            onClick={() => act(item.id, 1)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="snl-ticket" role="region" aria-label="SNL order ticket">
        <p className="snl-pos-title">Order ticket</p>
        <div className="snl-actions snl-ticket-types">
          {ORDER_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`touch-btn${otype === item.id ? " primary" : " ghost"}`}
              aria-pressed={otype === item.id}
              onClick={() => setOtype(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="snl-actions snl-ticket-types">
          {ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`touch-btn${ticketAction === item.id ? " primary" : " ghost"}`}
              aria-pressed={ticketAction === item.id}
              onClick={() => setTicketAction(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="vol-row">
          <span>Size (lots)</span>
          <span className="snl-stepper">
            <button type="button" className="touch-btn" disabled={disabled || lots <= 1} onClick={() => setLots((n) => Math.max(1, n - 1))} aria-label="Fewer lots">
              −
            </button>
            <strong>{lots}</strong>
            <button type="button" className="touch-btn" disabled={disabled} onClick={() => setLots((n) => Math.min(200, n + 1))} aria-label="More lots">
              +
            </button>
          </span>
        </label>
        {otype !== "market" ? (
          <label className="vol-row">
            <span>{otype === "limit" ? "Limit" : "Trigger"}</span>
            <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" aria-label="Order price" disabled={disabled} />
          </label>
        ) : null}
        <p className="fine">Est. fee {formatPnlSim(snlFee(px, lots), false)} sim. {SNL_DISCLAIMER}</p>
        {err ? <p role="status">{err}</p> : null}
        <button type="button" className="touch-btn primary" disabled={disabled} onClick={submitOrder}>
          Place {otype} {ticketAction}
        </button>
      </div>

      <div className="menu-row phone-tabs snl-tabs">
        {(["book", "tape", "orders", "fills"] as const).map((id) => (
          <button key={id} type="button" className={`touch-btn${tab === id ? " primary" : " ghost"}`} onClick={() => setTab(id)}>
            {id === "book" ? "Order book" : id === "tape" ? "Tape" : id === "orders" ? "Orders" : "Fills"}
          </button>
        ))}
      </div>
      {tab === "book" ? (
        <div className="snl-depth" aria-label="Simulated order book">
          <p className="fine">Sim depth · spread ${depth.spread.toFixed(3)} · not a real market</p>
          <div className="book-cols">
            <div>
              {depth.bids.map((b) => (
                <button
                  key={`b-${b.price}`}
                  type="button"
                  className="book-row bid"
                  onClick={() => {
                    setLimit(String(b.price))
                    setOtype("limit")
                    setTicketAction(snap.side === "short" ? "cover" : "long")
                    setTab("orders")
                  }}
                >
                  {b.price} · {b.size}
                </button>
              ))}
            </div>
            <div>
              {depth.asks.map((a) => (
                <button
                  key={`a-${a.price}`}
                  type="button"
                  className="book-row ask"
                  onClick={() => {
                    setLimit(String(a.price))
                    setOtype("limit")
                    setTicketAction(snap.side === "long" ? "close" : "short")
                    setTab("orders")
                  }}
                >
                  {a.price} · {a.size}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {tab === "tape" ? (
        <ul className="snl-tape fine" aria-label="Recent simulated trades">
          {tape.map((t, i) => (
            <li key={`${t.at}-${i}`} data-player={t.player ? "1" : "0"}>
              {t.side} {t.size} @ {t.price.toFixed(3)}
              {t.player ? " · you" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "orders" ? (
        <ul className="snl-tape fine" aria-label="Open paper orders">
          {openOrders.length === 0 ? <li>No open paper orders.</li> : null}
          {openOrders.map((o) => (
            <li key={o.id}>
              {o.type} {o.action} {o.lots} @ {o.price ?? "mkt"}
              <button
                type="button"
                className="touch-btn ghost"
                disabled={disabled}
                onClick={() => setBook(cancelSnlOrder(liveBook, o.id))}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "fills" ? (
        <ul className="snl-tape fine" aria-label="Paper fills">
          {liveBook.fills.length === 0 ? <li>No paper fills yet.</li> : null}
          {liveBook.fills.map((f) => (
            <li key={f.id}>
              {f.action} {f.lots} @ {formatXoeTickPrice(f.price)} · fee {formatPnlSim(-f.fee, true)}
              {f.realized ? ` · realized ${formatPnlSim(f.realized, true)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function Tip({
  kind,
  open,
  onToggle,
  label,
  text,
}: {
  kind: "cash" | "equity"
  open: "cash" | "equity" | null
  onToggle: (next: "cash" | "equity" | null) => void
  label: string
  text: string
}) {
  const on = open === kind
  return (
    <button
      type="button"
      className="touch-btn ghost snl-tip-btn"
      aria-label={label}
      aria-expanded={on}
      title={text}
      onClick={() => onToggle(on ? null : kind)}
    >
      ?
    </button>
  )
}

function SnlChart({
  candles,
  mark,
  entry,
  liq,
  side,
  reducedMotion,
}: {
  candles: readonly SimCandle[]
  mark: number
  entry: number | null
  liq: number | null
  side: string
  reducedMotion: boolean
}) {
  const W = 320
  const H = 148
  const VH = 40
  const padL = 6
  const padR = 44
  const padT = 8
  const innerW = W - padL - padR
  const candleLo = Math.min(mark, ...candles.map((c) => c.l), entry ?? mark)
  const candleHi = Math.max(mark, ...candles.map((c) => c.h), entry ?? mark)
  const pad = Math.max(0.15, (candleHi - candleLo) * 0.35)
  const liqInView = liq != null && Number.isFinite(liq) && liq >= candleLo - pad && liq <= candleHi + pad
  const lo = liqInView ? Math.min(candleLo, liq!) : candleLo
  const hi = liqInView ? Math.max(candleHi, liq!) : candleHi
  const span = Math.max(0.02, hi - lo) * 1.08
  const mid = (hi + lo) / 2
  const y = (p: number) => padT + (1 - (p - (mid - span / 2)) / span) * (H - padT)
  const maxV = Math.max(1, ...candles.map((c) => c.v))
  const n = Math.max(1, candles.length)
  const cw = innerW / n
  return (
    <svg
      className={`snl-chart${reducedMotion ? " is-reduced" : ""}`}
      viewBox={`0 0 ${W} ${H + VH}`}
      width="100%"
      role="img"
      data-snl-chart="1"
      aria-label={`SNL ${side} candlestick chart, mark ${formatXoeTickPrice(mark)}`}
    >
      <rect width={W} height={H + VH} fill="#0e1020" rx="10" />
      <line x1={padL} y1={y(mark)} x2={W - padR} y2={y(mark)} stroke="#c4b5fd" strokeDasharray="4 3" strokeWidth="1" />
      {entry != null ? <line x1={padL} y1={y(entry)} x2={W - padR} y2={y(entry)} stroke="#fbbf24" strokeWidth="1.2" /> : null}
      {liqInView ? (
        <line x1={padL} y1={y(liq!)} x2={W - padR} y2={y(liq!)} stroke="#f87171" strokeWidth="1.2" strokeDasharray="2 3" />
      ) : null}
      {candles.map((c, i) => {
        const x = padL + (i + 0.5) * cw
        const up = c.c >= c.o
        const color = up ? "#4ade80" : "#f87171"
        const top = y(Math.max(c.o, c.c))
        const bot = y(Math.min(c.o, c.c))
        const body = Math.max(1.2, bot - top)
        return (
          <g key={c.t}>
            <line x1={x} y1={y(c.h)} x2={x} y2={y(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x - Math.max(1, cw * 0.32)} y={top} width={Math.max(1.6, cw * 0.64)} height={body} fill={color} />
            <rect
              x={x - Math.max(1, cw * 0.32)}
              y={H + VH - (c.v / maxV) * (VH - 8)}
              width={Math.max(1.6, cw * 0.64)}
              height={(c.v / maxV) * (VH - 8)}
              fill={up ? "rgba(74,222,128,0.45)" : "rgba(248,113,113,0.45)"}
            />
          </g>
        )
      })}
      <text x={W - 4} y={y(mark) + 3} fill="#e0e7ff" fontSize="8" textAnchor="end">
        {formatXoeTickPrice(mark)}
      </text>
      {entry != null ? (
        <text x={W - 4} y={y(entry) - 2} fill="#fbbf24" fontSize="8" textAnchor="end">
          entry
        </text>
      ) : null}
      {liqInView ? (
        <text x={W - 4} y={y(liq!) + 10} fill="#f87171" fontSize="8" textAnchor="end">
          liq
        </text>
      ) : null}
    </svg>
  )
}
