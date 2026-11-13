# XOE: Unknown Orbital Engine — locked decisions

Everything below is **permanent** unless Eddie changes one item. Future builds must keep all of these.

Updated: 2026-11-09 (America/Indiana/Knox) — v15 pack

## Name and voice
- **Title page** (start screen h1, main header h1, menu h1, cover art, and HTML `<title>`): **XOE: Unknown Orbital Engine** (Nov 10, 2026, Eddie; replaces “X Orbital Engine” from Nov 9). **XOE** stays the short name. Output files keep the `X-Orbital-Engine-Build-*` names.
- **XOE** means **Unknown Orbital Engine** (short XO). XOE is the UI voice, mascot, and AI companion. In game it always identifies as “XOE, Unknown Orbital Engine” (live system prompt and built-in “who are you” answers; Nov 10, Eddie).
- **AI label** (Nov 10, 2026, Eddie): **Grok Bot**, one swappable constant `AI_NAME` in `src/game/brand.ts`. No xAI / Grok logos. Grok Bot is the engine under the hood; XO never calls itself Grok Bot.
- **XO class** (Nov 10, 2026, Eddie): state-of-the-art, cutting-edge unknown orbital. “Class: CLASSIFIED — Unknown Orbital · state of the art.” No strength, defense, or stat numbers for XO anywhere.
- Older notes may say “X Orbital Engine”; the on-screen title is now **XOE: Unknown Orbital Engine**.
- Tagline: **Now, in the palm of your hands.**
- **Cover art** (Nov 9, 2026, Eddie / v6): in-code SVG titled **XOE: Unknown Orbital Engine** (was X Orbital Engine until Nov 10) with purple orb guide **XOE**, colors `#0b0d12` / `#7c5cff` / `#a78bfa`. No “Project X”. No xAI / Grok / X Corp logos.

## Gameplay
- Moons: **Sol** (fiery/speed) and **Xelm** (cold/keys).
- Moon powers optional: Xelm **Frost Lock**, Sol **Flare Dash**, or none.
- Lessons are **arcade style** (learn while you fly).
- **Paper trading only** — no real money movement in the game.
- Price feed: **Coinbase public API only** (no keys, no account). **v9:** slim multi-asset live ticker (~30s; XLM/BTC/ETH/ADA) with Live/offline cache soft-fail. Market panel remains XLM-USD learning quote. No CoinGecko, no account connector.
- **Controls (v8)**: **Tap/click to fly** is primary. On phones: tap a spot, XO flies there; tap gates/buttons; **no on-screen joystick** and no keyboard prompts. On computers: mouse click-to-fly plus WASD/arrows. Detect via `(pointer: coarse)` / touch. Targets ≥ 48px.
- **Phone UI** (v6–v10): tap targets ≥ 48px, base font ≥ 16px, readable HUD at 390×844, `safe-area-inset`. **v8:** in-lesson narration compressed so the arcade field sits higher with little/no scroll. **v9–v10:** one-screen — Settings / High scores / Report / Tutorial / Market / Paper Advanced / Ask Grok are slide-in drawers over live play (one at a time). Title/cover is a brief fade overlay into play.
- **Tutorial** (v6–v8): skippable first-start tutorial; Replay in Settings; How to fly **Show me** demo. **v8:** fly step teaches tap/click; new cold vault & side missions step.
- **Arcade depth** (v6–v8): colonies include Trustline, Stroops, Volatility, **Phishing**, **Seed Backup** (offline paper/metal; never photos/cloud/share; never asks for a real seed). Overworld: first 3 = Ch1 L1, next 3 = Ch2 L3, rest = Ch3 L5. **10 story colonies.**
- **Practice exam moon** (v8): optional mixed-gate arcade before Ragnarok; paper-only; best score device-only; not required for moon path.
- **Race ghost** (v8): faint path of fastest clear on colony replay; device-only; settings toggle; respects reduced motion.
- **Side missions** (v8–v9): occasional between colonies when enabled (default on). **Phishing** = player spots/rejects red flags. **Remote hack** = **DANGER** — XOE takes mech control, input locked (Skip + reduced-motion static OK), auto-follows signal and destroys source; then player fight; then explains cold storage. Paper points device-only. Never ask for real seeds/keys. **v9:** cooldown + pity (min gap + pity after N clears); DANGER alarm SFX (respects SFX mute).
- **Cold storage story** (v8): player vault is cold storage — attackers can’t break in from the network, so they phish or remotely jab the mech link instead.
- **Mars music** (v6–v8): `mars` theme + soft ambient bed; **v8** separate Mars ambient volume slider; mute/off/reduced-motion silence all.
- **High scores** (v6–v11): device-only top scores remain; Reset local only. **v11:** optional opt-in **test leaderboard** (mock adapter, paper/arcade only, display name no email) with a documented Supabase/Firebase config hook — no real accounts.
- **Per-colony bests** (v7): best score/time on map domes; `xoe.colonyBests.v1`.
- **Phone haptic** (v7): vibrate + flash on correct gate; setting; reduced motion off.

- **Mech fighting** (v9): tap/hold fire, dodge/shield; Space/Shift on desktop; Easy/Normal/Hard (device prefs); 2–3 scam-tied enemies (phish drone / hack probe / scam swarm); hull/shield; haptics/SFX/reduced-motion; integrates danger→player fight, colony skirmish, Ragnarok boss prelude; paper scores device-only.
- **Paper Advanced desk** (v9): Coinbase Advanced–inspired paper trade layout as overlay drawer; **no Coinbase branding** on UI; paper balances/fills only; public chart/book seeds optional.
- **One-screen goal** (v9–v10): prefer overlays/drawers over navigating away from live play (Paper Advanced drawer, fight overlay on map, compact guide).
- **One-screen drawers** (v10→v11): drawer shell kept as sub-panels; v11 folds chrome into Start/Setup + Pause menu instead of scattered HUD buttons.
- **Two screens only** (v11): (1) **Start / Setup** — title/cover, Start/Continue, Grok key box visible on load (defaults ON; ON/OFF; Disconnect deletes key; built-in AI fallback), pilot select, difficulty, music/SFX/haptics/ticker/side missions/ghost/Mars volume, tutorial, leaderboard, Account & Wallet. (2) **Play** — story, map, lessons, moons, fights, side missions, Ragnarok, ending in-place with overlays. **Pause** button (top, ≥48px; Esc/P) opens the X Orbital Pause menu (Resume, Settings, Grok/Ask XOE, scores, Tutorial, Report, Paper Advanced, Market, Account & Wallet, Quit to start). Sub-panels may be drawers inside pause.
- **One X Orbital menu** (v12, Eddie voice call Nov 9, 2026): the separate Start/Setup screen is **gone**. The app is the **Play screen + ONE X Orbital menu** (`XOrbitalMenu`). At launch the menu shows in **start mode** over the idle play scene; during play the **Pause** button (≥48px; Esc/P on computer) opens the **same** menu in **pause mode**. The menu holds everything: title + tagline (cover art in start mode), Start/Continue (start mode) or Resume + Quit to start (pause mode), Grok integration (key box on load, ON/OFF, Disconnect, built-in AI fallback), Pilot select, Settings (music/SFX/haptics/ticker/side missions/ghost/Mars volume, difficulty), Panels (High scores/Leaderboard, Tutorial, Report a problem, Paper Advanced desk, Market, Ask XOE, Account & Wallet), **Upgrade & Shop**, and the voice mic. Sub-panels open as one drawer at a time **over** the menu. No duplicate Start/Setup, Pause, or Settings-drawer code.
- **Upgrade & Shop restored** (v12): the Upgrade (pilot stats, auto growth, no + buttons) and XO health Shop (health items only, no weapons) live as the **Upgrade & Shop** section of the X Orbital menu (permanence rule).
- **Grok voice reminder** (v11): always on first setup + first play; then at most ~every 10 min or after 3 colony clears; never during fight/danger; dismissible “Don’t remind me” in Settings. Mic/voice commands use Web Speech + built-in parser (music, difficulty, open panels); live Grok later.
- **Account & Wallet** (v11): Stellar **testnet only** (clearly labeled no real value). Display name; Connect browser wallet (feature-detect; phone how-to link) or paste public **G-address** (StrKey check). **Never** accept/store/show secret S… keys/seeds. Create-wallet guide + Seed Backup colony. XOE trustline explainer with **placeholder issuer config hook** (never Eddie’s real addresses). Pending testnet rewards are paper/admin-only — **no game-submitted payouts**. Partner coins placeholder. Disconnect wallet.

## Grok and built-in AI
- Grok access **defaults ON** at load.
- Skippable **key box on first load** when no key is saved (paste key, Save, link to console.x.ai, Skip).
- Without a key: **XOE: built-in AI**. With working key: **XOE: live Grok** (probe; fall back quietly).
- **Grok ON/OFF** keeps key; **Disconnect** deletes key → built-in.
- **Never bundle** any API key. Never print keys in reports or prompts.
- Grok settings reachable anytime from the X Orbital menu (v12: the Grok key box / ON-OFF / Disconnect render in exactly ONE place — the menu).

## Look and persona
- Visual style: `#0b0d12`, soft dark-slate panels, purple `#7c5cff` / `#a78bfa` — Grok Bot app vibe.
- No xAI/Grok logos or trademarked marks on screen.
- XOE persona: warm, plain words, short friendly sentences.

## Reliability and help
- **Safe storage** with in-memory Map fallback (opaque-origin / iOS in-chat sandbox).
- Standalone single-file HTML from `file://` and sandboxed `allow-scripts` iframes.
- **Report a problem** + **Auto error check**: Copy/Share only; advice only.

## Publishing
- **No deploy / no public sharehtml publish** without Eddie's explicit approval for that build.
- **Nothing in Eddie's Library** unless he asks for that specific save.
- No posting or sending outside without exact approved text.

## Stellar / money (standing hard rules outside this build)
- Never move, buy, sell, trade, convert, transfer, or withdraw anything for Eddie unless he explicitly approves that exact action.
- Company funds stay in cold storage; game remains paper-only.


## Before real rewards (checklist — not done)
- Legal / securities review for XOE rewards
- KYC / geo policy if required
- Stellar issuer setup (not placeholders) under Eddie’s approval
- Eddie’s explicit approval for any live network or payout path
- Never ship owner secret keys; never auto-payout from the game client

## Grok choice at start (Eddie, Nov 9, 2026 voice call) — LOCKED, SCHEDULED AFTER v13
- Grok integrated from the beginning; loads once only, no duplicates.
- No Grok means the generic built-in XOE AI.
- The player must pick Grok or Generic before starting; it is the FIRST item in the X Orbital menu at launch (was "Start/Setup"), and Start stays locked until picked.
- **Schedule (Eddie, Nov 9, 2026):** this spec stays locked, but the required Grok/Generic gate and new Grok-menu integration are **deferred until after v13** (graphics, ticker gameplay, mini map — v13 now built; the gate is next only when Eddie says go). v12 keeps the v11 Grok behavior unchanged, only moved into the one menu. Spec file: `XOE-Spec-Grok-Choice-2026-11-09.md`.

## v13 (Eddie approved, Nov 9, 2026) — built
- **Graphics: smooth vector neon** — glowing lines + gradients on `#0b0d12` / `#7c5cff` / `#a78bfa` (+ cyan/gold/green/red accents). Gradient sky, neon stars, glowing horizon, perspective grid floor, vector scam drones, neon deck, purple vignette. Pixel characters + XOE sprite/art stay, with a soft aura behind them. Map: neon grid night-Mars with glowing domes/path. No logos. Phone-fast: glow = double stroke (no shadowBlur), stage capped ~30 fps; reduced motion = static stars/grid/drones.
- **Ticker gameplay** (paper only): ONE ticker feed (Coinbase public spot, ~30s, no keys) drives the display AND gameplay. Price up ≥ 0.02% between snapshots → green **Gestalt** (10 pts +10 per 0.1%, cap 50); price down → red **enemy unit** (−10 if XO flies into it on the map, then a sim skirmish; in a lesson tap it to **shield** for +5). Each coin owns a lane: XLM → L1, BTC & ADA → L2, ETH → L3. Max 6 on field, 25s life. Offline or ticker off → **simulated prices** (labeled "Simulated prices (offline)") every 8s.
- **HUD mini map** on the colony map: player, colonies/lessons (done / next / locked), daily/weekly hubs, enemies (red ▲ hazards), pickups (green orbs), camera box. Tap small map → big; tap big map → XO flies there; "Shrink map". ≥48px.
- **Account & Wallet locks:** Stellar **testnet only**. Players must **connect Freighter to claim** XOE rewards; a pasted G-address is **view only**. Smallest unit **0.0000001 XOE** (1 stroop); amounts shown with 7 decimals. Sample tiers (rewards-config.json): lesson 0.0100000, level clear 0.0500000, fight win 0.0025000, tiny proof 0.0000001. Claim button is a disabled/queued placeholder — **no payouts wired**.
- **Founding Pilot badge — superseded by v14 (LOCKED + built, see below). Was:** early-launch perk for early XOE Pilots; cosmetic only, no money value, paper only, testnet note. Spec: `/workspace/eddie-bot-handoff/XOE-Spec-Founding-Pilot-Badge-2026-11-09.md`.
- Grok/Generic choice gate still deferred (see the Grok choice section: scheduled after v13). Grok defaults, key box, toggle, Disconnect unchanged.

## v14 reward plan + Founding Pilot badge (Eddie, Nov 9, 2026) — LOCKED, built (testnet only)
- **Supply:** 123,456,789.9999999 XOE (1,234,567,899,999,999 stroops). Smallest unit 0.0000001. Minted on testnet Nov 9, 2026, 6:34 PM CST to the hot wallet GCPTVIED…K7GP from issuer GBS5QXNW…QBV6 (mint tx 1f628824…5e96). Horizon reports supply 123456789.9999999. The old 1e9 demo set is kept as history.
- **Daily caps:** Founding Pilots (first 888 after mainnet launch) 8.888 XOE; new players 4.444 XOE.
- **Streak:** 7-day streak ×2, with credited = min(base × 2, cap). A missed day resets it. Days are the player's local day.
- **Milestones:** 25 XOE per chapter, one-time, outside the daily cap.
- **Monthly top 10:** 888 XOE pool.
- **Claim:** needs Freighter; weekly batch; never real money; nothing live; the claim button is disabled in-game.
- **[EDDIE TO PICK]:** halving trigger, top-10 split, earn rates, streak-day rule, Ragnarok milestone, batch day, supply allocation, issuer lock. Spec: `/workspace/eddie-bot-handoff/XOE-Spec-Reward-Plan-2026-11-09.md`.
- **Founding Pilot badge — LOCKED + built:** earned when one of the first 888 pilots after mainnet launch clears one colony (testnet/local uses the placeholder flag in Account & Wallet). Gold neon wings with 888 and a gold ship trail. Shows on every leaderboard (device list, Upgrade personal bests, test board). Tied to the local player id, not the name, so it survives a rename. NOT on Stellar; cosmetic; no XOE value. X mention at launch only with exact text Eddie approves first. Spec: `/workspace/eddie-bot-handoff/XOE-Spec-Founding-Pilot-Badge-2026-11-09.md`.
- **Still deferred:** the Grok/Generic gate (not added in v14).

## v15 live ticker + XOE coins + simulated USD (Eddie, Nov 9, 2026 calls) — built, LOCAL ONLY
- **XOE coins replace "orbs" on screen.** Price-up ticker items are gold neon **XOE coins** (in-code SVG "X" mark, no logos). Picking one up credits the v14 on-device ledger in **stroops**, through the SAME daily cap + streak rule (new 4.444 / Founding Pilot 8.888 XOE; credited = min(base × 2, cap) on a 7-day streak). Coin value: 1,000 stroops per point (normal 0.0010–0.0050 XOE), mini 0.0005 XOE, big moves ×2. Points formula (10 + 10 per 0.1%, cap 50) unchanged. A floating amount shows on every pickup.
- **Red ▼ hazards never take XOE.** They cost paper points on the map (−10, mini −5) or give +5 when shielded in a lesson. XOE balances never go down and never below 0.
- **Simulated USD display (Eddie's final pick):** `SIM_USD_PER_XOE = 10` — ONE named, game-only constant in `src/game/economy.ts` (switch `ECONOMY_DISPLAY_UNIT`, default `"sim-usd"`, other value `"xoe"`). The ledger stays in XOE stroops; only the display converts. Every USD figure carries a **"sim"** tag (e.g. "+$0.025 sim"; caps "$44.44 sim" / "$88.88 sim"; 3 decimals only when there are sub-cents). The Economy screen says **"Simulated USD for gameplay only. Not a price. No cash value. Testnet."** Never fetch or imply a real XOE market price. Not for promo/white paper. Paper trading cash stays separate.
- **Economy HUD** (today vs cap, session, unclaimed) on the colony map (inside the map) and in lessons; **Economy panel** in Account & Wallet (earned by source: coins, colony clears, fights, lessons & practice, side missions, milestones; lifetime; unclaimed; total supply 123,456,789.9999999 + 888 pool context). Claim stays **disabled**.
- **Calm-market ticker gameplay:** trigger scales to recent volatility (clamp 1.5 × average move, 0.004%–0.02%); the largest sub-trigger move makes one **mini** item; a **minimum cadence** drops a mini "drift" item when nothing spawned for 9s; **big moves** (≥0.15% and ≥3× average) stay special (gold pulse, double coin, 40s life, never crowded out). Items spawn near XO so they are on screen. Offline sim adds rare spikes so big moves still happen.
- **Ticker in fights:** every 5s one tick from the ticker coin rotation: green ▲ **energy** (tap → +12 shield, +5 pts), red ▼ **surge** (tap to defuse +5, Dodge blocks it, else 8 dmg × difficulty when its 3.5s fuse ends). Big moves double. Max 2 on field. Reduced motion = slower.
- **Ticker display:** focus coin button (≥48px; tap to switch XLM→BTC→ETH→ADA, saved on device), price, **real 24h %** from the Coinbase PUBLIC stats endpoint (every 5 min, no keys), tiny sparkline, ▲/▼ colored chips, seamless marquee, labels **Live / Last prices · offline / Simulated prices (offline)**.
- **Playability (v15):** fights show the result + **Fight again / Try again**; losing a side-mission or Ragnarok fight no longer counts as a win; the map scrolls on screen; first-steps hint on the map; on phones the decorative stage is hidden on the map/lesson so the play field comes first.
- Unchanged: name, neon look, paper only, Coinbase public API only, Grok defaults/key box/toggle/Disconnect, Freighter-only claim copy, v14 reward rates/badge logic, no Grok/Generic gate (still deferred), no deploy/public link/mainnet/posts/Library.


## v16 live simulator + XOE/USD sim ticker + phone preview fixes (Eddie, Nov 9, 2026) — built, LOCAL ONLY
- **Name, look, and safety unchanged:** XOE / XOE: Unknown Orbital Engine. Neon `#0b0d12` / `#7c5cff` / `#a78bfa`. Testnet only. Claim off. Freighter-only claim. Caps 4.444 / 8.888, 888 founders, supply 123,456,789.9999999. `SIM_USD_PER_XOE = 10`, every USD figure tagged **sim**. Coinbase public API only. No bundled xAI key, no seed prompts, no Cloudflare, no deploy / public link / Library / posts without approval. Grok/Generic gate still deferred.
- **Phone / in-chat preview:** Voice, Pause, and errors sit in a non-overlapping top bar (`play-chrome`). Voice is hidden in a sandboxed in-chat preview; a mic error is a ~3s toast after a Voice tap only, never on load. Offline ticker copy is friendlier and hints **Open in Safari for live prices.**
- **Grok connect:** Grok stays ON by default. One key box (X Orbital menu only): paste an `xai-` key, Save and test against `https://api.x.ai/v1/chat/completions` (model grok-4.7), show **Grok connected ✓** or a plain error. Players without a key use the built-in AI. Card copy: short “Grok is ready…” wording. Decline and Disconnect kept. If the sandbox blocks network: **Open in Safari to connect Grok.**
- **Cinematic / scene art redone** in locked neon vector style (no xAI/Grok logos). Eleven compressed webp stills in `src/assets/scenes/` (cinematic 1–3, wake, missing-pilot, auto-battle, cockpit-invite, practice, near-loss, rescue, navigate). Navigate keeps a moving XO on top of the still.
- **XOE/USD sim is the live trading instrument** (replaces the 4 fixed mock prints). Price floats around $10.00 sim, ticks ~every 1.2s, clamp $5–$20, never ≤0. Driven by live XLM-USD step % (dampened) plus noise and a light mean-revert; offline = labeled simulated walk. Visible motion: lerp animation, green/red flashes, scrolling chart, 24h-style %. Default ticker coin is XOE; XLM and the rest stay in the switcher. Always **sim price · testnet · not a real market**. Never a real XOE market, never promo/white paper.
- **Live simulator (first version):** flying and trading share the colony map. Always-on HUD with the live XOE price and chart; Buy/Sell XOE (0.1 lot) on a thumb dock; open position, P/L (XOE and sim $), and balance update while you fly. World reacts to ticks (green ▲ updrafts / coin streams on rises, red ▼ dips / hazards on falls). Fights and colonies stay in that same world. Opening practice remains a story beat with the same desk.
- **Ledger rules for trade P/L:** gains through `earnStroops` source `trade` (daily cap + streak). Losses cut unclaimed only, floor 0, lifetime never down. Hazards still never take XOE (points only). Voluntary Buy/Sell is the scoped exception to “balances never go down.” Practice/world desk seeds from unclaimed, or a 0.1 XOE practice lot + $20 sim cash if unclaimed is 0 (cash is in start and end mark so it is not gifted as XOE).
- **Grok Bot relay:** hook only in this build (`GROK_BOT_RELAY_ENABLED = false`). A later step can plug in an async “Grok Bot” provider. No relay network or files in v16.

## v17 — historical record clarification (Nov 10, 2026 CST)
- The supplied v18.2 archive contains no authoritative, separate v17 change manifest. Do not infer new permissions or gameplay formulas from a version number. All preceding locked decisions remain intact; the historical implementation is preserved by the baseline git commit.

## v18 / v18.2 / v18.3 — observed implementation facts (Nov 10, 2026 CST)
- v18.2 source was the v19 baseline. v18.3 was read-only comparison input; its supplied LOCKED-DECISIONS file contains no additional locked entries. Its short lessons, FAQ, Enter chip, naming/target fixes and detailed win/loss cards were reviewed and integrated without adopting unapproved reward decisions.
- Source uses React APIs/types but the existing Vite build aliases them to Preact compatibility. This is an inherited stack fact, not permission to silently migrate either way.
- Historical README claims about no networking, fixed mock trading prints, unplayable later regions and a static/non-hit-reactive shield no longer describe v18.2/v19. Original documentation/art is preserved in docs/history.
- Contradictions are FLAGGED, not deleted: earlier multi-asset live prices vs Nov 10 XLM-only network scope; v13 sample rates vs shipped v14 rates and “[EDDIE TO PICK]”; fixed ledger-display dollars vs floating simulated trade dollars; deferred guest no-save/required AI gate vs current saved preferences; missing XP progression vs permanent L1/L3/L5 gates. Values and level gates are not invented or relaxed.

## v19 — Eddie's Nov 10 directions and local implementation
- Title XOE: Unknown Orbital Engine; tagline exactly “Now, in the palm of your hands.” No Project X or X Orbital on screen or in delivered HTML identifiers. Original in-code orbital art: close curved planet, atmosphere, irregular multicolored twinkling stars, purple orbit/arrow, original spiritual-mechanical presence, XO/XOE focal guide. Keep original art in the repository. No copied franchise elements or logos.
- Every player-facing engine reference is Grok Bot, never bare Grok/Grok AI. Conversational identity remains “XOE, Unknown Orbital Engine”. Built-in AI is the offline/no-key/error fallback. Keep ON/OFF and Disconnect. Trade replay only after explicit yes.
- Only live Grok Bot with the player's own key and Coinbase public XLM data may make external service calls. Never bundle, log or commit a real key. Key defaults to session-only storage; Remember on this device requires explicit consent and plain disclosure. Disconnect aborts in-flight keyed requests and wipes storage, with a visible failure warning if erasure fails. Non-XLM switcher instruments remain labeled local simulations. Release relay OFF; any enabled relay is loopback-only.
- Arcade fly-and-learn, one line per lesson (≤12 words), Learn more into FAQ, no question-form quizzes. Existing optional mixed-gate practice exam remains flight-based. Ragnarok uses flight gates with the same boss/power reducer, not a new damage formula.
- Route: Wallet, Keys, Blocks | Fees, Stroops, Scams | Trustline, Volatility, Phishing, Seed Backup. Preserve 3/3/4 and L1/L3/L5. Moving Sol/Xelm choice to Chapter 3 is NOT approved; hold as a proposal.
- Streamlined phone and PC play: touch portrait 390×844 and landscape, keyboard/mouse desktop, safe-area support, ≥48px targets, smooth/fast lightweight visuals. A headless browser pass is not physical-phone certification.
- Visual XO/shield refinements only; no weapons or damage/economy value changes. Keep music/SFX, Sol and Xelm/powers, result/loss cards, Report a problem, toggle/Disconnect, PWA generator and single-HTML build. Paper/simulated, Stellar testnet only; claim disabled; no real money.
- No deploy, publication, push, posts, contacts, account access, real credentials, source-attachment changes, or Library saves. Local review commits/builds/screenshots only. Larger proposals, unresolved lock contradictions and progression decisions go back to Eddie rather than becoming silent new rules.

### v19 audit limitation — browser-managed speech (Nov 10, 2026, CST)
The inherited locked Web Speech voice/microphone feature remains. Browser vendors may route speech synthesis or recognition through their own remote services; application fetch interception cannot certify that backend. No microphone or physical-device voice session was invoked during v19 verification. This is an unresolved tension with the two-provider outbound-network rule, not permission for another provider. Do not silently remove the voice feature or claim a device-wide network guarantee. Eddie must approve any local-only/caption fallback or user-keyed xAI speech redesign needed on unsupported devices.

### v19 follow-up delivery naming (Nov 10, 2026, CST)
The follow-up explicitly requests `Unknown-Orbital-Engine-XOE-v19-2026-11-10.html`, replacing the historical output-prefix instruction for this v19 delivery only. The original locked line is retained as history, not silently edited. Game title, mascot identity and all other locks remain unchanged. Both phone orientations must have overlay union strictly below 30.6%, with non-overlapping controls and targets at least 48px.

### v19 evening authority and explicit choices — Nov 10, 2026, 9:35–9:37 PM CST
- Eddie authorized local changes/fixes/refactors/tests; all permanent locks remain. Nothing may be published, pushed or deployed. This authority does not alter earlier reward, damage, moon-power or stack decisions.
- Explicit progression option B is selected: on first Blocks clear, raise a lower-level pilot to level 3 / XP 0 with existing level-2/3 class-growth steps; first Scams clear raises to level 5 / XP 0 using existing level-4/5 steps. Add exactly 0 practice coins and 0 ledger XOE. Apply once per checkpoint, preserve advanced pilots and existing XP thresholds. This resolves the previously recorded missing-progression blocker without relaxing chapter gates or inventing an XP formula.
- Sol/Xelm choice stays at its existing all-colonies beat; moon powers and unlock timing stay unchanged. Do not implement the proposed Chapter 3 move.
- Browser speech output, including silent priming, is explicitly opt-in and OFF by default, with a one-line warning that the browser may use its vendor's servers. Captions and existing player-keyed Grok Bot voice remain. This addresses default output behavior in the earlier speech audit; optional browser synthesis/recognition backend transport is still not application-controlled or certified by HTTP interception. No third application fetch provider is added.
- Earn rates stay exactly as shipped. FAQ labels them local simulation settings, not approved or final real/testnet payout promises.
- PC map coverage aims at 35% or less; both phone orientations must remain strictly below 30.6%, with disjoint overlays and controls at least 48px. Accessibility checks must have zero serious/critical axe-core findings, without hiding or disabling offending rules.
- Dormant server and in-game model default is grok-4.7; XAI_MODEL override remains. Verification is mock-only with no live key or live model call. No entitlement, live response or service availability claim follows from those tests.

### v19 sim-combat lasers — Eddie, Nov 11, 2026, ~12:05 PM CST (voice)
Eddie approved lasers for the ship and for XOE in the paper/practice trading-sim combat only. This supersedes the “no weapons” lock for that scope only. Colony fights, damage formulas, economy, rewards and caps stay unchanged. Lasers are visual/sim defense against simulated bot attackers in the trade arena; they do not change P/L, ledgers or progression. The prior no-weapons line is retained as history.

