/**
 * Simulated SNL listing for the paper/practice trade desk.
 * Price tracks the moving XOE/USD sim. Isolated paper cash only —
 * never touches the ledger, daily caps, or XOE buy/sell lots.
 * Not a real market. No exchange branding.
 *
 * Positions use a margin-style paper book so cash and equity are
 * easy to tell apart: cash is settled, equity is cash + unrealized P/L.
 */
import { clampXoeSimPrice } from "./xoe-sim-price.ts"
import { formatPnlSim } from "./economy.ts"

export const SNL_SYMBOL = "SNL"
export const SNL_PAIR_LABEL = "SNL/USD"
export const SNL_LOT = 0.1
export const SNL_PAPER_CASH = 20
export const SNL_FEE_TAKER = 0.001
export const SNL_FEE_MAKER = 0.0004
/** Maintenance margin as a fraction of position notional (sim only). */
export const SNL_MAINT = 0.2
export const SNL_DISCLAIMER =
  "SNL is a simulated listing · not a real market · paper only · no real money."
export const SNL_CASH_TIP =
  "Cash is your settled paper balance: starting funds minus simulated fees plus realized P/L from closed trades. It does not include open positions."
export const SNL_EQUITY_TIP =
  "Equity is cash plus unrealized P/L on the open position. They differ while a trade is open. Example: cash $20 and a short up $1 means equity $21. Closing the short moves that $1 into cash. This is paper only."

export type SnlSide = "flat" | "long" | "short"
export type SnlAction = "long" | "close" | "short" | "cover" | "reverse"
export type SnlOrderType = "market" | "limit" | "stop" | "take-profit"
export type SnlOrderStatus = "open" | "filled" | "canceled"

export interface SnlOrder {
  id: string
  action: SnlAction
  type: SnlOrderType
  lots: number
  price: number | null
  status: SnlOrderStatus
  createdAt: number
  filledAt?: number
  fillPrice?: number
  fee: number
  /** One-cancels-other group: when one order in the group fills, the rest are canceled. */
  oco?: string
}

export interface SnlFill {
  id: string
  orderId: string
  action: SnlAction
  price: number
  lots: number
  fee: number
  realized: number
  at: number
}

export interface SnlBook {
  cash: number
  side: SnlSide
  lots: number
  entry: number | null
  realized: number
  feesPaid: number
  lastAction: SnlAction | null
  lastFill: number | null
  markedPrice: number | null
  nextId: number
  orders: SnlOrder[]
  fills: SnlFill[]
}

export function snlPriceFromXoe(xoeUsd: number): number {
  return clampXoeSimPrice(xoeUsd)
}

export function snlSize(lots: number): number {
  return SNL_LOT * lots
}

export function snlNotional(price: number, lots = 1): number {
  return snlSize(lots) * snlPriceFromXoe(price)
}

export function snlLotCost(price: number, lots = 1): number {
  return snlNotional(price, lots)
}

export function snlFee(price: number, lots = 1, rate = SNL_FEE_TAKER): number {
  return snlNotional(price, lots) * rate
}

export function initialSnlBook(): SnlBook {
  return {
    cash: SNL_PAPER_CASH,
    side: "flat",
    lots: 0,
    entry: null,
    realized: 0,
    feesPaid: 0,
    lastAction: null,
    lastFill: null,
    markedPrice: null,
    nextId: 1,
    orders: [],
    fills: [],
  }
}

function avgEntry(entry: number | null, lots: number, price: number, add: number): number {
  if (lots <= 0 || entry == null) return price
  return (entry * lots + price * add) / (lots + add)
}

export function snlUnrealized(book: SnlBook, price: number): number {
  if (book.side === "flat" || book.entry == null || book.lots <= 0) return 0
  const p = snlPriceFromXoe(price)
  const size = snlSize(book.lots)
  return book.side === "long" ? (p - book.entry) * size : (book.entry - p) * size
}

export function snlUnrealizedPct(book: SnlBook, price: number): number | null {
  if (book.side === "flat" || book.entry == null || book.lots <= 0) return null
  const basis = book.entry * snlSize(book.lots)
  if (!(basis > 0)) return null
  return (snlUnrealized(book, price) / basis) * 100
}

/** Equity = settled cash + unrealized P/L. */
export function snlEquity(book: SnlBook, price: number): number {
  return book.cash + snlUnrealized(book, price)
}

/** Session P/L versus the isolated SNL paper starting cash (includes fees). */
export function snlPnl(book: SnlBook, price: number): number {
  return snlEquity(book, price) - SNL_PAPER_CASH
}

/**
 * Theoretical maintenance liquidation price for the open paper position.
 * Returns null when flat. May fall outside the $5–$20 sim band.
 */
export function snlLiquidationPrice(book: SnlBook): number | null {
  if (book.side === "flat" || book.entry == null || book.lots <= 0) return null
  const size = snlSize(book.lots)
  const entry = book.entry
  const cash = book.cash
  if (book.side === "long") {
    const denom = size * (1 - SNL_MAINT)
    if (denom <= 0) return null
    return (size * entry - cash) / denom
  }
  const denom = size * (1 + SNL_MAINT)
  if (denom <= 0) return null
  return (cash + size * entry) / denom
}

export function snlPositionLine(book: SnlBook, price: number): string {
  const p = snlPriceFromXoe(price)
  const cash = `cash ${formatPnlSim(book.cash, false)}`
  const equity = `equity ${formatPnlSim(snlEquity(book, p), false)}`
  if (book.side === "flat") return `Flat · ${cash} · ${equity}`
  const entry = book.entry == null ? "—" : formatPnlSim(book.entry, false)
  const pct = snlUnrealizedPct(book, p)
  const u = formatPnlSim(snlUnrealized(book, p), true) + (pct == null ? "" : ` (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`)
  return `${book.side} ${book.lots} × ${SNL_LOT} · entry ${entry} · mark ${formatPnlSim(p, false)} · uP/L ${u} · realized ${formatPnlSim(book.realized, true)} · fees ${formatPnlSim(-book.feesPaid, true)} · ${cash} · ${equity}`
}

function recordFill(book: SnlBook, action: SnlAction, lots: number, price: number, fee: number, realizedAdd: number, now: number, orderId: string): SnlBook {
  const fill: SnlFill = {
    id: `sf-${book.nextId}`,
    orderId,
    action,
    price,
    lots,
    fee,
    realized: realizedAdd,
    at: now,
  }
  return {
    ...book,
    nextId: book.nextId + 1,
    fills: [fill, ...book.fills].slice(0, 40),
  }
}

function chargeFee(book: SnlBook, fee: number): SnlBook {
  return { ...book, cash: book.cash - fee, feesPaid: book.feesPaid + fee }
}

function canMargin(book: SnlBook, price: number, lots: number): boolean {
  return book.cash + 1e-9 >= snlNotional(price, lots)
}

export function applySnlAction(
  book: SnlBook,
  action: SnlAction,
  price: number,
  lots = 1,
  now = 0,
  feeRate = SNL_FEE_TAKER,
): SnlBook {
  const p = snlPriceFromXoe(price)
  const qty = Math.max(0, Math.trunc(lots))
  if (qty <= 0) return book
  const fee = snlFee(p, qty, feeRate)
  if (action === "long") {
    if (book.side === "short") return book
    const nextLots = book.lots + qty
    if (!canMargin(book, p, nextLots)) return book
    if (book.cash + 1e-9 < fee) return book
    let next = chargeFee(book, fee)
    next = {
      ...next,
      side: "long",
      lots: nextLots,
      entry: avgEntry(book.entry, book.lots, p, qty),
      lastAction: "long",
      lastFill: p,
      markedPrice: p,
    }
    return recordFill(next, "long", qty, p, fee, 0, now, "mkt")
  }
  if (action === "close") {
    if (book.side !== "long" || book.lots <= 0 || book.entry == null) return book
    const use = Math.min(qty, book.lots)
    const useFee = snlFee(p, use, feeRate)
    if (book.cash + 1e-9 < useFee) return book
    const realizedAdd = (p - book.entry) * snlSize(use)
    const remain = book.lots - use
    let next = chargeFee(book, useFee)
    next = {
      ...next,
      cash: next.cash + realizedAdd,
      side: remain > 0 ? "long" : "flat",
      lots: remain,
      entry: remain > 0 ? book.entry : null,
      realized: book.realized + realizedAdd,
      lastAction: "close",
      lastFill: p,
      markedPrice: p,
    }
    return recordFill(next, "close", use, p, useFee, realizedAdd, now, "mkt")
  }
  if (action === "short") {
    if (book.side === "long") return book
    const nextLots = book.lots + qty
    if (!canMargin(book, p, nextLots)) return book
    if (book.cash + 1e-9 < fee) return book
    let next = chargeFee(book, fee)
    next = {
      ...next,
      side: "short",
      lots: nextLots,
      entry: avgEntry(book.entry, book.lots, p, qty),
      lastAction: "short",
      lastFill: p,
      markedPrice: p,
    }
    return recordFill(next, "short", qty, p, fee, 0, now, "mkt")
  }
  if (action === "cover") {
    if (book.side !== "short" || book.lots <= 0 || book.entry == null) return book
    const use = Math.min(qty, book.lots)
    const useFee = snlFee(p, use, feeRate)
    const realizedAdd = (book.entry - p) * snlSize(use)
    if (book.cash + realizedAdd + 1e-9 < useFee) return book
    const remain = book.lots - use
    let next = chargeFee(book, useFee)
    next = {
      ...next,
      cash: Math.max(0, next.cash + realizedAdd),
      side: remain > 0 ? "short" : "flat",
      lots: remain,
      entry: remain > 0 ? book.entry : null,
      realized: book.realized + realizedAdd,
      lastAction: "cover",
      lastFill: p,
      markedPrice: p,
    }
    return recordFill(next, "cover", use, p, useFee, realizedAdd, now, "mkt")
  }
  if (action === "reverse") {
    if (book.side === "flat" || book.lots <= 0) return book
    const n = book.lots
    const closed = book.side === "long" ? applySnlAction(book, "close", p, n, now, feeRate) : applySnlAction(book, "cover", p, n, now, feeRate)
    if (closed === book || closed.side !== "flat") return book
    const opened = applySnlAction(closed, book.side === "long" ? "short" : "long", p, n, now, feeRate)
    if (opened.side === "flat") return book
    return { ...opened, lastAction: "reverse" }
  }
  return book
}

export function canSnl(book: SnlBook, action: SnlAction, price: number, lots = 1): boolean {
  const next = applySnlAction(book, action, price, lots)
  return next !== book
}

export function placeSnlOrder(
  book: SnlBook,
  opts: { action: SnlAction; type: SnlOrderType; lots?: number; price?: number | null; now?: number },
): { book: SnlBook; error?: string } {
  const lots = Math.max(1, Math.trunc(opts.lots ?? 1))
  const now = opts.now ?? 0
  const mid = snlPriceFromXoe(book.markedPrice ?? 10)
  if (opts.type === "market") {
    const next = applySnlAction(book, opts.action, mid, lots, now, SNL_FEE_TAKER)
    if (next === book) return { book, error: "Cannot fill that paper order." }
    return { book: next }
  }
  const px = opts.price
  if (px == null || !(px > 0)) return { book, error: "Enter a trigger or limit price." }
  const order: SnlOrder = {
    id: `so-${book.nextId}`,
    action: opts.action,
    type: opts.type,
    lots,
    price: clampXoeSimPrice(px),
    status: "open",
    createdAt: now,
    fee: 0,
  }
  return { book: { ...book, nextId: book.nextId + 1, orders: [order, ...book.orders] } }
}

/**
 * Attach a take-profit / stop-loss bracket to the open sim position. Both legs reduce the
 * position and share an OCO group, so when one fills the other is canceled. Paper only.
 */
export function attachSnlBracket(
  book: SnlBook,
  opts: { tp?: number | null; sl?: number | null; now?: number },
): { book: SnlBook; error?: string } {
  if (book.side === "flat" || book.lots <= 0) return { book, error: "Open a sim position first." }
  const tp = opts.tp != null && opts.tp > 0 ? clampXoeSimPrice(opts.tp) : null
  const sl = opts.sl != null && opts.sl > 0 ? clampXoeSimPrice(opts.sl) : null
  if (tp == null && sl == null) return { book, error: "Enter a take-profit or stop-loss price." }
  const action: SnlAction = book.side === "long" ? "close" : "cover"
  const group = `oco-${book.nextId}`
  const now = opts.now ?? 0
  // Replace any earlier bracket on this position so only one TP/SL pair is live.
  let orders = book.orders.map((o) => (o.status === "open" && o.oco ? { ...o, status: "canceled" as const } : o))
  let nextId = book.nextId
  const legs: SnlOrder[] = []
  if (tp != null) legs.push({ id: `so-${nextId++}`, action, type: "take-profit", lots: book.lots, price: tp, status: "open", createdAt: now, fee: 0, oco: group })
  if (sl != null) legs.push({ id: `so-${nextId++}`, action, type: "stop", lots: book.lots, price: sl, status: "open", createdAt: now, fee: 0, oco: group })
  orders = [...legs, ...orders]
  return { book: { ...book, nextId, orders } }
}

/** Open TP/SL bracket prices on the current position, if any. */
export function snlBracket(book: SnlBook): { tp: number | null; sl: number | null } {
  let tp: number | null = null
  let sl: number | null = null
  for (const o of book.orders) {
    if (o.status !== "open" || !o.oco) continue
    if (o.type === "take-profit" && tp == null) tp = o.price
    if (o.type === "stop" && sl == null) sl = o.price
  }
  return { tp, sl }
}

function cancelOrphanBrackets(book: SnlBook): SnlBook {
  if (book.side !== "flat") return book
  if (!book.orders.some((o) => o.status === "open" && o.oco)) return book
  return { ...book, orders: book.orders.map((o) => (o.status === "open" && o.oco ? { ...o, status: "canceled" as const } : o)) }
}

export function cancelSnlOrder(book: SnlBook, id: string): SnlBook {
  const orders = book.orders.map((o) => (o.id === id && o.status === "open" ? { ...o, status: "canceled" as const } : o))
  if (orders.every((o, i) => o === book.orders[i])) return book
  return { ...book, orders }
}

function shouldFill(order: SnlOrder, _price: number, high: number, low: number): boolean {
  if (order.status !== "open" || order.price == null) return false
  const target = order.price
  if (order.type === "limit") {
    if (order.action === "long" || order.action === "cover") return low <= target
    if (order.action === "short" || order.action === "close") return high >= target
    if (order.action === "reverse") return low <= target || high >= target
  }
  if (order.type === "stop") {
    if (order.action === "long" || order.action === "cover") return high >= target
    if (order.action === "short" || order.action === "close") return low <= target
    if (order.action === "reverse") return high >= target || low <= target
  }
  if (order.type === "take-profit") {
    if (order.action === "close" || order.action === "short") return high >= target
    if (order.action === "cover" || order.action === "long") return low <= target
    if (order.action === "reverse") return high >= target || low <= target
  }
  return false
}

function fillPriceFor(order: SnlOrder, mark: number): number {
  if (order.type === "limit" && order.price != null) return clampXoeSimPrice(order.price)
  return clampXoeSimPrice(order.price ?? mark)
}

/**
 * Apply mark-to-market: fill working orders that are touched, then check
 * a sim maintenance liquidation. Idempotent when the mark is unchanged and
 * nothing triggers.
 */
export function tickSnlBook(book: SnlBook, price: number, wickHigh?: number, wickLow?: number, now = 0): SnlBook {
  const p = snlPriceFromXoe(price)
  const high = clampXoeSimPrice(wickHigh ?? p)
  const low = clampXoeSimPrice(wickLow ?? p)
  const openOrders = book.orders.filter((o) => o.status === "open")
  const already = book.markedPrice === p && openOrders.length === 0
  if (already) {
    const liq = maybeLiquidate(book, p, now)
    return liq === book ? book : cancelOrphanBrackets(liq)
  }
  let next = book
  for (const order of book.orders) {
    const current = next.orders.find((o) => o.id === order.id)
    if (!current || !shouldFill(current, p, high, low)) continue
    const px = fillPriceFor(order, p)
    const filled = applySnlAction(next, order.action, px, order.lots, now, SNL_FEE_MAKER)
    if (filled === next) continue
    const orders = filled.orders.map((o) =>
      o.id === order.id
        ? { ...o, status: "filled" as const, filledAt: now, fillPrice: px, fee: snlFee(px, order.lots, SNL_FEE_MAKER) }
        : order.oco && o.oco === order.oco && o.status === "open"
          ? { ...o, status: "canceled" as const }
          : o,
    )
    // applySnlAction records a market fill id; retag last fill's orderId
    const fills = filled.fills.map((f, i) => (i === 0 ? { ...f, orderId: order.id } : f))
    next = { ...filled, orders, fills }
  }
  next = { ...next, markedPrice: p }
  return cancelOrphanBrackets(maybeLiquidate(next, p, now))
}

function maybeLiquidate(book: SnlBook, price: number, now: number): SnlBook {
  if (book.side === "flat" || book.lots <= 0) return book
  const liq = snlLiquidationPrice(book)
  if (liq == null || !Number.isFinite(liq)) return book
  const hit = book.side === "long" ? price <= liq : price >= liq
  if (!hit) return book
  const action: SnlAction = book.side === "long" ? "close" : "cover"
  // Fill at the theoretical liq so a derived tick stays stable if the mark keeps running.
  const flat = applySnlAction(book, action, liq, book.lots, now, SNL_FEE_TAKER)
  if (flat === book) return book
  return { ...flat, lastAction: action }
}

export function snlSessionBreakdown(book: SnlBook, price: number): {
  cash: number
  equity: number
  unrealized: number
  unrealizedPct: number | null
  realized: number
  fees: number
  session: number
  mark: number
  entry: number | null
  side: SnlSide
  lots: number
  size: number
  liq: number | null
} {
  const mark = snlPriceFromXoe(price)
  return {
    cash: book.cash,
    equity: snlEquity(book, mark),
    unrealized: snlUnrealized(book, mark),
    unrealizedPct: snlUnrealizedPct(book, mark),
    realized: book.realized,
    fees: book.feesPaid,
    session: snlPnl(book, mark),
    mark,
    entry: book.entry,
    side: book.side,
    lots: book.lots,
    size: snlSize(book.lots),
    liq: snlLiquidationPrice(book),
  }
}
