import { describe, expect, it } from "vitest"
import { drawerLabel, isDrawerOpen, openDrawer } from "./drawer.ts"

describe("one-screen drawers", () => {
  it("opens one at a time and closes with null", () => {
    expect(openDrawer(null, "scores")).toBe("scores")
    expect(openDrawer("scores", "settings")).toBe("settings")
    expect(openDrawer("settings", null)).toBe(null)
    expect(isDrawerOpen("settings", "settings")).toBe(true)
    expect(isDrawerOpen("settings", "scores")).toBe(false)
    expect(drawerLabel("report")).toMatch(/report/i)
  })
})
