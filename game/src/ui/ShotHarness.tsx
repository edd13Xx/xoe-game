import { RECHARGE_STATUS_LINE, RECHARGE_MS, initialXoeRun } from "../game/xoe-lifeblood.ts"
import { ShopView } from "./ShopView.tsx"
import { UpgradeMenu } from "./UpgradeMenu.tsx"
import { HEALTH_BAR_LABEL, XOE_UNIT } from "../game/xoe-lifeblood.ts"

/** Deterministic screens for Playwright screenshots via ?shot= */
export function ShotHarness({ shot }: { shot: string }) {
  if (shot === "recharge") {
    const sec = Math.ceil(RECHARGE_MS / 1000)
    return (
      <div className="shot-frame recharge-shot" data-shot="recharge">
        <div className="mars-world-shell" style={{ maxWidth: 360, height: 280, margin: 12 }}>
          <div style={{ padding: 24, color: "#c9f7ff" }}>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{RECHARGE_STATUS_LINE}</p>
            <p style={{ fontSize: 28, color: "#e4b15c" }}>{sec}s</p>
            <p className="fine">No skip — wall clock. Retry/Continue hidden.</p>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "map") {
    return (
      <div className="shot-frame map-shot" data-shot="map">
        <div className="mars-world-shell" style={{ maxWidth: 360, height: 400, margin: 12 }}>
          <div className="mars-world" style={{ width: 360, height: 400, transform: "none", position: "relative" }}>
            <div className="mars-world-sky" />
            <div className="mars-world-haze" />
            <div className="world-dome done" style={{ left: 70, top: 110 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">✓ Colony Wallet</span>
              <span className="dome-best" data-colony-best="wallet">Best 120 · 18s</span>
            </div>
            <div className="world-dome next" style={{ left: 190, top: 160 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Colony Trustline</span>
              <span className="dome-best" data-colony-best="trustline">Best 200 · 22s</span>
            </div>
            <div className="world-dome" style={{ left: 280, top: 220 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Colony Stroops</span>
            </div>
            <div className="world-dome daily" style={{ left: 300, top: 320 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Daily practice</span>
            </div>
            <div className="xo-avatar" style={{ left: 150, top: 150 }}>
              XO
            </div>
          </div>
          <div className="joy-base" aria-label="Joystick">
            <div className="joy-knob" />
          </div>
          <div className="enter-prompt">
            <p>Enter Colony Keys?</p>
            <button type="button" className="touch-btn primary">
              Enter
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "shop") {
    return (
      <div className="shot-frame shop-shot" data-shot="shop" style={{ padding: 12 }}>
        <ShopView />
      </div>
    )
  }
  if (shot === "scoring") {
    return (
      <div className="shot-frame scoring-shot panel" data-shot="scoring" style={{ margin: 12 }}>
        <h2>Private scoring</h2>
        <p>
          {HEALTH_BAR_LABEL}: 72 {XOE_UNIT}
        </p>
        <div className="xoe-health-track">
          <div className="xoe-health-fill" style={{ width: "72%" }} />
        </div>
        <p className="fine">Vault 68 · XP +20 · Energy +60 (practice coins only)</p>
        <p className="return-breakdown">Energy +60, XP +20, Vault +68</p>
        <UpgradeMenu />
      </div>
    )
  }
  if (shot === "liquidation") {
    return (
      <div
        className="shot-frame liq-shot"
        data-shot="liquidation"
        style={{ margin: 12, height: 240, background: "rgba(180,0,20,0.92)", color: "#fff", padding: 24 }}
      >
        <p style={{ fontSize: 20, fontWeight: 800 }}>Total Liquidation</p>
        <p>Getting totally liquidated.</p>
        <p className="fine">XO flying off-screen…</p>
      </div>
    )
  }
  if (shot === "respawn") {
    const run = { ...initialXoeRun(), deathPhase: "respawning" as const, invincibleUntilMs: Date.now() + 2000 }
    void run
    return (
      <div className="shot-frame respawn-shot" data-shot="respawn" style={{ margin: 12, height: 240, background: "#050a14", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%",
            transform: "translate(-50%, -50%)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            boxShadow: "0 0 24px rgba(120,255,230,0.8), inset 0 0 20px rgba(80,255,220,0.4)",
            border: "2px solid rgba(180,245,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.55,
            color: "#a78bfa",
            fontWeight: 800,
          }}
        >
          XO
        </div>
        <p style={{ position: "absolute", bottom: 16, left: 16, color: "#c9f7ff" }}>Shield bubble fade-in · 2.0s</p>
      </div>
    )
  }

  if (shot === "mars") {
    return (
      <div className="shot-frame mars-shot" data-shot="mars">
        <h1 style={{ margin: "12px 12px 0" }}>Colony route</h1>
        <p className="narration" style={{ margin: "4px 12px" }}>
          Mars dust under the dome lights. Walk or hover — enter a colony bubble to learn. Practice only.
        </p>
        <div className="mars-world-shell" style={{ maxWidth: 360, height: 420, margin: 12 }}>
          <div className="mars-world" style={{ width: 360, height: 420, transform: "none", position: "relative" }}>
            <div className="mars-world-sky" />
            <div className="mars-world-haze" />
            <div className="world-dome next" style={{ left: 160, top: 170 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Colony Volatility</span>
            </div>
            <div className="world-dome" style={{ left: 70, top: 250 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Colony Trustline</span>
            </div>
            <div className="xo-avatar" style={{ left: 130, top: 200 }}>XO</div>
          </div>
          <div className="joy-base" aria-label="Joystick">
            <div className="joy-knob" />
          </div>
          <div className="enter-prompt">
            <p>Enter Colony Volatility?</p>
            <button type="button" className="touch-btn primary">Enter</button>
          </div>
        </div>
        <p className="fine" style={{ margin: 12 }}>Mars theme playing when music is on.</p>
      </div>
    )
  }
  if (shot === "level") {
    return (
      <div className="shot-frame level-shot copy-block" data-shot="level" style={{ margin: 12 }}>
        <h1>Colony Trustline</h1>
        <p className="narration">
          A trustline is permission to hold a token on a network like Stellar. Practice only — no live trustlines open here.
        </p>
        <p className="fine">Score 25 · Combo x1 · Lane 2 · Learn while you fly</p>
        <div className="arcade-field" style={{ maxWidth: "100%", height: 240 }}>
          <button type="button" className="arcade-gate-node" style={{ left: "20%", top: "20%" }}>Send real money</button>
          <button type="button" className="arcade-gate-node" style={{ left: "50%", top: "18%" }}>Hold a specific asset</button>
          <button type="button" className="arcade-gate-node" style={{ left: "80%", top: "20%" }}>Delete your key</button>
          <div className="arcade-xo" style={{ left: "48%", top: "55%" }}>XO</div>
        </div>
        <button type="button" className="touch-btn primary">Fly this gate</button>
      </div>
    )
  }
  if (shot === "tutorial" || shot === "tutorial-demo") {
    return (
      <div className="shot-frame tutorial-shot" data-shot={shot} style={{ margin: 12 }}>
        <section className="tutorial-panel panel" role="dialog" aria-label="XOE tutorial" data-tutorial-step="fly">
          <p className="fine">XOE · step 2 of 5</p>
          <h2>How to fly</h2>
          <p className="narration">
            On the map, drag, tap, or use the joystick. Near a colony bubble, tap Enter. In a lesson, tap the field to steer XO through the correct gate.
          </p>
          <div className="tutorial-demo" data-tutorial-demo="done">
            <p className="fine">Show me · XO flies one sample gate (skippable)</p>
            <div className="tutorial-demo-field">
              <button type="button" className="arcade-gate-node" style={{ left: 60, top: 40 }} disabled>Wrong lane</button>
              <button type="button" className="arcade-gate-node gate-flash" style={{ left: 160, top: 40 }} disabled>Correct gate</button>
              <button type="button" className="arcade-gate-node" style={{ left: 260, top: 40 }} disabled>Trap</button>
              <div className="arcade-xo gate-flash" style={{ left: 160, top: 40 }}>XO</div>
            </div>
            <p className="ok">That’s the idea — fly the correct gate.</p>
          </div>
          <div className="menu-row tutorial-actions">
            <button type="button" className="touch-btn ghost">Skip tutorial</button>
            <button type="button" className="touch-btn primary">Next</button>
          </div>
        </section>
      </div>
    )
  }
  if (shot === "scores") {
    return (
      <div className="shot-frame scores-shot" data-shot="scores" style={{ margin: 12 }}>
        <section className="high-score-screen panel" role="dialog" aria-label="Private high scores" data-scores="private">
          <h2>High scores</h2>
          <p className="fine">Private to this device. Top 5. Never sent anywhere. Practice points only.</p>
          <ol className="local-leaderboard high-score-list">
            <li><strong>#1</strong> · 200 pts · Arcade · trustline</li>
            <li><strong>#2</strong> · 120 pts · Arcade · wallet</li>
            <li><strong>#3</strong> · 90 pts · Arcade · keys</li>
          </ol>
          <div className="menu-row">
            <button type="button" className="touch-btn ghost">Reset scores</button>
            <button type="button" className="touch-btn primary">Close</button>
          </div>
        </section>
      </div>
    )
  }
  if (shot === "map-scores") {
    return (
      <div className="shot-frame map-shot" data-shot="map-scores">
        <h1 style={{ margin: "12px 12px 0" }}>Colony route</h1>
        <p className="narration" style={{ margin: "4px 12px" }}>
          Mars dust under the dome lights. Best scores stay on this device.
        </p>
        <div className="mars-world-shell" style={{ maxWidth: 360, height: 420, margin: 12 }}>
          <div className="mars-world" style={{ width: 360, height: 420, transform: "none", position: "relative" }}>
            <div className="mars-world-sky" />
            <div className="mars-world-haze" />
            <div className="world-dome done" style={{ left: 80, top: 120 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">✓ Colony Wallet</span>
              <span className="dome-best" data-colony-best="wallet">Best 120 · 18s</span>
            </div>
            <div className="world-dome done" style={{ left: 200, top: 180 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">✓ Colony Keys</span>
              <span className="dome-best" data-colony-best="keys">Best 95 · 21s</span>
            </div>
            <div className="world-dome next" style={{ left: 140, top: 280 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Colony Phishing</span>
            </div>
            <div className="xo-avatar" style={{ left: 150, top: 200 }}>XO</div>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "phishing") {
    return (
      <div className="shot-frame level-shot copy-block" data-shot="phishing" style={{ margin: 12 }}>
        <h1>Colony Phishing</h1>
        <p className="narration">
          Phishing looks like help. Fake support DMs, lookalike URLs, and urgency nudges try to grab your seed phrase or keys. Practice only.
        </p>
        <p className="fine">Score 25 · Combo x1 · Lane 2 · Learn while you fly</p>
        <div className="arcade-field" style={{ maxWidth: "100%", height: 240 }}>
          <button type="button" className="arcade-gate-node" style={{ left: "20%", top: "20%" }}>Paste seed to unlock</button>
          <button type="button" className="arcade-gate-node gate-flash" style={{ left: "50%", top: "18%" }}>Ignore · never share</button>
          <button type="button" className="arcade-gate-node" style={{ left: "80%", top: "20%" }}>Click lookalike URL</button>
          <div className="arcade-xo gate-flash" style={{ left: "48%", top: "55%" }}>XO</div>
        </div>
        <button type="button" className="touch-btn primary">Fly this gate</button>
      </div>
    )
  }

  if (shot === "seed-colony") {
    return (
      <div className="shot-frame level-shot copy-block lesson-tight" data-shot="seed-colony" style={{ margin: 12 }}>
        <h1>Colony Seed Backup</h1>
        <p className="bubble lesson-bubble">
          Back up seeds offline — paper or metal. Never photos, never cloud, never share. We never ask for a real seed. Testnet XOE · no real money.
        </p>
        <p className="narration lesson-hint">Tap/click to fly · correct gate</p>
        <p className="fine">Score 25 · Combo x1 · Lane 1</p>
        <div className="arcade-field" style={{ maxWidth: "100%", height: 240 }}>
          <button type="button" className="arcade-gate-node gate-flash" style={{ left: "20%", top: "20%" }}>Paper / metal offline</button>
          <button type="button" className="arcade-gate-node" style={{ left: "50%", top: "18%" }}>Cloud photo album</button>
          <button type="button" className="arcade-gate-node" style={{ left: "80%", top: "20%" }}>DM to support</button>
          <div className="arcade-xo" style={{ left: "22%", top: "55%" }}>XO</div>
        </div>
      </div>
    )
  }
  if (shot === "lesson-tight") {
    return (
      <div className="shot-frame level-shot copy-block lesson-tight" data-shot="lesson-tight" style={{ margin: 12 }}>
        <h1>Colony Wallet</h1>
        <p className="bubble lesson-bubble">A wallet holds your keys. Practice only.</p>
        <p className="narration lesson-hint">Tap/click to fly · correct gate</p>
        <p className="fine">Score 0 · Combo x0 · Lane 2</p>
        <div className="arcade-field" style={{ maxWidth: "100%", height: 240 }}>
          <button type="button" className="arcade-gate-node" style={{ left: "50%", top: "18%" }}>Keys / access</button>
          <div className="arcade-xo" style={{ left: "48%", top: "60%" }}>XO</div>
        </div>
        <button type="button" className="touch-btn primary">Fly this gate</button>
      </div>
    )
  }
  if (shot === "exam-moon") {
    return (
      <div className="shot-frame level-shot copy-block" data-shot="exam-moon" style={{ margin: 12 }}>
        <h1>Practice Exam Moon</h1>
        <p className="narration">Optional warm-up before the moons. Mixed gates from every colony. Testnet XOE · no real money.</p>
        <p className="fine">Score 50 · Exam 1/3 · Lane 2</p>
        <div className="arcade-field" style={{ maxWidth: "100%", height: 240 }}>
          <button type="button" className="arcade-gate-node" style={{ left: "20%", top: "18%" }}>Wallet: Gold bars</button>
          <button type="button" className="arcade-gate-node gate-flash" style={{ left: "50%", top: "16%" }}>Keys: Refuse. Never share</button>
          <button type="button" className="arcade-gate-node" style={{ left: "80%", top: "18%" }}>Phishing: Paste seed</button>
          <div className="arcade-xo gate-flash" style={{ left: "48%", top: "55%" }}>XO</div>
        </div>
        <button type="button" className="touch-btn ghost">Back to colony map</button>
      </div>
    )
  }
  if (shot === "ghost") {
    return (
      <div className="shot-frame level-shot copy-block lesson-tight" data-shot="ghost" style={{ margin: 12 }}>
        <h1>Colony Keys · replay</h1>
        <p className="ok">Replay · race ghost on if enabled.</p>
        <p className="narration lesson-hint">Tap/click to fly · ghost path shown</p>
        <div className="arcade-field" style={{ maxWidth: "100%", height: 240, position: "relative" }}>
          <svg className="race-ghost-svg" width="320" height="220" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
            <path className="race-ghost-path" d="M40,110 L90,80 L140,50 L160,40" />
          </svg>
          <button type="button" className="arcade-gate-node" style={{ left: "50%", top: "18%" }}>Refuse. Never share</button>
          <div className="arcade-xo" style={{ left: "30%", top: "50%" }}>XO</div>
        </div>
      </div>
    )
  }
  if (shot === "music") {
    return (
      <div className="shot-frame" data-shot="music" style={{ margin: 12 }}>
        <details className="music-settings" open>
          <summary>Music & SFX settings</summary>
          <label className="vol-row"><span>Melody volume</span><input type="range" min={0} max={1} step={0.05} value={0.35} readOnly /></label>
          <label className="vol-row"><span>Mars ambient volume</span><input type="range" min={0} max={1} step={0.05} value={0.45} readOnly data-ambient-volume="1" /></label>
          <p className="fine">Ambient is the soft bed under the Mars melody. Mute/off still silences both.</p>
          <button type="button" className="touch-btn" aria-pressed={true}>Ghost on</button>
          <button type="button" className="touch-btn" data-side-missions="on">Side missions on</button>
        </details>
      </div>
    )
  }
  if (shot === "side-mission" || shot === "danger") {
    return (
      <div className="shot-frame" data-shot="side-mission" style={{ margin: 12 }}>
        <section className="side-mission panel danger-mode" data-side-mission="hack-remote-access" data-kind="remote-hack" data-phase="danger" data-input-locked="1">
          <p className="fine">Side mission · Testnet XOE · no real money · skippable</p>
          <h2>Side mission · Remote hack</h2>
          <div className="danger-cinematic">
            <p className="danger-banner">DANGER — XOE has control</p>
            <div className="danger-stage">
              <div className="danger-signal" />
              <div className="danger-mech" style={{ left: "55%" }}>XO</div>
              <div className="danger-source">◉</div>
            </div>
            <p className="narration">Mech auto-follows the trail…</p>
            <p className="fine">Tap/click/keyboard ignored while XOE auto-pilots.</p>
            <button type="button" className="touch-btn ghost">Skip</button>
          </div>
        </section>
      </div>
    )
  }
  if (shot === "phish-mission") {
    return (
      <div className="shot-frame" data-shot="phish-mission" style={{ margin: 12 }}>
        <section className="side-mission panel" data-side-mission="phish-support-dm" data-kind="phishing" data-phase="play" data-input-locked="0">
          <p className="fine">Side mission · Testnet XOE · no real money · skippable</p>
          <h2>Side mission · Fake support DM</h2>
          <p className="narration">A DM says: “Support here — verify your vault or it locks in 5 minutes.” Your vault is cold storage. What do you do?</p>
          <div className="choice-col">
            <button type="button" className="touch-btn primary">Ignore / block — real teams don’t DM for seeds</button>
            <button type="button" className="touch-btn primary">Send seed phrase to ‘unlock’ faster</button>
            <button type="button" className="touch-btn primary">Tap the lookalike link they sent</button>
          </div>
          <button type="button" className="touch-btn ghost">Skip side mission</button>
        </section>
      </div>
    )
  }
  if (shot === "tap-controls") {
    return (
      <div className="shot-frame map-shot" data-shot="tap-controls">
        <h1 style={{ margin: "12px 12px 0" }}>Colony route</h1>
        <p className="narration" style={{ margin: "4px 12px" }}>Tap a spot — XO flies there. Tap Enter near a dome.</p>
        <p className="fine" style={{ margin: "0 12px" }}>Your vault is cold storage — attackers can’t break in from the network.</p>
        <div className="mars-world-shell" style={{ maxWidth: 360, height: 420, margin: 12 }}>
          <div className="mars-world" style={{ width: 360, height: 420, transform: "none", position: "relative" }}>
            <div className="mars-world-sky" />
            <div className="mars-world-haze" />
            <div className="world-dome next" style={{ left: 160, top: 180 }}>
              <span className="dome-glow" />
              <span className="dome-atmo" />
              <span className="dome-name">Colony Seed Backup</span>
            </div>
            <div className="xo-avatar" style={{ left: 120, top: 220 }}>XO</div>
          </div>
          <div className="enter-prompt">
            <p>Enter Colony Seed Backup?</p>
            <button type="button" className="touch-btn primary">Enter</button>
          </div>
        </div>
        <p className="fine" style={{ margin: 12 }}>No on-screen joystick · tap/click to fly</p>
      </div>
    )
  }

  if (shot === "fight") {
    return (
      <div className="shot-frame" data-shot="fight" style={{ margin: 12 }}>
        <section className="fight-view panel" data-fight="skirmish">
          <p className="fine">Fight · skirmish · normal · pts · cold vault safe</p>
          <div className="barwrap"><div className="bar" style={{ width: "78%" }} /></div>
          <p className="fine">Hull 78/100 · Shield 30 · Score 60</p>
          <p className="bubble">XO: They attack the mech because the vault is cold. Tap to aim and fire.</p>
          <div className="fight-field arcade-field" style={{ height: 220, position: "relative" }}>
            <button type="button" className="fight-enemy gate-flash" style={{ left: "60%", top: "40%", background: "#ff6b7a" }}>Phish drone</button>
            <button type="button" className="fight-enemy" style={{ left: "35%", top: "55%", background: "#7c5cff" }}>Hack probe</button>
            <div className="arcade-xo fight-mech" style={{ left: "18%", top: "70%" }}>XO</div>
          </div>
          <div className="menu-row">
            <button type="button" className="touch-btn primary">Fire</button>
            <button type="button" className="touch-btn">Dash / Shield</button>
          </div>
        </section>
      </div>
    )
  }
  if (shot === "boss") {
    return (
      <div className="shot-frame" data-shot="boss" style={{ margin: 12 }}>
        <h1>Ragnarok</h1>
        <p className="fine">Threat 80 · Focus 100</p>
        <section className="fight-view panel" data-fight="boss">
          <p className="bubble">XO: Ragnarok sends everything. Tap foes, hold to auto-fire, dodge with shield.</p>
          <div className="fight-field arcade-field" style={{ height: 200, position: "relative" }}>
            <button type="button" className="fight-enemy" style={{ left: "70%", top: "35%", background: "#7c5cff" }}>Hack probe</button>
            <button type="button" className="fight-enemy" style={{ left: "45%", top: "50%", background: "#e4b15c" }}>Scam swarm</button>
            <div className="arcade-xo" style={{ left: "20%", top: "70%" }}>XO</div>
          </div>
        </section>
      </div>
    )
  }
  if (shot === "ticker") {
    return (
      <div className="shot-frame" data-shot="ticker" style={{ margin: 12 }}>
        <div className="live-ticker" data-live="1">
          <span className="live-dot on" />
          <span className="fine ticker-label">Live · Testnet XOE · no real money</span>
          <div className="ticker-track"><div className="ticker-scroll">
            <span className="ticker-chip up"><strong>XLM</strong> $0.42 +1.20%</span>
            <span className="ticker-chip down"><strong>BTC</strong> $90,100 -0.40%</span>
            <span className="ticker-chip up"><strong>ETH</strong> $3,200 +0.80%</span>
          </div></div>
        </div>
        <p className="narration">Start stays above the fold with the slim ticker.</p>
        <button type="button" className="touch-btn primary">Start</button>
      </div>
    )
  }
  if (shot === "danger") {
    return (
      <div className="shot-frame" data-shot="danger" style={{ margin: 12 }}>
        <section className="side-mission panel danger-mode" data-phase="danger" data-input-locked="1">
          <p className="danger-banner">DANGER — XOE has control</p>
          <div className="danger-stage"><div className="danger-signal" /><div className="danger-mech">XO</div><div className="danger-source">◉</div></div>
          <p className="narration">Tracing the hacker’s signal…</p>
          <button type="button" className="touch-btn ghost">Skip</button>
        </section>
      </div>
    )
  }
  if (shot === "lesson-panel") {
    return (
      <div className="shot-frame copy-block lesson-tight" data-shot="lesson-panel" style={{ margin: 12 }}>
        <h1>Colony Wallet</h1>
        <p className="bubble lesson-bubble">A wallet holds your keys. Practice only.</p>
        <p className="narration lesson-hint">Tap/click to fly</p>
        <div className="arcade-field" style={{ height: 200 }}><div className="arcade-xo" style={{ left: "40%", top: "50%" }}>XO</div></div>
        <button type="button" className="touch-btn ghost">Back to colony map</button>
        <section className="xoe-guide xoe-guide-compact">
          <button type="button" className="touch-btn">Ask XOE</button>
        </section>
      </div>
    )
  }

  if (shot === "scores-drawer") {
    return (
      <div className="shot-frame" data-shot="scores-drawer" style={{ margin: 0, minHeight: 844, position: "relative", background: "#0b0d12" }}>
        <p className="fine" style={{ padding: 12 }}>Colony map under drawer</p>
        <div className="drawer-overlay" data-drawer="open">
          <div className="drawer-sheet">
            <div className="drawer-head"><h2>High scores</h2><button type="button" className="touch-btn ghost">Close</button></div>
            <ol className="high-score-list"><li><strong>#1</strong> · 120 pts · Arcade</li><li><strong>#2</strong> · 80 pts</li></ol>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "settings-drawer") {
    return (
      <div className="shot-frame" data-shot="settings-drawer" style={{ margin: 0, minHeight: 844, position: "relative", background: "#0b0d12" }}>
        <p className="fine" style={{ padding: 12 }}>Play paused behind settings</p>
        <div className="drawer-overlay" data-drawer="open">
          <div className="drawer-sheet">
            <div className="drawer-head"><h2>Settings</h2><button type="button" className="touch-btn ghost">Close</button></div>
            <p className="fine">Music & SFX · Grok Bot · haptics · ticker · side missions · difficulty</p>
            <button type="button" className="touch-btn">Music on</button>
            <button type="button" className="touch-btn">Ticker on</button>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "leaderboard") {
    return (
      <div className="shot-frame" data-shot="leaderboard" style={{ margin: 12 }}>
        <div className="drawer-overlay" data-drawer="open">
          <div className="drawer-sheet">
            <div className="drawer-head"><h2>High scores / Leaderboard</h2><button type="button" className="touch-btn ghost">Close</button></div>
            <p className="fine" data-test-leaderboard="1">Test leaderboard · Testnet XOE · no real money</p>
            <ol className="high-score-list"><li><strong>#1</strong> · Flyer · 55 · arcade · test</li></ol>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "wallet") {
    return (
      <div className="shot-frame" data-shot="wallet" style={{ margin: 12 }}>
        <div className="drawer-overlay" data-drawer="open">
          <div className="drawer-sheet">
            <div className="drawer-head"><h2>Account & Wallet</h2><button type="button" className="touch-btn ghost">Close</button></div>
            <p className="bad">Testnet — no real value</p>
            <button type="button" className="touch-btn">Connect browser wallet</button>
            <p className="fine">Paste public G-address only. Never S… secrets.</p>
          </div>
        </div>
      </div>
    )
  }
  if (shot === "voice-reminder") {
    return (
      <div className="shot-frame" data-shot="voice-reminder" style={{ margin: 12, minHeight: 400, position: "relative" }}>
        <aside className="voice-reminder panel" data-voice-reminder="1">
          <p className="bubble">XO: I’m here to help. Say a voice command anytime — like “turn the music down.”</p>
          <button type="button" className="touch-btn primary">Got it</button>
          <button type="button" className="touch-btn ghost">Don’t remind me</button>
        </aside>
      </div>
    )
  }
  return null
}