import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
describe("original cinematic cover", () => {
 it("uses a true close sphere, static atmospheric detail, original entity and XOE focus", () => {
  const src = readFileSync(new URL("./OrbitalCover.tsx", import.meta.url), "utf8")
  expect(src).toContain('viewBox="0 0 1200 760"')
  expect(src).toContain('cx="600" cy="1720" r="1340"')
  expect(src).toContain('data-cover-entity="original-reliquary"')
  expect(src).toContain("feDistantLight")
  expect(src).toContain('fontSize="126"')
  expect(src).not.toMatch(/https?:|<image|feGaussianBlur/)
 })
 it("keeps twinkle opacity-only and makes reduced motion static", () => {
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8")
  expect(css).toMatch(/@keyframes orbital-twinkle\s*\{[^}]*opacity/)
  expect(css).toContain('.orbital-cover .orbital-star, .orbital-cover .orbital-xo { animation: none !important; }')
 })
})
