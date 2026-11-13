import type { XoeTip } from "../game/xoe-guide.ts"
import { XOE_SCRIPTED_LABEL } from "../game/xoe-guide.ts"

export function XoeGuidePanel({
  companionName,
  context,
  tips,
  open,
  reply,
  onToggle,
  onAsk,
  compact = false,
}: {
  companionName: string
  context: string
  tips: readonly XoeTip[]
  open: boolean
  reply: string | null
  onToggle: () => void
  onAsk: (tip: XoeTip) => void
  compact?: boolean
}) {
  return (
    <section className={`xoe-guide${compact ? " xoe-guide-compact" : ""}`} aria-label="XOE scripted guide">
      <button type="button" className="touch-btn" onClick={onToggle}>
        {open ? "Hide" : "Ask"} {companionName}
      </button>
      {!compact || open ? <p className="fine guide-label">{XOE_SCRIPTED_LABEL}</p> : null}
      {open ? (
        <div className="panel guide-drawer">
          <p className="bubble">{context}</p>
          {reply ? <p className="narration" role="status">{reply}</p> : null}
          <div className="choice-col" role="group" aria-label="Ask XOE">
            {tips.map((tip) => (
              <button key={tip.id} type="button" className="touch-btn" onClick={() => onAsk(tip)}>
                {tip.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
