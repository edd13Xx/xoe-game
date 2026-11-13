import { describe, expect, it } from "vitest"
import {
  DRAG_THRESHOLD_PX,
  MINI_DEFAULT,
  TOOL_BTN,
  boxInside,
  clampMiniHud,
  defaultMiniHud,
  miniHudExtents,
  miniHudResetRect,
  pushUndo,
  readMiniHud,
  resetReachable,
  writeMiniHud,
  econLeftClearOfDock,
  TOOL_DOCK_W,
  TOOL_GAP,
  MINI_OFFSET,
  ECON_GAP,
} from "./minimap-hud.ts"

const SHELLS = [
  { name: "phone portrait", w: 390, h: 844 },
  { name: "phone landscape", w: 844, h: 390 },
  { name: "iphone 15 landscape", w: 734, h: 320 },
  { name: "desktop", w: 1280, h: 800 },
] as const

const ATTEMPTS: { x: number; y: number; w: number; h: number }[] = [
  { x: -4000, y: -4000, w: 10, h: 10 },
  { x: 8000, y: 8000, w: 8000, h: 8000 },
  { x: 0, y: 0, w: MINI_DEFAULT.w, h: MINI_DEFAULT.h },
  { x: 200, y: -80, w: 240, h: 168 },
  { x: -80, y: 200, w: 72, h: 48 },
  { x: 99999, y: 12, w: 240, h: 48 },
  { x: 12, y: 99999, w: 48, h: 168 },
]

describe("mini-map panel layout", () => {
  it("clamps size and keeps the panel on the shell", () => {
    const next = clampMiniHud({ x: -40, y: 4000, w: 10, h: 10 }, { w: 200, h: 200 }, { w: 80, h: 100 })
    expect(next.x).toBe(0)
    expect(next.y).toBeLessThanOrEqual(200 - 100 - 8)
    expect(next.w).toBeGreaterThanOrEqual(48)
    expect(next.h).toBeGreaterThanOrEqual(48)
  })

  it("undo only records a change, and reset reads the default", () => {
    const a = defaultMiniHud()
    const b = { ...a, x: 20, y: 10 }
    expect(pushUndo([], a)).toEqual([a])
    expect(pushUndo([a], a)).toEqual([a])
    expect(pushUndo([a], b)).toEqual([a, b])
    const store = new Map<string, string>()
    const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
    writeMiniHud(kv, b, { w: 390, h: 844 })
    expect(readMiniHud(kv, { w: 390, h: 844 })).toMatchObject({ x: 20, y: 10, w: MINI_DEFAULT.w })
    expect(DRAG_THRESHOLD_PX).toBe(8)
  })

  it("cannot be dragged or resized off-screen, and Reset stays reachable", () => {
    for (const shell of SHELLS) {
      const stored = readMiniHud(
        { getItem: () => JSON.stringify({ x: 9999, y: -400, w: 900, h: 900 }), setItem: () => {} },
        shell,
      )
      expect(resetReachable(stored, shell), `stored junk on ${shell.name}`).toBe(true)

      for (const attempt of ATTEMPTS) {
        const next = clampMiniHud(attempt, shell)
        const ext = miniHudExtents(next)
        const panel = { x: 8 + next.x, y: 8 + next.y, w: ext.w, h: ext.h }
        expect(boxInside(panel, shell), `${shell.name} panel ${JSON.stringify(attempt)} → ${JSON.stringify(next)}`).toBe(true)
        expect(resetReachable(next, shell), `${shell.name} Reset ${JSON.stringify(miniHudResetRect(next))}`).toBe(true)
        expect(miniHudResetRect(next).w).toBe(TOOL_BTN)
        expect(miniHudResetRect(next).h).toBe(TOOL_BTN)
      }
    }
  })

  it("keeps the tool dock off the economy strip on every default shell", () => {
    const canvases = [
      { name: "phone portrait", shell: SHELLS[0], canvasW: 96 },
      { name: "phone landscape", shell: SHELLS[1], canvasW: 96 },
      { name: "iphone 15 landscape", shell: SHELLS[2], canvasW: 96 },
      { name: "desktop", shell: SHELLS[3], canvasW: MINI_DEFAULT.w },
    ]
    for (const { name, shell, canvasW } of canvases) {
      const layout = clampMiniHud(defaultMiniHud(), shell)
      const left = econLeftClearOfDock(layout, canvasW)
      if (left == null) continue
      const dockRight = MINI_OFFSET + layout.x + canvasW + TOOL_GAP + TOOL_DOCK_W
      expect(left, name).toBeGreaterThanOrEqual(dockRight + ECON_GAP)
      expect(left, `${name} still on shell`).toBeLessThanOrEqual(shell.w)
    }
  })
})
