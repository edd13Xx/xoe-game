/** Layout for the colony mini-map panel only. No other HUD is movable. */

export const MINIMAP_HUD_KEY = "xoe.minimapHud.v1"
export const MINI_DEFAULT = { x: 0, y: 0, w: 132, h: 92 } as const
export const MINI_MIN_W = 72
export const MINI_MIN_H = 48
export const MINI_MAX_W = 240
export const MINI_MAX_H = 168
export const DRAG_THRESHOLD_PX = 8
export const MINI_OFFSET = 8
export const TOOL_GAP = 4
export const TOOL_BTN = 48
/** Width of the Full Map + Undo + Reset column (Full Map uses an icon + “Map”). */
export const TOOL_DOCK_W = 80
export const ECON_GAP = 8
export const ECON_BAND_H = 32

export interface MiniHudLayout {
  x: number
  y: number
  w: number
  h: number
}

export interface MiniHudBox {
  x: number
  y: number
  w: number
  h: number
}

export function defaultMiniHud(): MiniHudLayout {
  return { ...MINI_DEFAULT }
}

export function sameMiniHud(a: MiniHudLayout, b: MiniHudLayout): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
}

/** Canvas plus the Full Map / Undo / Reset dock to the right. */
export function miniHudExtents(layout: Pick<MiniHudLayout, "w" | "h">): { w: number; h: number } {
  const sideW = TOOL_GAP + TOOL_DOCK_W
  const sideH = TOOL_BTN * 3 + TOOL_GAP * 2
  return { w: layout.w + sideW, h: Math.max(layout.h, sideH) }
}

/** Reset button in shell coordinates (origin = shell top-left). */
export function miniHudResetRect(layout: MiniHudLayout): MiniHudBox {
  return {
    x: MINI_OFFSET + layout.x + layout.w + TOOL_GAP,
    y: MINI_OFFSET + layout.y + 2 * (TOOL_BTN + TOOL_GAP),
    w: TOOL_BTN,
    h: TOOL_BTN,
  }
}

export function boxInside(box: MiniHudBox, shell: { w: number; h: number }): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= shell.w + 1e-6 && box.y + box.h <= shell.h + 1e-6
}

export function resetReachable(layout: MiniHudLayout, shell: { w: number; h: number }): boolean {
  return boxInside(miniHudResetRect(layout), shell)
}

/**
 * Keep the mini-map on the world shell (or viewport). Canvas size shrinks if needed so the
 * Reset control stays fully on-screen. `panel` overrides the measured chrome size.
 */
export function clampMiniHud(
  layout: MiniHudLayout,
  shell?: { w: number; h: number },
  panel?: { w: number; h: number },
): MiniHudLayout {
  let w = Math.max(MINI_MIN_W, Math.min(MINI_MAX_W, Math.round(layout.w)))
  let h = Math.max(MINI_MIN_H, Math.min(MINI_MAX_H, Math.round(layout.h)))
  if (shell) {
    const fitW = Math.floor(shell.w - MINI_OFFSET - TOOL_GAP - TOOL_DOCK_W)
    const fitH = Math.floor(shell.h - MINI_OFFSET)
    w = Math.min(w, Math.max(TOOL_BTN, fitW))
    h = Math.min(h, Math.max(TOOL_BTN, fitH))
  }
  const box = panel ?? miniHudExtents({ w, h })
  const maxX = Math.max(0, Math.round((shell?.w ?? 10_000) - box.w - MINI_OFFSET))
  const maxY = Math.max(0, Math.round((shell?.h ?? 10_000) - box.h - MINI_OFFSET))
  return {
    x: Math.max(0, Math.min(maxX, Math.round(layout.x))),
    y: Math.max(0, Math.min(maxY, Math.round(layout.y))),
    w,
    h,
  }
}


/**
 * Left edge (shell coords) for the economy strip so it does not cover the tool dock
 * when the dock occupies the top econ band. Returns null if they do not share that band.
 */
export function econLeftClearOfDock(
  layout: MiniHudLayout,
  canvasW: number,
  dockW = TOOL_DOCK_W,
): number | null {
  const dockLeft = MINI_OFFSET + layout.x + canvasW + TOOL_GAP
  const dockTop = MINI_OFFSET + layout.y
  const dockBottom = dockTop + TOOL_BTN * 3 + TOOL_GAP * 2
  const econTop = 8
  const econBottom = 8 + ECON_BAND_H
  if (dockBottom <= econTop || dockTop >= econBottom) return null
  return dockLeft + dockW + ECON_GAP
}

export function pushUndo(stack: readonly MiniHudLayout[], current: MiniHudLayout): MiniHudLayout[] {
  const last = stack[stack.length - 1]
  if (last && sameMiniHud(last, current)) return [...stack]
  return [...stack.slice(-19), current]
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export function readMiniHud(store: Store | null, shell?: { w: number; h: number }): MiniHudLayout {
  const raw = store?.getItem(MINIMAP_HUD_KEY)
  if (!raw) return clampMiniHud(defaultMiniHud(), shell)
  try {
    const p = JSON.parse(raw) as Partial<MiniHudLayout>
    return clampMiniHud({
      x: typeof p.x === "number" && Number.isFinite(p.x) ? p.x : 0,
      y: typeof p.y === "number" && Number.isFinite(p.y) ? p.y : 0,
      w: typeof p.w === "number" && Number.isFinite(p.w) ? p.w : MINI_DEFAULT.w,
      h: typeof p.h === "number" && Number.isFinite(p.h) ? p.h : MINI_DEFAULT.h,
    }, shell)
  } catch {
    return clampMiniHud(defaultMiniHud(), shell)
  }
}

export function writeMiniHud(store: Store | null, layout: MiniHudLayout, shell?: { w: number; h: number }): void {
  try {
    store?.setItem(MINIMAP_HUD_KEY, JSON.stringify(clampMiniHud(layout, shell)))
  } catch {
    /* safe-storage handles quota / private mode */
  }
}
