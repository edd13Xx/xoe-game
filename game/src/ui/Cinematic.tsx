import { CINEMATIC_PANELS } from "../game/opening.ts"

const CAPTIONS = [
  "Orbital dawn. Neon drones cut across a pale ring, and XO holds the light.",
  "XO answers on her own. The purple guide comes alive in the cockpit.",
  "A hand signals the open canopy. Night-Mars waits beyond the grid.",
]

export function CinematicChoice({ onPlay, onSkip }: { onPlay: () => void; onSkip: () => void }) {
  return (
    <article className="copy-block cine-copy has-action-bar">
      <h1 tabIndex={-1}>Optional cinematic</h1>
      <p className="narration">A short in-engine sequence can play. Skip it whenever you want.</p>
      <div className="menu-row action-bar" data-action-bar="cinematic">
        <button type="button" onClick={onPlay}>
          Play cinematic
        </button>
        <button type="button" onClick={onSkip}>
          Skip cinematic
        </button>
      </div>
    </article>
  )
}

export function CinematicPlayer({
  index,
  reducedMotion,
  onNext,
  onSkip,
}: {
  index: number
  reducedMotion: boolean
  onNext: () => void
  onSkip: () => void
}) {
  const caption = CAPTIONS[index] ?? CAPTIONS[0]
  return (
    <article className="copy-block cine-copy has-action-bar">
      <h1 tabIndex={-1}>Cinematic</h1>
      <p className="fine">
        Panel {index + 1} of {CINEMATIC_PANELS}.
        {reducedMotion ? " Reduced motion: the panel stays still." : ""}
      </p>
      <p className="narration">{caption}</p>
      <div className="menu-row action-bar" data-action-bar="cinematic">
        <button type="button" onClick={onNext}>
          Next panel
        </button>
        <button type="button" onClick={onSkip}>
          Skip cinematic
        </button>
      </div>
    </article>
  )
}
