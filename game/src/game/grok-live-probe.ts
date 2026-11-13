import { reportLiveResult } from "./live-status.ts"
import { canAttemptLiveGrok, type GrokConnectSettings } from "./grok-connect-settings.ts"
import { XAI_NETWORK, XAI_TIMEOUT, sendLiveXaiGrokMessage } from "./grok-guest.ts"
import { SAFARI_GROK_HINT, inRestrictedPreview } from "./sandbox.ts"

export type GrokProbeStatus = "live" | "builtin" | "blocked" | "error"
export type GrokProbeDetail = { status: GrokProbeStatus; message: string }

/** @deprecated used as a short result; prefer probeLiveGrokDetail */
export type GrokProbeResult = "live" | "builtin"

export const KEY_WRONG_PREFIX = "That key should start with xai-. Copy it again from console.x.ai."
export const KEY_TOO_SHORT = "That key is too short. Copy the whole key from console.x.ai."
const MIN_KEY_CHARS = 9

/** Plain reason a pasted key can't be right, or null if it looks OK to test. */
export function xaiKeyProblem(key: string): string | null {
  const k = key.trim()
  if (!k.startsWith("xai-")) return KEY_WRONG_PREFIX
  if (k.length < MIN_KEY_CHARS) return KEY_TOO_SHORT
  return null
}

export function looksLikeXaiKey(key: string): boolean {
  return xaiKeyProblem(key) === null
}

export async function probeLiveGrokDetail(settings: GrokConnectSettings): Promise<GrokProbeDetail> {
  const d = await probeLiveGrokDetailInner(settings)
  if (d.status === "live") reportLiveResult(true, d.message)
  else if (d.status === "error" || d.status === "blocked") reportLiveResult(false, d.message)
  return d
}

async function probeLiveGrokDetailInner(settings: GrokConnectSettings): Promise<GrokProbeDetail> {
  if (!canAttemptLiveGrok(settings)) {
    return {
      status: "builtin",
      message: "Grok Bot is ready. Paste your xAI key to turn on live Grok Bot. Until then XOE uses the built-in AI.",
    }
  }
  const problem = xaiKeyProblem(settings.apiKey)
  if (problem) return { status: "error", message: problem }
  try {
    const result = await sendLiveXaiGrokMessage({
      text: "Reply with the single word OK.",
      apiKey: settings.apiKey,
      endpoint: settings.endpoint,
      model: settings.model,
    })
    if (result.ok && result.reply) return { status: "live", message: "Grok Bot connected ✓" }
    if (result.status === "network-blocked") {
      return {
        status: "blocked",
        message: inRestrictedPreview() ? SAFARI_GROK_HINT : XAI_NETWORK,
      }
    }
    if (result.status === "timeout") return { status: "error", message: XAI_TIMEOUT }
    return { status: "error", message: result.status || "Grok Bot did not answer." }
  } catch {
    return {
      status: inRestrictedPreview() ? "blocked" : "error",
      message: inRestrictedPreview() ? SAFARI_GROK_HINT : XAI_NETWORK,
    }
  }
}

/**
 * Quick connectivity check when a player key is present.
 * Never throws; never returns or logs the key.
 */
export async function probeLiveGrok(settings: GrokConnectSettings): Promise<GrokProbeResult> {
  const detail = await probeLiveGrokDetail(settings)
  return detail.status === "live" ? "live" : "builtin"
}
