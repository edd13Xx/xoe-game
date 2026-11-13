import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { FAQ_SECTIONS, faqQuestions } from "./faq.ts"
import { FLIGHT_FAQ } from "./lesson-copy.ts"
describe("grouped FAQ follow-up", () => {
 it("has 31 questions across eight topics plus the colony flight reference", () => {
  expect(FAQ_SECTIONS).toHaveLength(8)
  expect(FAQ_SECTIONS.flatMap(faqQuestions)).toHaveLength(16)
  expect(FLIGHT_FAQ).toHaveLength(15)
  for (const group of FAQ_SECTIONS) {
   const questions = faqQuestions(group)
   expect(questions.flatMap(q => q.lines)).toEqual(group.lines)
   for (const q of questions) { expect(q.question.endsWith("?")).toBe(true); expect(q.lines.length).toBeGreaterThan(0) }
  }
 })
 it("gives every topic and flight question its own Ask XOE action", () => {
  for (const component of ["FaqPanel", "FlightFAQ"]) {
   const src = readFileSync(new URL(`../ui/${component}.tsx`, import.meta.url), "utf8")
   expect(src).toContain("data-faq-question")
   expect(src).toContain("requestAskXoe(")
   expect(src).toContain("Ask XOE")
  }
 })
})
