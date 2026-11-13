import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
}

describe("player-facing AI branding", () => {
  it("has no bare Grok labels in JSX text or user-facing string literals", () => {
    const stray: string[] = []
    for (const path of files("src").filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))) {
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
      const strings = [...source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g)].map((m) => m[2]!)
      const jsxText = [...source.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]!)
      for (const text of [...strings, ...jsxText]) {
        // This private model instruction is not a user-facing label.
        if (path.endsWith("/brand.ts") && /Never call yourself/.test(text)) continue
        if (/\bGrok\b(?! Bot\b)/.test(text)) stray.push(`${path}: ${text.slice(0, 100)}`)
      }
    }
    expect(stray).toEqual([])
  })
  it("has no old title in player-facing source strings", () => {
    const stray: string[] = []
    for (const path of files("src").filter(p => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))) {
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
      const strings = [...source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g)].map(m => m[2]!)
      const jsx = [...source.matchAll(/>([^<>{}]+)</g)].map(m => m[1]!)
      for (const text of [...strings, ...jsx]) if (/\bX[ -]+Orbital\b/i.test(text)) stray.push(`${path}: ${text.slice(0, 80)}`)
    }
    expect(stray).toEqual([])
  })

})
