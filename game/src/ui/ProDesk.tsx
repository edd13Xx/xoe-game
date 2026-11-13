import { useEffect, useMemo, useRef, useState } from "react"
import { GROK_COACH_LABEL, buildCoachContext, coachDecisionKey, requestGrokCoach } from "../game/grok-coach.ts"
import { BOOK_TICK_MS, bookDecimals, type BookLevel } from "../game/paper-advanced.ts"
import {
  BOOK_STEPS,
  PRO_DESK_LABEL,
  PRO_PAIR,
  PRO_TIMEFRAMES,
  advanceLiveBars,
  aggregateBars,
  amountFromLots,
  bracketGauge,
  COACH_LABEL,
  coachTip,
  type CoachInput,
  alertLine,
  checkAlerts,
  makeAlert,
  MAX_ALERTS,
  type PriceAlert,
  bracketProblem,
  optionalPx,
  TRAIL_PCTS,
  moveBracketStop,
  trailLine,
  trailStopPrice,
  deskAction,
  describeAction,
  fmtPx,
  fmtVol,
  limitProblem,
  stopProblem,
  lotsFromAmount,
  maxLotsFor,
  nextProBook,
  pctLots,
  pickPrice,
  type PickSource,
  RISK_PCTS,
  riskAtStop,
  riskLine,
  riskLots,
  pnlStats,
  fillNet,
  seedMinuteBars,
  seedTape,
  stats24h,
  stepTape,
  type DeskSide,
  type ProBook,
  type ProTimeframe,
  type ProTrade,
} from "../game/pro-desk.ts"
import {
  SNL_CASH_TIP,
  SNL_EQUITY_TIP,
  SNL_FEE_MAKER,
  SNL_FEE_TAKER,
  SNL_LOT,
  applySnlAction,
  attachSnlBracket,
  cancelSnlOrder,
  initialSnlBook,
  placeSnlOrder,
  snlBracket,
  snlFee,
  snlSessionBreakdown,
  tickSnlBook,
  type SnlAction,
  type SnlBook,
  type SnlSide,
} from "../game/snl-listing.ts"
import { formatPnlSim } from "../game/economy.ts"
import { clampXoeSimPrice } from "../game/xoe-sim-price.ts"
import { readFightDifficulty } from "../game/combat.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { OrderBookLadder } from "./OrderBookLadder.tsx"
import { TradeSimArena } from "./TradeSimArena.tsx"
import { ProCandleChart, ProDepthChart, useBox } from "./ProCharts.tsx"

type PanelTab = "chart" | "book" | "trades"
type LowerTab = "open" | "positions" | "balances" | "fills" | "pnl" | "alerts" | "arena"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}
function clock(t: number) {
  const d = new Date(t)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/**
 * Pro-style XOE trade desk (sim). Header stats, candles + depth, live book, tape and an order
 * form that runs on the existing SNL paper book. Testnet XOE · no real money.
 */
export function ProDesk({
  open,
  price,
  reducedMotion,
}: {
  open: boolean
  price: number
  reducedMotion: boolean
}) {
  const mark = clampXoeSimPrice(price)
  const priceRef = useRef(mark)
  priceRef.current = mark
  const [panel, setPanel] = useState<PanelTab>("chart")
  const [lower, setLower] = useState<LowerTab>("open")
  const [tf, setTf] = useState<ProTimeframe>("1m")
  const [view, setView] = useState<"candles" | "depth">("candles")
  const [showInd, setShowInd] = useState(true)
  const [step, setStep] = useState<number>(BOOK_STEPS[0]!)
  const [bars, setBars] = useState(() => advanceLiveBars(seedMinuteBars(mark, Math.floor(Date.now() / 60000) * 60000), mark, Date.now()))
  const [tick, setTick] = useState(() => Math.floor(Date.now() / BOOK_TICK_MS))
  const [book, setBook] = useState<ProBook | null>(() => nextProBook(null, mark, BOOK_STEPS[0]!, Math.floor(Date.now() / BOOK_TICK_MS)))
  const [tape, setTape] = useState<ProTrade[]>(() => seedTape(mark, BOOK_STEPS[0]!, Math.floor(Date.now() / BOOK_TICK_MS)))
  const [snl, setSnl] = useState<SnlBook>(initialSnlBook)
  const [pulse, setPulse] = useState<{ seq: number; action: SnlAction | null }>({ seq: 0, action: null })
  const [side, setSide] = useState<DeskSide>("buy")
  const [otype, setOtype] = useState<"limit" | "market" | "stop">("market")
  const [limitTxt, setLimitTxt] = useState("")
  const [amountTxt, setAmountTxt] = useState("0.5")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [useBracket, setUseBracket] = useState(false)
  const [tpTxt, setTpTxt] = useState("")
  const [slTxt, setSlTxt] = useState("")
  const chartBox = useBox(320, 280)
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [alertTxt, setAlertTxt] = useState("")
  const [alertMsg, setAlertMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [alertToast, setAlertToast] = useState<string | null>(null)
  const alertSeq = useRef(1)
  // Click-to-price: last pick (note for the form + screen readers) and a short highlight on the price box.
  const [pick, setPick] = useState<{ seq: number; note: string; bad: boolean; fresh: boolean } | null>(null)
  const pickSeq = useRef(0)
  const priceFieldRef = useRef<HTMLLabelElement | null>(null)
  useEffect(() => {
    if (!pick?.fresh) return
    const id = window.setTimeout(() => setPick((p) => (p && p.seq === pick.seq ? { ...p, fresh: false } : p)), 1200)
    return () => window.clearTimeout(id)
  }, [pick?.seq, pick?.fresh])

  // Price alerts fire on any sim tick, even with the desk closed. Local only; never places an order.
  useEffect(() => {
    setAlerts((list) => {
      if (!list.some((a) => !a.hit)) return list
      const r = checkAlerts(list, mark)
      if (!r.fired.length) return list
      const line = r.fired.map((a) => alertLine(a, mark)).join(" ")
      setAlertToast(line)
      return r.alerts
    })
  }, [mark])
  useEffect(() => {
    if (!alertToast) return
    const id = window.setTimeout(() => setAlertToast(null), 6000)
    return () => window.clearTimeout(id)
  }, [alertToast])

  function addAlert() {
    const made = makeAlert(alertSeq.current, alertTxt, mark, alerts)
    if (typeof made === "string") {
      setAlertMsg({ ok: false, text: made })
      return
    }
    alertSeq.current += 1
    setAlerts((l) => [made, ...l.filter((a) => !a.hit)].concat(l.filter((a) => a.hit)).slice(0, 12))
    setAlertTxt("")
    setAlertMsg({ ok: true, text: `Alert set: tells you when XOE ${made.dir === "above" ? "rises to" : "falls to"} ${fmtPx(made.price)} (sim).` })
  }

  // Candles follow every sim price tick.
  useEffect(() => {
    if (!open) return
    setBars((b) => advanceLiveBars(b, mark, Date.now()))
  }, [mark, open])

  const lastPxRef = useRef(mark)
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat")
  useEffect(() => {
    if (mark !== lastPxRef.current) {
      setDir(mark > lastPxRef.current ? "up" : "down")
      lastPxRef.current = mark
    }
  }, [mark])

  // The book and the tape refresh on their own beat.
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => {
      const t = Math.floor(Date.now() / BOOK_TICK_MS)
      setTick(t)
      setBook((b) => nextProBook(b, priceRef.current, stepRef.current, t))
      setTape((tp) => stepTape(tp, priceRef.current, stepRef.current, t))
    }, BOOK_TICK_MS)
    return () => window.clearInterval(id)
  }, [open])

  function changeStep(s: number) {
    setStep(s)
    stepRef.current = s
    setBook((b) => nextProBook(b, priceRef.current, s, tick))
  }

  const liveSnl = useMemo(() => tickSnlBook(snl, mark), [snl, mark])
  const journal = useMemo(() => pnlStats(liveSnl.fills), [liveSnl.fills])
  const [trailPct, setTrailPct] = useState<number | null>(null)
  // Trailing stop (sim): ratchet the bracket stop toward the price; it never moves back.
  useEffect(() => {
    if (trailPct == null) return
    if (liveSnl.side === "flat") {
      setTrailPct(null)
      return
    }
    const cur = snlBracket(liveSnl)
    const nextSl = trailStopPrice(liveSnl.side, mark, cur.sl, trailPct)
    if (nextSl == null) return
    if (cur.sl == null) {
      const res = attachSnlBracket({ ...liveSnl, markedPrice: mark }, { tp: cur.tp, sl: nextSl, now: liveSnl.nextId })
      if (!res.error) setSnl(res.book)
      return
    }
    setSnl(moveBracketStop(liveSnl, nextSl))
  }, [trailPct, liveSnl, mark])
  const snap = snlSessionBreakdown(liveSnl, mark)
  const stats = useMemo(() => stats24h(bars), [bars])
  const shownBars = useMemo(() => {
    const all = aggregateBars(bars, tf)
    const want = tf === "1h" ? 72 : 64
    return all.slice(-want)
  }, [bars, tf])

  const action = deskAction(side, liveSnl)
  const maxLots = maxLotsFor(side, liveSnl, mark)
  const amount = Number(amountTxt)
  const lots = lotsFromAmount(amount)
  const limitPx = Number(limitTxt)
  const execPx = otype !== "market" && limitPx > 0 ? limitPx : mark
  // Resting orders (limit and stop) fill at the sim maker rate, matching tickSnlBook.
  const feeRate = otype === "market" ? SNL_FEE_TAKER : SNL_FEE_MAKER
  const estFee = snlFee(execPx, lots, feeRate)
  const estNotional = SNL_LOT * lots * execPx
  const estTotal = side === "buy" ? estNotional + estFee : Math.max(0, estNotional - estFee)

  function commit(next: SnlBook, act: SnlAction) {
    setSnl(next)
    setPulse((p) => ({ seq: p.seq + 1, action: act }))
  }

  function submit() {
    if (lots <= 0) {
      setMsg({ ok: false, text: "Enter an amount above 0." })
      return
    }
    if (otype === "limit") {
      const problem = limitProblem(side, limitPx > 0 ? limitPx : null, mark)
      if (problem) {
        setMsg({ ok: false, text: problem })
        return
      }
    }
    if (otype === "stop") {
      const problem = stopProblem(side, limitPx > 0 ? limitPx : null, mark)
      if (problem) {
        setMsg({ ok: false, text: problem })
        return
      }
    }
    const opening = otype === "market" && useBracket && (action === "long" || action === "short")
    const tpIn = optionalPx(tpTxt)
    const slIn = optionalPx(slTxt)
    if (opening) {
      if (tpIn === "bad" || slIn === "bad") {
        setMsg({ ok: false, text: "Enter TP and SL as prices, or leave one blank." })
        return
      }
      const problem = bracketProblem(action === "long" ? "long" : "short", mark, tpIn, slIn)
      if (problem) {
        setMsg({ ok: false, text: problem })
        return
      }
    }
    const base = { ...liveSnl, markedPrice: mark }
    const res = placeSnlOrder(base, { action, type: otype, lots, price: otype === "market" ? null : limitPx, now: liveSnl.nextId })
    if (res.error) {
      const why = action === "close" || action === "cover" ? "You have no matching sim position to reduce." : "Not enough sim cash for that order."
      setMsg({ ok: false, text: `${res.error} ${why}` })
      return
    }
    if (opening && (tpIn != null || slIn != null)) {
      const withBracket = attachSnlBracket(res.book, {
        tp: tpIn === "bad" ? null : tpIn,
        sl: slIn === "bad" ? null : slIn,
        now: res.book.nextId,
      })
      commit(withBracket.book, action)
      const parts = [tpIn != null && tpIn !== "bad" ? `TP ${fmtPx(tpIn)}` : "", slIn != null && slIn !== "bad" ? `SL ${fmtPx(slIn)}` : ""].filter(Boolean)
      setMsg({ ok: true, text: `Filled ${amountFromLots(lots)} XOE at ${fmtPx(mark)} with ${parts.join(" / ")} (sim, one cancels the other).` })
      return
    }
    commit(res.book, action)
    setMsg(
      otype === "market"
        ? { ok: true, text: `Filled ${amountFromLots(lots)} XOE at ${fmtPx(mark)} (sim).` }
        : otype === "stop"
          ? { ok: true, text: `Stop order placed: ${side} ${amountFromLots(lots)} XOE when XOE trades ${side === "buy" ? "up" : "down"} to ${fmtPx(limitPx)} (sim).` }
          : { ok: true, text: `Limit order placed: ${side} ${amountFromLots(lots)} XOE at ${fmtPx(limitPx)} (sim).` },
    )
  }

  function closeAll() {
    if (liveSnl.side === "flat") return
    const act: SnlAction = liveSnl.side === "long" ? "close" : "cover"
    const next = applySnlAction(liveSnl, act, mark, liveSnl.lots, liveSnl.nextId)
    if (next === liveSnl) {
      setMsg({ ok: false, text: "Not enough sim cash to cover the fee." })
      return
    }
    commit(next, act)
    setMsg({ ok: true, text: "Position closed (sim)." })
  }

  function setPositionBracket() {
    if (liveSnl.side === "flat") return
    const tpIn = optionalPx(tpTxt)
    const slIn = optionalPx(slTxt)
    if (tpIn === "bad" || slIn === "bad") {
      setMsg({ ok: false, text: "Enter TP and SL as prices, or leave one blank." })
      return
    }
    const problem = bracketProblem(liveSnl.side, mark, tpIn, slIn)
    if (problem) {
      setMsg({ ok: false, text: problem })
      return
    }
    const res = attachSnlBracket({ ...liveSnl, markedPrice: mark }, { tp: tpIn, sl: slIn, now: liveSnl.nextId })
    if (res.error) {
      setMsg({ ok: false, text: res.error })
      return
    }
    setSnl(res.book)
    setMsg({ ok: true, text: "TP/SL set on your sim position (one cancels the other)." })
  }

  // Click-to-price (sim): copy a book level or tape print into the form. Never places an order.
  const pickAt = (price: number, source: PickSource, dp: number) => {
    const p = pickPrice(price, source, otype, side, mark, dp)
    setLimitTxt(p.text)
    setOtype(p.otype)
    setSide(p.side)
    pickSeq.current += 1
    setPick({ seq: pickSeq.current, note: p.note, bad: p.problem != null, fresh: true })
    const field = priceFieldRef.current
    if (field && typeof field.getBoundingClientRect === "function") {
      const r = field.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight
      if (r.top < 0 || r.bottom > vh) field.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" })
    }
  }
  const pickLevel = (l: BookLevel) => pickAt(l.price, l.side, bookDecimals(step))
  const editPrice = (v: string) => {
    setLimitTxt(v)
    setPick(null)
  }
  const pickedClass = pick?.fresh && !reducedMotion ? (pick.seq % 2 === 0 ? " pd-picked-a" : " pd-picked-b") : ""

  const openOrders = liveSnl.orders.filter((o) => o.status === "open")
  const ups = stats.changePct >= 0
  const tradesWithYou: ProTrade[] = [
    ...liveSnl.fills.slice(0, 5).map((f) => ({
      id: `you-${f.id}`,
      price: f.price,
      size: +(SNL_LOT * f.lots).toFixed(3),
      side: (f.action === "long" || f.action === "cover" ? "buy" : "sell") as "buy" | "sell",
      at: -1,
    })),
    ...tape,
  ].slice(0, 30)

  const posSide: SnlSide = snap.side
  const bracket = snlBracket(liveSnl)
  const gauge = bracketGauge(posSide, snap.entry, snap.mark, bracket.tp, bracket.sl)
  const showBracket = otype === "market" && (action === "long" || action === "short")
  const riskSlIn = optionalPx(slTxt)
  const riskSl = typeof riskSlIn === "number" ? riskSlIn : null
  const riskNow = showBracket && useBracket ? riskAtStop(action === "short" ? "short" : "long", snap.equity, mark, riskSl, lots) : null
  // Desk coach (sim). The rule-based tip is always computed and shown first. When the game is embedded in the NEAR demo
  // page, a Grok answer may replace it (via the host page, see grok-coach.ts). It never places or changes orders.
  const coachInput: CoachInput = {
    pos: posSide,
    entry: snap.entry,
    mark: snap.mark,
    equity: snap.equity,
    lots: snap.lots,
    tp: bracket.tp,
    sl: bracket.sl,
    liq: snap.liq,
    trailPct,
    fills: liveSnl.fills,
    form: { opening: showBracket ? (action === "short" ? "short" : "long") : null, bracketOn: useBracket, sl: riskSl, lots },
  }
  const tip = coachTip(coachInput)
  const coachKey = coachDecisionKey(coachInput, tip.id)
  const coachInputRef = useRef(coachInput)
  coachInputRef.current = coachInput
  const tipRef = useRef(tip)
  tipRef.current = tip
  const [grokTip, setGrokTip] = useState<{ key: string; text: string } | null>(null)
  useEffect(() => {
    let live = true
    const t = window.setTimeout(() => {
      void requestGrokCoach(buildCoachContext(coachInputRef.current, tipRef.current)).then((text) => {
        if (live && text) setGrokTip({ key: coachKey, text })
      })
    }, 700)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [coachKey])
  const grokText = grokTip && grokTip.key === coachKey ? grokTip.text : null
  const chartMarks = [
    ...(snap.entry != null && posSide !== "flat" ? [{ price: snap.entry, kind: "entry" as const, label: "Entry" }] : []),
    ...(bracket.tp != null ? [{ price: bracket.tp, kind: "tp" as const, label: "TP" }] : []),
    ...(bracket.sl != null ? [{ price: bracket.sl, kind: "sl" as const, label: "SL" }] : []),
    ...alerts.filter((a) => !a.hit).map((a) => ({ price: a.price, kind: "alert" as const, label: "Alert" })),
  ]
  const liveAlerts = alerts.filter((a) => !a.hit).length

  return (
    <div
      className={`paper-advanced pro-desk${reducedMotion ? " is-reduced" : ""}`}
      data-testid="pro-desk"
      data-snl="1"
      data-side={snap.side}
      data-upnl={snap.unrealized.toFixed(4)}
      data-entry={snap.entry ?? ""}
      data-mark={mark.toFixed(3)}
    >
      <div className="pd-head pd-glass" role="group" aria-label="XOE/USD market summary">
        <div className="pd-pair">
          <span className="pd-pair-name">{PRO_PAIR}</span>
          <span className="pd-sim-chip">SIM</span>
        </div>
        <div className={`pd-last ${dir}`} data-testid="pd-last" aria-label={`Last price ${fmtPx(mark)}`}>
          <span className="pd-last-px" key={mark.toFixed(3)}>{fmtPx(mark)}</span>
          <span className="pd-last-dir" aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"}</span>
        </div>
        <dl className="pd-stats">
          <div>
            <dt>24h change</dt>
            <dd className={ups ? "up" : "down"}>{ups ? "+" : ""}{stats.changePct.toFixed(2)}%</dd>
          </div>
          <div>
            <dt>24h high</dt>
            <dd>{fmtPx(stats.high)}</dd>
          </div>
          <div>
            <dt>24h low</dt>
            <dd>{fmtPx(stats.low)}</dd>
          </div>
          <div>
            <dt>24h volume</dt>
            <dd>{fmtVol(stats.volume)} XOE</dd>
          </div>
        </dl>
      </div>
      <p className="pd-label" data-testid="pd-sim-label">{PRO_DESK_LABEL}</p>
      <div className={`pd-coach is-${tip.tone}`} data-testid="pd-coach" data-tip={tip.id} data-source={grokText ? "grok" : "rules"} role="note" aria-label="Grok Bot desk coach, tips only, never places orders">
        <span className="pd-coach-k">{grokText ? GROK_COACH_LABEL : COACH_LABEL}</span>
        <p className="pd-coach-text" data-testid="pd-coach-text" aria-live="polite">
          {grokText ?? tip.text}
        </p>
      </div>
      {alertToast ? (
        <p className="pd-alert-toast" role="alert" data-testid="pd-alert-toast">
          <span aria-hidden="true">🔔</span> {alertToast}
        </p>
      ) : null}

      <div className="phone-tabs pd-tabs pd-glass" role="tablist" aria-label="Market view">
        {([
          ["chart", "Chart"],
          ["book", "Book"],
          ["trades", "Trades"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} className={`pd-tab${panel === id ? " on" : ""}`} onClick={() => setPanel(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="pd-grid" data-panel={panel}>
        <section className="pd-panel pd-glass pd-chart-panel" aria-label="Chart">
          <div className="pd-toolbar">
            <div className="pd-seg" role="group" aria-label="Timeframe">
              {PRO_TIMEFRAMES.map((id) => (
                <button key={id} type="button" className={`pd-seg-btn${tf === id ? " on" : ""}`} aria-pressed={tf === id} onClick={() => setTf(id)}>
                  {id}
                </button>
              ))}
            </div>
            <div className="pd-seg" role="group" aria-label="Chart type">
              <button type="button" className={`pd-seg-btn${view === "candles" ? " on" : ""}`} aria-pressed={view === "candles"} onClick={() => setView("candles")}>
                Candles
              </button>
              <button type="button" className={`pd-seg-btn${view === "depth" ? " on" : ""}`} aria-pressed={view === "depth"} onClick={() => setView("depth")}>
                Depth
              </button>
            </div>
            <div className="pd-seg" role="group" aria-label="Indicators">
              <button
                type="button"
                className={`pd-seg-btn pd-ind-btn${showInd && view === "candles" ? " on" : ""}`}
                aria-pressed={showInd}
                aria-label="Show EMA 9, EMA 21 and VWAP lines"
                title="EMA 9 / EMA 21 / VWAP (sim)"
                disabled={view !== "candles"}
                onClick={() => setShowInd((v) => !v)}
              >
                EMA
              </button>
            </div>
          </div>
          <div className="pd-chart-box" ref={chartBox.ref}>
            {view === "candles" ? (
              <ProCandleChart candles={shownBars} marks={chartMarks} width={chartBox.w} height={chartBox.h} reducedMotion={reducedMotion} indicators={showInd} />
            ) : book ? (
              <ProDepthChart bids={book.bids} asks={book.asks} mid={mark} width={chartBox.w} height={chartBox.h} />
            ) : null}
          </div>
        </section>

        <section className="pd-panel pd-glass pd-book-panel" aria-label="Order book">
          <div className="pd-panel-head">
            <h3>Order book</h3>
            <div className="pd-seg" role="group" aria-label="Book step">
              {BOOK_STEPS.map((s) => (
                <button key={s} type="button" className={`pd-seg-btn${step === s ? " on" : ""}`} aria-pressed={step === s} onClick={() => changeStep(s)}>
                  {s.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
          {book ? (
            <OrderBookLadder
              bids={book.bids}
              asks={book.asks}
              mid={mark}
              spread={book.spread}
              step={step}
              tick={tick}
              changed={book.changed}
              reducedMotion={reducedMotion}
              onPick={pickLevel}
            />
          ) : null}
        </section>

        <section className="pd-panel pd-glass pd-trades-panel" aria-label="Recent trades">
          <div className="pd-panel-head">
            <h3>Recent trades</h3>
          </div>
          <div className="pd-trades-head" aria-hidden="true">
            <span>Price</span>
            <span>Amount</span>
            <span>Time</span>
          </div>
          <ul className="pd-trades" data-testid="recent-trades">
            {tradesWithYou.map((t) => (
              <li key={t.id} className={`${t.side === "buy" ? "up" : "down"}${t.at < 0 ? " mine" : ""}`}>
                <button
                  type="button"
                  className="pd-print"
                  onClick={() => pickAt(t.price, t.side, 3)}
                  aria-label={`${t.at < 0 ? "Your fill" : t.side === "buy" ? "Buy print" : "Sell print"} ${fmtPx(t.price)}, ${t.size.toFixed(3)} XOE${t.at < 0 ? "" : ` at ${clock(t.at)}`}. Use this price`}
                >
                  <span className="px">{fmtPx(t.price)}</span>
                  <span>{t.size.toFixed(3)}</span>
                  <span className="time">{t.at < 0 ? "you" : clock(t.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="pd-panel pd-glass pd-order" aria-label="Order form" data-side={side}>
          <div className="pd-side-tabs" role="tablist" aria-label="Order side">
            <button type="button" role="tab" aria-selected={side === "buy"} className={`pd-side buy${side === "buy" ? " on" : ""}`} onClick={() => setSide("buy")}>
              Buy
            </button>
            <button type="button" role="tab" aria-selected={side === "sell"} className={`pd-side sell${side === "sell" ? " on" : ""}`} onClick={() => setSide("sell")}>
              Sell
            </button>
          </div>
          <div className="pd-seg wide" role="group" aria-label="Order type">
            <button type="button" className={`pd-seg-btn${otype === "limit" ? " on" : ""}`} aria-pressed={otype === "limit"} onClick={() => { setOtype("limit"); setPick(null) }}>
              Limit
            </button>
            <button type="button" className={`pd-seg-btn${otype === "market" ? " on" : ""}`} aria-pressed={otype === "market"} onClick={() => { setOtype("market"); setPick(null) }}>
              Market
            </button>
            <button type="button" className={`pd-seg-btn${otype === "stop" ? " on" : ""}`} aria-pressed={otype === "stop"} onClick={() => { setOtype("stop"); setPick(null) }} data-testid="pd-otype-stop">
              Stop
            </button>
          </div>
          <label className={`pd-field${pickedClass}`} ref={priceFieldRef} data-testid="pd-price-field" data-picked={pick?.fresh ? "1" : "0"}>
            <span>{otype === "stop" ? "Trigger (USD)" : "Price (USD)"}</span>
            {otype === "limit" ? (
              <input value={limitTxt} onChange={(e) => editPrice(e.target.value)} inputMode="decimal" placeholder={fmtPx(mark)} aria-label="Limit price" />
            ) : otype === "stop" ? (
              <input value={limitTxt} onChange={(e) => editPrice(e.target.value)} inputMode="decimal" placeholder={fmtPx(side === "buy" ? mark * 1.01 : mark * 0.99)} aria-label="Stop trigger price" data-testid="pd-stop-px" />
            ) : (
              <input value={`Market ≈ ${fmtPx(mark)}`} readOnly aria-label="Market price" className="ro" />
            )}
          </label>
          <p className={`pd-pick-note${pick ? (pick.bad ? " bad" : " ok") : " empty"}`} role="status" aria-live="polite" data-testid="pd-pick-note">
            {pick ? pick.note : <span className="sr-only">Tip: tap a price in the order book or recent trades to use it.</span>}
          </p>
          <label className="pd-field">
            <span>Amount (XOE)</span>
            <input value={amountTxt} onChange={(e) => setAmountTxt(e.target.value)} inputMode="decimal" aria-label="Amount in XOE" />
          </label>
          <div className="pd-pcts" role="group" aria-label="Quick amount">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                className="pd-pct"
                disabled={maxLots <= 0}
                onClick={() => setAmountTxt(String(amountFromLots(pctLots(maxLots, p))))}
              >
                {p}%
              </button>
            ))}
          </div>
          {showBracket ? (
            <div className="pd-bracket" data-testid="pd-bracket">
              <label className="pd-check">
                <input type="checkbox" checked={useBracket} onChange={(e) => setUseBracket(e.target.checked)} aria-label="Add take profit and stop loss" />
                <span>TP/SL</span>
              </label>
              {useBracket ? (
                <div className="pd-bracket-row">
                  <label className="pd-field tp">
                    <span>Take profit</span>
                    <input value={tpTxt} onChange={(e) => setTpTxt(e.target.value)} inputMode="decimal" placeholder={fmtPx(action === "long" ? mark * 1.02 : mark * 0.98)} aria-label="Take profit price" data-testid="pd-tp" />
                  </label>
                  <label className="pd-field sl">
                    <span>Stop loss</span>
                    <input value={slTxt} onChange={(e) => setSlTxt(e.target.value)} inputMode="decimal" placeholder={fmtPx(action === "long" ? mark * 0.98 : mark * 1.02)} aria-label="Stop loss price" data-testid="pd-sl" />
                  </label>
                </div>
              ) : null}
              {useBracket ? (
                <div className="pd-risk" data-testid="pd-risk">
                  <div className="pd-pcts pd-risk-pcts" role="group" aria-label="Size by risk">
                    <span className="pd-risk-k">Risk</span>
                    {RISK_PCTS.map((p) => {
                      const sz = riskLots(action === "short" ? "short" : "long", snap.equity, mark, riskSl, p, maxLots)
                      return (
                        <button
                          key={p}
                          type="button"
                          className="pd-pct"
                          data-risk={p}
                          disabled={sz <= 0}
                          aria-label={`Size so the stop loses ${p}% of sim equity`}
                          onClick={() => {
                            setAmountTxt(String(amountFromLots(sz)))
                            setMsg({ ok: true, text: `Sized to risk ${p}% of sim equity: ${amountFromLots(sz)} XOE.` })
                          }}
                        >
                          {p}%
                        </button>
                      )
                    })}
                  </div>
                  <p className="pd-risk-note" data-testid="pd-risk-note" aria-live="polite">
                    {riskNow ? riskLine(riskNow) : "Set a stop loss on the right side of the price to size by risk."}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <dl className="pd-est">
            <div>
              <dt>Est. total</dt>
              <dd data-testid="est-total">${estTotal.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Fee ({(feeRate * 100).toFixed(2)}%)</dt>
              <dd>${estFee.toFixed(4)}</dd>
            </div>
            <div>
              <dt>Available</dt>
              <dd>{(maxLots * SNL_LOT).toFixed(1)} XOE</dd>
            </div>
          </dl>
          <p className="pd-hint">{otype === "stop" ? `${side === "buy" ? "Buy stop waits above" : "Sell stop waits below"} the market and fills when XOE trades through it. ` : ""}{describeAction(action)}{lots > 0 ? ` · ${amountFromLots(lots)} XOE` : ""}</p>
          {msg ? (
            <p className={`pd-msg ${msg.ok ? "ok" : "bad"}`} role="status">
              {msg.text}
            </p>
          ) : null}
          <button type="button" className={`pd-go ${side}`} onClick={submit} data-testid="pd-submit">
            {side === "buy" ? "Buy" : "Sell"} XOE
          </button>
        </section>

        <section className="pd-lower pd-glass" aria-label="Orders, positions and balances">
          <div className="pd-lower-tabs" role="tablist" aria-label="Account views">
            {([
              ["open", `Open orders${openOrders.length ? ` (${openOrders.length})` : ""}`],
              ["positions", "Positions"],
              ["balances", "Balances"],
              ["fills", "Fills"],
              ["pnl", "P/L"],
              ["alerts", `Alerts${liveAlerts ? ` (${liveAlerts})` : ""}`],
              ["arena", "Arena"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={lower === id} className={`pd-tab${lower === id ? " on" : ""}`} onClick={() => setLower(id)}>
                {label}
              </button>
            ))}
          </div>
          {lower === "open" ? (
            <ul className="pd-rows" aria-label="Open sim orders">
              {openOrders.length === 0 ? <li className="empty">No open orders.</li> : null}
              {openOrders.map((o) => (
                <li key={o.id}>
                  <span className={o.action === "long" || o.action === "cover" ? "up" : "down"}>
                    {o.action === "long" || o.action === "cover" ? "Buy" : "Sell"} {o.type === "take-profit" ? "TP" : o.type === "stop" ? (o.oco ? "SL" : "Stop") : o.type}
                    {o.oco ? <em className="pd-oco"> OCO</em> : null}
                  </span>
                  <span>{amountFromLots(o.lots)} XOE @ {o.price != null ? fmtPx(o.price) : "mkt"}</span>
                  <button type="button" className="pd-mini" onClick={() => setSnl(cancelSnlOrder(liveSnl, o.id))}>
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {lower === "positions" ? (
            <div className="pd-pos" aria-label="Sim position">
              {posSide === "flat" ? (
                <p className="empty">No open position. Buy or sell XOE above to open one.</p>
              ) : (
                <>
                  <dl className="pd-pos-grid">
                    <div><dt>Side</dt><dd className={posSide === "long" ? "up" : "down"}>{posSide}</dd></div>
                    <div><dt>Size</dt><dd>{snap.size.toFixed(2)} XOE</dd></div>
                    <div><dt>Entry</dt><dd>{snap.entry == null ? "—" : fmtPx(snap.entry)}</dd></div>
                    <div><dt>Mark</dt><dd>{fmtPx(snap.mark)}</dd></div>
                    <div>
                      <dt>Unrealized P/L</dt>
                      <dd data-snl-upnl="1" className={snap.unrealized >= 0 ? "up" : "down"}>
                        {formatPnlSim(snap.unrealized, true)}
                        {snap.unrealizedPct == null ? "" : ` (${snap.unrealizedPct >= 0 ? "+" : ""}${snap.unrealizedPct.toFixed(2)}%)`}
                      </dd>
                    </div>
                    <div><dt>Liq. (sim)</dt><dd>{snap.liq == null || !Number.isFinite(snap.liq) || snap.liq <= 0 ? "—" : fmtPx(snap.liq)}</dd></div>
                  </dl>
                  <div className="pd-pos-bracket" data-testid="pd-pos-bracket">
                    <span className="lbl">TP <b className="up">{bracket.tp == null ? "—" : fmtPx(bracket.tp)}</b></span>
                    <span className="lbl">SL <b className="down">{bracket.sl == null ? "—" : fmtPx(bracket.sl)}</b></span>
                    <input value={tpTxt} onChange={(e) => setTpTxt(e.target.value)} inputMode="decimal" placeholder="TP" aria-label="New take profit price" />
                    <input value={slTxt} onChange={(e) => setSlTxt(e.target.value)} inputMode="decimal" placeholder="SL" aria-label="New stop loss price" />
                    <button type="button" className="pd-mini" onClick={setPositionBracket} data-testid="pd-set-bracket">
                      Set TP/SL
                    </button>
                  </div>
                  <div className="pd-trail" data-testid="pd-trail" role="group" aria-label="Trailing stop (sim)">
                    <span className="lbl">Trailing stop</span>
                    {[null, ...TRAIL_PCTS].map((p) => (
                      <button
                        key={p ?? "off"}
                        type="button"
                        className={`pd-pct${trailPct === p ? " is-on" : ""}`}
                        aria-pressed={trailPct === p}
                        data-trail={p ?? "off"}
                        onClick={() => {
                          setTrailPct(p)
                          setMsg(p == null ? { ok: true, text: "Trailing stop off. Your stop stays where it is (sim)." } : { ok: true, text: trailLine(posSide === "short" ? "short" : "long", p) })
                        }}
                      >
                        {p == null ? "Off" : `${p}%`}
                      </button>
                    ))}
                    {trailPct != null ? <p className="pd-trail-note" data-testid="pd-trail-note">{trailLine(posSide === "short" ? "short" : "long", trailPct)}</p> : null}
                  </div>
                  {gauge ? (
                    <div
                      className={`pd-gauge is-${gauge.zone}`}
                      data-testid="pd-gauge"
                      data-zone={gauge.zone}
                      role="meter"
                      aria-label="Distance from stop loss to take profit (sim)"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(gauge.mark * 100)}
                      aria-valuetext={gauge.label}
                    >
                      <div className="pd-gauge-ends">
                        <span className="down">SL {fmtPx(bracket.sl ?? 0)}</span>
                        <span className="up">TP {fmtPx(bracket.tp ?? 0)}</span>
                      </div>
                      <div className="pd-gauge-track">
                        <div className="pd-gauge-fill" style={{ width: `${gauge.mark * 100}%` }} />
                        {gauge.entry != null ? <span className="pd-gauge-entry" style={{ left: `${gauge.entry * 100}%` }} title="Entry" /> : null}
                        <span className="pd-gauge-mark" style={{ left: `${gauge.mark * 100}%` }} />
                      </div>
                      <p className="pd-gauge-label" aria-live="polite">{gauge.label}</p>
                    </div>
                  ) : null}
                  <button type="button" className="pd-mini wide" onClick={closeAll}>
                    Close position
                  </button>
                </>
              )}
            </div>
          ) : null}
          {lower === "balances" ? (
            <dl className="pd-pos-grid" aria-label="Sim balances">
              <div><dt>Cash (USD)</dt><dd data-snl-cash="1">{formatPnlSim(snap.cash, false)}</dd></div>
              <div><dt>Equity</dt><dd data-snl-equity="1">{formatPnlSim(snap.equity, false)}</dd></div>
              <div><dt>XOE position</dt><dd>{posSide === "short" ? "-" : ""}{snap.size.toFixed(2)} XOE</dd></div>
              <div><dt>Realized P/L</dt><dd>{formatPnlSim(snap.realized, true)}</dd></div>
              <div><dt>Fees paid</dt><dd>{formatPnlSim(-snap.fees, true)}</dd></div>
              <div><dt>Session P/L</dt><dd>{formatPnlSim(snap.session, true)}</dd></div>
              <p className="pd-note">{SNL_CASH_TIP} {SNL_EQUITY_TIP}</p>
            </dl>
          ) : null}
          {lower === "fills" ? (
            <ul className="pd-rows" aria-label="Sim fills">
              {liveSnl.fills.length === 0 ? <li className="empty">No fills yet.</li> : null}
              {liveSnl.fills.slice(0, 20).map((f) => (
                <li key={f.id}>
                  <span className={f.action === "long" || f.action === "cover" ? "up" : "down"}>
                    {f.action === "long" || f.action === "cover" ? "Buy" : "Sell"} ({f.action})
                  </span>
                  <span>{amountFromLots(f.lots)} XOE @ {fmtPx(f.price)}</span>
                  {fillNet(f) == null ? (
                    <span className="fine">fee {formatPnlSim(-f.fee, true)}</span>
                  ) : (
                    <span className={`fine ${(fillNet(f) ?? 0) >= 0 ? "up" : "down"}`}>net {formatPnlSim(fillNet(f) ?? 0, true)}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {lower === "pnl" ? (
            <div className="pd-pnl" data-testid="pd-pnl" aria-label="Sim trade journal">
              <PnlCurve curve={journal.curve} />
              <dl className="pd-pos-grid">
                <div><dt>Net P/L (after fees)</dt><dd data-pnl-net="1" className={journal.net >= 0 ? "up" : "down"}>{formatPnlSim(journal.net, true)}</dd></div>
                <div><dt>Closed trades</dt><dd data-pnl-trades="1">{journal.trades}</dd></div>
                <div><dt>Win rate</dt><dd>{journal.winRate == null ? "—" : `${Math.round(journal.winRate * 100)}% (${journal.wins}W / ${journal.losses}L)`}</dd></div>
                <div><dt>Profit factor</dt><dd>{journal.profitFactor == null ? "—" : Number.isFinite(journal.profitFactor) ? journal.profitFactor.toFixed(2) : "∞"}</dd></div>
                <div><dt>Avg win</dt><dd className="up">{journal.avgWin == null ? "—" : formatPnlSim(journal.avgWin, true)}</dd></div>
                <div><dt>Avg loss</dt><dd className="down">{journal.avgLoss == null ? "—" : formatPnlSim(journal.avgLoss, true)}</dd></div>
                <div><dt>Best trade</dt><dd>{journal.best == null ? "—" : formatPnlSim(journal.best, true)}</dd></div>
                <div><dt>Worst trade</dt><dd>{journal.worst == null ? "—" : formatPnlSim(journal.worst, true)}</dd></div>
                <div><dt>Max drawdown</dt><dd>{formatPnlSim(-journal.maxDrawdown, true)}</dd></div>
                <div><dt>Fees paid</dt><dd>{formatPnlSim(-journal.feesPaid, true)}</dd></div>
                <p className="pd-note">Journal of your sim fills this session. A trade counts when you close or cover. Sim · testnet XOE · no real money.</p>
              </dl>
            </div>
          ) : null}
          {lower === "alerts" ? (
            <div className="pd-alerts" data-testid="pd-alerts" aria-label="Sim price alerts">
              <div className="pd-alert-add">
                <input
                  value={alertTxt}
                  onChange={(e) => setAlertTxt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addAlert()
                  }}
                  inputMode="decimal"
                  placeholder={fmtPx(mark * 1.01)}
                  aria-label="Alert price"
                  data-testid="pd-alert-input"
                />
                <button type="button" className="pd-mini" onClick={addAlert} data-testid="pd-alert-add">
                  Add alert
                </button>
              </div>
              <div className="pd-alert-quick" role="group" aria-label="Quick alert levels">
                {[-2, -1, 1, 2].map((p) => (
                  <button key={p} type="button" className="pd-pct" onClick={() => setAlertTxt((mark * (1 + p / 100)).toFixed(3))}>
                    {p > 0 ? "+" : ""}{p}%
                  </button>
                ))}
              </div>
              {alertMsg ? (
                <p className={`pd-msg ${alertMsg.ok ? "ok" : "bad"}`} role="status">
                  {alertMsg.text}
                </p>
              ) : null}
              <ul className="pd-rows" aria-label="Your sim alerts">
                {alerts.length === 0 ? <li className="empty">No alerts yet. Set a price and we'll tell you when XOE gets there.</li> : null}
                {alerts.map((a) => (
                  <li key={a.id} className={a.hit ? "is-hit" : ""} data-alert-state={a.hit ? "hit" : "live"}>
                    <span className={a.dir === "above" ? "up" : "down"}>{a.dir === "above" ? "▲ Rises to" : "▼ Falls to"}</span>
                    <span>{fmtPx(a.price)}</span>
                    <span className="fine">{a.hit ? "Hit" : `${(((a.price - mark) / mark) * 100).toFixed(2)}% away`}</span>
                    <button type="button" className="pd-mini" onClick={() => setAlerts((l) => l.filter((x) => x.id !== a.id))} aria-label={`Remove alert at ${fmtPx(a.price)}`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="pd-note">Up to {MAX_ALERTS} live alerts. Alerts only notify you; they never place an order. Sim · testnet XOE · no real money.</p>
            </div>
          ) : null}
          <div className="pd-arena" hidden={lower !== "arena"}>
            <TradeSimArena
              price={mark}
              history={bars.slice(-48).map((b) => b.c)}
              difficulty={readFightDifficulty(getLocalStore())}
              reducedMotion={reducedMotion}
              forcePaused={!open || lower !== "arena"}
              tradeImpulse={pulse.action}
              tradeSeq={pulse.seq}
              positionSide={posSide}
            />
          </div>
        </section>
      </div>

    </div>
  )
}

/** Small running net P/L line for the sim trade journal. */
function PnlCurve({ curve }: { curve: readonly number[] }) {
  const w = 320
  const h = 72
  if (curve.length < 2) {
    return <p className="empty pd-pnl-empty">No fills yet. Your running P/L line appears here after your first trade.</p>
  }
  const lo = Math.min(0, ...curve)
  const hi = Math.max(0, ...curve)
  const span = hi - lo || 1
  const x = (i: number) => (i / (curve.length - 1)) * w
  const y = (v: number) => h - 4 - ((v - lo) / span) * (h - 8)
  const pts = curve.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const last = curve[curve.length - 1] ?? 0
  return (
    <svg className="pd-pnl-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Running net P/L, now ${formatPnlSim(last, true)}`}>
      <line x1="0" x2={w} y1={y(0)} y2={y(0)} className="zero" />
      <polyline points={pts} className={last >= 0 ? "up" : "down"} />
    </svg>
  )
}
