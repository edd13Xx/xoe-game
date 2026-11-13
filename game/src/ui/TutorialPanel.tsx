import { useState } from "react"
import {
  TUTORIAL_STEPS,
  markTutorialComplete,
  nextTutorialStep,
  writeTutorialProgress,
} from "../game/tutorial.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { TutorialDemo } from "./TutorialDemo.tsx"
import { DrawerShell } from "./DrawerShell.tsx"

export function TutorialPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const current = TUTORIAL_STEPS[step] ?? TUTORIAL_STEPS[0]!
  const last = step >= TUTORIAL_STEPS.length - 1
  const showDemo = current.id === "fly"

  function finish() {
    markTutorialComplete(getLocalStore())
    onClose()
  }

  function skip() {
    finish()
  }

  function advance() {
    const n = nextTutorialStep(step)
    if (n === null) {
      finish()
      return
    }
    setStep(n)
    writeTutorialProgress(getLocalStore(), { completed: false, step: n })
  }

  return (
    <DrawerShell open={open} title="Tutorial" onClose={skip} labelledBy="drawer-tutorial-title">
      <section className="tutorial-panel" data-tutorial-step={current.id}>
        <p className="fine">XOE · step {step + 1} of {TUTORIAL_STEPS.length}</p>
        <h2>{current.title}</h2>
        <p className="narration">{current.body}</p>
        {showDemo ? <TutorialDemo active={true} /> : null}
        <div className="menu-row tutorial-actions">
          <button type="button" className="touch-btn ghost" onClick={skip}>
            Skip tutorial
          </button>
          <button type="button" className="touch-btn primary" onClick={advance}>
            {last ? "Got it — let’s fly" : "Next"}
          </button>
        </div>
      </section>
    </DrawerShell>
  )
}
