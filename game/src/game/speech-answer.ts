/**
 * Parse spoken multiple-choice answers.
 * Accepts A/B/C/D, "option A", ay/bee/see/dee, or fuzzy option words.
 */

export interface SpeechChoice {
  /** 0-based index */
  index: number
  /** Letter label A/B/C/D… */
  letter: string
  /** Visible option text */
  text: string
}

const LETTER_WORDS: Record<string, string> = {
  a: "a",
  ay: "a",
  ey: "a",
  hey: "a",
  b: "b",
  be: "b",
  bee: "b",
  bea: "b",
  c: "c",
  see: "c",
  sea: "c",
  si: "c",
  d: "d",
  dee: "d",
  de: "d",
  e: "e",
  ee: "e",
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean)
}

/** Edit distance for short fuzzy match. */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

export function letterForIndex(index: number): string {
  return String.fromCharCode(65 + index)
}

export function choicesFromTexts(texts: readonly string[]): SpeechChoice[] {
  return texts.map((text, index) => ({
    index,
    letter: letterForIndex(index),
    text,
  }))
}

export interface ParseSpeechResult {
  matchedIndex: number | null
  heard: string
  confidence: "letter" | "option-word" | "fuzzy" | "none"
  confirm: string
}

/**
 * Match transcript against choices.
 * Priority: letter / option letter phrases → exact-ish option words → fuzzy.
 */
export function parseSpokenAnswer(transcript: string, choices: readonly SpeechChoice[]): ParseSpeechResult {
  const heard = transcript.trim()
  const norm = normalize(heard)
  const toks = tokens(heard)
  if (!norm || choices.length === 0) {
    return { matchedIndex: null, heard, confidence: "none", confirm: "XO: I didn’t catch a choice." }
  }

  // Letter forms: "a", "option a", "option ay", "ay", "bee"
  for (const tok of toks) {
    const mapped = LETTER_WORDS[tok]
    if (mapped) {
      const idx = mapped.charCodeAt(0) - 97
      if (idx >= 0 && idx < choices.length) {
        return {
          matchedIndex: idx,
          heard,
          confidence: "letter",
          confirm: `XO: Heard ${choices[idx]!.letter} — ${choices[idx]!.text}`,
        }
      }
    }
  }
  const optionLetter = norm.match(/\b(?:option|choice|answer|pick|select)\s+([a-e]|ay|bee|see|sea|dee)\b/)
  if (optionLetter) {
    const raw = optionLetter[1]!
    const mapped = LETTER_WORDS[raw] ?? raw
    const idx = mapped.charCodeAt(0) - 97
    if (idx >= 0 && idx < choices.length) {
      return {
        matchedIndex: idx,
        heard,
        confidence: "letter",
        confirm: `XO: Heard ${choices[idx]!.letter} — ${choices[idx]!.text}`,
      }
    }
  }

  // Option words: transcript contains distinctive words from an option
  let best: { index: number; score: number; kind: "option-word" | "fuzzy" } | null = null
  for (const choice of choices) {
    const cNorm = normalize(choice.text)
    if (!cNorm) continue
    if (norm === cNorm || norm.includes(cNorm) || cNorm.includes(norm)) {
      return {
        matchedIndex: choice.index,
        heard,
        confidence: "option-word",
        confirm: `XO: Heard ${choice.letter} — ${choice.text}`,
      }
    }
    const cToks = tokens(choice.text).filter((t) => t.length > 2)
    const hit = cToks.filter((t) => toks.includes(t) || toks.some((x) => editDistance(x, t) <= 1))
    const score = hit.length / Math.max(1, cToks.length)
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { index: choice.index, score, kind: score >= 0.8 ? "option-word" : "fuzzy" }
    }
    // whole-string fuzzy
    const dist = editDistance(norm, cNorm)
    if (dist <= Math.max(2, Math.floor(cNorm.length * 0.25))) {
      const fuzzyScore = 1 - dist / Math.max(1, cNorm.length)
      if (!best || fuzzyScore > best.score) best = { index: choice.index, score: fuzzyScore, kind: "fuzzy" }
    }
  }
  if (best) {
    const choice = choices[best.index]!
    return {
      matchedIndex: best.index,
      heard,
      confidence: best.kind,
      confirm: `XO: Heard ${choice.letter} — ${choice.text}`,
    }
  }
  return { matchedIndex: null, heard, confidence: "none", confirm: `XO: Heard “${heard}” — tap or say A, B, C…` }
}
