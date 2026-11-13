import { redactSecrets } from "./error-log.ts"
import { DEFAULT_GROK_ENDPOINT } from "./grok-connect-settings.ts"
import { trackGrokRequest } from "./grok-requests.ts"
import { XOE_SYSTEM_PROMPT } from "./brand.ts"
export const GROK_UNAVAILABLE = "Grok Bot unavailable/not configured"
export const GROK_GUEST_PATH = "/api/grok"
export const GUEST_SESSION_KEY = "xeno.grokGuestSession"

export interface GrokGuestResult {
  ok: boolean
  reply: string | null
  status: string
}

type GuestFetcher = (path: string, body: { text: string; sessionId: string }) => Promise<Response>

export async function sendGuestGrokMessage(
  text: string,
  sessionId: string,
  fetcher: GuestFetcher = defaultFetcher,
): Promise<GrokGuestResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, reply: null, status: "Type a message before sending." }
  }
  try {
    const response = await fetcher(GROK_GUEST_PATH, { text: trimmed, sessionId })
    const data = (await response.json().catch(() => null)) as { configured?: boolean; reply?: unknown; status?: unknown; error?: unknown } | null
    if (response.ok && data?.configured === true && typeof data.reply === "string" && data.reply.trim()) {
      return { ok: true, reply: data.reply, status: "Reply text from Grok Bot. Spoken with the selected device voice. This is not Grok Bot audio and not a call voice." }
    }
    if (data?.configured === true && typeof data.status === "string" && data.error !== "upstream" && data.error !== "empty_reply") {
      return { ok: false, reply: null, status: data.status }
    }
  } catch {
    return { ok: false, reply: null, status: GROK_UNAVAILABLE }
  }
  return { ok: false, reply: null, status: GROK_UNAVAILABLE }
}

async function defaultFetcher(path: string, body: { text: string; sessionId: string }): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

export function guestSessionId(store: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } | null): string {
  if (!store) return `local-${Math.random().toString(36).slice(2)}`
  try {
    const existing = store.getItem(GUEST_SESSION_KEY)
    if (existing) return existing
    const created = `guest-${Math.random().toString(36).slice(2)}`
    store.setItem(GUEST_SESSION_KEY, created)
    return created
  } catch {
    return `local-${Math.random().toString(36).slice(2)}`
  }
}


export interface LiveGrokInput {
  text: string
  apiKey: string
  endpoint: string
  model: string
  timeoutMs?: number
}

type LiveFetcher = (url: string, init: RequestInit) => Promise<Response>

export const XAI_KEY_NOT_VALID = "xAI said the key is not valid. Check it at console.x.ai."
/** v18.1: grok-4.7 can take well over 12 s to answer, so the old 12 s limit cut good replies off. */
export const LIVE_GROK_TIMEOUT_MS = 45_000
export const XAI_TIMEOUT = "Grok Bot took too long to answer (over 45 seconds). Try again, or ask something shorter."
export const XAI_NETWORK = "Could not reach xAI from this browser. Check your internet, then try again."
export const XAI_NO_CREDITS =
  "xAI accepted the key but refused the request: the account has no credits or this key lacks chat access. Check billing and key permissions at console.x.ai."
export const XAI_RATE_LIMIT = "xAI says too many requests or the credit limit is reached. Wait a minute or check console.x.ai."
export const XAI_SERVER = "xAI is having trouble right now. Try again in a minute."

/** xAI's own error text, shortened and with anything key-like removed (never echo a key). */
export function xaiErrorText(data: unknown): string {
  let raw = ""
  if (data && typeof data === "object") {
    const d = data as { error?: unknown; message?: unknown }
    if (typeof d.error === "string") raw = d.error
    else if (d.error && typeof d.error === "object" && typeof (d.error as { message?: unknown }).message === "string")
      raw = (d.error as { message: string }).message
    else if (typeof d.message === "string") raw = d.message
  }
  return redactSecrets(raw)
    .replace(/xai-[A-Za-z0-9_-]+/g, "xai-…")
    .replace(/https?:\/\/\S+/g, "console.x.ai")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
}

/** Plain-word message for an xAI HTTP failure. */
export function describeXaiFailure(status: number, data: unknown): string {
  const text = xaiErrorText(data)
  const lower = text.toLowerCase()
  const said = text ? ` (xAI: "${text}")` : ""
  if (/api key|incorrect key|invalid key|unauthori[sz]ed/.test(lower) || status === 401) return `${XAI_KEY_NOT_VALID}${said}`
  if (/credit|billing|balance|spending|license|permission|forbidden|payment/.test(lower) || status === 403 || status === 402)
    return `${XAI_NO_CREDITS}${said}`
  if (status === 429) return `${XAI_RATE_LIMIT}${said}`
  if (/model/.test(lower) || status === 404) return `Grok Bot could not use that model. Try grok-4.7.${said}`
  if (status >= 500) return `${XAI_SERVER}${said}`
  return `Grok Bot did not answer (error ${status}).${said}`
}

/** Live xAI chat call. Only invoke when Connect to Grok Bot is ON and a key is set. */
export async function sendLiveXaiGrokMessage(
  input: LiveGrokInput,
  fetcher: LiveFetcher = fetch,
): Promise<GrokGuestResult> {
  const trimmed = input.text.trim()
  if (!trimmed) return { ok: false, reply: null, status: "Type a message before sending." }
  if (!input.apiKey.trim()) return { ok: false, reply: null, status: GROK_UNAVAILABLE }
  if (trimmed.length > 2000) return { ok: false, reply: null, status: "Grok Bot: keep the question under 2,000 characters." }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const timeoutMs = input.timeoutMs ?? LIVE_GROK_TIMEOUT_MS
  const untrack = controller ? trackGrokRequest(controller) : () => {}
  let timedOut = false
  const timer = controller ? setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs) : null
  try {
    const response = await fetcher(DEFAULT_GROK_ENDPOINT, {
      method: "POST",
      redirect: "error",
      credentials: "omit",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: input.model || "grok-4.7",
        messages: [
          {
            role: "system",
            content: XOE_SYSTEM_PROMPT,
          },
          { role: "user", content: trimmed },
        ],
        temperature: 0.4,
        max_tokens: 256,
        stream: false,
      }),
      signal: controller?.signal,
    })
    const data = (await response.json().catch(() => null)) as
      | { choices?: { message?: { content?: unknown } }[]; error?: unknown }
      | null
    if (controller?.signal.aborted) return { ok: false, reply: null, status: "Grok Bot request cancelled." }
    const content = data?.choices?.[0]?.message?.content
    if (response.ok && typeof content === "string" && content.trim()) {
      return {
        ok: true,
        reply: content.trim(),
        status: "Grok Bot connected ✓",
      }
    }
    if (response.ok) return { ok: false, reply: null, status: "xAI answered with an empty reply. Try again." }
    return { ok: false, reply: null, status: describeXaiFailure(response.status, data) }
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    const msg = err instanceof Error ? err.message : String(err)
    if (name === "AbortError" || /abort/i.test(msg)) return { ok: false, reply: null, status: timedOut ? "timeout" : "Grok Bot request cancelled." }
    const blocked = name === "TypeError" || /failed to fetch|networkerror|load failed/i.test(msg)
    if (blocked) {
      return { ok: false, reply: null, status: "network-blocked" }
    }
    return { ok: false, reply: null, status: "Grok Bot did not answer. Try again, or use the built-in AI." }
  } finally {
    untrack()
    if (timer) clearTimeout(timer)
  }
}

/** Turn a live-call status code into words a player can act on. */
export function liveStatusText(status: string): string {
  if (status === "timeout") return XAI_TIMEOUT
  if (status === "network-blocked") return XAI_NETWORK
  return status
}
