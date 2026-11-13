/** Tap/click-to-fly is primary. Touch devices hide joystick + keyboard prompts. */

/** True when the primary pointing device is coarse (typical phone/tablet). */
export function prefersTouchPrimary(
  matchMediaFn: ((query: string) => MediaQueryList) | null = typeof matchMedia === "function" ? matchMedia.bind(globalThis) : null,
): boolean {
  try {
    if (matchMediaFn) {
      if (matchMediaFn("(pointer: coarse)").matches) return true
      if (matchMediaFn("(hover: none)").matches && matchMediaFn("(pointer: fine)").matches === false) return true
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== "undefined" && Number(navigator.maxTouchPoints) > 0) {
      // Fine pointer + touch (Surface) still gets keyboard; only hide stick when coarse.
      if (matchMediaFn && matchMediaFn("(pointer: fine)").matches) return false
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Keyboard move (WASD/arrows) is for computers only. */
export function keyboardMoveEnabled(touchPrimary: boolean): boolean {
  return !touchPrimary
}

/** On-screen joystick is retired; tap/click-to-fly replaces it. */
export function showOnScreenJoystick(): boolean {
  return false
}

export const TAP_FLY_HINT_TOUCH = "Tap a spot — XO flies there. Tap Enter near a dome."
export const TAP_FLY_HINT_DESKTOP = "Click a spot — XO flies there. WASD / arrows on computer. Enter near a dome."
