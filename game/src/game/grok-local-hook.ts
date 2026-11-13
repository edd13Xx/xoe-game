/**
 * Optional future local-model hook for Grok Bot (e.g. localhost endpoint).
 * DISABLED BY DEFAULT. Contains no network I/O while disabled.
 * Do not enable in the offline practice build.
 */

export const LOCAL_GROK_HOOK_ENABLED = false as const

/** Placeholder only. Empty while disabled so nothing can be contacted. */
export const LOCAL_GROK_ENDPOINT = "" as const

export const GROK_OFFLINE_PRACTICE_LABEL = "Grok Bot (offline practice)"

export interface GrokHookResult {
  ok: boolean
  reply: string | null
  reason: "disabled" | "empty" | "not-implemented"
}

/**
 * Future local Grok Bot provider. Always returns disabled in this build.
 * Guaranteed: no network I/O while LOCAL_GROK_HOOK_ENABLED is false.
 */
export class GrokLocalHookProvider {
  readonly enabled = LOCAL_GROK_HOOK_ENABLED
  readonly endpoint = LOCAL_GROK_ENDPOINT

  async ask(question: string): Promise<GrokHookResult> {
    const trimmed = question.trim()
    if (!trimmed) return { ok: false, reply: null, reason: "empty" }
    if (!LOCAL_GROK_HOOK_ENABLED) {
      return { ok: false, reply: null, reason: "disabled" }
    }
    // Future slot: a local model endpoint would go here.
    // Intentionally unimplemented and unreachable while the flag is false.
    return { ok: false, reply: null, reason: "not-implemented" }
  }
}

export function createGrokLocalHook(): GrokLocalHookProvider {
  return new GrokLocalHookProvider()
}
