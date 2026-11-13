/** First-start skippable tutorial. Device-only via safe storage. */

export const TUTORIAL_STORAGE_KEY = "xoe.tutorial.v1"

export interface TutorialProgress {
  completed: boolean
  step: number
}

export interface TutorialStep {
  id: string
  title: string
  body: string
}

/** Warm XOE voice — plain words, short sentences. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "welcome",
    title: "Hey — I’m XOE, Unknown Orbital Engine",
    body: "Welcome to XOE: Unknown Orbital Engine. I’ll keep this short. You can Skip anytime, or Replay later in Settings.",
  },
  {
    id: "fly",
    title: "How to fly",
    body: "Tap or click a spot — XO flies there. On phones there’s no joystick. On a computer, mouse click works the same and WASD / arrows still work. Near a colony bubble, tap Enter. In a lesson, tap/click the field to fly through the correct gate.",
  },
  {
    id: "lessons",
    title: "Lessons while you fly",
    body: "Arcade lessons teach as you move — fly the right gate, grab pickups for tips. No quiz pop-ups. Wrong gate? Try again. Testnet only.",
  },
  {
    id: "vault",
    title: "Cold vault & side missions",
    body: "Your vault is cold storage — attackers can’t break in from the network. That’s why they phish you or jab the mech link. Side missions may pop up: spot phishing yourself, or if it’s a remote hack I’ll take control in DANGER mode and smash the source.",
  },
  {
    id: "moons",
    title: "Moons and powers",
    body: "Later you pick Sol or Xelm. Sol’s Flare Dash is a timed burst. Xelm’s Frost Lock slows a threat. Both are optional practice tools — never required. Optional practice exam mixes colony gates before Ragnarok.",
  },
  {
    id: "paper",
    title: "XOE trading basics",
    body: "Practice buys and sells use the live XOE sim price while you fly. Nothing real moves. Scores stay on this device. Back up seeds offline on paper or metal. If someone asks for a seed phrase — that’s a hard no. We never ask for a real seed.",
  },
] as const

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem?: (k: string) => void
}

export function readTutorialProgress(store: Store | null): TutorialProgress {
  const fallback: TutorialProgress = { completed: false, step: 0 }
  if (!store) return fallback
  try {
    const raw = store.getItem(TUTORIAL_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<TutorialProgress>
    return {
      completed: parsed.completed === true,
      step: Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Number(parsed.step) || 0)),
    }
  } catch {
    return fallback
  }
}

export function writeTutorialProgress(store: Store | null, progress: TutorialProgress): boolean {
  if (!store) return false
  try {
    store.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        completed: progress.completed === true,
        step: Math.max(0, Math.floor(progress.step)),
      }),
    )
    return true
  } catch {
    return false
  }
}

export function shouldShowTutorial(store: Store | null): boolean {
  return !readTutorialProgress(store).completed
}

export function markTutorialComplete(store: Store | null): void {
  writeTutorialProgress(store, { completed: true, step: TUTORIAL_STEPS.length - 1 })
}

export function resetTutorialForReplay(store: Store | null): void {
  writeTutorialProgress(store, { completed: false, step: 0 })
}

export function nextTutorialStep(step: number): number | null {
  const n = step + 1
  if (n >= TUTORIAL_STEPS.length) return null
  return n
}
