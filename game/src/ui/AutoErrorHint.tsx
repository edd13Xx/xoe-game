import { useEffect, useState } from "react"
import {
  detectScreen,
  grokAutoHintPrompt,
  subscribeErrorLog,
  type LoggedError,
  getRecentErrors,
} from "../game/error-log.ts"
import { canAttemptLiveGrok, type GrokConnectSettings } from "../game/grok-connect-settings.ts"
import { sendLiveXaiGrokMessage } from "../game/grok-guest.ts"

const GENERIC =
  "Something glitched. Try again, or open Report a problem to send Eddie the details."

export function AutoErrorHint({ grokConnect }: { grokConnect: GrokConnectSettings }) {
  const [entry, setEntry] = useState<LoggedError | null>(null)
  const [hint, setHint] = useState(GENERIC)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return subscribeErrorLog(() => {
      const latest = getRecentErrors()[0]
      if (!latest) return
      // avoid re-firing for the same timestamp
      setEntry((prev) => (prev && prev.at === latest.at ? prev : latest))
      setOpen(true)
      setHint(GENERIC)
    })
  }, [])

  useEffect(() => {
    if (!entry || !open) return
    let cancelled = false
    ;(async () => {
      if (!canAttemptLiveGrok(grokConnect)) return
      const live = await sendLiveXaiGrokMessage({
        text: grokAutoHintPrompt(entry, detectScreen()),
        apiKey: grokConnect.apiKey,
        endpoint: grokConnect.endpoint,
        model: grokConnect.model,
      })
      if (!cancelled && live.ok && live.reply) setHint(live.reply.trim())
    })()
    return () => {
      cancelled = true
    }
  }, [entry, open, grokConnect])

  if (!open || !entry) return null

  return (
    <div className="auto-error-hint" role="status">
      <p className="fine">
        <strong>Quick tip:</strong> {hint}
      </p>
      <p className="fine">
        {entry.name}: {entry.message}
      </p>
      <button type="button" className="touch-btn ghost" onClick={() => setOpen(false)}>
        Dismiss
      </button>
    </div>
  )
}
