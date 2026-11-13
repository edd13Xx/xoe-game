export const GUEST_LIMITS = {
  maxInputChars: 500,
  maxOutputChars: 600,
  maxPerSession: 8,
  maxGlobal: 30,
  maxConcurrent: 1,
}

const UNAVAILABLE = "Grok unavailable/not configured"
const CHAT_URL = "https://api.x.ai/v1/chat/completions"

export function createStore() {
  return { sessions: new Map(), globalCount: 0, inFlight: 0 }
}

const liveStore = createStore()

export function createGuestGrokHandler({ env, fetchImpl, store, limits = GUEST_LIMITS }) {
  return async function handle(body) {
    const enabled = env.XAI_GROK_GUEST_ENABLED === "1" && typeof env.XAI_API_KEY === "string" && env.XAI_API_KEY.length > 0
    if (!enabled) return { status: 503, body: { configured: false, status: UNAVAILABLE } }
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 80) : ""
    if (!text || !sessionId) return { status: 400, body: { configured: true, status: "Type a message before sending.", error: "empty" } }
    if (text.length > limits.maxInputChars) {
      return { status: 413, body: { configured: true, status: "Message is too long for this guest limit.", error: "too_long" } }
    }
    const used = store.sessions.get(sessionId) ?? 0
    if (used >= limits.maxPerSession || store.globalCount >= limits.maxGlobal || store.inFlight >= limits.maxConcurrent) {
      return {
        status: 429,
        body: {
          configured: true,
          status: "Guest limit reached for this server process. This is an in-memory limit, not distributed protection.",
          error: "limited",
        },
      }
    }
    store.inFlight += 1
    try {
      const response = await fetchImpl(CHAT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.XAI_MODEL || "grok-4.7",
          messages: [{ role: "user", content: text }],
          max_tokens: 200,
          stream: false,
        }),
      })
      if (!response.ok) return { status: 502, body: { configured: true, status: UNAVAILABLE, error: "upstream" } }
      const data = await response.json()
      const reply = String(data?.choices?.[0]?.message?.content ?? "").trim().slice(0, limits.maxOutputChars)
      if (!reply) return { status: 502, body: { configured: true, status: UNAVAILABLE, error: "empty_reply" } }
      store.sessions.set(sessionId, used + 1)
      store.globalCount += 1
      return { status: 200, body: { configured: true, reply } }
    } catch {
      return { status: 502, body: { configured: true, status: UNAVAILABLE, error: "upstream" } }
    } finally {
      store.inFlight = Math.max(0, store.inFlight - 1)
    }
  }
}

export function handleGuestGrok(body) {
  return createGuestGrokHandler({ env: process.env, fetchImpl: globalThis.fetch, store: liveStore })(body)
}
