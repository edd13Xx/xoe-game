/**
 * Backup AI — tiny in-browser retrieval over the bundled corpus.
 * Bag-of-words TF-IDF + cosine similarity, with fuzzy token matching for typos.
 * Keeps a short conversation memory. No network. No model download.
 */

import { COMPANION_CORPUS, type CorpusEntry } from "./companion-corpus.ts"
import { AI_BUILTIN_INDICATOR } from "./brand.ts"

/** v18.3: players see "Built-in AI" everywhere (header and "Answered by"), never "Backup AI". */
export const BACKUP_AI_LABEL = AI_BUILTIN_INDICATOR
export const BACKUP_FALLBACK_ANSWER =
  "XO: Hmm, I didn't quite catch that. Try Sol, Xelm, keys, seals, the market chart, controls, or what to do next — happy to help."

const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "am",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "me",
  "my",
  "you",
  "your",
  "do",
  "does",
  "did",
  "what",
  "who",
  "how",
  "when",
  "where",
  "why",
  "can",
  "could",
  "would",
  "should",
  "i",
  "it",
  "this",
  "that",
  "with",
  "about",
  "please",
  "tell",
])

export interface MemoryTurn {
  role: "pilot" | "xoe"
  text: string
}

export interface BackupMatch {
  entry: CorpusEntry
  score: number
}

export interface BackupReply {
  ok: true
  reply: string
  source: "backup-ai"
  matchedId: string | null
  score: number
  memorySize: number
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
}

/** Levenshtein distance — small strings only. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost)
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]!
  }
  return prev[b.length]!
}

/** Fuzzy token equality: exact, prefix, or small edit distance. */
export function tokensSimilar(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  const maxLen = Math.max(a.length, b.length)
  if (maxLen <= 2) return false
  const allowed = maxLen <= 5 ? 1 : 2
  return editDistance(a, b) <= allowed
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  return tf
}

type IndexedDoc = {
  entry: CorpusEntry
  tokens: string[]
  tf: Map<string, number>
}

function buildIndex(corpus: readonly CorpusEntry[]): { docs: IndexedDoc[]; idf: Map<string, number>; vocab: string[] } {
  const docs: IndexedDoc[] = corpus.map((entry) => {
    const tokens = tokenize(`${entry.title} ${entry.doc} ${entry.answer}`)
    return { entry, tokens, tf: termFreq(tokens) }
  })
  const df = new Map<string, number>()
  for (const doc of docs) {
    for (const term of new Set(doc.tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1)
    }
  }
  const n = docs.length
  const idf = new Map<string, number>()
  const vocab: string[] = []
  for (const [term, count] of df) {
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1)
    vocab.push(term)
  }
  return { docs, idf, vocab }
}

const INDEX = buildIndex(COMPANION_CORPUS)

function fuzzyExpand(queryTokens: string[], vocab: string[]): string[] {
  const expanded = new Set(queryTokens)
  for (const qt of queryTokens) {
    for (const term of vocab) {
      if (tokensSimilar(qt, term)) expanded.add(term)
    }
  }
  return [...expanded]
}

function vectorize(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = termFreq(tokens)
  const vec = new Map<string, number>()
  const len = tokens.length || 1
  for (const [term, count] of tf) {
    const weight = (count / len) * (idf.get(term) ?? 0)
    if (weight > 0) vec.set(term, weight)
  }
  return vec
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const [, v] of a) na += v * v
  for (const [, v] of b) nb += v * v
  if (na === 0 || nb === 0) return 0
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  for (const [term, v] of smaller) {
    const w = larger.get(term)
    if (w !== undefined) dot += v * w
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function rankCorpus(query: string, limit = 3): BackupMatch[] {
  const raw = tokenize(query)
  if (raw.length === 0) return []
  const expanded = fuzzyExpand(raw, INDEX.vocab)
  const qVec = vectorize(expanded, INDEX.idf)
  const scored: BackupMatch[] = INDEX.docs.map((doc) => ({
    entry: doc.entry,
    score: cosineSimilarity(qVec, vectorize(doc.tokens, INDEX.idf)),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

const MEMORY_LIMIT = 4
const SCORE_FLOOR = 0.08

export class BackupAI {
  private memory: MemoryTurn[] = []

  resetMemory(): void {
    this.memory = []
  }

  getMemory(): readonly MemoryTurn[] {
    return this.memory
  }

  ask(question: string): BackupReply {
    const trimmed = question.trim()
    const contextBoost = this.memory
      .slice(-2)
      .map((t) => t.text)
      .join(" ")
    const query = contextBoost ? `${contextBoost} ${trimmed}` : trimmed
    const ranked = rankCorpus(query, 3)
    const best = ranked[0]
    let reply = BACKUP_FALLBACK_ANSWER
    let matchedId: string | null = null
    let score = 0
    // v18.2: identity questions always get the XOE intro ("I'm XOE, Unknown Orbital Engine.")
    const identity = IDENTITY_QUESTION.test(trimmed) ? COMPANION_CORPUS.find((e) => e.id === "who-xoe") : undefined
    if (identity) {
      reply = identity.answer
      matchedId = identity.id
      score = 1
    } else if (best && best.score >= SCORE_FLOOR) {
      reply = best.entry.answer
      matchedId = best.entry.id
      score = best.score
      // Light memory cue: if prior turn asked about moons and this is vague, stay on moons.
      const prior = this.memory[this.memory.length - 1]
      if (prior && /moon|sol|xelm/i.test(prior.text) && best.score < 0.15) {
        const moonHit = ranked.find((m) => m.entry.id.startsWith("moon-"))
        if (moonHit && moonHit.score >= SCORE_FLOOR * 0.5) {
          reply = moonHit.entry.answer
          matchedId = moonHit.entry.id
          score = moonHit.score
        }
      }
    }
    this.memory.push({ role: "pilot", text: trimmed })
    this.memory.push({ role: "xoe", text: reply })
    if (this.memory.length > MEMORY_LIMIT * 2) {
      this.memory = this.memory.slice(-MEMORY_LIMIT * 2)
    }
    return {
      ok: true,
      reply,
      source: "backup-ai",
      matchedId,
      score,
      memorySize: this.memory.length,
    }
  }
}

export function createBackupAI(): BackupAI {
  return new BackupAI()
}

/** "who are you", "what are you", "your name", "are you Grok/an AI/a bot", "who is XO/XOE". */
export const IDENTITY_QUESTION =
  /\b(who|what)\s*(are|r)\s*(you|u|ya)\b|\byour name\b|\bare you (grok|an ai|a bot|ai|real|human)\b|\bwho(?:'s| is)\s+(xo|xoe)\b|\bwhat(?:'s| is)\s+(xo|xoe)\b|\bintroduce yourself\b/i
