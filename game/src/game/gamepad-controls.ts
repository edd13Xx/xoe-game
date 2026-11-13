/** Optional Gamepad API — OFF by default. Left stick moves; buttons → trading legend. */
export const GAMEPAD_STORAGE_KEY = "xoe.gamepad.v1"

export interface GamepadPreference {
  enabled: boolean
}

export const GAMEPAD_LEGEND = [
  { button: "A / Cross", action: "Buy / confirm" },
  { button: "B / Circle", action: "Sell / cancel" },
  { button: "X / Square", action: "Enter / interact" },
  { button: "Y / Triangle", action: "Open shop tip" },
  { button: "Left stick", action: "Move" },
] as const

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export function readGamepadPreference(store: Store | null): GamepadPreference {
  if (!store) return { enabled: false }
  try {
    const raw = store.getItem(GAMEPAD_STORAGE_KEY)
    if (!raw) return { enabled: false }
    const parsed = JSON.parse(raw) as Partial<GamepadPreference>
    return { enabled: parsed.enabled === true }
  } catch {
    return { enabled: false }
  }
}

export function writeGamepadPreference(store: Store | null, next: GamepadPreference): boolean {
  if (!store) return false
  try {
    store.setItem(GAMEPAD_STORAGE_KEY, JSON.stringify({ enabled: next.enabled === true }))
    return true
  } catch {
    return false
  }
}

/** Normalized left-stick vector, or null if disabled / absent. */
export function readGamepadStick(enabled: boolean): { x: number; y: number } | null {
  if (!enabled || typeof navigator === "undefined" || !navigator.getGamepads) return null
  const pads = navigator.getGamepads()
  for (const pad of pads) {
    if (!pad) continue
    const x = pad.axes[0] ?? 0
    const y = pad.axes[1] ?? 0
    if (Math.hypot(x, y) < 0.18) return { x: 0, y: 0 }
    return { x, y }
  }
  return null
}

export function readGamepadTradingAction(enabled: boolean): "buy" | "sell" | "enter" | null {
  if (!enabled || typeof navigator === "undefined" || !navigator.getGamepads) return null
  const pads = navigator.getGamepads()
  for (const pad of pads) {
    if (!pad) continue
    if (pad.buttons[0]?.pressed) return "buy"
    if (pad.buttons[1]?.pressed) return "sell"
    if (pad.buttons[2]?.pressed) return "enter"
  }
  return null
}
