import type { DialogueMode, SpeechSupport } from "../game/dialogue.ts"
import { presentDialogue } from "../game/dialogue.ts"
import { LINES } from "../game/content.ts"
import type { Phase } from "../game/opening.ts"
import { DialogueSpeaker } from "./DialogueSpeaker.tsx"

const STORY: Partial<Record<Phase, { title: string; line: (typeof LINES)[keyof typeof LINES] }>> = {
  wake: { title: "You wake in the battle", line: LINES.wake },
  "missing-pilot": { title: "Original pilot missing", line: LINES.missing },
  "auto-battle": { title: "Auto-battle is on", line: LINES.auto },
  "cockpit-invite": { title: "Zoe", line: LINES.zoeInvite },
  "near-loss": { title: "Near loss", line: LINES.near },
}

export function StoryView({
  phase,
  mode,
  speech,
  onContinue,
}: {
  phase: Phase
  mode: DialogueMode
  speech: SpeechSupport
  onContinue: () => void
}) {
  const story = STORY[phase]
  if (!story) return null
  const presentation = story.line.kind === "dialogue" ? presentDialogue(story.line.text, mode, speech) : null
  const shown = presentation ? presentation.text : story.line.text
  return (
    <article className="copy-block has-action-bar">
      <h1 tabIndex={-1}>{story.title}</h1>
      <p className="speaker">{story.line.speaker}</p>
      {shown ? <p className={story.line.kind === "dialogue" ? "bubble" : "narration"}>{shown}</p> : null}
      {phase === "near-loss" ? (
        <p className="fine">
          The ring around XOE is a staged picture for this beat. It does not detect a hit and it does not change damage.
        </p>
      ) : null}
      {presentation?.status ? <p role="status">{presentation.status}</p> : null}
      <DialogueSpeaker line={presentation?.speak ?? null} />
      {/* v18: sticky bottom bar so Continue is always on screen on a 659px-tall iPhone view. */}
      <div className="action-bar" data-action-bar="story">
        {phase === "wake" ? (
          <p className="next-cue" data-next-cue="1" aria-hidden="true">
            Tap Continue to start your story ▸
          </p>
        ) : null}
        <button type="button" className={`touch-btn primary${phase === "wake" ? " pulse-next" : ""}`} onClick={onContinue}>
          Continue
        </button>
      </div>
    </article>
  )
}
