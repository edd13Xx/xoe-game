import { VoiceSettings } from "./VoiceSettings.tsx"
import { grokRequestEpoch } from "../game/grok-requests.ts"
import { SoundChip } from "./SoundChip.tsx"
import { TestGrokButton } from "./TestGrokButton.tsx"
import { GAME_FULL_NAME } from "../game/brand.ts"
import { useEffect, useRef, useState } from "react"
import { OrbitalCover as CoverArt } from "./OrbitalCover.tsx"
import { FounderBadge } from "./FounderBadge.tsx"
import { hasFounderBadge } from "../game/reward-plan.ts"
import { GrokFirstRunPanel } from "./GrokFirstRunPanel.tsx"
import { GrokConnectSettingsPanel } from "./GrokConnectSettings.tsx"
import { GrokHudControls } from "./GrokHudControls.tsx"
import { MusicSettings } from "./MusicSettings.tsx"
import { PilotMenu } from "./PilotMenu.tsx"
import { UpgradeMenu } from "./UpgradeMenu.tsx"
import { ShopView } from "./ShopView.tsx"
import { VoiceCommandMic } from "./VoiceCommandMic.tsx"
import type { MusicController } from "../game/music.ts"
import type { GrokConnectSettings } from "../game/grok-connect-settings.ts"
import type { GameState } from "../game/opening.ts"
import type { Gender, PlayerClassName } from "../game/content.ts"
import type { DrawerId } from "../game/drawer.ts"

/** "launch" = start menu over the idle play scene; "pause" = same menu opened by Pause during play. */
export type MenuMode = "launch" | "pause"
export type MenuSection = "settings" | "pilot" | "shop"

/** Sub-panels opened from the menu (one drawer at a time, over the menu). */
const PANELS: { id: DrawerId; label: string }[] = [
  { id: "scores", label: "High scores / Leaderboard" },
  { id: "tutorial", label: "Tutorial" },
  { id: "report", label: "Report a problem" },
  { id: "paper", label: "XOE trade desk" },
  { id: "market", label: "Market" },
  { id: "ask-grok", label: "Ask XOE" },
  { id: "wallet", label: "Account & Wallet" },
  { id: "faq", label: "FAQ" },
]

/**
 * v12: ONE XOE menu. Holds everything that used to be on Start/Setup
 * plus everything from the Pause menu, plus Upgrade & Shop.
 */
export function XOrbitalMenu({
  open,
  mode,
  section,
  onSection,
  state,
  music,
  reducedMotion,
  grokConnect,
  showGrokKeyBox,
  onGrokChange,
  onGrokFirstSaved,
  onGrokFirstSkip,
  onStart,
  onResume,
  onQuitToStart,
  onOpenPanel,
  onCharacter,
  onName,
  onGender,
  onNa,
  onClass,
  onDisclaimer,
  onSuit,
  onBegin,
  onPlayOpening,
}: {
  open: boolean
  mode: MenuMode
  section: MenuSection | null
  onSection: (s: MenuSection | null) => void
  state: GameState
  music: MusicController
  reducedMotion: boolean
  grokConnect: GrokConnectSettings
  showGrokKeyBox: boolean
  onGrokChange: (next: GrokConnectSettings) => void
  onGrokFirstSaved: (next: GrokConnectSettings) => void
  onGrokFirstSkip: () => void
  onStart: () => void
  onResume: () => void
  onQuitToStart: () => void
  onOpenPanel: (id: DrawerId) => void
  onCharacter: (characterId: string) => void
  onName: (name: string) => void
  onGender: (gender: Gender) => void
  onNa: (checked: boolean) => void
  onClass: (className: PlayerClassName) => void
  onDisclaimer: (confirmed: boolean) => void
  onSuit: (cosmeticId: string) => void
  onBegin: () => void
  onPlayOpening?: () => void
}) {
  const firstRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [grokNote, setGrokNote] = useState<string | null>(null)
  useEffect(() => {
    if (open) firstRef.current?.focus()
  }, [open, mode])
  useEffect(() => {
    if (!open || !section) return
    sheetRef.current?.querySelector<HTMLElement>(`[data-section="${section}"]`)?.scrollIntoView({ block: "start" })
  }, [open, section])

  if (!open) return null
  const launch = mode === "launch"
  const pilotSelect = state.phase === "pilot-select"
  const toggle = (s: MenuSection) => (e: { currentTarget: HTMLDetailsElement }) => {
    const isOpen = e.currentTarget.open
    if (isOpen !== (section === s)) onSection(isOpen ? s : null)
  }

  return (
    <div
      className="xo-menu-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={launch ? "XOE start menu" : "XOE pause menu"}
      data-menu={mode}
      data-pause={launch ? undefined : "1"}
    >
      <div className="xo-menu-sheet panel" ref={sheetRef}>
        <div className="xo-menu-head">
          <h1 tabIndex={-1}>{GAME_FULL_NAME}</h1>
          <p className="xo-tagline">Now, in the palm of your hands.</p>
          <p className="fine xo-menu-sub">{launch ? "XOE trade practice · Learn while you fly" : "XOE menu · game paused"}</p>
          {hasFounderBadge() ? <FounderBadge /> : null}
        </div>
        {launch ? <CoverArt /> : null}

        {/* v18: Start / Resume stay pinned at the top of the sheet while you scroll Grok Bot setup. */}
        <div className="menu-row xo-menu-primary">
          {launch ? (
            <button
              ref={firstRef}
              type="button"
              className="touch-btn primary"
              onClick={() => (pilotSelect ? onSection("pilot") : onStart())}
            >
              {pilotSelect ? "Start" : "Continue"}
            </button>
          ) : (
            <>
              <button ref={firstRef} type="button" className="touch-btn primary" onClick={onResume}>
                Resume
              </button>
              <button type="button" className="touch-btn ghost" onClick={onQuitToStart}>
                Quit to start
              </button>
            </>
          )}
          {/* v18.2: sound indicator — iPhone needs one tap before music and XO's voice can play */}
          <SoundChip music={music} long />
        </div>

        <section className="xo-menu-block" aria-label="Grok Bot integration">
          <h2>Grok Bot integration</h2>
          <p className="fine">Grok Bot is ON by default. Paste an xAI key (starts with xai-) for live Grok Bot, or skip: built-in AI works without one.</p>
          {/* v18: ONE Grok Bot ON/OFF + Disconnect row (the first-run box has none; the settings panel brings its own). */}
          {showGrokKeyBox ? (
            <>
              <GrokFirstRunPanel
                key={grokRequestEpoch()}
                bare
                onSaved={(next, note) => {
                  setGrokNote(note ?? null)
                  onGrokFirstSaved(next)
                }}
                onSkip={onGrokFirstSkip}
              />
              <GrokHudControls settings={grokConnect} onChange={onGrokChange} />
            </>
          ) : (
            <>
              <GrokConnectSettingsPanel compact initialNote={grokNote} onChange={onGrokChange} />
              {/* v18.2: what is answering + one-tap Test Grok Bot (real result or exact error) */}
              <TestGrokButton />
            </>
          )}
        </section>

        <details className="xo-menu-block pilot-select" data-section="pilot" open={section === "pilot"} onToggle={toggle("pilot")}>
          <summary>Pilot select</summary>
          {pilotSelect ? (
            <PilotMenu
              state={state}
              onCharacter={onCharacter}
              onName={onName}
              onGender={onGender}
              onNa={onNa}
              onClass={onClass}
              onDisclaimer={onDisclaimer}
              onSuit={onSuit}
              onBegin={onBegin}
            />
          ) : (
            <p className="fine">Pilot locked in for this run: {state.playerName}. Quit to start to pick again.</p>
          )}
        </details>

        <details className="xo-menu-block" data-section="settings" open={section === "settings"} onToggle={toggle("settings")}>
          <summary>Settings</summary>
          <MusicSettings
            music={music}
            reducedMotion={reducedMotion}
            forceOpen
            onReplayTutorial={() => onOpenPanel("tutorial")}
            onOpenScores={() => onOpenPanel("scores")}
            onOpenPaperDesk={() => onOpenPanel("paper")}
          />
          <VoiceSettings />
        </details>

        {onPlayOpening && state.phase === "colony-map" ? (
          <div className="menu-row">
            <button type="button" className="touch-btn" onClick={onPlayOpening}>
              Opening story
            </button>
          </div>
        ) : null}

        <section className="xo-menu-block" aria-label="Panels">
          <h2>Panels</h2>
          <div className="xo-menu-list">
            {PANELS.map((p) => (
              <button key={p.id} type="button" className="touch-btn" onClick={() => onOpenPanel(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <details className="xo-menu-block xo-menu-shop" data-section="shop" open={section === "shop"} onToggle={toggle("shop")}>
          <summary>Upgrade & Shop</summary>
          {section === "shop" ? (
            <>
              <UpgradeMenu xoPilot={(state.pilotId ?? state.characterId) === "xoe"} />
              <ShopView />
            </>
          ) : null}
        </details>

        <VoiceCommandMic
          music={music}
          onOpenDrawer={(id) => (id === "settings" ? onSection("settings") : onOpenPanel(id))}
        />
      </div>
    </div>
  )
}
