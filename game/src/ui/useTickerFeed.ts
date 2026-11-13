import { createContext, useEffect, useRef, useState } from "react"
import {
  TICKER_REFRESH_MS,
  TICKER_STATS_MS,
  fetchOpens,
  fetchTickerSnapshot,
  pushHistory,
  probeSpot,
  type TickerSnapshot,
} from "../game/live-ticker.ts"
import { TICKER_SIM_STEP_MS, seededRng, simulateSnapshot } from "../game/ticker-play.ts"
import {
  XOE_SIM_SYMBOL,
  XOE_SIM_TICK_MS,
  initialXoeSim,
  tickXoeSim,
  xoeSimQuote,
  type XoeSimState,
} from "../game/xoe-sim-price.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { flareController } from "../game/flare-bus.ts"
import { FEED_BACKOFF_START, afterFeedLoad, feedPlan } from "../game/feed-backoff.ts"

const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false

function stepXoe(prev: XoeSimState, opts: Parameters<typeof tickXoeSim>[1], advanceFlare: boolean): XoeSimState {
  const ctl = flareController()
  const flare = ctl?.peek()
  if (flare?.active || (advanceFlare && ctl)) {
    if (!advanceFlare && flare?.active) return prev
    if (advanceFlare && ctl) {
      const base = flare?.active ? prev : tickXoeSim(prev, opts)
      return ctl.onSimTick(base, opts.noise ?? 0, opts.now ?? 0).sim
    }
  }
  return tickXoeSim(prev, opts)
}


/** Fights and the trade desk read the same feed without prop drilling. */
export const TickerContext = createContext<TickerSnapshot | null>(null)

function withXoe(snap: TickerSnapshot, xoe: XoeSimState, prevPrice?: number): TickerSnapshot {
  const quote = xoeSimQuote(xoe, prevPrice)
  const rest = snap.quotes.filter((q) => q.symbol !== XOE_SIM_SYMBOL)
  // Earlier multi-coin gameplay stays, but only XLM can request live prices (Nov 10 ceiling).
  const local = simulateSnapshot(snap, seededRng(snap.updatedAt & 0xffff), snap.updatedAt).quotes
    .filter((q) => !["XLM", XOE_SIM_SYMBOL].includes(q.symbol))
    .map((q) => ({ ...q, simulated: true }))
  return { ...snap, quotes: [quote, ...rest.filter((q) => q.symbol === "XLM"), ...local] }
}

/**
 * ONE ticker feed for the whole app (display + gameplay + XOE/USD sim trade).
 * - Coinbase PUBLIC spot every 30s + 24h opens every 5 min (no keys). v18: backs off when offline.
 * - XOE/USD sim ticks every 1.5s, driven by XLM's live step plus noise, or a walk when offline.
 * - offline / ticker off: simulated prices every 8s for the other coins while `active`.
 */
export function useTickerFeed(enabled: boolean, active: boolean): { snap: TickerSnapshot | null; history: Record<string, number[]> } {
  const [snap, setSnap] = useState<TickerSnapshot | null>(null)
  const [history, setHistory] = useState<Record<string, number[]>>({})
  const snapRef = useRef<TickerSnapshot | null>(null)
  snapRef.current = snap
  const rngRef = useRef(seededRng(Date.now() & 0xffff))
  const opensRef = useRef<{ at: number; opens: Record<string, number> }>({ at: 0, opens: {} })
  const xoeRef = useRef<XoeSimState>(initialXoeSim(Date.now()))
  const lastXlmRef = useRef<number | null>(null)
  const backoffRef = useRef(FEED_BACKOFF_START)

  const accept = (next: TickerSnapshot) => {
    setSnap(next)
    setHistory((h) => pushHistory(h, next))
  }

  useEffect(() => {
    if (!enabled || !active) return
    let cancelled = false
    const load = async () => {
      try {
        const plan = feedPlan(backoffRef.current, Date.now(), isOnline())
        if (plan === "skip") return
        if (plan === "probe" && !(await probeSpot(fetch))) {
          backoffRef.current = afterFeedLoad(backoffRef.current, false, Date.now())
          return
        }
        const next = await fetchTickerSnapshot(fetch, getLocalStore(), opensRef.current.opens)
        backoffRef.current = afterFeedLoad(backoffRef.current, next.live, Date.now())
        // 24h opens only once spot prices are coming through.
        if (next.live && Date.now() - opensRef.current.at > TICKER_STATS_MS) {
          const opens = await fetchOpens(fetch)
          if (Object.keys(opens).length) opensRef.current = { at: Date.now(), opens }
        }
        if (!cancelled && (next.live || !snapRef.current)) {
          const xlm = next.quotes.find((q) => q.symbol === "XLM")
          const prevXlm = lastXlmRef.current
          if (xlm && xlm.priceUsd > 0) {
            const step = prevXlm && prevXlm > 0 ? ((xlm.priceUsd - prevXlm) / prevXlm) * 100 : (xlm.stepPct ?? 0)
            lastXlmRef.current = xlm.priceUsd
            const prevP = xoeRef.current.price
            xoeRef.current = stepXoe(xoeRef.current, {
              xlmStepPct: step,
              noise: rngRef.current() - 0.5,
              liveXlm: next.live,
              now: Date.now(),
            }, false)
            accept(withXoe(next, xoeRef.current, prevP))
          } else {
            accept(withXoe(next, xoeRef.current))
          }
        }
      } catch {
        /* simulated loop below covers offline */
      }
    }
    const onOnline = () => {
      backoffRef.current = FEED_BACKOFF_START
      void load()
    }
    void load()
    const id = window.setInterval(() => void load(), TICKER_REFRESH_MS)
    window.addEventListener("online", onOnline)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener("online", onOnline)
    }
  }, [enabled, active])

  useEffect(() => {
    if (!active) return
    const step = () => {
      const cur = snapRef.current
      if (enabled && cur?.live && Date.now() - cur.updatedAt < TICKER_REFRESH_MS * 2) return
      const sim = simulateSnapshot(cur, rngRef.current, Date.now())
      const xlm = sim.quotes.find((q) => q.symbol === "XLM")
      const prevP = xoeRef.current.price
      xoeRef.current = stepXoe(xoeRef.current, {
        xlmStepPct: xlm?.stepPct ?? 0,
        noise: rngRef.current() - 0.5,
        offline: true,
        liveXlm: false,
        now: Date.now(),
      }, false)
      accept(withXoe(sim, xoeRef.current, prevP))
    }
    if (!snapRef.current?.quotes.length) step()
    const id = window.setInterval(step, TICKER_SIM_STEP_MS)
    return () => window.clearInterval(id)
  }, [enabled, active])

  // XOE sim ticks every 1–2s even while the other coins wait for the 30s poll.
  useEffect(() => {
    if (!active) return
    const tick = () => {
      const cur = snapRef.current
      const xlm = cur?.quotes.find((q) => q.symbol === "XLM")
      const live = Boolean(enabled && cur?.live && xlm && Date.now() - xlm.updatedAt < TICKER_REFRESH_MS * 2)
      const prevP = xoeRef.current.price
      // Keep ticking between 30s XLM polls: drip the last XLM step plus visible noise
      // so the sim price reads like a live market (up and down every second or so).
      const drip = 0 // Each live XLM step is consumed once, on its poll, never on animation ticks.
      xoeRef.current = stepXoe(xoeRef.current, {
        xlmStepPct: drip,
        noise: rngRef.current() - 0.5,
        offline: !live,
        liveXlm: live,
        now: Date.now(),
      }, true)
      const base: TickerSnapshot = cur ?? {
        quotes: [],
        live: false,
        message: "Simulated walk · offline",
        updatedAt: Date.now(),
      }
      accept(withXoe({ ...base, live, message: live ? base.message : "Simulated walk · offline", updatedAt: Date.now() }, xoeRef.current, prevP))
    }
    tick()
    const id = window.setInterval(tick, XOE_SIM_TICK_MS)
    return () => window.clearInterval(id)
  }, [enabled, active])

  return { snap, history }
}

export function xoePriceFromSnap(snap: TickerSnapshot | null): number | null {
  const q = snap?.quotes.find((x) => x.symbol === XOE_SIM_SYMBOL)
  return q && q.priceUsd > 0 ? q.priceUsd : null
}
