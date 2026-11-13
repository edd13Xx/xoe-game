import { mapCamera } from "../game/map-camera.ts"
import { settleRouteCheckpoints } from "../game/route-checkpoints.ts"
import { useDocumentHidden } from "./runtime.ts"
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { enterChipName } from "../game/enter-chip.ts"
import { recordEarn } from "../game/reward-plan.ts"
import { FounderBadge } from "./FounderBadge.tsx"
import { ColonySettlers, XoeCompanion } from "./MapCast.tsx"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { COLONIES, allColoniesCleared } from "../game/colonies.ts"
import { moonGateOpen, type GameState } from "../game/opening.ts"
import { contextLine, tipsForMap, type XoeTip } from "../game/xoe-guide.ts"
import { rosterLine } from "../game/xoe-guide.ts"
import { XoeGuidePanel } from "./XoeGuidePanel.tsx"
import {
  DAILY_BONUS_COINS,
  WEEKLY_BONUS_COINS,
  canClaimDailyBonus,
  canClaimWeeklyBonus,
  claimDailyBonus,
  claimWeeklyBonus,
  readMeta,
} from "../game/meta-progress.ts"
import {
  ENTER_RADIUS,
  WORLD_H,
  WORLD_W,
  XO_SPEED,
  buildOverworldNodes,
  chapterLockLabel,
  clamp,
  isNodeLocked,
  nextUnlockedColonyId,
  type OverworldNode,
} from "../game/overworld.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import { maybeShopPurchaseLine } from "../game/shop-lines.ts"
import { CHAPTER_INTROS } from "../game/chapters.ts"
import { readGamepadPreference, readGamepadStick } from "../game/gamepad-controls.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { formatColonyBestLabel, readColonyBests, type ColonyBest } from "../game/colony-bests.ts"
import {
  TAP_FLY_HINT_DESKTOP,
  TAP_FLY_HINT_TOUCH,
  keyboardMoveEnabled,
  prefersTouchPrimary,
  showOnScreenJoystick,
} from "../game/controls.ts"
import {
  COLD_STORAGE_STORY,
  pickSideMission,
  shouldOfferSideMission,
  noteColonyClearForSideMissions,
  markSideMissionOffered,
  type SideMissionDef,
} from "../game/side-missions.ts"
import { SideMissionView } from "./SideMissionView.tsx"
import { MiniMapHud } from "./PixelStage.tsx"
import { MapBackdrop } from "./MapBackdrop.tsx"
import { SolarFlareFx } from "./SolarFlareFx.tsx"
import { PlasmaCanvas } from "./PlasmaCanvas.tsx"
import { MOON_SCENERY } from "./overworld-scenery.ts"
import { OverworldScenery } from "./OverworldScenery.tsx"
import { musicBus } from "../game/music-bus.ts"
import { touchedItems } from "../game/ticker-play.ts"
import type { MinimapInput } from "../game/minimap.ts"
import { readPracticeExamBest } from "../game/practice-exam.ts"


/** HUD pieces drawn over the map; world tokens underneath them fade out. */
const HUD_OCCLUDERS = ".minimap-hud, .map-open-btn, .map-econ, .map-fight-btn, .map-trade, .map-fly-hint, .map-founder"

/** v18: px kept clear at the bottom of the phone map for the XOE dock (price row + Buy/Sell). */
const MAP_DOCK_RESERVE = 104 // v18.2: compact one-row phone dock (was 168)

/** v18: Chapter 1 shows once per run, not every time you come back from a lesson. */

function store() {
  return getLocalStore()
}

/**
 * Walkable Mars-like overworld: camera follows XO, path in story order.
 * Tap/click-to-fly primary. No on-screen joystick. Keyboard only on computer.
 */
/** env(safe-area-inset-bottom) in px (0 in a normal Safari tab, ~34 on a Home Screen iPhone app). */
function safeAreaBottom(): number {
  try {
    const probe = document.createElement("div")
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-bottom, 0px)"
    document.body.appendChild(probe)
    const h = probe.offsetHeight
    probe.remove()
    return Number.isFinite(h) ? Math.min(h, 60) : 0
  } catch {
    return 0
  }
}

export function ColonyMapView({
  state,
  onEnter,
  onMoons,
  onPracticeExam,
  onSkirmish,
  onToggleGuide,
  onAsk,
  onTicker,
  onPos,
  hud,
  trade,
  founder = false,
  reducedMotion = false,
  paused = false,
  onPlayOpening,
  redDay = false,
  notice,
  noticeOpen = false,
}: {
  state: GameState
  founder?: boolean
  onEnter: (colonyId: string, replay?: boolean) => void
  onMoons: () => void
  onPracticeExam?: () => void
  onSkirmish?: () => void
  onToggleGuide: () => void
  onAsk: (tip: XoeTip) => void
  onTicker?: (id: string, how: "touch" | "shield") => void
  /** v15: XO's map position, so ticker coins spawn where the player can see them. */
  onPos?: (p: { x: number; y: number }) => void
  /** v15: economy HUD shown inside the map so it stays on screen while flying. */
  hud?: ReactNode
  /** v16: live XOE trade HUD (chart + Buy/Sell) inside the flying world. */
  trade?: ReactNode
  paused?: boolean
  reducedMotion?: boolean
  /** Optional opening story; the map is the first playable screen after setup. */
  onPlayOpening?: () => void
  redDay?: boolean
  /**
   * v19 iPhone/WebKit pass: on phones the voice reminder sits in the page flow right UNDER the map
   * (not over it, not above it), so the map, minimap, XO and settlers are on screen right after
   * Start when ready. noticeOpen lets the map leave room for it and grow back when it closes.
   */
  notice?: ReactNode
  noticeOpen?: boolean
}) {
  const hidden = useDocumentHidden()
  const allSaved = allColoniesCleared(state.clearedColonies)
  const cleared = moonGateOpen(state)
  const companion = state.playerName
  const wrapRef = useRef<HTMLDivElement>(null)
  const nodes = useMemo(() => buildOverworldNodes(), [])
  const [pilotLevel, setPilotLevel] = useState(1)
  const [pos, setPos] = useState({ x: nodes[0]?.x ?? 200, y: nodes[0]?.y ?? 200 })
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null)
  const keysRef = useRef({ u: false, d: false, l: false, r: false })
  const activePointer = useRef<number | null>(null)
  const [near, setNear] = useState<OverworldNode | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [chapter, setChapter] = useState<(typeof CHAPTER_INTROS)[number] | null>(null)
  const [dailyOk, setDailyOk] = useState(true)
  const [weeklyOk, setWeeklyOk] = useState(true)
  const [colonyBests, setColonyBests] = useState<Record<string, ColonyBest>>({})
  const [touchPrimary] = useState(() => prefersTouchPrimary())
  const [sideMission, setSideMission] = useState<SideMissionDef | null>(null)
  const [examBest, setExamBest] = useState<number>(0)
  const offeredSide = useRef(false)
  const showStick = showOnScreenJoystick()
  const allowKeys = keyboardMoveEnabled(touchPrimary)
  const holdFollow = useRef(false)
  const holdPos = useRef<{ x: number; y: number } | null>(null)
  const padEnabled = useRef(false)
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([])

  useEffect(() => {
    const meta = settleRouteCheckpoints(store(), state.clearedColonies)
    setPilotLevel(meta.level)
    setDailyOk(canClaimDailyBonus(store()))
    setWeeklyOk(canClaimWeeklyBonus(store()))
    setColonyBests(readColonyBests(store()))
    setExamBest(readPracticeExamBest(store())?.bestScore ?? 0)
    padEnabled.current = readGamepadPreference(store()).enabled
  }, [state.clearedColonies, state.arcadeScore, paused])

  // v14 Founding Pilot gold ship trail (cosmetic).
  useEffect(() => {
    if (founder) setTrail((t) => [pos, ...t].slice(0, 8))
  }, [founder, pos])

  const nextId = nextUnlockedColonyId(nodes, pilotLevel, state.clearedColonies)

  useEffect(() => {
    if (!state.colonyFeedback) return
    noteColonyClearForSideMissions(store())
    if (offeredSide.current) return
    if (sideMission) return
    if (!shouldOfferSideMission(store(), state.clearedColonies.length)) return
    offeredSide.current = true
    markSideMissionOffered(store())
    setSideMission(pickSideMission())
  }, [state.colonyFeedback, state.clearedColonies.length, sideMission])

  useEffect(() => {
    if (paused || hidden) {
      keysRef.current = { u: false, d: false, l: false, r: false }
      holdFollow.current = false
      holdPos.current = null
      activePointer.current = null
    }
  }, [paused, hidden])



  const tryEnter = useCallback(
    (node: OverworldNode) => {
      if (node.kind === "daily") {
        const meta = readMeta(store())
        const next = claimDailyBonus(meta, store())
        if (!next) {
          setNote("Daily already claimed.")
          setDailyOk(false)
          return
        }
        setDailyOk(false)
        recordEarn(store(), "daily_practice")
        const line = maybeShopPurchaseLine(Date.now(), true)
        if (line) void xoSpeak(line)
        setNote(`Daily +${DAILY_BONUS_COINS} XOE`)
        return
      }
      if (node.kind === "weekly") {
        const meta = readMeta(store())
        const next = claimWeeklyBonus(meta, store())
        if (!next) {
          setNote("Weekly already claimed (resets Monday).")
          setWeeklyOk(false)
          return
        }
        setWeeklyOk(false)
        const line = maybeShopPurchaseLine(Date.now(), true)
        if (line) void xoSpeak(line)
        setNote(`Weekly +${WEEKLY_BONUS_COINS} XOE`)
        return
      }
      if (node.kind === "bonus") {
        // v18 optional lesson (Fees and leverage): always open, replay anytime.
        onEnter(node.id)
        return
      }
      if (node.kind === "town") {
        onEnter(node.id)
        return
      }
      if (isNodeLocked(node, pilotLevel, state.clearedColonies)) {
        setNote(`Locked ${chapterLockLabel(node)}`)
        return
      }
      if (state.clearedColonies.includes(node.id)) {
        setNote("Replay · tap Enter again for race ghost practice.")
        onEnter(node.id, true)
        return
      }
      onEnter(node.id)
    },
    [onEnter, pilotLevel, state.clearedColonies],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || hidden) return
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return
      const k = e.key.toLowerCase()
      if (allowKeys) {
        if (["arrowup", "w"].includes(k)) keysRef.current.u = e.type === "keydown"
        if (["arrowdown", "s"].includes(k)) keysRef.current.d = e.type === "keydown"
        if (["arrowleft", "a"].includes(k)) keysRef.current.l = e.type === "keydown"
        if (["arrowright", "d"].includes(k)) keysRef.current.r = e.type === "keydown"
      }
      if (e.type === "keydown" && (k === "enter" || k === "e") && near) tryEnter(near)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
    }
  }, [paused, hidden, allowKeys, near, tryEnter])

  useEffect(() => {
    keysRef.current = { u: false, d: false, l: false, r: false }
    holdFollow.current = false
    if (paused || hidden) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setPos((p) => {
        let vx = 0
        let vy = 0
        const k = keysRef.current
        if (k.u) vy -= 1
        if (k.d) vy += 1
        if (k.l) vx -= 1
        if (k.r) vx += 1
        const pad = readGamepadStick(padEnabled.current)
        if (pad) {
          vx += pad.x
          vy += pad.y
        }
        if (holdFollow.current && holdPos.current) {
          const dx = holdPos.current.x - p.x
          const dy = holdPos.current.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist > 4) {
            vx += dx / dist
            vy += dy / dist
          }
        } else if (target) {
          const dx = target.x - p.x
          const dy = target.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < 6) {
            setTarget(null)
          } else {
            vx += dx / dist
            vy += dy / dist
          }
        }
        // v18 perf: idle frames keep the same object so React skips the whole map re-render.
        if (vx === 0 && vy === 0) return p
        const mag = Math.hypot(vx, vy)
        if (mag > 1) {
          vx /= mag
          vy /= mag
        }
        const nx = clamp(p.x + vx * XO_SPEED * dt, 40, WORLD_W - 40)
        const ny = clamp(p.y + vy * XO_SPEED * dt, 40, WORLD_H - 40)
        if (nx === p.x && ny === p.y) return p
        return { x: nx, y: ny }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, paused, hidden])

  useEffect(() => {
    let found: OverworldNode | null = null
    for (const n of nodes) {
      if (Math.hypot(n.x - pos.x, n.y - pos.y) <= ENTER_RADIUS) {
        found = n
        break
      }
    }
    setNear((cur) => (cur?.id === found?.id ? cur : found))
    const bus = musicBus()
    const region = found?.id ?? (pos.y > 620 && pos.x > 540 && pos.x < 760 ? "sol" : pos.y > 620 && pos.x >= 760 ? "xelm" : "open")
    bus?.setRegion(region)
  }, [pos, nodes])

  // Ticker gameplay: XO flies into Gestalt (price up) / enemy units (price down) on the map.
  const hitRef = useRef(new Set<string>())
  useEffect(() => onPos?.(pos), [pos, onPos])
  // v15 playability: bring the map on screen when it opens and when the chapter card closes (phones scrolled past it).
  useEffect(() => {
    if (chapter) return
    try {
      wrapRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" })
    } catch {
      /* old browsers */
    }
  }, [chapter, reducedMotion])
  useEffect(() => {
    if (paused || hidden) return
    for (const it of touchedItems(state.tickerItems, pos.x, pos.y)) {
      if (it.symbol === "XOE" && it.kind === "orb") {
        setPos((p) => ({ x: p.x, y: clamp(p.y - 18, 40, 10000) }))
      }
      if (hitRef.current.has(it.id)) continue
      hitRef.current.add(it.id)
      onTicker?.(it.id, "touch")
      // Mid-flight or at a dome: keep the route clear so Enter stays reachable.
      // The Fight button still opens the same skirmish. Rewards and the ledger are unchanged.
      if (it.kind === "hazard" && !target && !near) onSkirmish?.()
    }
  }, [pos, state.tickerItems, onTicker, onSkirmish, paused, hidden, target, near])

  // v18: on phones the map fills the rest of the screen (iPhone Safari is ~393x659), so the dock,
  // Enter, and the chapter card all fit without scrolling. The camera keeps XO in the open sky above the dock.
  const [viewSize, setViewSize] = useState({ w: 390, h: 440 })
  const [fit, setFit] = useState<{ h: number } | null>(null)
  // v18: the "Tap the map to fly XO" hint folds away after the first tap so the map gets that room.
  const [flown, setFlown] = useState(false)
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (!el) return
      const w = el.clientWidth, measuredH = el.clientHeight
      setViewSize(v => v.w === w && v.h === measuredH ? v : { w, h: measuredH })
      if (window.innerWidth > 480 && !window.matchMedia("(pointer: coarse)").matches) {
        setFit(null)
        return
      }
      const top = el.getBoundingClientRect().top + window.scrollY
      // v19: leave room for the reminder under the map while it shows (it auto-hides after 12s)
      const below = noticeOpen ? (el.parentElement?.querySelector<HTMLElement>(":scope > .voice-reminder")?.offsetHeight ?? 0) + 12 : 0
      // v19: as a Home Screen app (viewport-fit=cover) the bottom of the screen sits under the iPhone home bar
      const h = Math.round(Math.max(window.innerHeight < 500 ? 190 : 300, Math.min(560, (window.visualViewport?.height ?? window.innerHeight) - top - 8 - below - safeAreaBottom())))
      setFit((f) => (f?.h === h ? f : { h }))
    }
    measure()
    window.addEventListener("resize", measure)
    window.visualViewport?.addEventListener("resize", measure)
    return () => { window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure) }
  }, [flown, state.colonyFeedback, note, noticeOpen])
  const viewH = fit?.h ?? viewSize.h
  const camera = mapCamera(pos, { w: viewSize.w, h: viewH }, fit ? MAP_DOCK_RESERVE : 0)
  const { x: camX, y: camY } = camera


  // v19 (night run): world tokens and colony names that slide under the HUD (mini-map, Map button, price chip,
  // Fight, the fly hint, the trade dock) fade out so they never read through the controls. Purely visual:
  // a faded Gestalt or Enemy still works when XO flies into it. One coalesced read-then-write pass per frame.
  const occlusionRaf = useRef(0)
  useEffect(() => {
    if (occlusionRaf.current) return
    occlusionRaf.current = requestAnimationFrame(() => {
      occlusionRaf.current = 0
      const wrap = wrapRef.current
      if (!wrap) return
      const huds = Array.from(wrap.querySelectorAll<HTMLElement>(HUD_OCCLUDERS))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
      const marks = Array.from(wrap.querySelectorAll<HTMLElement>(".world-ticker, .world-dome .dome-name"))
      const hits = marks.map((el) => {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        // Fade when the token's centre sits under a control, or a real slice of it is covered.
        return huds.some((h) => {
          if (cx >= h.left && cx <= h.right && cy >= h.top && cy <= h.bottom) return true
          const ix = Math.max(0, Math.min(r.right, h.right) - Math.max(r.left, h.left))
          const iy = Math.max(0, Math.min(r.bottom, h.bottom) - Math.max(r.top, h.top))
          return r.width * r.height > 0 && (ix * iy) / (r.width * r.height) > 0.15
        })
      })
      marks.forEach((el, i) => {
        const target = el.classList.contains("dome-name") ? el.parentElement : el
        target?.classList.toggle(el.classList.contains("dome-name") ? "name-under-hud" : "under-hud", hits[i] ?? false)
      })
    })
  })
  useEffect(() => () => { if (occlusionRaf.current) cancelAnimationFrame(occlusionRaf.current) }, [])

  const miniInput = useMemo<MinimapInput>(
    () => ({
      world: { w: WORLD_W, h: WORLD_H },
      player: pos,
      nodes: nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        kind: n.kind,
        done: state.clearedColonies.includes(n.id),
        next: n.id === nextId,
        locked: isNodeLocked(n, pilotLevel, state.clearedColonies),
      })),
      enemies: state.tickerItems.filter((it) => it.kind === "hazard").map((it) => ({ id: it.id, x: it.wx, y: it.wy })),
      pickups: state.tickerItems.filter((it) => it.kind === "orb").map((it) => ({ id: it.id, x: it.wx, y: it.wy })),
    }),
    [pos, nodes, state.clearedColonies, state.tickerItems, nextId, pilotLevel],
  )
  const miniView = useMemo(() => ({ x: camX, y: camY, w: camera.w, h: camera.h }), [camX, camY, camera.w, camera.h])


  const pathColonies = useMemo(
    () => nodes.filter((n) => n.kind === "colony").sort((a, b) => a.storyOrder - b.storyOrder),
    [nodes],
  )

  // v18 perf: the world (sky, path, domes) and the ticker items only re-render when their data changes,
  // not on every flight frame. Only the camera transform and the XO avatar move per frame.
  const staticLayer = useMemo(
    () => (
      <>
      <div className="mars-world-sky" />
      <div className="mars-world-haze" />
      <OverworldScenery />
      <svg className="mars-path" width={WORLD_W} height={WORLD_H} aria-hidden="true">
        {pathColonies.map((n, i) => {
          const next = pathColonies[i + 1]
          if (!next) return null
          const highlight =
            n.id === nextId || next.id === nextId || state.clearedColonies.includes(n.id)
          return (
            <line
              key={`${n.id}-${next.id}`}
              x1={n.x}
              y1={n.y}
              x2={next.x}
              y2={next.y}
              className={highlight ? "path-lit" : "path-dirt"}
            />
          )
        })}
      </svg>
      {nodes.map((n) => {
        const locked = isNodeLocked(n, pilotLevel, state.clearedColonies)
        const done =
          (n.kind === "colony" && state.clearedColonies.includes(n.id)) ||
          (n.kind === "bonus" && state.bonusLessonsCleared.includes(n.id))
        const isNext = n.id === nextId
        return (
          <div
            key={n.id}
            className={`world-dome${locked ? " locked" : ""}${done ? " done" : ""}${isNext ? " next" : ""} ${n.kind}`}
            style={{ left: n.x, top: n.y }}
          >
            <span className="dome-glow" />
            <span className="dome-atmo" />
            {locked ? <span className="lock-icon" aria-label="locked">🔒 {chapterLockLabel(n)}</span> : null}
            <span className="dome-name">
              {done ? "✓ " : ""}
              {n.label}
              {n.kind === "daily" ? ` · ${dailyOk ? "open" : "done"}` : ""}
              {n.kind === "weekly" ? ` · ${weeklyOk ? "open" : "done"}` : ""}
            </span>
            {n.kind === "colony" && formatColonyBestLabel(colonyBests[n.id] ?? null) ? (
              <span className="dome-best" data-colony-best={n.id}>
                {formatColonyBestLabel(colonyBests[n.id] ?? null)}
              </span>
            ) : null}
          </div>
        )
      })}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, pathColonies, nextId, pilotLevel, state.clearedColonies, state.bonusLessonsCleared, dailyOk, weeklyOk, colonyBests],
  )
  const tickerLayer = useMemo(
    () => (
      <>
      {state.tickerItems.map((it) => (
        <div
          key={it.id}
          className={`world-ticker ticker-${it.kind}${it.kind === "orb" ? " ticker-gestalt" : " ticker-enemy"}${it.size ? ` size-${it.size}` : ""}${it.kind === "orb" && it.symbol === "XOE" ? " ticker-updraft" : ""}`}
          data-ticker={it.kind === "orb" ? "gestalt" : "enemy"}
          style={{ left: it.wx, top: it.wy }}
          role="img"
          aria-label={it.kind === "orb" ? "Gestalt" : "Enemy unit"}
        >
          {it.kind === "orb" ? (
            <>
              {it.symbol === "XOE" ? <span className="hz">▲</span> : null}
              <span className="gestalt-pip" aria-hidden="true" />
            </>
          ) : (
            <span className="enemy-bot" aria-hidden="true"><span className="hz">▼</span></span>
          )}
          <span className="tk-sym">{it.kind === "orb" ? "Gestalt" : "Enemy"}</span>
        </div>
      ))}
      </>
    ),
    [state.tickerItems],
  )

  return (
    <article className="copy-block colony-map-view">
      <h1 tabIndex={-1}>Colony route</h1>
      {!flown && !fit ? (
      <p className="first-steps" data-first-steps="1">
        <b>Tap the map to fly XO.</b> Grab green Gestalt. Enter a glowing dome.
      </p>
      ) : null}
      {!flown && !fit ? (
        <div className="first-steps-actions menu-row">
          {onPlayOpening ? (
            <button type="button" className="touch-btn ghost" onClick={onPlayOpening}>
              Opening story
            </button>
          ) : null}
          <button type="button" className="touch-btn ghost" onClick={() => setChapter(CHAPTER_INTROS[0]!)}>
            Chapters
          </button>
        </div>
      ) : null}
      {state.colonyFeedback ? <p className="ok" role="status">{state.colonyFeedback}</p> : null}
      {note ? <p className="ok" role="status">{note}</p> : null}
      {state.tickerNote ? <p className="fine ticker-note" role="status">{state.tickerNote}</p> : null}

      <div
        className={`mars-world-shell${chapter ? " has-chapter" : ""}${fit ? " fit-phone" : ""}${redDay ? " is-red-day" : ""}`}
        ref={wrapRef}
        style={fit ? { height: fit.h } : undefined}
      >
        <MapBackdrop reducedMotion={reducedMotion} redDay={redDay} />
        <PlasmaCanvas reducedMotion={reducedMotion} redDay={redDay} mode="backdrop" />
        {chapter ? (
          <div className="chapter-card panel chapter-overlay" role="dialog" aria-label={chapter.title}>
            <h2>{chapter.title}</h2>
            <p className="chapter-body">{chapter.body}</p>
            {/* v18: Continue + chapter picks share one 48px row so the card stays above the trade dock. */}
            <div className="menu-row chapter-picks" role="group" aria-label="Read a chapter">
              <button type="button" className="touch-btn primary chapter-continue" onClick={() => setChapter(null)}>
                Continue
              </button>
              {CHAPTER_INTROS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`touch-btn ghost${c.id === chapter.id ? " is-current" : ""}`}
                  aria-label={c.title}
                  aria-pressed={c.id === chapter.id}
                  onClick={() => setChapter(c)}
                >
                  {c.title.replace("Chapter ", "Ch ")}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div
          className="mars-world"
          style={{ width: WORLD_W, height: WORLD_H, transform: `translate(${-camX}px, ${-camY}px)` }}
          onPointerDown={(e) => {
            if (paused || hidden || activePointer.current !== null) return
            activePointer.current = e.pointerId
            if (showStick && (e.target as HTMLElement).closest(".joy-base")) return
            holdFollow.current = true
            if (!flown) setFlown(true)
            const el = wrapRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            const wx = clamp(camX + (e.clientX - r.left), 40, WORLD_W - 40)
            const wy = clamp(camY + (e.clientY - r.top), 40, WORLD_H - 40)
            holdPos.current = { x: wx, y: wy }
            setTarget({ x: wx, y: wy })
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!holdFollow.current || activePointer.current !== e.pointerId) return
            const el = wrapRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            holdPos.current = {
              x: clamp(camX + (e.clientX - r.left), 40, WORLD_W - 40),
              y: clamp(camY + (e.clientY - r.top), 40, WORLD_H - 40),
            }
          }}
          onPointerCancel={() => { activePointer.current = null; holdFollow.current = false; holdPos.current = null; setTarget(null) }}
          onLostPointerCapture={() => { activePointer.current = null; holdFollow.current = false; holdPos.current = null }}
          onPointerUp={(e) => {
            if (activePointer.current !== e.pointerId) return
            activePointer.current = null
            holdFollow.current = false
            // short click already set target once in pointerdown
            holdPos.current = null
            try {
              ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
            } catch { /* ignore */ }
          }}
        >
          {staticLayer}
          {tickerLayer}
          {state.tickerPop ? (
            <div key={state.tickerPop.id} className={`coin-pop${state.tickerPop.good ? "" : " bad"}`} style={{ left: state.tickerPop.wx, top: state.tickerPop.wy }} aria-hidden="true">
              {state.tickerPop.text}
            </div>
          ) : null}
          {founder
            ? trail.map((p, i) => (
                <i
                  key={i}
                  className="gold-trail-dot"
                  data-gold-trail="1"
                  style={{ left: p.x - (i + 1) * 7, top: p.y + (i % 2 ? 2 : -2), opacity: 0.85 - i * 0.1 }}
                />
              ))
            : null}
          {redDay ? <SolarFlareFx reducedMotion={reducedMotion} /> : null}
          <div
            className="solar-flare-explosion"
            style={{ left: (MOON_SCENERY.find((m) => m.id === "sol") ?? { x: 640, y: 700 }).x, top: (MOON_SCENERY.find((m) => m.id === "sol") ?? { x: 640, y: 700 }).y }}
            aria-hidden="true"
          >
            <PlasmaCanvas reducedMotion={reducedMotion} redDay={redDay} mode="sol" />
          </div>
          <ColonySettlers nodes={nodes} />
          <div className={`${founder ? "xo-avatar gold-trail" : "xo-avatar"}${redDay ? " is-struggling" : ""}`} style={{ left: pos.x, top: pos.y }} aria-label={`XO craft, ${companion}${redDay ? ", struggling in the solar flare" : ""}`}>
            <span className="xo-ship" aria-hidden="true" />
            <span className="xo-ship-shadow" aria-hidden="true" />
            XO
          </div>
          <XoeCompanion x={pos.x} y={pos.y} reducedMotion={reducedMotion} />
        </div>

        {hud ? <div className="map-econ">{hud}</div> : null}
        {onSkirmish ? <button type="button" className="touch-btn map-fight-btn" aria-label="Skirmish fight" disabled={paused} onClick={onSkirmish}>Fight</button> : null}
        {trade ? (
          <div className="map-trade">
            {/* v18.3 (QA fix 1): on phones the big Enter bar is replaced by a small Enter chip in the Buy/Sell row */}
            {near && !chapter && isValidElement(trade)
              ? cloneElement(trade as ReactElement<{ dockExtra?: ReactNode }>, {
                  dockExtra: (
                    <button
                      type="button"
                      className="touch-btn primary enter-chip"
                      data-enter-chip="1"
                      disabled={near.kind === "colony" && isNodeLocked(near, pilotLevel, state.clearedColonies)}
                      onClick={() => tryEnter(near)}
                      title={
                        near.kind === "colony" && isNodeLocked(near, pilotLevel, state.clearedColonies)
                          ? `Locked ${enterChipName(near.label)} — ${chapterLockLabel(near)}`
                          : `Enter ${enterChipName(near.label)} — ${near.label}`
                      }
                    >
                      <span className="enter-chip-verb">
                        {near.kind === "colony" && isNodeLocked(near, pilotLevel, state.clearedColonies) ? "Locked" : "Enter"}
                      </span>{" "}
                      <span className="enter-chip-name">{enterChipName(near.label)}</span>
                    </button>
                  ),
                })
              : trade}
          </div>
        ) : null}
        {!flown && fit ? (
          <p className="map-fly-hint" data-first-steps="1">
            <b>Tap to fly.</b> Grab green Gestalt. Enter a dome.
          </p>
        ) : null}
        <MiniMapHud
          input={miniInput}
          view={miniView}
          animate={!reducedMotion}
          onFlyTo={setTarget}
          labels={nodes.map((n) => ({ id: n.id, label: n.label, x: n.x, y: n.y }))}
        />
        {founder ? (
          <div className="map-founder">
            <FounderBadge small />
          </div>
        ) : null}

        {showStick ? (
          <div className="joy-base" aria-label="Joystick">
            <div className="joy-knob" />
          </div>
        ) : null}

        {near && !chapter ? (
          <div className="enter-prompt">
            <p>
              {near.kind === "colony" && isNodeLocked(near, pilotLevel, state.clearedColonies)
                ? `Locked ${chapterLockLabel(near)}`
                : `Enter ${near.label}?`}
            </p>
            <button
              type="button"
              className="touch-btn primary"
              disabled={near.kind === "colony" && isNodeLocked(near, pilotLevel, state.clearedColonies)}
              onClick={() => tryEnter(near)}
              aria-label={`Enter ${near.label}`}
            >
              {/* v18.2: the button names the dome, so phones (where the line above is hidden) still show it */}
              Enter {near.label.replace(/\s*\(bonus\)\s*$/i, "")}
            </button>
          </div>
        ) : null}
      </div>
      {notice}

      <p className="narration">
Live XOE world — fly, trade, and learn in one place. Testnet only. No real money.
      </p>
      <p className="fine">{rosterLine(state.characterId)} · Pilot Lv {pilotLevel}</p>
      <p className="fine">{touchPrimary ? TAP_FLY_HINT_TOUCH : TAP_FLY_HINT_DESKTOP}</p>
      <p className="fine">{COLD_STORAGE_STORY}</p>
      <p className="fine">
        {state.tickerScore ? `Ticker pts ${state.tickerScore} · ` : ""}Colonies: {COLONIES.length}.{" "}
        {allSaved
          ? "All clear — optional exam, then moon path."
          : `${state.clearedColonies.length}/${COLONIES.length} saved.${state.qaMoons ? " QA test mode: moon path open." : ""}`}
        {examBest > 0 ? ` · Exam best ${examBest}` : ""}
      </p>
      {cleared ? (
        <div className="menu-row">
          {onPracticeExam && allSaved ? (
            <button type="button" className="touch-btn ghost" onClick={onPracticeExam}>
              Practice exam moon
            </button>
          ) : null}
          <button type="button" className="touch-btn primary" onClick={onMoons}>
            {state.moonId ? "Face Ragnarok" : "Choose moon path"}
          </button>
        </div>
      ) : null}
      {sideMission ? (
        <SideMissionView
          mission={sideMission}
          onClose={() => setSideMission(null)}
          onAwarded={() => setNote("Side mission clear · points on this device")}
        />
      ) : null}
      <XoeGuidePanel
        companionName={companion}
        context={contextLine({ companionName: companion, phase: "colony-map", colonyId: null, bossStep: 0 })}
        tips={tipsForMap()}
        open={state.xoeGuideOpen}
        reply={state.xoeGuideReply}
        onToggle={onToggleGuide}
        onAsk={onAsk}
      />
    </article>
  )
}
