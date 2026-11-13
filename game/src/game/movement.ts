export const WORLD = {
  width: 12,
  height: 9,
  start: { x: 2, y: 4 },
} as const

export interface Pos {
  x: number
  y: number
}

export interface Input {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
}

export type TouchControl = "up" | "down" | "left" | "right"

export function clampMove(pos: Pos, input: Input): Pos {
  const x = Math.min(WORLD.width - 1, Math.max(0, pos.x + input.x))
  const y = Math.min(WORLD.height - 1, Math.max(0, pos.y + input.y))
  return { x, y }
}

export const HATCH_TILE: Pos = { x: 11, y: 8 }

function buildTerraceRoute(): Pos[] {
  const tiles: Pos[] = []
  for (let x = WORLD.start.x; x <= HATCH_TILE.x; x += 1) {
    tiles.push({ x, y: WORLD.start.y })
  }
  for (let y = WORLD.start.y + 1; y <= HATCH_TILE.y; y += 1) {
    tiles.push({ x: HATCH_TILE.x, y })
  }
  return tiles
}

/** One fixed passable path from the start pad to the sealed hatch. */
export const TERRACE_ROUTE: readonly Pos[] = buildTerraceRoute()

export function isRouteTile(pos: Pos): boolean {
  return TERRACE_ROUTE.some((tile) => tile.x === pos.x && tile.y === pos.y)
}

export function moveAlongRoute(pos: Pos, input: Input): Pos {
  const next = clampMove(pos, input)
  if (next.x === pos.x && next.y === pos.y) return pos
  if (!isRouteTile(pos) || !isRouteTile(next)) return pos
  return next
}

export function inputFromKey(key: string): Input | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return { x: 0, y: -1 }
    case "ArrowDown":
    case "s":
    case "S":
      return { x: 0, y: 1 }
    case "ArrowLeft":
    case "a":
    case "A":
      return { x: -1, y: 0 }
    case "ArrowRight":
    case "d":
    case "D":
      return { x: 1, y: 0 }
    default:
      return null
  }
}

export function inputFromTouch(control: TouchControl): Input {
  switch (control) {
    case "up":
      return { x: 0, y: -1 }
    case "down":
      return { x: 0, y: 1 }
    case "left":
      return { x: -1, y: 0 }
    case "right":
      return { x: 1, y: 0 }
    default: {
      const neverControl: never = control
      throw new Error(`Unknown touch control: ${String(neverControl)}`)
    }
  }
}

export function tileKey(pos: Pos): string {
  return `${pos.x},${pos.y}`
}

/**
 * v18: plain next step on the terrace so off-route taps never feel like dead controls.
 * Pure. `suggest` names the one move button to highlight (or null when no move is needed).
 */
export function terraceNextStep(
  pos: Pos,
  hatchNoted: boolean,
): { text: string; suggest: TouchControl | null; atHatch: boolean } {
  const atHatch = pos.x === HATCH_TILE.x && pos.y === HATCH_TILE.y
  if (hatchNoted) return { text: "Next: tap Travel to colonies.", suggest: null, atHatch }
  if (atHatch) return { text: "You reached the sealed hatch. Tap Inspect sealed hatch.", suggest: null, atHatch }
  if (pos.y === WORLD.start.y && pos.x < HATCH_TILE.x) {
    const n = HATCH_TILE.x - pos.x
    return { text: `Next: tap Move right ${n} more ${n === 1 ? "time" : "times"}, then Move down to the hatch.`, suggest: "right", atHatch }
  }
  if (pos.x === HATCH_TILE.x && pos.y < HATCH_TILE.y) {
    const n = HATCH_TILE.y - pos.y
    return { text: `Next: tap Move down ${n} more ${n === 1 ? "time" : "times"} to reach the sealed hatch.`, suggest: "down", atHatch }
  }
  return { text: "Follow the lit path: Move right, then Move down to the sealed hatch.", suggest: "right", atHatch }
}
