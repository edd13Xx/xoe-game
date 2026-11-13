/**
 * Grok Bot phone relay provider (v18).
 *
 * Build switch: VITE_XOE_RELAY_ENABLED=true and VITE_XOE_RELAY_BASE=<relay url>.
 * v18 builds point at http://127.0.0.1:18791 only (a local test relay); a public relay needs Eddie's OK.
 * Runtime: the relay is used only when Grok Bot is ON and a tester code is saved on this device.
 * The game never holds the Grok Bot webhook key. It only gets a ticket and polls for the answer.
 */
import { getLocalStore } from "./safe-storage.ts"

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void }

const env: Record<string, string | undefined> = import.meta.env ?? {}

export const GROK_BOT_RELAY_ENABLED: boolean = env.VITE_XOE_RELAY_ENABLED === "true"
export const GROK_BOT_RELAY_BASE: string = (env.VITE_XOE_RELAY_BASE ?? "").replace(/\/$/, "")
/** Public relay hosts need Eddie's approval, so non-local bases are refused unless a build opts in. */
const ALLOW_PUBLIC_BASE = false // Network lock: no public relays in v19.
export const GROK_BOT_SOURCE = "grok-bot" as const
export const GROK_BOT_MAX_CHARS = 300
export const GROK_BOT_TIMEOUT_MS = 180_000
export const GROK_BOT_POLL_MS = 4_000
export const GROK_BOT_TIMEOUT_REPLY = "XOE is thinking too long; using built-in AI."
export const GROK_BOT_BUSY_STATUS = "XOE's Grok Bot line is busy. Built-in AI is answering."
export const GROK_BOT_LABEL = "XOE: Grok Bot"

export const RELAY_TESTER_STORAGE_KEY = "xoe.relayTesterCode.v1"
export const DEVICE_ID_STORAGE_KEY = "xoe.deviceId.v1"

export function isLocalRelayBase(base: string): boolean {
  try {
    const u = new URL(base)
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")
  } catch {
    return false
  }
}

export function relayBaseAllowed(base: string, allowPublic = ALLOW_PUBLIC_BASE): boolean {
  if (!base) return false
  if (isLocalRelayBase(base)) return true
  void allowPublic
  return false
}

/**
 * v18.1: an https page (the public link) can never call an http://127.0.0.1 relay — Safari blocks it as
 * mixed content / local network. So a local relay base only counts on http: or file: pages.
 */
export function relayReachableFromPage(base: string, pageProtocol: string = pageProtocolNow()): boolean {
  if (!isLocalRelayBase(base)) return true
  return pageProtocol !== "https:"
}

function pageProtocolNow(): string {
  try {
    return typeof location !== "undefined" ? location.protocol : "file:"
  } catch {
    return "file:"
  }
}

export function readTesterCode(store: Store | null = getLocalStore()): string {
  try {
    return store?.getItem(RELAY_TESTER_STORAGE_KEY)?.trim() ?? ""
  } catch {
    return ""
  }
}

export function writeTesterCode(store: Store | null, code: string): void {
  try {
    const t = code.trim().slice(0, 64)
    if (t) store?.setItem(RELAY_TESTER_STORAGE_KEY, t)
    else store?.removeItem(RELAY_TESTER_STORAGE_KEY)
  } catch {
    /* storage blocked: relay just stays off */
  }
}

export function deviceId(store: Store | null = getLocalStore()): string {
  try {
    const saved = store?.getItem(DEVICE_ID_STORAGE_KEY)
    if (saved && /^[A-Za-z0-9-]{8,64}$/.test(saved)) return saved
    const id = `dev-${crypto.randomUUID()}`
    store?.setItem(DEVICE_ID_STORAGE_KEY, id)
    return id
  } catch {
    return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }
}

export type GrokBotRelayResult = {
  ok: boolean
  reply: string | null
  reason: "disabled" | "empty" | "ready" | "busy" | "timeout" | "error" | "unreachable"
  requestId: string | null
}

export interface RelayDeps {
  enabled?: boolean
  base?: string
  testerCode?: () => string
  device?: () => string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  timeoutMs?: number
}

const fail = (reason: GrokBotRelayResult["reason"], requestId: string | null = null): GrokBotRelayResult => ({
  ok: false,
  reply: null,
  reason,
  requestId,
})

export class GrokBotRelayProvider {
  private d: Required<RelayDeps>

  constructor(deps: RelayDeps = {}) {
    this.d = {
      enabled: deps.enabled ?? GROK_BOT_RELAY_ENABLED,
      base: (deps.base ?? GROK_BOT_RELAY_BASE).replace(/\/$/, ""),
      testerCode: deps.testerCode ?? (() => readTesterCode()),
      device: deps.device ?? (() => deviceId()),
      fetchImpl: deps.fetchImpl ?? ((...a) => fetch(...a)),
      sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      now: deps.now ?? Date.now,
      timeoutMs: deps.timeoutMs ?? GROK_BOT_TIMEOUT_MS,
    }
  }

  /** True when this build and device are set up to use the relay. */
  get enabled(): boolean {
    return this.d.enabled && relayBaseAllowed(this.d.base) && relayReachableFromPage(this.d.base) && this.d.testerCode().length > 0
  }

  async ask(question: string): Promise<GrokBotRelayResult> {
    const text = question.trim().slice(0, GROK_BOT_MAX_CHARS)
    if (!text) return fail("empty")
    if (!this.enabled) return fail("disabled")
    const { base, fetchImpl, sleep, now, timeoutMs } = this.d
    const started = now()
    let requestId: string
    let pollMs = GROK_BOT_POLL_MS
    try {
      const res = await fetchImpl(`${base}/v1/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, deviceId: this.d.device(), testerCode: this.d.testerCode() }),
      })
      const data = (await res.json().catch(() => null)) as { requestId?: unknown; pollMs?: unknown } | null
      if (res.status === 429 || res.status === 503) return fail("busy")
      if (!res.ok || typeof data?.requestId !== "string") return fail("error")
      requestId = data.requestId
      if (typeof data.pollMs === "number" && data.pollMs >= 2_000) pollMs = data.pollMs
    } catch {
      return fail("unreachable")
    }
    while (now() - started < timeoutMs) {
      await sleep(Math.min(pollMs, Math.max(0, timeoutMs - (now() - started))))
      try {
        const res = await fetchImpl(`${base}/v1/reply/${encodeURIComponent(requestId)}`)
        if (res.status === 429) continue
        const data = (await res.json().catch(() => null)) as { status?: unknown; reply?: unknown } | null
        if (data?.status === "done" && typeof data.reply === "string" && data.reply.trim()) {
          return { ok: true, reply: data.reply.trim(), reason: "ready", requestId }
        }
        if (data?.status === "timeout") return fail("timeout", requestId)
        if (data?.status === "error" || data?.status === "gone") return fail("error", requestId)
      } catch {
        return fail("unreachable", requestId)
      }
    }
    return fail("timeout", requestId)
  }
}

export function createGrokBotRelay(deps?: RelayDeps): GrokBotRelayProvider {
  return new GrokBotRelayProvider(deps)
}
