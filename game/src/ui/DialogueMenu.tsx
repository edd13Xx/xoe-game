import type { DialogueMode } from "../game/dialogue.ts"
import { GROK_STATUS } from "../game/dialogue.ts"

export function DialogueMenu({
  mode,
  onMode,
  onGrok,
}: {
  mode: DialogueMode
  onMode: (mode: DialogueMode) => void
  onGrok: () => void
}) {
  return (
    <div className="menu-row" role="group" aria-label="Dialogue menu">
      <button type="button" aria-pressed={mode === "bubble"} onClick={() => onMode("bubble")}>
        Bubble text on screen
      </button>
      <button type="button" aria-pressed={mode === "audio-only"} onClick={() => onMode("audio-only")}>
        Audio only, no dialogue text
      </button>
      <button type="button" onClick={onGrok}>
        Connect to Grok Bot
      </button>
    </div>
  )
}

export function GrokStatus({ open, onDecline }: { open: boolean; onDecline: () => void }) {
  if (!open) return null
  return (
    <div className="panel warn-panel grok-connect-card" role="region" aria-label="Grok Bot status">
      <p className="status-line">{GROK_STATUS}</p>
      <p className="fine">Paste your xAI key in the XOE menu (Pause). Until then XOE uses the built-in AI.</p>
      <button type="button" onClick={onDecline}>
        Decline Grok Bot
      </button>
    </div>
  )
}
