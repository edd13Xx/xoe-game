import { useEffect, useRef, useState } from "react"
import type { PracticeState } from "../game/practice.ts"
import {
  EMPTY_TRACKER,
  LEARN_MORE,
  addFeesSoFar,
  breakdown,
  detailLines,
  grokTipPrompt,
  resultLines,
  resultTip,
  trackDesk,
  validateGrokTip,
  type ClosedTrade,
  type TradeTip,
} from "../game/trade-result.ts"
import { faqSection } from "../game/faq.ts"
import { requestAskXoe, requestOpenFaq } from "../game/faq-nav.ts"
import { canAttemptLiveGrok, readGrokConnectSettings } from "../game/grok-connect-settings.ts"
import { sendLiveXaiGrokMessage } from "../game/grok-guest.ts"
import { getLocalStore } from "../game/safe-storage.ts"

/** Grok Bot gets this long to reword; the built-in line is already on screen, so nothing waits. */
export const GROK_TIP_TIMEOUT_MS = 8000

interface Shown {
  id: number
  trade: ClosedTrade
  tip: TradeTip
  text: string
  source: "built-in" | "grok"
  /** Running total of fees paid so far (cents), stored under FEES_SO_FAR_KEY. */
  feesSoFarCents: number
}

/**
 * v18.3 (XOE-004): result card after a sim trade CLOSES. Nothing shows while a trade is open.
 * Collapsed = exactly 2 lines (net result + one tip, win or loss). "Details" opens the exact breakdown,
 * including "Fees so far" (device-local running total, key xoe.feesSoFar.v1).
 */
export function TradeResultCard({ desk, compact = false }: { desk: PracticeState; compact?: boolean }) {
  const prev = useRef(desk)
  const tracker = useRef(EMPTY_TRACKER)
  const seq = useRef(0)
  const [shown, setShown] = useState<Shown | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const p = prev.current
    prev.current = desk
    if (p === desk) return
    const r = trackDesk(tracker.current, p, desk)
    tracker.current = r.tracker
    if (r.tracker.lots > 0 && !r.closed) {
      // A trade is open: no card, no tip, no warning.
      setShown(null)
      return
    }
    if (!r.closed) return
    const tip = resultTip(r.closed)
    const feesSoFarCents = addFeesSoFar(getLocalStore(), r.closed)
    seq.current += 1
    const id = seq.current
    setOpen(false)
    setShown({ id, trade: r.closed, tip, text: tip.text, source: "built-in", feesSoFarCents })
    const settings = readGrokConnectSettings(getLocalStore())
    if (!canAttemptLiveGrok(settings)) return
    void sendLiveXaiGrokMessage({
      text: grokTipPrompt(tip),
      apiKey: settings.apiKey,
      endpoint: settings.endpoint,
      model: settings.model,
      timeoutMs: GROK_TIP_TIMEOUT_MS,
    })
      .then((res) => {
        const ok = res.ok ? validateGrokTip(res.reply, tip) : null
        if (ok) setShown((cur) => (cur && cur.id === id ? { ...cur, text: ok, source: "grok" } : cur))
      })
      .catch(() => {})
  }, [desk])

  if (!shown) return null
  const tipForLines = { ...shown.tip, text: shown.text }
  const [head, line2] = resultLines(shown.trade, tipForLines)
  const tipBody = line2.slice(0, -LEARN_MORE.length).trim()
  const loss = breakdown(shown.trade).netCents < 0
  return (
    <aside
      className={`trade-result${loss ? " loss" : " win"}${compact ? " compact" : ""}`}
      role="status"
      aria-label="Trade result"
      data-trade-result="1"
      data-expanded={open ? "1" : "0"}
      data-cause={shown.tip.cause}
      data-tip-source={shown.source}
      data-faq-target={shown.tip.faq}
    >
      <div className="trade-result-row">
        <p className="trade-result-line trade-result-head" data-line="1">{head}</p>
        <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Details"}
        </button>
        <button type="button" className="link-btn" data-tip-ask="1" onClick={() => requestAskXoe(`${faqSection(shown.tip.faq).ask} My trade: ${head}.`)}>
          Ask XOE
        </button>
        <button type="button" className="link-btn trade-result-close" aria-label="Close trade result" onClick={() => setShown(null)}>
          ✕
        </button>
      </div>
      <p className="trade-result-line trade-result-tip" data-line="2">
        {tipBody}{" "}
        <button type="button" className="link-btn inline" data-tip-learn={shown.tip.faq} onClick={() => requestOpenFaq(shown.tip.faq)}>
          {LEARN_MORE}
        </button>
      </p>
      {open ? (
        <ul className="trade-result-details" data-trade-details="1">
          {detailLines(shown.trade, shown.feesSoFarCents).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  )
}
