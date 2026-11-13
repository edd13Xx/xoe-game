import { describe, expect, it } from "vitest"
import {
  keyboardMoveEnabled,
  prefersTouchPrimary,
  showOnScreenJoystick,
} from "./controls.ts"

describe("tap/click controls", () => {
  it("hides on-screen joystick; keyboard only when not touch-primary", () => {
    expect(showOnScreenJoystick()).toBe(false)
    expect(keyboardMoveEnabled(true)).toBe(false)
    expect(keyboardMoveEnabled(false)).toBe(true)
  })

  it("detects coarse pointer as touch-primary", () => {
    const coarse = prefersTouchPrimary(((q: string) => ({
      matches: q.includes("pointer: coarse"),
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    })) as unknown as typeof matchMedia)
    expect(coarse).toBe(true)
    const fine = prefersTouchPrimary(((q: string) => ({
      matches: q.includes("pointer: fine") && !q.includes("coarse"),
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    })) as unknown as typeof matchMedia)
    // without coarse match and without touch points → false
    expect(fine).toBe(false)
  })
})
