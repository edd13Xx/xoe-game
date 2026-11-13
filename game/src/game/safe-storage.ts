/**
 * Storage that survives opaque-origin sandboxes (e.g. iOS in-chat WebKit
 * iframe with sandbox="allow-scripts" and no allow-same-origin).
 * Accessing window.localStorage there throws SecurityError ("The operation is insecure.").
 */

export interface KvStore {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

class MemoryKv implements KvStore {
  #map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.#map.has(key) ? (this.#map.get(key) as string) : null
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, String(value))
  }

  removeItem(key: string): void {
    this.#map.delete(key)
  }
}

type Backend = "real" | "memory"

let localStore: KvStore | null = null
let sessionStore: KvStore | null = null
let localBackend: Backend = "memory"
let sessionBackend: Backend = "memory"
let shimsInstalled = false

function canUse(storage: Storage): boolean {
  try {
    const probe = "__uoe_storage_probe__"
    storage.setItem(probe, "1")
    storage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function tryNative(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    const storage = window[kind]
    if (storage && canUse(storage)) return storage
  } catch {
    // SecurityError in opaque-origin sandbox
  }
  return null
}

/** Device-local prefs / Grok Bot key. Falls back to in-memory Map. */
export function getLocalStore(): KvStore {
  if (localStore) return localStore
  const native = typeof window !== "undefined" ? tryNative("localStorage") : null
  if (native) {
    localStore = native
    localBackend = "real"
    return localStore
  }
  localStore = new MemoryKv()
  localBackend = "memory"
  return localStore
}

/** Session-scoped ids. Falls back to in-memory Map. */
export function getSessionStore(): KvStore {
  if (sessionStore) return sessionStore
  const native = typeof window !== "undefined" ? tryNative("sessionStorage") : null
  if (native) {
    sessionStore = native
    sessionBackend = "real"
    return sessionStore
  }
  sessionStore = new MemoryKv()
  sessionBackend = "memory"
  return sessionStore
}

export function storageBackendInfo(): { local: Backend; session: Backend } {
  getLocalStore()
  getSessionStore()
  return { local: localBackend, session: sessionBackend }
}

/**
 * Best-effort: if native storage throws on access, expose memory stores on
 * window so any leftover direct `localStorage` reads still work.
 */
export function installSafeStorageShims(): void {
  if (shimsInstalled || typeof window === "undefined") return
  shimsInstalled = true
  const local = getLocalStore()
  const session = getSessionStore()

  const patch = (kind: "localStorage" | "sessionStorage", store: KvStore) => {
    try {
      // Probe: does reading the property throw?
      void window[kind]
      return
    } catch {
      // continue to patch
    }
    try {
      Object.defineProperty(window, kind, {
        configurable: true,
        enumerable: true,
        get() {
          return store
        },
      })
    } catch {
      // Some hosts refuse redefinition; call sites must use getLocalStore().
    }
  }

  if (localBackend === "memory") patch("localStorage", local)
  if (sessionBackend === "memory") patch("sessionStorage", session)
}

/** @internal test helper */
export function __resetSafeStorageForTests(): void {
  localStore = null
  sessionStore = null
  localBackend = "memory"
  sessionBackend = "memory"
  shimsInstalled = false
}
