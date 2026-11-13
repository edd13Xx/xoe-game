# XOE: Unknown Orbital Engine — v19 (local review build)

Now, in the palm of your hands.

An arcade fly-and-learn game with a **simulated** XOE/USD trading instrument. Testnet only; no real money. Claim remains disabled. This is a local prototype, not a deployed game or a production-security certification.

## Run and build

```sh
npm install
npm test
npm run lint
npm run accept
bash scripts/build-v19.sh
# Optional, loopback-only development server:
npm run dev
```

The release artifact is `dist/index.html`, an inlined, standalone HTML file. Open it directly in Chromium or a normal browser; no asset server is required. Browser sandbox/CORS restrictions can prevent live services; offline simulation and Built-in AI remain available. `node verify.mjs check --build dist/index.html` runs mechanical lock checks. `node review-v19.mjs` exercises desktop, portrait touch and landscape touch with intercepted Coinbase requests and no live credentials. After building, `npm run test:full` plays a fresh 10-colony route, the unchanged moon choice, actual boss combat and ending at all three viewports, with axe audits. It uses precise clock advancement (every timer/rAF callback still runs), not injected progress or a QA unlock; omit `XOE_FAST_CLOCK=1` when calling the script directly for normal-time playback. `npm run test:a11y` additionally audits all seven retained panels. Evidence is in `review/`. The obsolete pre-menu Playwright acceptance script (old cover IDs, fixed-print trades and bare AI labels) is preserved in `docs/history/accept-v18.2.mjs`; `npm run accept` now runs the current Chromium lock/map/Grok Bot/tutorial checks.

For a separately packaged Home Screen app, run `node pwa/make-pwa.mjs dist/index.html review/pwa v19-2026-11-10`. No publishing is authorized. A real secure origin is needed for installation outside loopback; an iPhone/Android installation has not been certified.

## Actual stack (unchanged)

TypeScript and React-style JSX/hooks, React 19 APIs/types, Vite 8, and Canvas2D/SVG/CSS. **The inherited Vite configuration aliases React imports to Preact 11 compatibility modules.** The delivered runtime is therefore Preact compatibility, not a pure React 19 runtime. This resolves the apparent package/code mismatch without silently switching stacks. A runtime migration requires a separate decision and regression pass.

## Game and controls

One XOE menu at launch and Pause; in-place story, pilot setup, practice desk, colony map, lessons, optional practice exam, Sol/Xelm and optional powers, side missions, skirmishes, Ragnarok and ending. Settings, FAQ, music/SFX, voice, tutorial, scores, Report a problem, Account & Wallet, and Upgrade & Shop remain.

- Phone: tap/hold flight and gates; no joystick. Portrait 390×844 and landscape 844×390 have 48px minimum control targets and safe-area CSS.
- PC: click-to-fly, WASD/arrows, B/S practice trades, Space fire and Shift dodge; native buttons also support Enter/Space. Pause blocks gameplay input and preserves an ongoing colony fight.
- Route: **Wallet, Keys, Blocks | Fees, Stroops, Scams | Trustline, Volatility, Phishing, Seed Backup**. Concrete mechanics precede threats and advanced safety. The permanent 3/3/4 and level 1/3/5 gates remain. Approved option B: first Blocks clear raises the pilot to level 3 / XP 0, first Scams to level 5 / XP 0, using existing class growth; no coins or ledger XOE are added. Checkpoints apply once and never downgrade an advanced pilot.
- Lessons use one short line (12 words or fewer) and flight gates, with Learn more opening the in-game FAQ. Ragnarok's inherited question form is now flight gates using the unchanged boss reducer and moon-power effects.
- Original, in-code orbital cover; old art is preserved byte-for-byte in `docs/history/CoverArt-v18.2.tsx`. The active scene retains the locked purple orb, palette and branding. The shield flare responds only to actual fight hull/shield loss; it adds no protection or damage.

## Network and Grok Bot

Not a “no network” build. The normal release permits only:

1. Player-keyed Grok Bot chat/TTS at fixed HTTPS `api.x.ai` endpoints. No bundled/server operator key; no cookies; redirects rejected. Chat has a 45-second timeout and bounded output, TTS a 12-second fetch timeout. Rate limits produce feedback, not automatic paid retries. Responses are non-streaming to keep identity, validation, cancellation and fallback deterministic. Streaming remains a proposal.
2. Coinbase **public XLM-USD** spot/stats and the optional XLM learning chart. No accounts or price keys. Requests time out after seven seconds; the main feed backs off on failure. The ticker focus is XOE, a clearly labeled $5–$20 simulation driven once per XLM snapshot plus local noise/mean reversion. Other retained coin-switcher assets are explicitly local simulations, not additional live feeds.

Grok Bot is ON by default, with a skippable key box. The companion calls itself **“XOE, Unknown Orbital Engine”**; UI engine labels say **Grok Bot**, with no logos. Built-in AI is the offline/no-key/failed-call fallback. Trade replay requires an explicit yes; no replay autoplay was added. Result-card tip rewording is not replay narration.

Keys default to **sessionStorage** (memory fallback when browser storage is denied). Only explicit **Remember on this device** persists a key in localStorage. Neither is encrypted or safe against injected JavaScript on the same origin. Legacy implicitly persistent keys are migrated into session storage. Save and test, not typing, commits a new draft key. OFF retains the key but aborts calls; Disconnect aborts calls, clears both storage locations/tester codes, invalidates probes, clears the entry draft, and reports wipe failures. Other open same-origin tabs respond to storage revocation. No JavaScript implementation can promise physical erasure of secret strings from browser memory.

Browser speech output (including silent priming) is **off by default** and requires an explicit Voice settings opt-in: the browser may use its vendor's servers. Captions remain available; player-keyed Grok Bot voice is retained. Microphone recognition remains tap-initiated and browser-managed; no vendor transport or audible playback is certified. Application HTTP requests remain pinned to the two providers above.

The inherited guest adapter and async relay are **dormant hooks**, not the release path. Release build flags turn relay OFF. Public relay bases are rejected. Client and dormant server both default to `grok-4.7`; `XAI_MODEL` can override the dormant server. Model behavior/availability has only been checked with mocks, never a live call. The local development guest HTTP route requires a loopback Host, same-origin request and an ≤8KiB JSON body. Do not configure it with an owner/operator key; that would require a separate authorization and is outside the player-own-key lock.

## Economy and results

No reward/cap/damage values changed; only the explicitly approved zero-currency route level checkpoints were added. Trade sessions are consumed once on map exit; map skirmishes share that same desk instead of duplicating inventory. Sim-dollar P/L uses actual mark P/L, while XOE P/L is shown separately; the ledger's fixed display conversion remains unchanged. Win/loss cards, details, rounding, fees/funding explanations and FAQ were integrated from v18.3. Unapproved reward rates/splits/halving/batch choices are labeled provisional rather than promoted to owner decisions.

## Known limitations / approval needed

- The previous fresh-run level blocker is resolved by Eddie's explicit checkpoint option B, not a new XP formula. Existing practice-return thresholds/splits, coin rewards, ledger rates and caps are unchanged.
- Historical v13 sample earn rates differ from shipped v14 values, which remain “[EDDIE TO PICK]”. All shipped values are preserved. FAQ does not settle those choices.
- Earlier multi-asset live-feed wording conflicts with Nov 10's XLM-only network lock. Coin options/features remain; only their non-XLM prices are local simulations.
- Old notes about a no-save guest and mandatory Grok/Generic gate are explicitly deferred, not implemented policy.
- Moon unlock timing, functional power redesign, real rewards/accounts, production relay, stack migration, fees/leverage/stop-loss expansion and deployment remain proposals only.

Headless touch emulation is not a physical phone, audible music/haptic proof, accessibility certification, or live-service proof. See `review/STATUS-v19.md` for exact measured passes and gaps, commit history, comparison and checksums. Historical README/design notes are preserved under `docs/history/`; they describe older builds, not this release.
