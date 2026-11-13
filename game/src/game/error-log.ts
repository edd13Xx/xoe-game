/**
 * Ring buffer of recent client errors for "Report a problem".
 * Never stores API keys. Advice only — no code changes from Grok Bot.
 */

export const BUILD_VERSION = "uoe-2026-11-10-v19"

export interface LoggedError {
  at: number
  source: "boundary" | "window.onerror" | "unhandledrejection" | "manual"
  name: string
  message: string
  stack?: string
}

export interface ReportContext {
  buildVersion: string
  screen: string
  userAgent: string
  language: string
  viewport: string
  online: boolean
  storage: string
  grokEnabled: boolean
  hasKey: boolean
  note: string
  errors: LoggedError[]
}

const MAX = 20
const buffer: LoggedError[] = []
let installed = false
let listeners: Array<() => void> = []

export function redactSecrets(value: string): string {
  return value.replace(/(?:xai-|sk-)[A-Za-z0-9_-]{8,}/gi, (key) => key.toLowerCase().startsWith("xai-") ? "xai-[redacted]" : "sk-[redacted]")
    .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
    .replace(/\bS[A-Z2-7]{55}\b/g, "[redacted seed]")
}

function push(entry: LoggedError): void {
  const scrub = redactSecrets
  buffer.unshift({
    ...entry,
    name: scrub(entry.name || "Error"),
    message: scrub(entry.message || ""),
    stack: entry.stack ? scrub(entry.stack) : undefined,
  })
  if (buffer.length > MAX) buffer.length = MAX
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function logClientError(
  source: LoggedError["source"],
  error: unknown,
  fallbackMessage = "Unknown error",
): LoggedError {
  const err = error instanceof Error ? error : null
  const entry: LoggedError = {
    at: Date.now(),
    source,
    name: err?.name || (typeof error === "string" ? "Error" : "Error"),
    message: err?.message || (typeof error === "string" ? error : fallbackMessage),
    stack: err?.stack,
  }
  push(entry)
  return { ...entry, name: redactSecrets(entry.name), message: redactSecrets(entry.message), stack: entry.stack ? redactSecrets(entry.stack) : undefined }
}

export function getRecentErrors(): LoggedError[] {
  return buffer.slice()
}

export function clearErrorLog(): void {
  buffer.length = 0
}

export function subscribeErrorLog(fn: () => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((x) => x !== fn)
  }
}

export function installGlobalErrorHooks(): void {
  if (installed || typeof window === "undefined") return
  installed = true
  window.addEventListener("error", (event) => {
    logClientError("window.onerror", event.error || event.message || "window error")
  })
  window.addEventListener("unhandledrejection", (event) => {
    logClientError("unhandledrejection", event.reason || "unhandled rejection")
  })
}

export function detectScreen(): string {
  try {
    const menu = document.querySelector("[data-menu]")?.getAttribute("data-menu")
    if (menu) return `xoe-menu-${menu}`
    const phase = document.querySelector("[data-phase]")?.getAttribute("data-phase")
    if (phase) return phase
    if (document.querySelector(".pilot-select")) return "pilot-select"
    return document.title || "unknown"
  } catch {
    return "unknown"
  }
}

export function buildReportContext(input: {
  note?: string
  grokEnabled: boolean
  hasKey: boolean
  storageBackend?: string
}): ReportContext {
  let viewport = "?"
  let userAgent = "?"
  let language = "?"
  let online = false
  try {
    viewport = `${window.innerWidth}x${window.innerHeight}`
    userAgent = navigator.userAgent
    language = navigator.language
    online = navigator.onLine
  } catch {
    /* sandbox */
  }
  return {
    buildVersion: BUILD_VERSION,
    screen: detectScreen(),
    userAgent,
    language,
    viewport,
    online,
    storage: input.storageBackend || "unknown",
    grokEnabled: input.grokEnabled,
    hasKey: input.hasKey,
    note: redactSecrets(input.note || "").trim().slice(0, 500),
    errors: getRecentErrors(),
  }
}

export function templateBugReport(ctx: ReportContext): string {
  const lines = [
    "XOE: Unknown Orbital Engine — player bug report",
    `Build: ${ctx.buildVersion}`,
    `Screen: ${ctx.screen}`,
    `Viewport: ${ctx.viewport}`,
    `Online: ${ctx.online}`,
    `Storage: ${ctx.storage}`,
    `Grok Bot toggle: ${ctx.grokEnabled ? "ON" : "OFF"} (key present: ${ctx.hasKey ? "yes" : "no"})`,
    `Browser: ${ctx.userAgent}`,
    `Language: ${ctx.language}`,
    "",
    "Player note:",
    ctx.note || "(none)",
    "",
    "Recent errors:",
  ]
  if (ctx.errors.length === 0) lines.push("(none captured)")
  for (const e of ctx.errors.slice(0, 8)) {
    lines.push(`- [${new Date(e.at).toISOString()}] ${e.source} ${e.name}: ${e.message}`)
    if (e.stack) lines.push(`  ${e.stack.split("\n").slice(0, 2).join(" | ")}`)
  }
  lines.push("", "Grok Bot cannot modify game code — advice only.")
  return redactSecrets(lines.join("\n"))
}

/** Prompt for live Grok Bot: never include API keys. */
export function grokBugReportPrompt(ctx: ReportContext): string {
  return [
    "Write a short plain-English bug report for the game developer (Eddie).",
    "Be warm, clear, and specific. 6–12 short lines. No API keys. No secrets.",
    "Include likely cause and one practical next check if you can.",
    "",
    templateBugReport(ctx),
  ].join("\n")
}

export function grokAutoHintPrompt(entry: LoggedError, screen: string): string {
  return redactSecrets([
    "A player hit this error in XOE: Unknown Orbital Engine.",
    "In 1–2 short friendly lines, say the likely cause and a simple fix tip.",
    "No API keys. No code dumps. Advice only.",
    `Screen: ${screen}`,
    `Error: ${entry.name}: ${entry.message}`,
  ].join("\n"))
}
