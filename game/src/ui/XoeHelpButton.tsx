import { useId, useState } from "react"
import { requestAskXoe } from "../game/faq-nav.ts"
import { helpPrefill, tipsForHelp, type HelpContextId } from "../game/xoe-help.ts"

/** Compact 48px XOE help control for the play chrome. Uses Ask XOE (live Grok Bot or built-in). */
export function XoeHelpButton({
  context,
  colonyId = null,
}: {
  context: HelpContextId
  colonyId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const tips = tipsForHelp(context, colonyId)
  const panelId = useId()

  return (
    <div className="xoe-help">
      <button
        type="button"
        className="touch-btn xoe-help-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="XOE help"
        onClick={() => setOpen((v) => !v)}
      >
        XOE
      </button>
      {open ? (
        <div id={panelId} className="xoe-help-panel panel" role="dialog" aria-label="XOE help">
          <p className="fine">I'm XOE, Unknown Orbital Engine. Short hints for this screen — or ask me.</p>
          <div className="choice-col" role="group" aria-label="XOE hints">
            {tips.map((tip) => (
              <p key={tip.id} className="xoe-help-tip">
                <strong>{tip.label}.</strong> {tip.reply}
              </p>
            ))}
          </div>
          <button
            type="button"
            className="touch-btn primary"
            onClick={() => {
              setOpen(false)
              requestAskXoe(helpPrefill(context))
            }}
          >
            Ask XOE
          </button>
        </div>
      ) : null}
    </div>
  )
}
