import { focusSceneEntry } from "./ui/scene-entry-focus.ts"
import { cancelGrokRequests } from "./game/grok-requests.ts"
import { settlePaperSession } from "./game/paper-session.ts"
import { SoundChip } from "./ui/SoundChip.tsx"
import { installFirstTapAudioUnlock, isSoundMuted, unlockAudioInGesture } from "./game/audio-unlock.ts"
import { getCompanionBrain } from "./game/companion-brain.ts"
import { liveState, onLiveStatus } from "./game/live-status.ts"
import { GAME_FULL_NAME, GAME_SHORT_NAME } from "./game/brand.ts" // "XOE: Unknown Orbital Engine"
import { Component, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { ReactNode } from "react"
import { COLONIES } from "./game/colonies.ts"
import { dailyCap, hasFounderBadge, readLedger, recordCoin, recordColonyProgress, recordTradePnl } from "./game/reward-plan.ts"
import { PLAY_UNIT, SIM_USD_NOTE, formatPlay, formatPlayAmount } from "./game/economy.ts"
import { pilotById, suitById } from "./game/content.ts"
import { localHour, skyPhase } from "./game/daynight.ts"
import type { DialogueMode } from "./game/dialogue.ts"
import { shouldAnimate } from "./game/dialogue.ts"
import { createMusicController, themeForPhase } from "./game/music.ts"
import { bindMusicController } from "./game/music-bus.ts"
import { useSolarFlare } from "./ui/useSolarFlare.ts"
import { helpContextFor } from "./game/xoe-help.ts"
import { XoeHelpButton } from "./ui/XoeHelpButton.tsx"
import { inputFromKey, inputFromTouch, type TouchControl } from "./game/movement.ts"
import { createOpening, openingReducer, type GameState } from "./game/opening.ts"
import { applyPaperAction, applyPracticeTick, canBuy, finalizePractice, initialPractice, paperResultStroops, type PaperAction, type PracticeState } from "./game/practice.ts"
import type { SceneId } from "./game/sprites.ts"
import type { XoeTip } from "./game/xoe-guide.ts"
import { HEADER_SUBTITLE_GROK, HEADER_SUBTITLE_OFFLINE } from "./game/companion-brain.ts"
import { CinematicChoice, CinematicPlayer } from "./ui/Cinematic.tsx"
import { ColonyLessonView } from "./ui/ColonyLessonView.tsx"
import { ColonyMapView } from "./ui/ColonyMapView.tsx"
import { EndingView } from "./ui/EndingView.tsx"
import { TownView } from "./ui/TownView.tsx"
import { isTownId } from "./game/towns.ts"
import { MoonApproachView } from "./ui/MoonApproachView.tsx"
import { AskGrokPanel } from "./ui/AskGrokPanel.tsx"
import { FaqPanel } from "./ui/FaqPanel.tsx"
import { OPEN_ASK_EVENT, OPEN_FAQ_EVENT } from "./game/faq-nav.ts"
import { ReportProblemPanel } from "./ui/ReportProblemPanel.tsx"
import { AutoErrorHint } from "./ui/AutoErrorHint.tsx"
import { MoonChoiceView } from "./ui/MoonChoiceView.tsx"
import { ShotHarness } from "./ui/ShotHarness.tsx"
import { XoSpeechBubble } from "./ui/XoSpeechBubble.tsx"
import { NavView } from "./ui/NavView.tsx"
import { PixelStage } from "./ui/PixelStage.tsx"
import { PracticeView } from "./ui/PracticeView.tsx"
import { RagnarokView } from "./ui/RagnarokView.tsx"
import { RescueView } from "./ui/RescueView.tsx"
import { playLocalScoff, useDocumentHidden, usePhoneMapLayout, usePrefersReducedMotion, useSpeechSupport } from "./ui/runtime.ts"
import { StoryView } from "./ui/StoryView.tsx"
import {
  canAttemptLiveGrok,
  readGrokConnectSettings,
  disconnectGrok,
  GROK_CONNECT_STORAGE_KEY,
  shouldShowGrokFirstRunPanel,
  writeGrokFirstRunDismissed,
  type GrokConnectSettings,
} from "./game/grok-connect-settings.ts"
import { probeLiveGrok, type GrokProbeResult } from "./game/grok-live-probe.ts"
import { getLocalStore } from "./game/safe-storage.ts"
import { installGlobalErrorHooks, logClientError } from "./game/error-log.ts"
import { recordPersonalBest } from "./game/meta-progress.ts"
import { recordColonyBest } from "./game/colony-bests.ts"
import { HighScoreScreen } from "./ui/HighScoreScreen.tsx"
import { openDrawer, type DrawerId } from "./game/drawer.ts"
import { LiveTicker } from "./ui/LiveTicker.tsx"
import { LiveTradeHud } from "./ui/LiveTradeHud.tsx"
import { PaperAdvancedDrawer } from "./ui/PaperAdvancedDrawer.tsx"
import { FightView } from "./ui/FightView.tsx"
import { readTickerPref } from "./game/live-ticker.ts"
import { cadenceItem, itemsFromMoves, pushRecent, tickerMoves, xoeWorldItems } from "./game/ticker-play.ts"
import { TickerContext, useTickerFeed, xoePriceFromSnap } from "./ui/useTickerFeed.ts"
import { TutorialPanel } from "./ui/TutorialPanel.tsx"
import { XOrbitalMenu, type MenuMode, type MenuSection } from "./ui/XOrbitalMenu.tsx"
import { AccountWalletDrawer } from "./ui/AccountWalletDrawer.tsx"
import { VoiceReminderBanner } from "./ui/VoiceReminderBanner.tsx"
import { pilotHeaderLabel } from "./game/pilot-label.ts"

/** v18 perf: the decorative stage is display:none on phones in the map and lessons, so do not animate it there. */
function stageHiddenOnPhone(phase: string): boolean {
  // Front menu already has the orbital cover; keep the decorative stage still.
  if (phase === "pilot-select") return true
  const cinematic = phase === "ragnarok" || phase === "ending" || phase === "moon-choice" || phase === "moon-approach"
  const playField = phase === "colony-map" || phase === "colony-lesson"
  try {
    const phone = window.matchMedia("(max-width: 480px)").matches
    const shortDesk = window.matchMedia("(max-height: 920px)").matches
    if (phone && (playField || cinematic)) return true
    // v18.1: short desktop windows hide the stage on the colony map too (see index.css)
    return phase === "colony-map" && shortDesk
  } catch {
    return false
  }
}
import { readQaCredits, readQaMode } from "./game/qa-flags.ts"
import { VoiceCommandMic } from "./ui/VoiceCommandMic.tsx"
import {
  markVoiceReminderShown,
  noteColonyClearForVoiceReminder,
  shouldShowVoiceReminder,
} from "./game/voice-reminder.ts"
import { noteColonyClearForSideMissions } from "./game/side-missions.ts"
import { MarketPanel } from "./ui/MarketPanel.tsx"

installGlobalErrorHooks()

class SceneBoundary extends Component<
  { children: ReactNode },
  { message: string | null; detail: string | null }
> {
  state = { message: null as string | null, detail: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    logClientError("boundary", error, "This scene failed to draw.")
    if (error instanceof Error) {
      const stackLine = (error.stack || "").split("\n").slice(0, 3).join(" | ")
      return {
        message: error.message || "This scene failed to draw.",
        detail: `${error.name}${stackLine ? ` · ${stackLine}` : ""}`,
      }
    }
    return { message: "This scene failed to draw.", detail: String(error) }
  }

  render() {
    if (this.state.message) {
      return (
        <div role="alert" className="scene-error">
          <p>This scene failed to draw. {this.state.message}</p>
          {this.state.detail ? <p className="fine scene-error-detail">{this.state.detail}</p> : null}
        </div>
      )
    }
    return this.props.children
  }
}

function sceneFor(state: GameState): SceneId {
  switch (state.phase) {
    case "pilot-select":
    case "moon-choice":
    case "moon-approach":
      return "cinematic-2"
    case "wake":
      return "wake"
    case "missing-pilot":
      return "missing-pilot"
    case "auto-battle":
    case "ragnarok":
      return "auto-battle"
    case "cockpit-invite":
    case "cinematic-choice":
      return "cockpit-invite"
    case "cinematic":
      if (state.cinematicIndex <= 0) return "cinematic-1"
      if (state.cinematicIndex === 1) return "cinematic-2"
      return "cinematic-3"
    case "practice-pause":
    case "practice":
    case "colony-map":
    case "colony-lesson":
      return "practice"
    case "near-loss":
      return "near-loss"
    case "sis-rescue":
      return "rescue"
    case "navigate":
      return "navigate"
    case "ending":
    case "blackout":
      return "cinematic-3"
    default: {
      const neverPhase: never = state.phase
      return neverPhase
    }
  }
}

export default function App() {
  const shot = (() => {
    try {
      return new URLSearchParams(window.location.search).get("shot")
    } catch {
      return null
    }
  })()
  // Screenshot harness is a dev-server tool only; the player build drops it (v13 streamline).
  if (shot && import.meta.env.DEV) {
    return (
      <SceneBoundary>
        <div className="top">
          <h1>{GAME_FULL_NAME}</h1>
          <p className="top-subtitle">Screenshot harness</p>
        </div>
        <ShotHarness shot={shot} />
      </SceneBoundary>
    )
  }
  return <Game />
}

function Game() {
  const [state, dispatch] = useReducer(openingReducer, undefined, createOpening)
  // v18: ?qa=1 opens the moon picker for XOE QA (test-only, off by default, adds nothing).
  useEffect(() => {
    if (readQaMode()) dispatch({ type: "qa-unlock-moons" })
  }, [])
  const mapShot = (() => {
    try {
      return new URLSearchParams(window.location.search).get("mapShot") === "1"
    } catch {
      return false
    }
  })()
  // v12: one XOE menu. "launch" at start (over the idle play scene), "pause" during play.
  const [menu, setMenu] = useState<MenuMode | null>(mapShot ? null : "launch")
  const [menuSection, setMenuSection] = useState<MenuSection | null>(null)
  const started = menu !== "launch"
  const [drawer, setDrawer] = useState<DrawerId | null>(null)
  const [grokConnect, setGrokConnect] = useState<GrokConnectSettings>(() => readGrokConnectSettings(null))
  const [showGrokKeyBox, setShowGrokKeyBox] = useState(true)
  const [mapFight, setMapFight] = useState(false)
  const fightOverlayRef = useRef<HTMLDivElement>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const phoneMapLayout = usePhoneMapLayout()
  const [tickerEnabled] = useState(() => {
    try {
      return readTickerPref(getLocalStore())
    } catch {
      return true
    }
  })
  const [grokProbe, setGrokProbe] = useState<GrokProbeResult>("builtin")
  const prevClearedRef = useRef(0)
  const [founder, setFounder] = useState(hasFounderBadge)

  const openOne = useCallback((id: DrawerId | null) => {
    // Settings live inside the menu itself, so "settings" opens that section instead of a drawer.
    if (id === "settings") {
      setMenu((m) => m ?? "pause")
      setMenuSection("settings")
      setDrawer(null)
      return
    }
    setDrawer((cur) => openDrawer(cur, id))
  }, [])
  // v18.3 (XOE-004): lessons, the loss card and the FAQ open drawers through a small in-page event bus
  useEffect(() => {
    const openFaq = () => {
      setDrawer(null) // re-mount so the FAQ reads the pending section
      window.setTimeout(() => setDrawer("faq"), 0)
    }
    const openAsk = () => {
      setDrawer(null)
      window.setTimeout(() => setDrawer("ask-grok"), 0)
    }
    window.addEventListener(OPEN_FAQ_EVENT, openFaq)
    window.addEventListener(OPEN_ASK_EVENT, openAsk)
    return () => {
      window.removeEventListener(OPEN_FAQ_EVENT, openFaq)
      window.removeEventListener(OPEN_ASK_EVENT, openAsk)
    }
  }, [])
  const closeDrawer = useCallback(() => {
    setDrawer(null)
    setFounder(hasFounderBadge())
  }, [])

  const applyGrok = useCallback((next: GrokConnectSettings) => {
    setGrokConnect(next)
    // Save/test owns its probe. Editing a key must never send a request per keystroke.
    if (!canAttemptLiveGrok(next)) setGrokProbe("builtin")
  }, [])

  useEffect(() => {
    try {
      const store = getLocalStore()
      const settings = readGrokConnectSettings(store)
      setGrokConnect(settings)
      setShowGrokKeyBox(shouldShowGrokFirstRunPanel(store) || !settings.apiKey.trim())
      if (canAttemptLiveGrok(settings)) void probeLiveGrok(settings).then(setGrokProbe)
      else setGrokProbe("builtin")
    } catch {
      setGrokConnect(readGrokConnectSettings(null))
      setShowGrokKeyBox(true)
      setGrokProbe("builtin")
    }
  }, [])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== GROK_CONNECT_STORAGE_KEY && event.key !== null) return
      cancelGrokRequests()
      const next = event.newValue === null ? disconnectGrok(getLocalStore()) : readGrokConnectSettings(getLocalStore())
      setGrokConnect(next)
      setGrokProbe("builtin")
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  const lessonStartedAt = useRef<number | null>(null)
  useEffect(() => {
    if (state.phase === "colony-lesson" && state.activeColonyId) {
      lessonStartedAt.current = Date.now()
    }
  }, [state.phase, state.activeColonyId])

  useEffect(() => {
    const n = state.clearedColonies.length
    if (n > prevClearedRef.current && state.arcadeScore > 0) {
      const last = state.clearedColonies[n - 1] ?? "arcade"
      const store = getLocalStore()
      recordPersonalBest(store, state.arcadeScore, `Arcade · ${last}`)
      const elapsed =
        lessonStartedAt.current != null ? Math.max(1, Date.now() - lessonStartedAt.current) : null
      recordColonyBest(store, last, state.arcadeScore, elapsed)
      noteColonyClearForSideMissions(store)
      noteColonyClearForVoiceReminder(store)
      setFounder(recordColonyProgress(store, state.clearedColonies, COLONIES.map((c) => c.id)).founderBadge)
      lessonStartedAt.current = null
    }
    prevClearedRef.current = n
  }, [state.clearedColonies, state.arcadeScore])

  // v18.2: the header shows what is really answering: "Live Grok Bot: connected", "Built-in AI", or a problem.
  const [liveTick, setLiveTick] = useState(0)
  useEffect(() => onLiveStatus(() => setLiveTick((n) => n + 1)), [])
  const live = useMemo(() => liveState(), [liveTick, grokProbe, grokConnect]) // eslint-disable-line react-hooks/exhaustive-deps
  const headerSubtitle = grokProbe === "live" && live.state !== "error" ? HEADER_SUBTITLE_GROK : live.state === "builtin" ? HEADER_SUBTITLE_OFFLINE : live.label
  const [now, setNow] = useState(() => new Date())
  const speech = useSpeechSupport()
  const reducedMotion = usePrefersReducedMotion()
  const hidden = useDocumentHidden()
  const playFrozen = menu !== null
  useEffect(() => { if (mapFight && !playFrozen) fightOverlayRef.current?.focus() }, [mapFight, playFrozen])
  const animate = shouldAnimate({
    hidden,
    reducedMotion,
    storyPaused: state.paused || playFrozen,
  })
  // Ticker gameplay: one feed → display + Gestalt / enemy units on the map and in lessons (v13), tuned for calm markets (v15).
  const feedActive = !hidden
  const scenePhase = useRef(state.phase)
  useEffect(() => {
    const previous = scenePhase.current
    if (previous === state.phase) return
    scenePhase.current = state.phase
    if (!playFrozen) focusSceneEntry(state.phase, previous)
  }, [state.phase, playFrozen])

  const worldLive = (state.phase === "colony-map" || state.phase === "colony-lesson") && !playFrozen
  // v19 iPhone pass: the map (and its minimap/XO/settlers) comes first on phones; the reminder goes under it
  const reminderUnderMap = phoneMapLayout && state.phase === "colony-map"
  const tickerActive = worldLive
  const { snap: tickerSnap, history: tickerHistory } = useTickerFeed(tickerEnabled, feedActive)

  useEffect(() => {
    if (state.phase !== "practice-pause" && state.phase !== "practice") return
    dispatch({
      type: "prime-practice",
      unclaimedStroops: readLedger(getLocalStore()).unclaimed,
      price: xoePriceFromSnap(tickerSnap) ?? undefined,
    })
  }, [state.phase])
  const prevSnapRef = useRef(tickerSnap)
  const recentRef = useRef<number[]>([])
  const lastSpawnRef = useRef(Date.now())
  const seqRef = useRef(0)
  const mapPosRef = useRef<{ x: number; y: number } | null>(null)
  const onMapPos = useCallback((p: { x: number; y: number }) => void (mapPosRef.current = p), [])
  const [worldDesk, setWorldDesk] = useState<PracticeState>(() =>
    initialPractice({ unclaimedStroops: 0, price: 10 }),
  )
  const worldDeskRef = useRef(worldDesk)
  worldDeskRef.current = worldDesk
  const starterTradeRef = useRef(false)
  const lastXoePx = useRef<number | null>(null)
  const wasMap = useRef(false)
  useEffect(() => {
    if (state.phase === "colony-map") {
      wasMap.current = true
      return
    }
    if (!wasMap.current) return
    wasMap.current = false
    const settled = settlePaperSession(worldDeskRef.current, (pnl) => {
      if (pnl !== 0) recordTradePnl(getLocalStore(), pnl)
      return readLedger(getLocalStore()).unclaimed
    })
    worldDeskRef.current = settled.next
    setWorldDesk(settled.next)
  }, [state.phase])
  useEffect(() => {
    if (state.phase !== "colony-map") return
    setWorldDesk((d) => {
      if (d.step > 0 || d.lastAction) return d
      const base = initialPractice({ unclaimedStroops: readLedger(getLocalStore()).unclaimed, price: xoePriceFromSnap(tickerSnap) ?? d.price })
      if (!starterTradeRef.current && canBuy(base, base.price)) {
        starterTradeRef.current = true
        return applyPaperAction(base, "buy", base.price)
      }
      return base
    })
  }, [state.phase])
  useEffect(() => {
    const prev = prevSnapRef.current
    prevSnapRef.current = tickerSnap
    if (!tickerSnap || !tickerActive) return
    const now = Date.now()
    const moves = tickerMoves(prev, tickerSnap)
    const items = itemsFromMoves(moves, now, recentRef.current, mapPosRef.current)
    recentRef.current = pushRecent(recentRef.current, moves)
    if (items.length) lastSpawnRef.current = now
    dispatch({ type: "ticker-spawn", items, now })
  }, [tickerSnap, tickerActive])
  useEffect(() => {
    const px = xoePriceFromSnap(tickerSnap)
    if (px == null) return
    const prev = lastXoePx.current
    lastXoePx.current = px
    setWorldDesk((d) => applyPracticeTick(d, px))
    if (!worldLive || prev == null) return
    const items = xoeWorldItems(prev, px, Date.now(), mapPosRef.current)
    if (items.length) {
      lastSpawnRef.current = Date.now()
      dispatch({ type: "ticker-spawn", items, now: Date.now() })
    }
  }, [tickerSnap, worldLive])
  useEffect(() => {
    if (!tickerActive) return
    lastSpawnRef.current = Math.min(lastSpawnRef.current, Date.now() - 6000) // first coin within ~3s
    const id = window.setInterval(() => {
      const now = Date.now()
      const drift = cadenceItem(prevSnapRef.current, lastSpawnRef.current, now, seqRef.current, mapPosRef.current)
      if (drift) {
        seqRef.current += 1
        lastSpawnRef.current = now
      }
      dispatch({ type: "ticker-spawn", items: drift ? [drift] : [], now })
    }, 3000)
    return () => window.clearInterval(id)
  }, [tickerActive])
  // v15 economy: coins credit the v14 ledger (stroops, same caps/streak). HUD shows simulated USD.
  const [ledger, setLedger] = useState(() => readLedger(getLocalStore()))
  const [sessionEarned, setSessionEarned] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const creditedIds = useRef(new Set<string>())
  const onTicker = useCallback((id: string, how: "touch" | "shield") => {
    const item = stateRef.current.tickerItems.find((it) => it.id === id)
    if (!item || creditedIds.current.has(id)) return
    creditedIds.current.add(id)
    let credited = 0
    if (item.kind === "orb") {
      const store = getLocalStore()
      credited = recordCoin(store, item.stroops ?? 0)
      setSessionEarned((n) => n + credited)
      setLedger(readLedger(store))
    }
    dispatch({ type: "ticker-collect", id, how, credited })
  }, [])
  useEffect(() => {
    if (!started) return
    const id = window.setInterval(() => setLedger(readLedger(getLocalStore())), 2500)
    return () => window.clearInterval(id)
  }, [started])
  const econHud = (
    <div className="econ-hud" data-econ="v15" aria-label={`Testnet XOE play rewards, simulated USD, no cash value. Today ${formatPlay(ledger.todayCredited)} of ${formatPlay(dailyCap(ledger))}.`}>
      <span className="econ-today">
        Today <b>{formatPlayAmount(ledger.todayCredited)}</b>
        <span className="econ-cap"> / {formatPlayAmount(dailyCap(ledger))} {PLAY_UNIT}</span>
      </span>
      <span>
        Session <b>{formatPlay(sessionEarned, true)}</b>
      </span>
      <span>
        Unclaimed <b>{formatPlay(ledger.unclaimed)}</b>
      </span>
      <span className="fine econ-note" title={SIM_USD_NOTE}>Testnet XOE · sim USD · no cash value</span>
    </div>
  )
  const pilot = pilotById(state.pilotId ?? state.characterId)
  const suit = suitById(state.cosmeticId)
  const hour = localHour(now)
  const music = useMemo(() => createMusicController({ mutedBySystem: false }), [])
  const { redDay, noteSession } = useSolarFlare(music, started)

  useEffect(() => {
    bindMusicController(music)
    return () => bindMusicController(null)
  }, [music])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    music.setMutedBySystem(reducedMotion)
  }, [music, reducedMotion])

  useEffect(() => {
    const trading = drawer === "paper" || state.phase === "practice" || state.phase === "practice-pause"
    music.setTheme(themeForPhase(state.phase, started, {
      fight: mapFight,
      trading,
      town: Boolean(state.activeTownId),
      credits: state.phase === "ending" && state.endingIndex >= 5,
    }))
    music.setRegion(state.regionId ?? "open")
    if (state.phase === "ragnarok") music.setBossLayer(1)
    else music.setBossLayer(0)
  }, [music, state.phase, started, mapFight, drawer, state.activeTownId, state.endingIndex, state.regionId])

  useEffect(() => {
    if (state.phase !== "navigate" || playFrozen) return
    const onKey = (event: KeyboardEvent) => {
      const input = inputFromKey(event.key)
      if (!input) return
      event.preventDefault()
      dispatch({ type: "move", input })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.phase, playFrozen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "p" && e.key !== "P") return
      const t = e.target
      if ((e.key === "p" || e.key === "P") && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return
      if (drawer) {
        e.preventDefault()
        closeDrawer()
        return
      }
      if (menu === "launch") return
      e.preventDefault()
      setMenu((m) => (m ? null : "pause"))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menu, drawer, closeDrawer])

  const unlockAudio = useCallback(() => {
    unlockAudioInGesture(music)
  }, [music])
  // v18.2 iPhone: listen for the first real taps anywhere (touchend/click/keys) to start music + XO's voice.
  useEffect(() => installFirstTapAudioUnlock(music), [music])
  useEffect(() => {
    if (isSoundMuted()) music.setEnabled(false)
  }, [music])

  useEffect(() => {
    // Never cover the XOE menu / Grok Bot key box. Wait until the menu is closed.
    if (menu) {
      setReminderOpen(false)
      return
    }
    const at = started ? "play" : "setup"
    if (shouldShowVoiceReminder(getLocalStore(), { screen: at, inFight: mapFight, dangerMode: false })) {
      setReminderOpen(true)
      markVoiceReminderShown(getLocalStore(), at)
    }
  }, [started, mapFight, menu])

  const onMode = useCallback((mode: DialogueMode) => dispatch({ type: "set-dialogue-mode", mode }), [])
  const onGrok = useCallback(() => {
    setShowGrokKeyBox(true)
    setMenu((m) => m ?? "pause")
    dispatch({ type: "open-grok" })
  }, [])
  const onDecline = useCallback(() => dispatch({ type: "decline-grok" }), [])
  const settleTrade = useCallback((practice: typeof state.practice) => {
    const settled = practice.outcome ? practice : finalizePractice(practice)
    const pnl = paperResultStroops(settled)
    if (pnl !== 0) recordTradePnl(getLocalStore(), pnl)
  }, [])
  const onAction = useCallback((action: PaperAction, price?: number) => {
    if (!playFrozen) dispatch({ type: "paper-action", action, price })
  }, [playFrozen])
  const onPracticeTick = useCallback((price: number) => {
    if (playFrozen) return
    dispatch({ type: "practice-tick", price })
  }, [playFrozen])
  // v18.2: XO's guide tips go through live Grok Bot by default when a key is saved and ON; the built-in
  // line shows at once and is replaced by the live answer (or stays, with the reason, if live fails).
  const onAsk = useCallback((tip: XoeTip) => {
    dispatch({ type: "ask-xoe", tipId: tip.id, reply: tip.reply })
    const settings = readGrokConnectSettings(getLocalStore())
    if (!canAttemptLiveGrok(settings)) return
    void getCompanionBrain()
      .ask(`${tip.label} (Answer as XOE in 1-3 short sentences. Built-in tip for reference: ${tip.reply})`)
      .then((r) => {
        if (r.source === "grok-live" && r.reply) dispatch({ type: "ask-xoe", tipId: tip.id, reply: r.reply })
      })
  }, [])

  const quitToStart = useCallback(() => {
    closeDrawer()
    dispatch({ type: "return-to-front" })
    setMenu("launch")
  }, [closeDrawer])

  const startPlay = useCallback(() => {
    unlockAudio()
    setMenu(null)
    setMenuSection(null)
    noteSession()
    if (readQaCredits()) dispatch({ type: "qa-jump-credits" })
  }, [unlockAudio, noteSession])

  const drawers = (
    <>
      <HighScoreScreen open={drawer === "scores"} onClose={closeDrawer} />
      <ReportProblemPanel open={drawer === "report"} onClose={closeDrawer} grokConnect={grokConnect} />
      <TutorialPanel open={drawer === "tutorial"} onClose={closeDrawer} />
      <PaperAdvancedDrawer open={drawer === "paper"} onClose={closeDrawer} xoePrice={xoePriceFromSnap(tickerSnap) ?? 10} xoeHistory={tickerHistory.XOE ?? []} reducedMotion={reducedMotion} />
      <MarketPanel open={drawer === "market"} onClose={closeDrawer} />
      <AskGrokPanel open={drawer === "ask-grok"} onClose={closeDrawer} />
      <FaqPanel open={drawer === "faq"} onClose={closeDrawer} />
      <AccountWalletDrawer open={drawer === "wallet"} onClose={closeDrawer} />
      <AutoErrorHint grokConnect={grokConnect} />
    </>
  )

  return (
    <SceneBoundary>
      <div className="play-frozen" data-screen="play" data-paused={playFrozen ? "1" : "0"} data-red-day={redDay ? "1" : "0"} onClick={unlockAudio} role="presentation">
        <a className="skip" href="#scene">
          Skip to scene
        </a>
        <XoSpeechBubble />
        <header className="play-chrome">
          <div className="play-topbar">
            <div className="play-topbar-id">
              <h1 tabIndex={-1} aria-label={GAME_FULL_NAME}>
                <span className="play-title-full" aria-hidden="true">{GAME_FULL_NAME}</span>
                <span className="play-title-short" aria-hidden="true">{GAME_SHORT_NAME}</span>
              </h1>
              <p className="top-subtitle">
                {headerSubtitle}
                <span className="top-pilot"> · {pilotHeaderLabel((state.pilotId ?? state.characterId) === "xoe" ? "XO" : pilot?.name ?? "Pilot", state.playerName)}</span>
              </p>
            </div>
            <div className="play-topbar-actions">
              <XoeHelpButton
                key={`${menu ?? ""}-${drawer ?? ""}-${state.phase}-${mapFight}-${state.colonyFeedback ?? ""}-${state.activeColonyId ?? ""}`}
                context={helpContextFor({
                  phase: menu && drawer !== "paper" ? "menu-screen" : state.phase,
                  inFight: mapFight,
                  trading: drawer === "paper" || state.phase === "practice" || state.phase === "practice-pause",
                  justCleared: Boolean(state.colonyFeedback),
                })}
                colonyId={state.activeColonyId ?? null}
              />
              <SoundChip music={music} />
              <VoiceCommandMic music={music} compact onOpenDrawer={(id) => { setMenu((m) => m ?? "pause"); openOne(id) }} />
              <button
                type="button"
                className="touch-btn pause-btn"
                aria-pressed={menu !== null}
                aria-label="Pause menu"
                onClick={() => {
                  unlockAudio()
                  setMenu("pause")
                }}
              >
                Pause
              </button>
            </div>
          </div>
          {state.phase !== "ending" && state.phase !== "blackout" ? (
            <LiveTicker enabled={tickerEnabled} snap={tickerSnap} history={tickerHistory} />
          ) : null}
          {redDay ? (
            <div className="red-day-banner is-chrome" role="status" data-red-day-banner="1">
              SOLAR FLARE · RED DAY
            </div>
          ) : null}
        </header>
        {/* v18.3 (QA fix 6): in the page flow under the header, so it can never sit on a title or story text */}
        {/* v19 iPhone pass: on phones in the colony map the reminder moves under the map (see ColonyMapView notice) */}
        <VoiceReminderBanner open={reminderOpen && !mapFight && !reminderUnderMap} onDismiss={() => setReminderOpen(false)} />
        <TickerContext.Provider value={tickerSnap}>
        <main
          id="scene"
          data-phase={state.phase}
          data-reduced-motion={reducedMotion ? "true" : "false"}
          data-animations={animate ? "running" : "paused"}
          data-region={state.regionId}
          data-red-day={redDay ? "1" : "0"}
          aria-hidden={playFrozen ? true : undefined}
        >
          {started && state.phase === "colony-lesson" ? econHud : null}
          {state.phase !== "blackout" ? (
            <PixelStage
              scene={sceneFor(state)}
              animate={animate && !stageHiddenOnPhone(state.phase)}
              pos={state.pos}
              sky={skyPhase(hour)}
              hull={suit?.hull ?? "#c4c0d4"}
              visor={pilot?.visor ?? "#a78bfa"}
              reducedMotion={reducedMotion}
              xoeLikeness={(state.pilotId ?? state.characterId) === "xoe"}
            />
          ) : null}
          {state.phase === "pilot-select" ? (
            <p className="narration">Finish pilot setup in the XOE menu (Pause → Quit to start).</p>
          ) : null}
          {state.phase === "wake" ||
          state.phase === "missing-pilot" ||
          state.phase === "auto-battle" ||
          state.phase === "cockpit-invite" ||
          state.phase === "near-loss" ? (
            <StoryView
              phase={state.phase}
              mode={state.dialogueMode}
              speech={speech}
              onContinue={() => {
                if (playFrozen) return
                if (state.phase === "near-loss") playLocalScoff()
                dispatch({ type: "continue" })
              }}
            />
          ) : null}
          {state.phase === "cinematic-choice" ? (
            <CinematicChoice
              onPlay={() => !playFrozen && dispatch({ type: "choose-cinematic", choice: "play" })}
              onSkip={() => !playFrozen && dispatch({ type: "choose-cinematic", choice: "skip" })}
            />
          ) : null}
          {state.phase === "cinematic" ? (
            <CinematicPlayer
              index={state.cinematicIndex}
              reducedMotion={reducedMotion}
              onNext={() => !playFrozen && dispatch({ type: "next-panel" })}
              onSkip={() => !playFrozen && dispatch({ type: "skip-cinematic" })}
            />
          ) : null}
          {state.phase === "practice-pause" || state.phase === "practice" ? (
            <PracticeView
              priceHistory={tickerHistory.XOE ?? []}
              reducedMotion={reducedMotion}
              frozen={playFrozen}
              state={state}
              speech={speech}
              onMode={onMode}
              onGrok={onGrok}
              onDecline={onDecline}
              onResume={() => !playFrozen && dispatch({ type: "resume-practice" })}
              onAction={onAction}
              onTick={onPracticeTick}
              onRestart={() => !playFrozen && dispatch({ type: "restart-paper" })}
              onExit={() => {
                if (playFrozen) return
                settleTrade(state.practice)
                dispatch({ type: "exit-paper" })
              }}
              onComplete={() => {
                if (playFrozen) return
                settleTrade(state.practice)
                dispatch({ type: "complete-paper", price: xoePriceFromSnap(tickerSnap) ?? state.practice.price })
              }}
            />
          ) : null}
          {state.phase === "sis-rescue" ? (
            <RescueView
              state={state}
              speech={speech}
              onMode={onMode}
              onGrok={onGrok}
              onDecline={onDecline}
              onContinue={() => !playFrozen && dispatch({ type: "continue" })}
            />
          ) : null}
          {state.phase === "navigate" ? (
            <NavView
              state={state}
              sky={skyPhase(hour)}
              hour={hour}
              onMove={(control: TouchControl) => !playFrozen && dispatch({ type: "move", input: inputFromTouch(control) })}
              onHatch={() => !playFrozen && dispatch({ type: "inspect-hatch" })}
              onDepart={() => !playFrozen && dispatch({ type: "depart-colonies" })}
              onMode={onMode}
              onGrok={onGrok}
              onDecline={onDecline}
            />
          ) : null}
          {mapFight ? (
            <div ref={fightOverlayRef} tabIndex={-1} onKeyDown={(e) => {
              if (e.key !== "Tab") return
              const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')).filter(el => el.getBoundingClientRect().height > 0)
              const first = controls[0], last = controls[controls.length - 1]
              if (!first || !last) return
              if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus() }
              else if (!e.shiftKey && (document.activeElement === last || document.activeElement === e.currentTarget)) { e.preventDefault(); first.focus() }
            }} className="overlay-card colony-fight-overlay" role="dialog" aria-modal="true" aria-label="Colony fight" hidden={playFrozen} inert={playFrozen}>
              <div className="fight-overlay-head">
                <strong>XO · colony fight</strong>
                <button type="button" className="touch-btn" onClick={() => setMenu("pause")}>Pause</button>
                <button type="button" className="touch-btn ghost" onClick={() => setMapFight(false)}>Close fight</button>
              </div>
              <FightView paused={playFrozen} mode="colony" sharedDesk={worldDesk} onSharedDesk={setWorldDesk} onDone={() => setLedger(readLedger(getLocalStore()))} />
            </div>
          ) : null}
          {state.phase === "colony-map" && state.activeTownId ? (
            <TownView
              townId={state.activeTownId}
              visitedBoth={state.visitedTowns.length >= 2}
              onLeave={() => !playFrozen && dispatch({ type: "leave-town" })}
              onOpenDesk={() => !playFrozen && openOne("paper")}
            />
          ) : null}
          {state.phase === "colony-map" && !state.activeTownId ? (
            <ColonyMapView
              paused={playFrozen || mapFight}
              onSkirmish={() => !playFrozen && setMapFight(true)}
              state={state}
              founder={founder}
              onEnter={(colonyId, replay) => {
                if (playFrozen) return
                if (isTownId(colonyId)) dispatch({ type: "enter-town", townId: colonyId })
                else dispatch({ type: "enter-colony", colonyId, replay })
              }}
              onMoons={() => !playFrozen && dispatch({ type: "open-moon-choice" })}
              onPracticeExam={() => !playFrozen && dispatch({ type: "start-practice-exam" })}
              onToggleGuide={() => dispatch({ type: "toggle-xoe-guide" })}
              onAsk={onAsk}
              onTicker={onTicker}
              onPos={onMapPos}
              hud={econHud}
              trade={
                <LiveTradeHud
                  price={xoePriceFromSnap(tickerSnap) ?? worldDesk.price}
                  history={tickerHistory.XOE ?? []}
                  desk={worldDesk}
                  onBuy={(price) => !playFrozen && setWorldDesk((d) => applyPaperAction(d, "buy", price))}
                  onSell={(price) => !playFrozen && setWorldDesk((d) => applyPaperAction(d, "sell", price))}
                  onOpenDesk={() => !playFrozen && openOne("paper")}
                />
              }
              reducedMotion={reducedMotion}
              redDay={redDay}
              noticeOpen={reminderUnderMap && reminderOpen && !mapFight}
              notice={reminderUnderMap ? <VoiceReminderBanner open={reminderOpen && !mapFight} onDismiss={() => setReminderOpen(false)} /> : null}
              onPlayOpening={() => {
                if (playFrozen) return
                dispatch({ type: "play-opening" })
                setMenu(null)
              }}
            />
          ) : null}
          {/* v18: below the map so the map, dock, and Enter fit the first screen */}
          {state.phase === "colony-lesson" ? (
            <ColonyLessonView
              paused={playFrozen}
              state={state}
              onAnswer={(choiceIndex) => !playFrozen && dispatch({ type: "answer-colony", choiceIndex })}
              onLeave={() => !playFrozen && dispatch({ type: "leave-colony" })}
              onToggleGuide={() => dispatch({ type: "toggle-xoe-guide" })}
              onAsk={onAsk}
              onSetLane={(lane) => !playFrozen && dispatch({ type: "arcade-set-lane", lane })}
              onCollectPickup={(pickupIndex) => !playFrozen && dispatch({ type: "arcade-collect-pickup", pickupIndex })}
              onFlyGate={(gateIndex) => !playFrozen && dispatch({ type: "arcade-fly-gate", gateIndex })}
              onTicker={onTicker}
            />
          ) : null}
          {state.phase === "moon-choice" ? (
            <MoonChoiceView
              state={state}
              onChoose={(moonId, powerId, variantId) =>
                !playFrozen && dispatch({ type: "choose-moon", moonId, powerId, variantId })
              }
            />
          ) : null}
          {state.phase === "moon-approach" ? (
            <MoonApproachView
              state={state}
              onAbility={() => !playFrozen && dispatch({ type: "use-moon-ability", nowMs: Date.now() })}
              onEnterGate={() => !playFrozen && dispatch({ type: "start-ragnarok" })}
            />
          ) : null}
          {state.phase === "ragnarok" ? (
            <RagnarokView
              paused={playFrozen}
              state={state}
              onAnswer={(choiceIndex) => !playFrozen && dispatch({ type: "answer-ragnarok", choiceIndex })}
              onAbility={() => !playFrozen && dispatch({ type: "use-moon-ability", nowMs: Date.now() })}
              onToggleGuide={() => dispatch({ type: "toggle-xoe-guide" })}
              onAsk={onAsk}
            />
          ) : null}
          {state.phase === "ending" || state.phase === "blackout" ? (
            <EndingView state={state} onNext={() => !playFrozen && dispatch({ type: "ending-next" })} onSkipToCredits={() => !playFrozen && dispatch({ type: "ending-skip-to-credits" })} />
          ) : null}
        </main>
        </TickerContext.Provider>
      </div>
      <XOrbitalMenu
        open={menu !== null}
        mode={menu ?? "pause"}
        section={menuSection}
        onSection={setMenuSection}
        state={state}
        music={music}
        reducedMotion={reducedMotion}
        grokConnect={grokConnect}
        showGrokKeyBox={showGrokKeyBox}
        onGrokChange={applyGrok}
        onGrokFirstSaved={(next) => {
          applyGrok(next)
          setShowGrokKeyBox(false)
        }}
        onGrokFirstSkip={() => {
          writeGrokFirstRunDismissed(getLocalStore(), true)
          setShowGrokKeyBox(false)
          setGrokProbe("builtin")
        }}
        onStart={startPlay}
        onResume={() => setMenu(null)}
        onQuitToStart={quitToStart}
        onOpenPanel={openOne}
        onCharacter={(characterId) => dispatch({ type: "choose-character", characterId })}
        onName={(name) => dispatch({ type: "set-player-name", name })}
        onGender={(gender) => dispatch({ type: "set-gender", gender })}
        onNa={(checked) => dispatch({ type: "set-gender-na", checked })}
        onClass={(className) => dispatch({ type: "choose-class", className })}
        onDisclaimer={(confirmed) => dispatch({ type: "confirm-disclaimer", confirmed })}
        onSuit={(cosmeticId) => dispatch({ type: "choose-suit", cosmeticId })}
        onBegin={() => {
          dispatch({ type: "begin" })
          startPlay()
        }}
        onPlayOpening={() => {
          dispatch({ type: "play-opening" })
          startPlay()
        }}
      />
      {drawers}
    </SceneBoundary>
  )
}
