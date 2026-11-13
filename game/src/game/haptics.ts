/** Phone haptic helpers. Feature-detected; respects setting + reduced motion. */

export const HAPTICS_STORAGE_KEY = "xoe.haptics.v1"

export interface HapticsPreference {
  enabled: boolean
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem?: (k: string) => void
}

export function readHapticsPreference(store: Store | null): {
  saved: HapticsPreference
  storageBlocked: boolean
} {
  const fallback: HapticsPreference = { enabled: true }
  if (!store) return { saved: fallback, storageBlocked: true }
  try {
    const raw = store.getItem(HAPTICS_STORAGE_KEY)
    if (!raw) return { saved: fallback, storageBlocked: false }
    const parsed = JSON.parse(raw) as Partial<HapticsPreference>
    return {
      saved: { enabled: parsed.enabled !== false },
      storageBlocked: false,
    }
  } catch {
    return { saved: fallback, storageBlocked: true }
  }
}

export function writeHapticsPreference(store: Store | null, saved: HapticsPreference): boolean {
  if (!store) return false
  try {
    store.setItem(HAPTICS_STORAGE_KEY, JSON.stringify({ enabled: saved.enabled === true }))
    return true
  } catch {
    return false
  }
}

export function canVibrate(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    )
  } catch {
    return false
  }
}

/** Short confirmation buzz (correct gate). No-op when unsupported / off / reduced motion. */
export function hapticPulse(
  store: Store | null,
  pattern: number | number[] = 18,
  options?: { reducedMotion?: boolean },
): boolean {
  const reduced = options?.reducedMotion === true || prefersReducedMotion()
  if (reduced) return false
  if (!readHapticsPreference(store).saved.enabled) return false
  if (!canVibrate()) return false
  try {
    return navigator.vibrate(pattern) === true
  } catch {
    return false
  }
}

/** Slightly stronger pattern for a correct gate clear. */
export function hapticCorrectGate(store: Store | null, options?: { reducedMotion?: boolean }): boolean {
  return hapticPulse(store, [12, 30, 24], options)
}
