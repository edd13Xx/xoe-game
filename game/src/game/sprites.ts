import { drawXoShield } from "./shield-visual.ts"
import type { SkyPhase } from "./daynight.ts"
import type { Pos } from "./movement.ts"
import { WORLD } from "./movement.ts"
import { NEON, aura, glow, glowCircle, neonBackdrop, neonDeck, neonDrone, neonMoons, neonVignette } from "./neon.ts"

export const PILOT_ROWS = [
  "................",
  "......4444......",
  ".....477774.....",
  "....47VVVV74....",
  "....47V77V74....",
  ".....477774.....",
  "....41111114....",
  "...4111331114...",
  "...4111331114...",
  "....41111114....",
  ".....411114.....",
  ".....41..14.....",
  "......4..4......",
  "................",
  "................",
  "................",
]

export const ZOE_ROWS = [
  "...........44...",
  "......4444.474..",
  ".....47VVV74.4..",
  "....47VVVV74....",
  "....47V77V74....",
  ".....477774.....",
  "....45555554....",
  "...4555335554...",
  "...4555335554...",
  "....45555554....",
  ".....455554.....",
  ".....45..54.....",
  "......4..4......",
  "................",
  "................",
  "................",
]

export const SIS_ROWS = [
  "..44............",
  "..494...........",
  "..44444.........",
  "...4VVV44.......",
  "..44V7V444......",
  "...4777444......",
  "...4111144......",
  "..411331144.....",
  "..41133114......",
  "...411114.......",
  "....4..4........",
  "....4..4..44....",
  ".....44..4.4....",
  "..........4.....",
  "................",
  "................",
]

export const DRONE_ROWS = [
  "..8888..",
  ".883388.",
  "..8338..",
  ".8.88.8.",
  "8..88..8",
  "..8..8..",
]

export const XENO_ROWS = [
  "........................",
  "........44444444........",
  "......44........44......",
  ".....44..333333..44.....",
  "....44..33333333..44....",
  "...44444444444444444....",
  "..44111111111111111144..",
  "..44111113333311111144..",
  "...44444444444444444....",
  "....44...44..44...44....",
  "....4....44..44....4....",
  "....44...44..44...44....",
  "........................",
  "........................",
]

const COLORS: Record<string, string> = {
  "1": "#c4c0d4",
  "2": "#8d7d6c",
  "3": "#a78bfa",
  "4": "#243140",
  "5": "#e4b15c",
  "7": "#f7f4ee",
  "8": "#c75b62",
  "9": "#7ea2d6",
  V: "#163833",
}

export function spriteWidthIssues(name: string, rows: readonly string[]): string | null {
  const width = rows[0]?.length ?? 0
  if (width === 0) return `${name} is empty`
  const bad = rows.findIndex((row) => row.length !== width)
  if (bad >= 0) return `${name} row ${bad} is ${rows[bad]?.length ?? 0}, expected ${width}`
  return null
}

export type SceneId =
  | "wake"
  | "missing-pilot"
  | "auto-battle"
  | "cockpit-invite"
  | "cinematic-1"
  | "cinematic-2"
  | "cinematic-3"
  | "practice"
  | "near-loss"
  | "rescue"
  | "navigate"

export interface DrawInput {
  scene: SceneId
  frame: number
  pos: Pos
  sky: SkyPhase
  hull: string
  visor: string
  reducedMotion: boolean
  xoeLikeness: boolean
  xoeImage: CanvasImageSource | null
  xoeSprite: CanvasImageSource | null
  sceneImage?: CanvasImageSource | null
}

export function xoeUsesCombatStill(scene: SceneId): boolean {
  return scene === "wake" || scene === "auto-battle"
}

export function stageAlpha(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  if (max < 16 && max - min < 14) return 0
  if (max < 78 && blue > red + 8 && green < 90 && red < 55) return 0
  if (max < 34 && max - min < 16) return Math.round(((max - 16) / 18) * 255)
  return 255
}

export function prepareXoeStageImage(image: HTMLImageElement): HTMLCanvasElement {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx || width < 1 || height < 1) return canvas
  ctx.drawImage(image, 0, 0, width, height)
  try {
    const frame = ctx.getImageData(0, 0, width, height)
    const pixels = frame.data
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index + 3] = stageAlpha(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0)
    }
    ctx.putImageData(frame, 0, 0)
  } catch {
    // SecurityError on tainted canvas / opaque-origin sandbox — keep drawn image as-is.
  }
  return canvas
}

export const XOE_STORY_BOX = { x: 4, y: 2, w: 132, h: 176 }
export const XOE_SPRITE_STORY_BOX = { x: 28, y: 96, w: 32, h: 32 }

export function xoeSpriteNavigateBox(
  width: number,
  height: number,
  pos: Pos,
): { x: number; y: number; w: number; h: number } {
  const ground = height - 78
  const px = 36 + (pos.x / (WORLD.width - 1)) * 200
  const py = ground - 20 - (WORLD.height - 1 - pos.y) * 4
  const boxW = 32
  const boxH = 32
  // PILOT_ROWS is 17 cells at scale 2, so those feet sit at py + 34.
  // XOE is the same 2px cell on a 16-cell body, so her top is 2px lower.
  return {
    x: Math.max(2, Math.min(width - boxW - 2, px)),
    y: Math.max(2, Math.min(height - boxH - 2, py + 2)),
    w: boxW,
    h: boxH,
  }
}

export function xoeNavigateBox(
  width: number,
  height: number,
  pos: Pos,
): { x: number; y: number; w: number; h: number } {
  const ground = height - 78
  const px = 36 + (pos.x / (WORLD.width - 1)) * 200
  const py = ground - 20 - (WORLD.height - 1 - pos.y) * 4
  const boxW = 96
  const boxH = 128
  return {
    x: Math.max(2, Math.min(width - boxW - 2, px - boxW * 0.38)),
    y: Math.max(2, Math.min(height - boxH - 2, py - boxH + 20)),
    w: boxW,
    h: boxH,
  }
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
  }
  if (image instanceof HTMLCanvasElement || image instanceof ImageBitmap) {
    return { width: image.width, height: image.height }
  }
  return { width: 0, height: 0 }
}

function drawCoverArt(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
) {
  const source = sourceSize(image)
  if (source.width < 1 || source.height < 1) return
  const scale = Math.max(width / source.width, height / source.height)
  const dw = source.width * scale
  const dh = source.height * scale
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh)
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  smooth: boolean,
) {
  const source = sourceSize(image)
  if (source.width < 1 || source.height < 1) return
  const scale = Math.min(boxW / source.width, boxH / source.height)
  const width = source.width * scale
  const height = source.height * scale
  ctx.imageSmoothingEnabled = smooth
  ctx.drawImage(image, boxX + (boxW - width) / 2, boxY + (boxH - height) / 2, width, height)
  const transform = ctx.getTransform()
  const left = Math.round(boxX * transform.a + transform.e)
  const top = Math.round(boxY * transform.d + transform.f)
  const boxWidth = Math.round(boxW * transform.a)
  const boxHeight = Math.round(boxH * transform.d)
  ctx.canvas.dataset.xoeBox = `${left},${top},${boxWidth},${boxHeight}`
}

function paint(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  originX: number,
  originY: number,
  scale: number,
  hull: string,
  visor: string,
) {
  rows.forEach((row, py) => {
    for (let px = 0; px < row.length; px += 1) {
      const ch = row.charAt(px)
      if (ch === "." || ch === "0") continue
      if (ch === "1") ctx.fillStyle = hull
      else if (ch === "V") ctx.fillStyle = visor
      else ctx.fillStyle = COLORS[ch] ?? "#ffffff"
      ctx.fillRect(originX + px * scale, originY + py * scale, scale, scale)
    }
  })
}

export const PILOT_PORTRAIT_SCALE = 12
export const PILOT_PORTRAIT_SIZE = 144

const CLASS_ICONS: Record<string, readonly string[]> = {
  Sentinel: ["..4444..", ".477774.", ".477774.", ".477774.", ".466664.", "..4664..", "...44..."],
  Striker: ["44444444", "..7777..", "44444444", "..7777..", "44444444", "..7777..", "44444444"],
  Recon: ["...44...", "..4..4..", ".4.77.4.", "4.7777.4", ".4.77.4.", "..4..4..", "...44..."],
}

export function drawClassIcon(ctx: CanvasRenderingContext2D, className: string): void {
  const rows = CLASS_ICONS[className]
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!rows) return
  paint(ctx, rows, 0, 0, 4, "#c4c0d4", "#a78bfa")
}

export function drawPilotPortrait(
  ctx: CanvasRenderingContext2D,
  hull: string,
  visor: string,
): void {
  const scale = PILOT_PORTRAIT_SCALE
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = "#10141a"
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  paint(ctx, PILOT_ROWS, -2 * scale, -1 * scale, scale, hull, visor)
}

function drones(ctx: CanvasRenderingContext2D, frame: number, close: boolean) {
  const bob = Math.sin(frame / 12) * 2
  const xs = close ? [210, 250, 280] : [230, 268, 300]
  xs.forEach((x, index) => neonDrone(ctx, x + 8, 44 + index * 14 + bob, frame + index * 7, close))
}

export function drawScene(ctx: CanvasRenderingContext2D, input: DrawInput): void {
  const width = 320
  const height = 180
  delete ctx.canvas.dataset.xoeBox
  ctx.setTransform(ctx.canvas.width / width, 0, 0, ctx.canvas.height / height, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const art = input.sceneImage
  if (art) {
    drawCoverArt(ctx, art, width, height)
  } else {
    neonBackdrop(ctx, width, height, input.frame, input.scene === "navigate" ? input.sky : "night", input.reducedMotion)
    if (input.scene === "navigate" && (input.sky === "night" || input.sky === "dusk")) neonMoons(ctx)
    neonDeck(ctx, width, height)
  }

  const ground = height - 78
  const paintPixels = !art
  if (!paintPixels && input.scene !== "navigate") {
    if (input.scene === "cinematic-1" || input.scene === "wake" || input.scene === "auto-battle" || input.scene === "near-loss" || input.scene === "practice") {
      drones(ctx, input.reducedMotion ? 0 : input.frame, input.scene === "near-loss")
    }
  } else if (input.scene === "cinematic-1") {
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath()
      ctx.moveTo(20, 20 + i * 12)
      ctx.lineTo(140, 40 + i * 8)
      glow(ctx, i % 2 ? NEON.cyan : NEON.lilac, 1, 3)
    }
    drones(ctx, input.reducedMotion ? 0 : input.frame, false)
  } else if (input.scene === "cinematic-2") {
    aura(ctx, 102, 80, 60, NEON.purple)
    paint(ctx, XENO_ROWS, 70, 48, 4, input.hull, input.visor)
  } else if (input.scene === "cinematic-3") {
    aura(ctx, 152, 80, 56, NEON.gold, 0.25)
    paint(ctx, ZOE_ROWS, 120, 48, 4, "#c4c0d4", "#e4b15c")
  } else if (input.scene === "navigate") {
    const px = 36 + (input.pos.x / (WORLD.width - 1)) * 200
    const py = ground - 20 - (WORLD.height - 1 - input.pos.y) * 4
    if (!input.xoeLikeness) {
      aura(ctx, px + 16, py + 14, 24, NEON.purple)
      paint(ctx, PILOT_ROWS, px, py, 2, input.hull, input.visor)
    }
    // hatch
    ctx.beginPath()
    ctx.rect(250, ground - 8, 18, 12)
    ctx.fillStyle = "rgba(228,177,92,0.15)"
    ctx.fill()
    glow(ctx, NEON.gold, 1, 3)
    ctx.beginPath()
    ctx.rect(292, 64, 8, 8)
    ctx.rect(304, 74, 5, 5)
    glow(ctx, "rgba(167,139,250,0.6)", 0.8, 2)
  } else {
    aura(ctx, (input.xoeLikeness ? 214 : 70) + 16, ground - 20, 34, NEON.purple)
    paint(ctx, XENO_ROWS, input.xoeLikeness ? 214 : 70, ground - 36, 2, input.hull, input.visor)
    if (!input.xoeLikeness) paint(ctx, PILOT_ROWS, 28, ground - 8, 2, input.hull, input.visor)
    if (input.scene === "rescue") {
      // wreckage
      ctx.beginPath()
      ctx.rect(214, 44, 16, 7)
      ctx.rect(248, 62, 12, 5)
      ctx.rect(286, 36, 9, 9)
      glow(ctx, NEON.red, 0.8, 2)
    } else {
      drones(ctx, input.reducedMotion ? 0 : input.frame, input.scene === "near-loss")
    }
    if (input.scene === "auto-battle" || input.scene === "practice") {
      ctx.beginPath()
      ctx.moveTo(150, ground - 20)
      ctx.lineTo(230, 48)
      glow(ctx, NEON.cyan, 1, 4)
    }
    if (input.scene === "missing-pilot") {
      glowCircle(ctx, 170, ground - 28, 3, NEON.gold, 1, NEON.gold)
    }
    if (input.scene === "cockpit-invite" || input.scene === "practice") {
      paint(ctx, ZOE_ROWS, 168, ground - 16, 2, "#c4c0d4", "#e4b15c")
    }
    if (input.scene === "rescue") {
      const leave = input.reducedMotion ? 0 : Math.min(150, input.frame * 2)
      paint(ctx, SIS_ROWS, 150 + leave, ground - 36, 3, "#c4c0d4", "#7ea2d6")
    }
    if (input.scene === "near-loss") {
      ctx.beginPath()
      ctx.rect(8, 8, width - 16, height - 16)
      glow(ctx, NEON.red, 1, 4)
    }
  }
  neonVignette(ctx, width, height)
  const hideXoe =
    Boolean(art && input.scene !== "navigate") ||
    input.scene === "cinematic-1" || input.scene === "cinematic-2" || input.scene === "cinematic-3"
  if (!input.xoeLikeness || hideXoe) {
    delete ctx.canvas.dataset.xoePresentation
  } else if (xoeUsesCombatStill(input.scene) && input.xoeImage) {
    drawContained(ctx, input.xoeImage, XOE_STORY_BOX.x, XOE_STORY_BOX.y, XOE_STORY_BOX.w, XOE_STORY_BOX.h, true)
    ctx.canvas.dataset.xoePresentation = "combat"
  } else if (input.xoeSprite) {
    const box = input.scene === "navigate" ? xoeSpriteNavigateBox(width, height, input.pos) : XOE_SPRITE_STORY_BOX
    const bob = input.reducedMotion ? 0 : Math.round(Math.sin(input.frame / 18) * 2)
    drawContained(ctx, input.xoeSprite, box.x, box.y + bob, box.w, box.h, false)
    const glimmer = input.reducedMotion ? 0.3 : 0.2 + 0.2 * Math.sin(input.frame / 22 + 1)
    ctx.save()
    ctx.globalAlpha = glimmer
    ctx.fillStyle = "#e8ffff"
    ctx.fillRect(box.x + Math.round(box.w * 0.5), box.y + bob + Math.round(box.h * 0.22), 2, 2)
    ctx.restore()
    if (input.scene === "near-loss") {
      const progress = input.reducedMotion ? 0 : Math.min(1, input.frame / 150)
      const fade = input.reducedMotion ? 0.35 : Math.max(0, 0.7 * (1 - progress) ** 1.4)
      const grow = input.reducedMotion ? 4 : 4 + 8 * progress
      ctx.canvas.dataset.xoeShield = fade > 0.02 ? "staged" : "faded"
      if (fade > 0.02) {
        const centerX = box.x + box.w / 2
        const centerY = box.y + bob + box.h / 2
        const radius = box.w * 0.55 + grow
        drawXoShield(ctx, centerX, centerY, radius, fade)
      }
    } else {
      delete ctx.canvas.dataset.xoeShield
    }
    ctx.canvas.dataset.xoePresentation = "sprite"
  } else {
    delete ctx.canvas.dataset.xoePresentation
  }
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  explored: readonly string[],
  pos: Pos,
): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = NEON.bg
  ctx.fillRect(0, 0, width, height)
  const cell = 7
  const originX = 8
  const originY = 8
  for (let y = 0; y < WORLD.height; y += 1) {
    for (let x = 0; x < WORLD.width; x += 1) {
      const key = `${x},${y}`
      ctx.fillStyle = explored.includes(key) ? NEON.lilac : "rgba(124, 92, 255, 0.16)"
      ctx.fillRect(originX + x * cell, originY + y * cell, cell - 1, cell - 1)
    }
  }
  ctx.fillStyle = NEON.cyan
  ctx.fillRect(originX + pos.x * cell, originY + pos.y * cell, cell - 1, cell - 1)
  ctx.fillStyle = "rgba(228, 177, 92, 0.45)"
  ctx.fillRect(originX + (WORLD.width - 1) * cell, originY + 2 * cell, cell - 1, cell - 1)
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 18, width / 2, height / 2, width * 0.55)
  gradient.addColorStop(0, "rgba(10,14,20,0)")
  gradient.addColorStop(1, "rgba(10,14,20,0.88)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}
