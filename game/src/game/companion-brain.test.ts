import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import {
  BackupAI,
  BACKUP_FALLBACK_ANSWER,
  cosineSimilarity,
  createBackupAI,
  editDistance,
  rankCorpus,
  tokensSimilar,
} from "./backup-ai.ts"
import {
  CompanionBrainRouter,
  createCompanionBrain,
  GROK_UNAVAILABLE_BACKUP_STATUS,
  describeGrokHudStatus,
  GROK_HUD_BUILTIN,
  GROK_HUD_LIVE,
} from "./companion-brain.ts"
import { COMPANION_CARD_CLASS_DISPLAY, COMPANION_CLASS_DISPLAY, COMPANION_CLASS_INTERNAL, displayCompanionCardClass, displayCompanionClass } from "./companion-display.ts"
import { COMPANION_CORPUS } from "./companion-corpus.ts"
import { LOCAL_GROK_HOOK_ENABLED, LOCAL_GROK_ENDPOINT, GROK_OFFLINE_PRACTICE_LABEL, createGrokLocalHook } from "./grok-local-hook.ts"
import { spokenForm } from "./sis-speech.ts"

describe("companion class display", () => {
  // v18.2 (Eddie): XO is a state-of-the-art unknown orbital; her class shows as CLASSIFIED everywhere.
  it("keeps Sentinel internally; card and header show CLASSIFIED", () => {
    expect(COMPANION_CLASS_INTERNAL).toBe("Sentinel")
    expect(COMPANION_CARD_CLASS_DISPLAY).toBe("CLASSIFIED")
    expect(COMPANION_CLASS_DISPLAY).toBe("CLASSIFIED")
    expect(displayCompanionCardClass("Sentinel")).toBe("CLASSIFIED")
    expect(displayCompanionClass("Sentinel")).toBe("CLASSIFIED")
    expect(displayCompanionClass(null)).toBe("CLASSIFIED")
  })

  it("shows the CLASSIFIED class line on the companion card", () => {
    const menu = readFileSync("src/ui/PilotMenu.tsx", "utf8")
    expect(menu).toContain("displayCompanionCardClass")
    expect(menu).toContain("{XO_CLASS_LINE}")
    const display = readFileSync("src/game/companion-display.ts", "utf8")
    expect(display).toContain("displayCompanionClass")
    expect(display).toContain("Class: CLASSIFIED — Unknown Orbital · state of the art")
  })
})

describe("SIS speech", () => {
  it("speaks SIS as separate letters while leaving the display form available", () => {
    expect(spokenForm("SIS rescued you")).toBe("S. I. S. rescued you")
    expect(spokenForm("Talk to SIS and SIS again")).toBe("Talk to S. I. S. and S. I. S. again")
    expect(spokenForm("No match")).toBe("No match")
  })
})

describe("Backup AI similarity", () => {
  it("ranks Sol and Xelm questions to the right corpus entries", () => {
    const sol = rankCorpus("Tell me about the fiery moon Sol")
    expect(sol[0]?.entry.id).toMatch(/sol|moon/)
    expect(sol[0]!.score).toBeGreaterThan(0.1)

    const xelm = rankCorpus("What is Xelm and the cold keys?")
    expect(xelm[0]?.entry.id).toMatch(/xelm|moon|keys/)
    expect(xelm[0]!.score).toBeGreaterThan(0.08)
  })

  it("fuzzy-matches typos via edit distance / token similarity", () => {
    expect(editDistance("sol", "sol")).toBe(0)
    expect(editDistance("xelm", "xelmm")).toBe(1)
    expect(tokensSimilar("xelm", "xelmm")).toBe(true)
    expect(tokensSimilar("sol", "zzz")).toBe(false)

    const typo = rankCorpus("whaat is xeelm moon")
    expect(typo.length).toBeGreaterThan(0)
    expect(typo[0]!.score).toBeGreaterThan(0)
  })

  it("answers known topics and falls back when nothing matches", async () => {
    const ai = createBackupAI()
    const keys = ai.ask("How do private keys work?")
    expect(keys.ok).toBe(true)
    expect(keys.source).toBe("backup-ai")
    expect(keys.reply).toMatch(/key/i)
    expect(keys.matchedId).toBeTruthy()

    const marketAi = createBackupAI()
    const market = marketAi.ask("Is the XLM chart financial advice?")
    expect(market.reply).toMatch(/learning|not financial advice/i)

    const missAi = createBackupAI()
    const miss = missAi.ask("zzzz qqqq xyzzy plugh")
    expect(miss.reply).toBe(BACKUP_FALLBACK_ANSWER)
    expect(miss.matchedId).toBeNull()
  })

  it("keeps short conversation memory across turns", () => {
    const ai = new BackupAI()
    ai.ask("Tell me about Sol")
    expect(ai.getMemory().length).toBeGreaterThanOrEqual(2)
    ai.ask("and the other moon?")
    expect(ai.getMemory().length).toBeGreaterThanOrEqual(4)
    ai.resetMemory()
    expect(ai.getMemory()).toEqual([])
  })

  it("computes cosine similarity for simple vectors", () => {
    const a = new Map([
      ["sol", 1],
      ["moon", 1],
    ])
    const b = new Map([
      ["sol", 1],
      ["moon", 1],
    ])
    const c = new Map([["keys", 1]])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5)
    expect(cosineSimilarity(a, c)).toBe(0)
  })
})

describe("CompanionBrain provider chain", () => {
  it("keeps the Grok Bot local hook disabled with no endpoint and no fetch in source", () => {
    expect(LOCAL_GROK_HOOK_ENABLED).toBe(false)
    expect(LOCAL_GROK_ENDPOINT).toBe("")
    const hookSrc = readFileSync("src/game/grok-local-hook.ts", "utf8")
    expect(hookSrc).not.toMatch(/fetch\s*\(/)
    expect(hookSrc).not.toMatch(/XMLHttpRequest/)
    expect(hookSrc).not.toMatch(/\bWebSocket\b/)
    const brainSrc = readFileSync("src/game/companion-brain.ts", "utf8")
    expect(brainSrc).not.toMatch(/fetch\s*\(/)
    const backupSrc = readFileSync("src/game/backup-ai.ts", "utf8")
    expect(backupSrc).not.toMatch(/fetch\s*\(/)
  })

  it("falls back to Backup AI when Grok Bot hook is unavailable", async () => {
    const brain = createCompanionBrain()
    expect(brain.grokHookEnabled).toBe(false)
    const result = await brain.ask("What is Sol?")
    expect(result.ok).toBe(true)
    expect(result.source).toBe("backup-ai")
    expect(result.status).toBe(GROK_UNAVAILABLE_BACKUP_STATUS)
    expect(result.status).toMatch(/built-in AI/i)
    // v18.3 (QA fix 4): the footer reads "Answered by: Built-in AI", same as the header label
    expect(result.label).toBe("Built-in AI")
    expect(result.label).not.toMatch(/Backup AI/)
    expect(result.reply).toMatch(/Sol|XOE/i)
  })

  it("never calls fetch while answering offline", async () => {
    const fetchSpy = vi.fn()
    const original = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      const brain = new CompanionBrainRouter(createGrokLocalHook(), createBackupAI())
      await brain.ask("Tell me about Xelm keys and seals")
      await brain.ask("controls")
      await brain.ask("")
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = original
    }
  })

  // v18.2 (QA N2): the Ask XOE panel shows the live status + Test Grok Bot, not "offline practice"
  it("shows the live status indicator in the Ask panel source", () => {
    const panel = readFileSync("src/ui/AskGrokPanel.tsx", "utf8")
    expect(panel).not.toContain("GROK_OFFLINE_PRACTICE_LABEL")
    expect(panel).toContain("TestGrokButton")
    expect(panel).toContain("getCompanionBrain")
    expect(panel).toContain("result.status")
    expect(panel).toContain("result.label")
    expect(COMPANION_CORPUS.length).toBeGreaterThanOrEqual(10)
    expect(GROK_OFFLINE_PRACTICE_LABEL).toBe("Grok Bot (offline practice)")
  })
})


describe("Connect to Grok Bot on-demand", () => {
  it("uses built-in AI with no key and never fetches", async () => {
    const fetchSpy = vi.fn()
    const original = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      const brain = createCompanionBrain(() => ({
        enabled: true,
        apiKey: "",
        endpoint: "https://example.invalid/v1",
        model: "grok-3",
      }))
      const result = await brain.ask("What is Sol?")
      expect(result.source).toBe("backup-ai")
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = original
    }
  })

  it("uses live reply when Connect is ON with a key; falls back on error without calling real xAI", async () => {
    const liveOk = vi.fn(async () => ({ ok: true, reply: "Live XO reply", status: "ok" }))
    const brain = createCompanionBrain(
      () => ({
        enabled: true,
        apiKey: "xai-test",
        endpoint: "https://example.invalid/v1",
        model: "grok-3",
      }),
      liveOk as never,
    )
    const ok = await brain.ask("Hello")
    expect(liveOk).toHaveBeenCalledOnce()
    expect(ok.source).toBe("grok-live")
    expect(ok.reply).toBe("Live XO reply")

    const liveFail = vi.fn(async () => ({ ok: false, reply: null, status: "fail" }))
    const brain2 = createCompanionBrain(
      () => ({
        enabled: true,
        apiKey: "xai-test",
        endpoint: "https://example.invalid/v1",
        model: "grok-3",
      }),
      liveFail as never,
    )
    const fallback = await brain2.ask("What is Sol?")
    expect(fallback.source).toBe("backup-ai")
    expect(fallback.status).toMatch(/built-in AI|Backup AI/i)
  })

  it("describes Grok Bot HUD status from Connect settings", () => {
    expect(
      describeGrokHudStatus({ enabled: false, apiKey: "", endpoint: "https://api.x.ai/v1/chat/completions", model: "grok-3" }),
    ).toBe(GROK_HUD_BUILTIN)
    expect(
      describeGrokHudStatus({ enabled: true, apiKey: "", endpoint: "https://api.x.ai/v1/chat/completions", model: "grok-3" }),
    ).toBe(GROK_HUD_BUILTIN)
    expect(
      describeGrokHudStatus({ enabled: true, apiKey: "xai-test", endpoint: "https://api.x.ai/v1/chat/completions", model: "grok-3" }),
    ).toBe(GROK_HUD_LIVE)
    expect(
      describeGrokHudStatus({ enabled: false, apiKey: "xai-test", endpoint: "https://api.x.ai/v1/chat/completions", model: "grok-3" }),
    ).toBe(GROK_HUD_BUILTIN)
  })

  it("ships Grok Bot settings UI in Settings and Ask panel", () => {
    const settings = readFileSync("src/ui/GrokConnectSettings.tsx", "utf8")
    expect(settings).toContain("Grok Bot settings")
    expect(settings).toContain("Disconnect")
    expect(settings).toContain('Grok Bot {settings.enabled ? "ON" : "OFF"}')
    expect(settings).toContain("GROK_CONNECT_WARNING")
    const panel = readFileSync("src/ui/AskGrokPanel.tsx", "utf8")
    expect(panel).not.toContain("GrokConnectSettingsPanel")
    const app = readFileSync("src/App.tsx", "utf8")
    expect(app).toContain("HEADER_SUBTITLE_GROK")
    expect(app).toContain("showGrokKeyBox")
    const menu = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    expect(menu).toContain("GrokFirstRunPanel")
    expect(menu).toContain("GrokConnectSettingsPanel")
    expect(menu).toContain("GrokHudControls")
    const first = readFileSync("src/ui/GrokFirstRunPanel.tsx", "utf8")
    expect(first).toContain("console.x.ai")
    expect(first).toContain("Skip for now")
  })
})
