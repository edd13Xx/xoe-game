import { useEffect, useRef } from "react"
import { VOICE_REMINDER_TEXT, setDontRemind } from "../game/voice-reminder.ts"
import { getLocalStore } from "../game/safe-storage.ts"

/** How long the reminder pill stays before it hides on its own. */
export const VOICE_REMINDER_AUTO_HIDE_MS = 12_000

/** v18.3: the reminder is a normal block in the page flow (not fixed), right under the header. */
export const VOICE_REMINDER_IN_FLOW = true

/**
 * v18.3 (QA fix 6): a slim bar in the page flow right under the header. It pushes the scene down
 * instead of floating over it, so it can never cover the wake-scene title or story text.
 * v18: a small top pill that never blocks play. The pill itself lets taps pass through
 * (pointer-events: none); only its two small buttons take taps. Hides on its own after 12s.
 */
export function VoiceReminderBanner({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    if (!open) return
    // The parent re-renders on every ticker step, so keep the timer tied to `open` only.
    const t = setTimeout(() => dismiss.current(), VOICE_REMINDER_AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [open])
  if (!open) return null
  return (
    <aside className="voice-reminder" role="status" data-voice-reminder="1" aria-label="Grok Bot voice reminder">
      <p>{VOICE_REMINDER_TEXT}</p>
      <span className="voice-reminder-actions">
        <button type="button" onClick={onDismiss}>
          Got it
        </button>
        <button
          type="button"
          onClick={() => {
            setDontRemind(getLocalStore(), true)
            onDismiss()
          }}
        >
          Don’t remind me
        </button>
      </span>
    </aside>
  )
}
