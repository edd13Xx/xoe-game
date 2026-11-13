import { OPEN_MAP_EVENT, setMapScreenAvailable } from "../game/map-screen.ts"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { getLocalStore } from "../game/safe-storage.ts"
import {
  DRAG_THRESHOLD_PX,
  MINI_OFFSET,
  clampMiniHud,
  defaultMiniHud,
  pushUndo,
  readMiniHud,
  sameMiniHud,
  writeMiniHud,
  type MiniHudLayout,
} from "../game/minimap-hud.ts"
import xoeArt from "../assets/xoe-weapons.webp"
import xoeSpriteUrl from "../assets/xoe-sprite.png"
import type { SkyPhase } from "../game/daynight.ts"
import type { Pos } from "../game/movement.ts"
import { drawNeonMinimap } from "../game/neon.ts"
import { minimapFit, minimapToWorld, projectMinimap, type MinimapInput, type MinimapSize } from "../game/minimap.ts"
import { drawMinimap, drawScene, prepareXoeStageImage, xoeUsesCombatStill, type SceneId } from "../game/sprites.ts"
import { SCENE_ART } from "./scene-art.ts"

export function PixelStage({
  scene,
  animate,
  pos,
  sky,
  hull,
  visor,
  reducedMotion,
  xoeLikeness,
}: {
  scene: SceneId
  animate: boolean
  pos: Pos
  sky: SkyPhase
  hull: string
  visor: string
  reducedMotion: boolean
  xoeLikeness: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLCanvasElement | null>(null)
  const spriteRef = useRef<HTMLImageElement | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [spriteReady, setSpriteReady] = useState(false)
  const sceneArtRef = useRef<Record<string, HTMLImageElement>>({})
  const [sceneArtReady, setSceneArtReady] = useState(0)

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    const ready = () => {
      if (cancelled) return
      imageRef.current = prepareXoeStageImage(image)
      setImageReady(true)
    }
    image.onload = ready
    image.src = xoeArt
    if (image.complete && image.naturalWidth > 0) ready()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    const ready = () => {
      if (cancelled) return
      spriteRef.current = image
      setSpriteReady(true)
    }
    image.onload = ready
    image.src = xoeSpriteUrl
    if (image.complete && image.naturalWidth > 0) ready()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const entries = Object.entries(SCENE_ART)
    entries.forEach(([id, url]) => {
      const image = new Image()
      const ready = () => {
        if (cancelled) return
        sceneArtRef.current[id] = image
        setSceneArtReady((n) => n + 1)
      }
      image.onload = ready
      image.src = url
      if (image.complete && image.naturalWidth > 0) ready()
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let frame = 0
    let raf = 0
    const draw = () => {
      ctx.imageSmoothingEnabled = false
      drawScene(ctx, {
        scene,
        frame,
        pos,
        sky,
        hull,
        visor,
        reducedMotion,
        xoeLikeness,
        xoeImage: xoeLikeness && xoeUsesCombatStill(scene) && imageReady ? imageRef.current : null,
        xoeSprite: xoeLikeness && spriteReady ? spriteRef.current : null,
        sceneImage: sceneArtRef.current[scene] ?? null,
      })
    }
    draw()
    if (!animate) return
    // ~30 fps cap keeps phones cool; frame counter advances at the same speed as before.
    let last = 0
    const loop = (t: number) => {
      if (t - last >= 32) {
        frame += 2
        last = t
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [animate, scene, pos, sky, hull, visor, reducedMotion, xoeLikeness, imageReady, spriteReady, sceneArtReady])

  return <canvas ref={ref} className="stage stage-hero" width={640} height={360} aria-hidden="true" data-scene={scene} />
}

export function MinimapCanvas({ explored, pos }: { explored: readonly string[]; pos: Pos }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    drawMinimap(ctx, explored, pos)
  }, [explored, pos])
  return <canvas ref={ref} className="minimap" width={112} height={84} aria-hidden="true" />
}

const MINI_SMALL: MinimapSize = { w: 132, h: 92, pad: 6 }

/**
 * v13 HUD mini map (neon). Tap a spot on the small map to fly there; Full Map opens the full screen.
 * Drag, resize, Undo, and Reset apply only to this panel. Green = Gestalt, red = enemy units.
 */
export function MiniMapHud({
  input,
  view,
  animate,
  onFlyTo,
  labels = [],
}: {
  input: MinimapInput
  view: { x: number; y: number; w: number; h: number }
  animate: boolean
  onFlyTo: (pt: { x: number; y: number }) => void
  labels?: readonly { id: string; label: string; x: number; y: number }[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // v18.2: the small mini map always stays in the corner; the big map opens as its own full screen.
  const [full, setFull] = useState(false)
  const [layout, setLayout] = useState<MiniHudLayout>(() => readMiniHud(getLocalStore()))
  const [undo, setUndo] = useState<MiniHudLayout[]>([])
  const layoutRef = useRef(layout)
  useEffect(() => { layoutRef.current = layout }, [layout])
  const dragRef = useRef<{
    mode: "move" | "resize"
    px: number
    py: number
    origin: MiniHudLayout
    moved: boolean
    pointer: number
  } | null>(null)
  const size: MinimapSize = useMemo(() => ({ w: layout.w, h: layout.h, pad: MINI_SMALL.pad }), [layout.w, layout.h])
  const syncEconClearance = useCallback(() => {
    const shell = document.querySelector(".mars-world-shell") as HTMLElement | null
    const dock = document.querySelector("[data-minimap-arrange]") as HTMLElement | null
    if (!shell || !dock) return
    const sh = shell.getBoundingClientRect()
    const d = dock.getBoundingClientRect()
    const bandTop = sh.top + 4
    const bandBottom = sh.top + 8 + 32
    if (d.bottom <= bandTop || d.top >= bandBottom) {
      shell.style.removeProperty("--map-econ-left")
      return
    }
    shell.style.setProperty("--map-econ-left", `${Math.ceil(d.right - sh.left + 8)}px`)
  }, [])
  const applyLayout = useCallback((next: MiniHudLayout, record: boolean) => {
    const shell = document.querySelector(".mars-world-shell")
    const box = shell?.getBoundingClientRect()
    const clamped = clampMiniHud(next, box ? { w: box.width, h: box.height } : undefined)
    if (record && !sameMiniHud(layoutRef.current, clamped)) {
      setUndo((stack) => pushUndo(stack, layoutRef.current))
    }
    setLayout(clamped)
    writeMiniHud(getLocalStore(), clamped)
    requestAnimationFrame(syncEconClearance)
  }, [syncEconClearance])
  const endDrag = useCallback((el: HTMLElement, pointerId: number) => {
    const drag = dragRef.current
    if (!drag || drag.pointer !== pointerId) return null
    dragRef.current = null
    try { el.releasePointerCapture(pointerId) } catch { /* already released */ }
    return drag
  }, [])
  useEffect(() => { syncEconClearance() }, [layout, syncEconClearance])
  useEffect(() => {
    const onWin = () => applyLayout(layoutRef.current, false)
    window.addEventListener("resize", onWin)
    window.visualViewport?.addEventListener("resize", onWin)
    return () => {
      window.removeEventListener("resize", onWin)
      window.visualViewport?.removeEventListener("resize", onWin)
    }
  }, [applyLayout])

  useEffect(() => {
    const open = () => setFull(true)
    window.addEventListener(OPEN_MAP_EVENT, open)
    setMapScreenAvailable(true)
    return () => {
      window.removeEventListener(OPEN_MAP_EVENT, open)
      setMapScreenAvailable(false)
    }
  }, [])
  const inputRef = useRef(input)
  const viewRef = useRef(view)
  const dirtyRef = useRef(true)
  const drawRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    inputRef.current = input
    viewRef.current = view
    dirtyRef.current = true
    if (!animate) drawRef.current?.()
  }, [input, view, animate])
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = 2
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0
    let frame = 0
    let dots = projectMinimap(inputRef.current, size)
    const draw = () => {
      if (dirtyRef.current) {
        dots = projectMinimap(inputRef.current, size)
        dirtyRef.current = false
      }
      const v = viewRef.current
      const { s, ox, oy } = minimapFit(inputRef.current.world, size)
      const vr = { x: ox + v.x * s, y: oy + v.y * s, w: v.w * s, h: v.h * s }
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      drawNeonMinimap(ctx, dots, vr, frame, size.w, size.h)
    }
    drawRef.current = draw
    draw()
    if (!animate) return () => { drawRef.current = null }
    let last = 0
    const loop = (t: number) => {
      if (t - last >= 66) {
        frame += 4
        last = t
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      drawRef.current = null
    }
  }, [size, animate, size.w, size.h])

  const startMove = (e: ReactPointerEvent, mode: "move" | "resize") => {
    if (mode === "move" && (e.target as Element | null)?.closest?.("button")) return
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      mode,
      px: e.clientX,
      py: e.clientY,
      origin: layoutRef.current,
      moved: false,
      pointer: e.pointerId,
    }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ok */ }
  }
  const onPanelMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointer !== e.pointerId) return
    const dx = e.clientX - drag.px
    const dy = e.clientY - drag.py
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    if (drag.mode === "move") {
      applyLayout({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy }, false)
    } else {
      applyLayout({ ...drag.origin, w: drag.origin.w + dx, h: drag.origin.h + dy }, false)
    }
  }
  const onPanelUp = (e: ReactPointerEvent, fly?: (clientX: number, clientY: number, el: HTMLElement) => void) => {
    const el = e.currentTarget as HTMLElement
    const drag = endDrag(el, e.pointerId)
    if (!drag) return
    if (drag.moved) {
      const current = layoutRef.current
      if (!sameMiniHud(drag.origin, current)) {
        setUndo((stack) => pushUndo(stack, drag.origin))
      }
      applyLayout(current, false)
      return
    }
    if (fly) fly(e.clientX, e.clientY, el)
  }

  return (
    <>
      <div
        className="minimap-cluster"
        style={{ left: MINI_OFFSET + layout.x, top: MINI_OFFSET + layout.y }}
      >
      <div
        className="minimap-hud"
        data-minimap="small"
        onPointerDown={(e) => startMove(e, "move")}
        onPointerMove={onPanelMove}
        onPointerUp={(e) => onPanelUp(e)}
        onPointerCancel={(e) => endDrag(e.currentTarget as HTMLElement, e.pointerId)}
      >
        <div className="minimap-canvas-wrap">
        <canvas
          ref={ref}
          className="minimap-hud-canvas"
          width={size.w * 2}
          height={size.h * 2}
          style={{ width: size.w, height: size.h }}
          tabIndex={0}
          aria-label="Mini map. Tap a spot to fly there. Use Full Map for the full map. Drag this panel to move it."
          onPointerDown={(e) => startMove(e, "move")}
          onPointerMove={onPanelMove}
          onPointerUp={(e) => onPanelUp(e, (cx, cy, el) => {
            const r = el.getBoundingClientRect()
            onFlyTo(minimapToWorld({ x: cx - r.left, y: cy - r.top }, input.world, size))
          })}
        />
        <button
          type="button"
          className="minimap-resize"
          aria-label="Resize mini-map"
          onPointerDown={(e) => startMove(e, "resize")}
          onPointerMove={onPanelMove}
          onPointerUp={(e) => onPanelUp(e)}
        />
        </div>
        <div className="minimap-hud-arrange" data-minimap-arrange="1">
          <button
            type="button"
            className="touch-btn map-open-btn"
            aria-label="Full Map"
            title="Full Map"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setFull(true)
            }}
          >
            <svg className="map-open-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.95" />
              <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.55" />
              <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.55" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
            </svg>
            <span aria-hidden="true">Map</span>
          </button>
          {(undo.length > 0 || !sameMiniHud(layout, defaultMiniHud())) ? <>
          <button
            type="button"
            className="touch-btn"
            disabled={undo.length === 0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              const prev = undo[undo.length - 1]
              if (!prev) return
              setUndo((stack) => stack.slice(0, -1))
              applyLayout(prev, false)
            }}
          >
            Undo
          </button>
          <button
            type="button"
            className="touch-btn"
            data-minimap-reset="1"
            disabled={sameMiniHud(layout, defaultMiniHud())}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              applyLayout(defaultMiniHud(), true)
            }}
          >
            Reset
          </button>
          </> : null}
        </div>
      </div>
      </div>
      {full && typeof document !== "undefined"
        ? createPortal(
        <FullMapScreen
          input={input}
          view={view}
          labels={labels}
          onClose={() => setFull(false)}
          onFlyTo={(pt) => {
            onFlyTo(pt)
            setFull(false)
          }}
        />,
          document.body,
        )
        : null}
    </>
  )
}

/** v18.2: the big map in its own full screen, with Close, tap-to-fly, and a list of every dome. */
function FullMapScreen({
  input,
  view,
  labels,
  onClose,
  onFlyTo,
}: {
  input: MinimapInput
  view: { x: number; y: number; w: number; h: number }
  labels: readonly { id: string; label: string; x: number; y: number }[]
  onClose: () => void
  onFlyTo: (pt: { x: number; y: number }) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 390))
  useEffect(() => {
    const r = () => setVw(window.innerWidth)
    window.addEventListener("resize", r)
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", k)
    return () => {
      window.removeEventListener("resize", r)
      window.removeEventListener("keydown", k)
    }
  }, [onClose])
  const w = Math.round(Math.min(vw - 24, 720))
  const size: MinimapSize = useMemo(() => ({ w, h: Math.round((w * input.world.h) / input.world.w) + 12, pad: 10 }), [w, input.world.h, input.world.w])
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    const dots = projectMinimap(input, size)
    const { s, ox, oy } = minimapFit(input.world, size)
    const vr = { x: ox + view.x * s, y: oy + view.y * s, w: view.w * s, h: view.h * s }
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    drawNeonMinimap(ctx, dots, vr, 0, size.w, size.h)
    // dome names on the full map
    ctx.font = "600 12px Inter, system-ui, sans-serif"
    ctx.textAlign = "center"
    labels.forEach((l, i) => {
      const p = { x: ox + l.x * s, y: oy + l.y * s }
      const bonus = /\(bonus\)/i.test(l.label)
      const t = l.label.replace(/^Colony\s+/, "").replace(/\s*\(bonus\)\s*$/i, " ★")
      const tw = ctx.measureText(t).width
      // keep every name inside the map, and alternate above/below so neighbours don't overlap
      const cx = Math.min(Math.max(p.x, tw / 2 + 4), size.w - tw / 2 - 4)
      const below = i % 2 === 0
      const ty = below ? p.y + 20 : p.y - 11
      ctx.fillStyle = "rgba(11,13,18,0.8)"
      ctx.fillRect(cx - tw / 2 - 3, ty - 11, tw + 6, 15)
      ctx.fillStyle = bonus ? "#fcd34d" : "#e9e6ff"
      ctx.fillText(t, cx, ty)
    })
  }, [input, view, labels, size.w, size.h])
  return (
    <div className="full-map-screen" role="dialog" aria-modal="true" aria-label="Full map" onPointerDown={(e) => e.stopPropagation()}>
      <div className="full-map-head">
        <h2>Map</h2>
        <button type="button" className="touch-btn primary full-map-close" onClick={onClose}>
          Back
        </button>
      </div>
      <p className="fine">Tap a spot to fly XO there, or pick a dome.</p>
      <ul className="minimap-legend full-map-legend" aria-label="Map legend">
        <li className="mm-you">You</li>
        <li className="mm-col">Colonies, towns, moons</li>
        <li className="mm-orb">Gestalt</li>
        <li className="mm-foe">Enemy</li>
      </ul>
      <canvas
        ref={ref}
        className="full-map-canvas"
        width={size.w * 2}
        height={size.h * 2}
        style={{ width: size.w, height: size.h }}
        aria-label="Full map. Tap a spot to fly there."
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onFlyTo(minimapToWorld({ x: e.clientX - r.left, y: e.clientY - r.top }, input.world, size))
        }}
      />
      <div className="full-map-list" role="list">
        {[...labels]
          .sort((a, b) => Number(/\(bonus\)/i.test(b.label)) - Number(/\(bonus\)/i.test(a.label)))
          .map((l) => (
          <button
            key={l.id}
            type="button"
            role="listitem"
            className={`touch-btn full-map-dome${/\(bonus\)/i.test(l.label) ? " bonus" : ""}`}
            data-dome={l.id}
            onClick={() => onFlyTo({ x: l.x, y: l.y + 40 })}
          >
            Fly to {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}
