import { getLocalStore, getSessionStore, type KvStore } from "./safe-storage.ts"
import { cancelGrokRequests } from "./grok-requests.ts"
/**
 * Grok Bot access defaults ON. Players paste their own xAI key.
 * Toggle OFF = stop all xAI calls, keep key. Disconnect = delete key → built-in AI.
 * Key lives only on this device (safe storage / memory fallback). Never bundled.
 */

export const GROK_CONNECT_STORAGE_KEY = "xoe.grokConnect.v1"
export const GROK_FIRST_RUN_STORAGE_KEY = "xoe.grokFirstRun.v1"
export const XAI_CONSOLE_URL = ["https", "://", "console.x.ai"].join("")

function absoluteUrl(hostAndPath: string): string {
  return ["https", "://", hostAndPath].join("")
}

export const DEFAULT_GROK_ENDPOINT = absoluteUrl("api.x.ai/v1/chat/completions")
export const DEFAULT_GROK_MODEL = "grok-4.7"

export const GROK_CONNECT_WARNING =
  "Grok Bot defaults ON. Paste your own xAI key for live replies. Toggle off to pause xAI calls (keeps key). Disconnect deletes the key."

export interface GrokConnectSettings {
  enabled: boolean
  apiKey: string
  endpoint: string
  model: string
  remember?: boolean
  storageError?: string
}

export const DEFAULT_GROK_CONNECT: GrokConnectSettings = {
  enabled: true,
  apiKey: "",
  endpoint: DEFAULT_GROK_ENDPOINT,
  model: DEFAULT_GROK_MODEL,
  remember: false,
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem: (k: string) => void
}

export const GROK_SESSION_KEY = "xoe.grokSessionKey.v1"
const testSessions = new WeakMap<Store, KvStore>()
const revoked = new WeakSet<Store>()
function sessionFor(store: Store): KvStore {
  if (store === getLocalStore()) return getSessionStore()
  let session = testSessions.get(store)
  if (!session) {
    const m = new Map<string, string>()
    session = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) }, removeItem: (k) => { m.delete(k) } }
    testSessions.set(store, session)
  }
  return session
}

export function readGrokConnectSettings(store: Store | null): GrokConnectSettings {
  if (!store || revoked.has(store)) return { ...DEFAULT_GROK_CONNECT }
  try {
    const parsed = JSON.parse(store.getItem(GROK_CONNECT_STORAGE_KEY) || "{}") as Partial<GrokConnectSettings>
    const remember = parsed.remember === true
    const session = sessionFor(store)
    // Migrate old, implicitly persistent keys into this session, without treating history as consent.
    if (!remember && typeof parsed.apiKey === "string" && parsed.apiKey) {
      session.setItem(GROK_SESSION_KEY, parsed.apiKey)
      store.setItem(GROK_CONNECT_STORAGE_KEY, JSON.stringify({ ...parsed, apiKey: "", remember: false }))
    }
    return {
      enabled: parsed.enabled !== false,
      apiKey: remember && typeof parsed.apiKey === "string" ? parsed.apiKey : session.getItem(GROK_SESSION_KEY) || "",
      endpoint: DEFAULT_GROK_ENDPOINT,
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : DEFAULT_GROK_MODEL,
      remember,
    }
  } catch {
    return { ...DEFAULT_GROK_CONNECT, storageError: "Grok Bot could not read or migrate key storage. Disconnect and clear browser site data before using a real key." }
  }
}

export function writeGrokConnectSettings(store: Store | null, next: GrokConnectSettings): boolean {
  const previous = readGrokConnectSettings(store)
  if (!next.enabled || next.apiKey !== previous.apiKey) cancelGrokRequests()
  if (!store) return false
  try {
    const remember = next.remember === true
    sessionFor(store).setItem(GROK_SESSION_KEY, remember ? "" : next.apiKey || "")
    store.setItem(GROK_CONNECT_STORAGE_KEY, JSON.stringify({
      enabled: next.enabled !== false,
      apiKey: remember ? next.apiKey || "" : "",
      endpoint: DEFAULT_GROK_ENDPOINT,
      model: next.model || DEFAULT_GROK_MODEL,
      remember,
    }))
    revoked.delete(store)
    return true
  } catch { return false }
}

/** Toggle live xAI calls without deleting the key. */
export function setGrokEnabled(store: Store | null, enabled: boolean): GrokConnectSettings {
  const cur = readGrokConnectSettings(store)
  const next = { ...cur, enabled: enabled === true }
  writeGrokConnectSettings(store, next)
  return next
}

/** Delete the saved key (and clear from memory store). Live calls stop until a new key is pasted. */
export function disconnectGrok(store: Store | null): GrokConnectSettings {
  cancelGrokRequests()
  if (!store) return { ...DEFAULT_GROK_CONNECT }
  revoked.add(store) // A failed wipe must NEVER reactivate a persisted key.
  let failed = false
  for (const location of new Set([store, sessionFor(store)])) {
    for (const key of [GROK_CONNECT_STORAGE_KEY, GROK_SESSION_KEY, "xoe.relayTesterCode.v1"]) {
      try { location.removeItem(key); if (location.getItem(key)) failed = true } catch { failed = true }
    }
  }
  if (!failed) revoked.delete(store)
  return { ...DEFAULT_GROK_CONNECT, ...(failed ? { storageError: "Grok Bot stopped. Key storage could not be fully cleared. Clear this site's browser data before leaving this device." } : {}) }
}

export function clearGrokApiKey(store: Store | null): GrokConnectSettings {
  return disconnectGrok(store)
}

export function maskApiKey(key: string): string {
  const t = key.trim()
  if (!t) return ""
  if (t.length <= 8) return "••••••••"
  return `${t.slice(0, 3)}••••${t.slice(-4)}`
}

/** Live Grok Bot needs toggle ON + player key. */
export function canAttemptLiveGrok(settings: GrokConnectSettings): boolean {
  return settings.enabled === true && settings.apiKey.trim().length > 0 && settings.endpoint.trim().length > 0
}

export function readGrokFirstRunDismissed(store: Store | null): boolean {
  if (!store) return false
  try {
    const raw = store.getItem(GROK_FIRST_RUN_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { dismissed?: unknown }
    return parsed.dismissed === true
  } catch {
    return false
  }
}

export function writeGrokFirstRunDismissed(store: Store | null, dismissed = true): boolean {
  if (!store) return false
  try {
    store.setItem(GROK_FIRST_RUN_STORAGE_KEY, JSON.stringify({ dismissed: dismissed === true }))
    return true
  } catch {
    return false
  }
}

export function shouldShowGrokFirstRunPanel(store: Store | null): boolean {
  const settings = readGrokConnectSettings(store)
  if (settings.apiKey.trim().length > 0) return false
  return !readGrokFirstRunDismissed(store)
}
