/** Optional practice exam: mix gates from all story colonies before Ragnarok. Testnet XOE · no real money. */

import { COLONIES, type ArcadeGate, type ArcadePickup, type ColonyLesson } from "./colonies.ts"

export const PRACTICE_EXAM_ID = "practice-exam"
export const PRACTICE_EXAM_BEST_KEY = "xoe.practiceExamBest.v1"

export interface PracticeExamBest {
  bestScore: number
  atMs: number
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
}

/** Build a learn-while-flying exam from prior colony gates (ok + one trap each, capped). */
export function buildPracticeExamLesson(): ColonyLesson {
  const gates: ArcadeGate[] = []
  const pickups: ArcadePickup[] = []
  let lane = 0
  for (const colony of COLONIES) {
    const ok = colony.gates.find((g) => g.ok)
    const bad = colony.gates.find((g) => !g.ok)
    if (ok) {
      gates.push({
        label: `${shortName(colony.name)}: ${ok.label}`,
        ok: true,
        lane: lane % 3,
      })
      lane++
    }
    if (bad && gates.length < 12) {
      gates.push({
        label: `${shortName(colony.name)}: ${bad.label}`,
        ok: false,
        lane: lane % 3,
      })
      lane++
    }
    if (pickups.length < 4 && colony.pickups[0]) {
      pickups.push({
        label: colony.pickups[0].label,
        lane: pickups.length % 3,
        xoeLine: colony.pickups[0].xoeLine,
      })
    }
  }
  // Exam clears by flying ANY correct gate once (arcade-fly-gate style) — but we want
  // multi-gate progress. For simplicity: one "wave" of mixed gates; flying a correct
  // gate clears the exam (same as colony). Multiple correct labels teach the mix.
  return {
    id: PRACTICE_EXAM_ID,
    name: "Practice Exam Moon",
    lesson: "Optional warm-up: gates mix lessons from every colony you cleared.",
    question: "Which move matches what you practiced?",
    choices: gates.slice(0, 3).map((g) => ({ text: g.label, ok: g.ok })),
    gates: gates.slice(0, 9),
    pickups,
    teach: "Exam clear. Review any colony you missed — still Testnet XOE · no real money.",
  }
}

function shortName(name: string): string {
  return name.replace(/^Colony\s+/i, "")
}

export function readPracticeExamBest(store: Store | null): PracticeExamBest | null {
  if (!store) return null
  try {
    const raw = store.getItem(PRACTICE_EXAM_BEST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PracticeExamBest>
    if (typeof parsed.bestScore !== "number") return null
    return { bestScore: Math.max(0, Math.floor(parsed.bestScore)), atMs: parsed.atMs ?? 0 }
  } catch {
    return null
  }
}

export function recordPracticeExamBest(store: Store | null, score: number): PracticeExamBest {
  const clean = Math.max(0, Math.floor(score))
  const prev = readPracticeExamBest(store)
  const next: PracticeExamBest = {
    bestScore: prev ? Math.max(prev.bestScore, clean) : clean,
    atMs: Date.now(),
  }
  if (store && clean > 0) {
    try {
      store.setItem(PRACTICE_EXAM_BEST_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return next
}
