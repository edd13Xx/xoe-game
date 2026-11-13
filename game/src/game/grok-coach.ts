/**
 * Grok AI desk coach bridge (NEAR HACKATHON demo). Paper/sim only; it never places or changes an order.
 *
 * The game never calls a server and never holds an xAI key (the locked two-provider network rule stays true).
 * When the game runs embedded in the demo page, it posts the small trade context to the host page with
 * postMessage. The host calls its own /api/coach endpoint, which holds XAI_API_KEY server-side, and posts the
 * answer back. If the game is not embedded (file://, standalone PWA), no request is made at all. On any miss
 * (no key, timeout, error, bad reply) this returns null and the caller keeps showing the rule-based tip.
 */
import { fillNet, losingStreak, riskAtStop, type CoachInput, type CoachTip } from "./pro-desk.ts"

export const GROK_COACH_LABEL = "Grok Bot coach (sim)"
export const GROK_COACH_TIMEOUT_MS = 6500
export const GROK_COACH_MAX_CHARS = 280

export interface GrokCoachContext {
  /** "open-position" = a sim position is open; "planning-order" = flat, side/size/stop come from the order form. */
  state: "open-position" | "planning-order"
  side: "long" | "short" | "flat"
  sizeLots: number
  entry: number | null
  mark: number
  stopLoss: number | null
  takeProfit: number | null
  riskPctOfEquity: number | null
  unrealizedPnlPct: number | null
  lastResult: "win" | "loss" | "none"
  losingStreak: number
  ruleTip: string
}

const fin = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(4)) : null)

/** The only data that leaves the game for the coach: side, size, entry, SL/TP, risk %, P/L %, recent result. */
export function buildCoachContext(s: CoachInput, tip: CoachTip): GrokCoachContext {
  const flat = s.pos === "flat"
  const opening: "long" | "short" | null = flat ? s.form?.opening ?? null : s.pos === "short" ? "short" : "long"
  const sl = flat ? s.form?.sl ?? null : s.sl
  const lots = flat ? s.form?.lots ?? 0 : s.lots
  const refPx = flat ? s.mark : s.entry
  const risk = opening && sl != null && refPx != null ? riskAtStop(opening, s.equity, refPx, sl, lots) : null
  const upnl = !flat && s.entry ? ((s.mark - s.entry) / s.entry) * 100 * (s.pos === "short" ? -1 : 1) : null
  const closed = [...s.fills].sort((a, b) => b.at - a.at || b.id.localeCompare(a.id)).map(fillNet).filter((n): n is number => n != null)
  return {
    state: flat ? "planning-order" : "open-position",
    side: opening ?? "flat",
    sizeLots: fin(lots) ?? 0,
    entry: fin(flat ? null : s.entry),
    mark: fin(s.mark) ?? 0,
    stopLoss: fin(sl),
    takeProfit: fin(flat ? null : s.tp),
    riskPctOfEquity: risk ? fin(risk.pct) : null,
    unrealizedPnlPct: fin(upnl),
    lastResult: closed.length === 0 ? "none" : closed[0] < 0 ? "loss" : "win",
    losingStreak: losingStreak(s.fills),
    ruleTip: tip.text.slice(0, 160),
  }
}

/** A key that changes when the player makes a trading decision (not on every price tick). */
export function coachDecisionKey(s: CoachInput, tipId: string): string {
  return [s.pos, s.lots, s.sl ?? "", s.tp ?? "", s.fills.length, s.form?.opening ?? "", s.form?.bracketOn ? 1 : 0, tipId].join("|")
}

export function cleanGrokText(t: unknown): string | null {
  if (typeof t !== "string") return null
  const s = t.replace(/\s+/g, " ").trim()
  if (!s || /xrp|ripple/i.test(s)) return null
  return s.length > GROK_COACH_MAX_CHARS ? s.slice(0, GROK_COACH_MAX_CHARS - 1).replace(/\s+\S*$/, "") + "…" : s
}

interface Win {
  parent: Win | { postMessage: (m: unknown, o: string) => void }
  postMessage?: unknown
  addEventListener: (t: "message", f: (e: { source: unknown; data: unknown }) => void) => void
  removeEventListener: (t: "message", f: (e: { source: unknown; data: unknown }) => void) => void
}

let seq = 0

/** Resolves with Grok's text, or null on ANY problem. Never rejects and never throws. */
export function requestGrokCoach(ctx: GrokCoachContext, opts: { win?: Win; timeoutMs?: number } = {}): Promise<string | null> {
  const win = (opts.win ?? (typeof window !== "undefined" ? (window as unknown as Win) : undefined)) as Win | undefined
  try {
    if (!win || win.parent === (win as unknown) || !win.parent) return Promise.resolve(null) // not embedded: rule-based only
    const parent = win.parent as { postMessage: (m: unknown, o: string) => void }
    const id = `coach-${Date.now().toString(36)}-${++seq}`
    return new Promise<string | null>((resolve) => {
      let done = false
      const finish = (v: string | null) => {
        if (done) return
        done = true
        clearTimeout(timer)
        try { win.removeEventListener("message", onMsg) } catch { /* ignore */ }
        resolve(v)
      }
      const onMsg = (e: { source: unknown; data: unknown }) => {
        const d = e.data as { source?: string; type?: string; id?: string; ok?: boolean; text?: unknown } | null
        if (e.source !== parent || !d || d.source !== "xoe-host" || d.type !== "xoe:coach-reply" || d.id !== id) return
        finish(d.ok ? cleanGrokText(d.text) : null)
      }
      const timer = setTimeout(() => finish(null), opts.timeoutMs ?? GROK_COACH_TIMEOUT_MS)
      win.addEventListener("message", onMsg)
      try { parent.postMessage({ source: "xoe-game", type: "xoe:coach-request", id, context: ctx }, "*") } catch { finish(null) }
    })
  } catch {
    return Promise.resolve(null)
  }
}
