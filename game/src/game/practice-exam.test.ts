import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { COLONIES } from "./colonies.ts"
import {
  PRACTICE_EXAM_ID,
  buildPracticeExamLesson,
  recordPracticeExamBest,
  readPracticeExamBest,
} from "./practice-exam.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

describe("practice exam moon", () => {
  it("mixes gates from story colonies and records device best", () => {
    const lesson = buildPracticeExamLesson()
    expect(lesson.id).toBe(PRACTICE_EXAM_ID)
    expect(lesson.gates.length).toBeGreaterThanOrEqual(6)
    expect(lesson.gates.some((g) => g.ok)).toBe(true)
    expect(lesson.gates.some((g) => !g.ok)).toBe(true)
    // v18.3 (XOE-004): one short lesson line; the lesson screen shows "Testnet XOE · no real money" under it
    expect(lesson.lesson.split(/\s+/).length).toBeLessThanOrEqual(12)
    expect(readFileSync("src/ui/ColonyLessonView.tsx", "utf8")).toContain('<p className="fine lesson-safety">{XOE_SIM_SAFETY}</p>')
    expect(COLONIES.some((c) => c.id === PRACTICE_EXAM_ID)).toBe(false)
    const store = mem()
    recordPracticeExamBest(store, 120)
    recordPracticeExamBest(store, 90)
    expect(readPracticeExamBest(store)!.bestScore).toBe(120)
  })
})
