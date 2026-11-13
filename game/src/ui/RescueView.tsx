import type { DialogueMode, SpeechSupport } from "../game/dialogue.ts"
import { presentDialogue } from "../game/dialogue.ts"
import { LINES } from "../game/content.ts"
import type { GameState } from "../game/opening.ts"
import { DialogueMenu, GrokStatus } from "./DialogueMenu.tsx"
import { DialogueSpeaker } from "./DialogueSpeaker.tsx"

export function RescueView({
  state,
  speech,
  onMode,
  onGrok,
  onDecline,
  onContinue,
}: {
  state: GameState
  speech: SpeechSupport
  onMode: (mode: DialogueMode) => void
  onGrok: () => void
  onDecline: () => void
  onContinue: () => void
}) {
  const line = presentDialogue(LINES.sis.text, state.dialogueMode, speech)
  return (
    <article className="copy-block has-action-bar">
      <h1 tabIndex={-1}>SIS</h1>
      <p className="narration">SIS breaks the drones, scoffs, and flies on. The opening rescue still happens.</p>
      <p className="speaker">SIS</p>
      <p className="fine">Draft example. Not a locked script.</p>
      {line.text ? <p className="bubble">{line.text}</p> : null}
      {line.status ? <p role="status">{line.status}</p> : null}
      <DialogueSpeaker line={line.speak} />
      <details className="dialogue-options">
        <summary>Dialogue options</summary>
        <DialogueMenu mode={state.dialogueMode} onMode={onMode} onGrok={onGrok} />
      </details>
      <GrokStatus open={state.grokOfferOpen} onDecline={onDecline} />
      <div className="action-bar" data-action-bar="rescue">
        <p className="next-cue" aria-hidden="true">
          Next: the Planet X terrace ▸
        </p>
        <button type="button" className="touch-btn primary" onClick={onContinue}>
          Enter the terrace
        </button>
      </div>
    </article>
  )
}
