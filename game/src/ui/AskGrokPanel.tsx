import { TestGrokButton } from "./TestGrokButton.tsx"
import { useCallback, useEffect, useState } from "react"
import { takeAskPrefill } from "../game/faq-nav.ts"
import {
  ASK_GROK_PANEL_TITLE,
  ASK_GROK_SUBTITLE,
  getCompanionBrain,
  type CompanionAskResult,
} from "../game/companion-brain.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import { DrawerShell } from "./DrawerShell.tsx"
import { GROK_BOT_MAX_CHARS, GROK_BOT_RELAY_ENABLED, readTesterCode } from "../game/grok-bot-relay.ts"

export function AskGrokPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CompanionAskResult | null>(null)
  // v18.3 (XOE-004): the FAQ / loss card can open Ask XOE with the topic already typed in
  useEffect(() => {
    if (!open) return
    const pre = takeAskPrefill()
    if (pre) {
      setDraft(pre)
      setResult(null)
    }
  }, [open])

  const onAsk = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const brain = getCompanionBrain()
    const next = await brain.ask(draft)
    setResult(next)
    if (next.ok && next.reply) void xoSpeak(next.reply)
    setBusy(false)
  }, [busy, draft])

  return (
    <DrawerShell open={open} title={ASK_GROK_PANEL_TITLE} onClose={onClose} labelledBy="drawer-ask-title">
      <section className="ask-grok-panel">
      {/* v18.2: live status + one-tap test instead of the old "offline practice" label (QA N2) */}
      <TestGrokButton compact />
      <p className="fine">{ASK_GROK_SUBTITLE}</p>
      <p className="fine">Grok Bot key, ON/OFF and Disconnect live in the XOE menu.</p>
      <label className="name-field">
        Ask XOE
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          maxLength={GROK_BOT_MAX_CHARS}
          placeholder="e.g. What is Sol? What about keys?"
          aria-label="Ask XOE question"
        />
      </label>
      <button type="button" className="touch-btn primary" onClick={() => void onAsk()} disabled={busy}>
        {busy ? "XOE is thinking…" : "Ask"}
      </button>
      {busy && GROK_BOT_RELAY_ENABLED && readTesterCode() ? <p className="fine" role="status">Keep flying. Grok Bot can take about a minute.</p> : null}
      {busy && !(GROK_BOT_RELAY_ENABLED && readTesterCode()) ? <p className="fine" role="status">XOE is thinking… live Grok Bot can take up to 45 seconds.</p> : null}
      {result ? (
        <div className="ask-grok-reply" role="status" data-brain={result.source}>
          <p className="status-line">{result.status}</p>
          <p className="bubble">{result.reply}</p>
          <p className="fine">Answered by: {result.label}</p>
        </div>
      ) : null}
    </section>
    </DrawerShell>
  )
}

