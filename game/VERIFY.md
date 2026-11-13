# XOE verify tool (`verify.mjs`)

This tool is local only and for testing only. It never pushes, deploys, or posts. The only network calls are to Coinbase and xAI, and Playwright answers both with fixed local mocks. Every other http(s) request is blocked. It uses a fake key only (`xai-test-fake-0000`) and never prints a key-like match.

Targets the shipped **v18.2** HTML by default:
`/workspace/eddie-bot-handoff/X-Orbital-Engine-Build-2026-11-10-v18.2.html`.
Pick another file with `--build <path>` or `VERIFY_BUILD=<path>`.

Needs Playwright (already in devDependencies). If browsers are missing: `npx playwright install chromium webkit`.

It is not part of the game. `verify.mjs` sits in the project root, outside `src/`, so `tsc -b` (src + vite.config.ts), vitest (`src/**/*.test.ts`) and the Vite bundle never see it. Proof: a relay build made from this tree is byte-identical to the shipped v18.2 file (sha256 `b21c106b…`).

| Command | npm script |
|---|---|
| `node verify.mjs seed` | `npm run verify:seed` |
| `node verify.mjs run <flow>` / `run list` | `npm run verify:run -- <flow>` |
| `node verify.mjs screenshot <page>` / `screenshot list` | `npm run verify:screenshot -- <page>` |
| `node verify.mjs check` | `npm run verify:check` |

Exit codes: `0` = all pass, `1` = something failed, `2` = bad usage.

## 1. `seed`

The seed command writes `qa/verify/seed.json` with sorted keys and no timestamps. Running it again gives a byte-identical file.

- seed `20261110`. Before the game loads, this seeds `Math.random` (mulberry32) and `crypto.randomUUID`.
- clock `2026-11-10T12:00:00-06:00`. This is `page.clock.install`: time starts there and then runs normally.
- Mocked Coinbase public API: spot `XLM-USD 0.2500`, BTC 90000, ETH 3000, ADA 0.50, plus 24h opens. Candles and order book come back empty.
- The game's real localStorage keys are injected once per page: `xoe.deviceId.v1`, `xoe.soundMuted.v1`, `xoe.tutorial.v1`, `xoe.voiceReminder.v1`. The voice reminder is marked as already shown, so it does not cover buttons.
- The api.x.ai mock reply text and the fake key (grok-test only).

```
$ node verify.mjs seed
wrote qa/verify/seed.json (1085 bytes) sha256 0efaa18e104fb9deba1c0255f139189d9600546894e8cf2cc83166e5a78740db
seed=20261110 clock=2026-11-10T12:00:00-06:00 coinbase XLM-USD=0.2500 (mock)
```

`run`, `screenshot` and `check` read this file. If it's missing, they create it first.

## 2. `run <flow>`

Plays the flow headlessly. By default it uses desktop Chromium at 1280x800. Add `--device iphone15` for WebKit iPhone 15. It prints one `PASS|FAIL <flow>.<nn> <step> — detail` line per step, then `SUMMARY`.

| Flow | What it does |
|---|---|
| `tutorial` | Opens Tutorial from the start menu. Checks the step 1 title "Hey — I’m XOE, Unknown Orbital Engine", walks all 6 steps, then checks that `xoe.tutorial.v1` is saved as completed. |
| `map` | Pilot setup → story (skips the cinematic) → practice desk buy/sell → navigate → colony map. Checks the trade dock, the 13 domes, the full map list (1 bonus) and the pause menu. |
| `fees-bonus` | Reaches the map and picks the ★ bonus dome from the full map. Taps Enter and plays all 6 "Fees and leverage" steps, with one wrong gate first. Checks the education label, the ~0.3% funding line and "Fees and leverage clear." back on the map. |
| `grok-test` | Uses a mocked api.x.ai. Checks the "Grok Bot integration" label and the built-in reply to "Who are you?" (must say "I'm XOE, Unknown Orbital Engine"). Then the key paths: short key error, mocked 401 bad-key error, and a good fake key → "Live Grok Bot: connected". It also checks that the system prompt tells the model to say "I'm XOE, Unknown Orbital Engine.", that the Ask XOE reply is answered by "Grok Bot (connected)", and that Disconnect deletes the key. |

```
$ node verify.mjs run grok-test
verify run grok-test · build X-Orbital-Engine-Build-2026-11-10-v18.2.html · desktop Chromium 1280x800
PASS grok-test.01 label-grok-bot — card says 'Grok Bot integration' + 'Grok Bot ON'
PASS grok-test.02 builtin-identity — built-in reply: "XO: Hey Pilot — I'm XOE, Unknown Orbital Engine. I'm a state-of-the-ar"
PASS grok-test.04 short-key-error — "That key is too short. Copy the whole key from console.x.ai."
PASS grok-test.05 bad-key-error — mocked 401 → "xAI said the key is not valid. Check it at console.x.ai. (xA"
PASS grok-test.06 good-key-connected — mocked 200 → "Live Grok Bot: connected"
...
PASS grok-test.15 network-blocked — requests: 10 coinbase (mock), 5 x.ai (mock), 0 blocked
SUMMARY grok-test: PASS 15/15 steps passed
```

Rough run times: tutorial and grok-test take about 5 s each, map about 15 s, fees-bonus about 35 s.

## 3. `screenshot <page>`

Each page gets two PNGs in `qa/verify/`: `<page>-iphone15.png` and `<page>-desktop.png`. The iPhone shot uses WebKit with the Playwright "iPhone 15" profile (393x659 viewport, touch, mobile Safari UA, DPR 3). The desktop shot uses Chromium at 1280x800.

Pages: `launch`, `grok-card`, `pilot-select`, `tutorial`, `practice`, `map`, `full-map`, `pause`.

```
$ node verify.mjs screenshot map
PASS screenshot map iPhone 15 WebKit 393x659 393x659 → qa/verify/map-iphone15.png
PASS screenshot map desktop Chromium 1280x800 1280x800 → qa/verify/map-desktop.png
```

Live parts such as the XOE/USD sim price animation and the ticker coins can differ by a pixel or a cent between shots. The screen and the layout stay the same.

## 4. `check`

Prints one line per rule as `PASS|FAIL <rule-id> <detail>`, always in the same order and with no timestamps, then a `SUMMARY`. It exits 1 if any rule fails. Two runs on the same file give identical output (same sha256).

Rules come from the static HTML text plus one rendered pass: the start menu, then pilot select after Start, then Tutorial step 1, on desktop Chromium with the mocks.

| Rule | Passes when |
|---|---|
| `title-exact` | `<title>`, `document.title` and every `<h1>` are exactly `XOE: Unknown Orbital Engine` |
| `no-old-title` | No `X Orbital Engine` words, in any case, in the HTML or in the rendered text and aria-label/alt/title/placeholder. The lookbehind skips "Unknown Orbital Engine". **Code identifiers** such as `x-orbital-engine`, `XOrbitalEngine` or `X_Orbital_Engine` are counted in the detail but are not a FAIL, because they never render. "X Orbital menu" is not the old title and is allowed. |
| `ai-label-grok-bot` | "Grok Bot" is in the HTML, and the start menu shows "Grok Bot integration" and the Grok Bot ON/OFF toggle |
| `ai-identity-line` | "I'm XOE, Unknown Orbital Engine" is in the HTML (straight or curly apostrophe) and Tutorial step 1 renders it |
| `no-ai-logos` | None of these: xAI/Grok logo, mark or icon words; image file names containing grok or xai; SVG data URIs containing grok or xai; `<img>` grok/xai attributes |
| `no-keys` | 0 matches for `xai-` + 20 or more characters, `sk-…`, `Bearer <token>`, Slack/Discord/`/webhook` URLs, Stellar `S…` secrets, AWS/GitHub tokens, `GROKBOT_WEBHOOK`. Only counts are printed. |
| `prices-coinbase-only` | No other price API (CoinGecko, Binance, Kraken, CoinMarketCap and others) is in the HTML, and the page only requested `api.coinbase.com` / `api.exchange.coinbase.com` |
| `hosts-allowlist` | Every host the HTML names is in the allowlist: Coinbase ×2, `api.x.ai` (the player's own key), `console.x.ai` (link), `www.w3.org` (SVG namespaces), `freighter.app` (how-to text), `horizon-testnet.stellar.org` (testnet config string, not a price source), `127.0.0.1:18791` |
| `relay-local-only` | The only IP/localhost URL or host:port is `127.0.0.1:18791`. When the relay is ON, `VITE_XOE_RELAY_BASE` must be `http://127.0.0.1:18791`. The bare `127.0.0.1` / `localhost` strings in the relay guard (`isLocalRelayBase`) are harmless and ignored. |
| `no-banned-figures` | No `$86.10` and no `$36,345` |
| `xo-classified` | "Class: CLASSIFIED" and "Stats: CLASSIFIED" are in the HTML, and the rendered XO pilot card says "Stats: CLASSIFIED" with no DEF/OFF/HP/Strength numbers |
| `fees-funding-line` | The exact fees lesson line from `src/game/fees-leverage.ts` is present: "Holding a perp (perpetual) trade also charges funding fees, so about 0.3% is a safer number to plan with." |
| `no-paper-trading-copy` | No "paper trading" or "Paper only" in the HTML or on screen. The seed-backup line "paper or metal" is allowed. |
| `tagline` | "Now, in the palm of your hands." is in the HTML and on the start menu (Locked Decisions) |
| `no-project-x` | No "Project X" (Locked Decisions, cover art) |
| `build-id` | Exactly one `uoe-YYYY-MM-DD-vN` build id |
| `no-page-errors` | No page errors during the rendered pass |

Sample output on v18.2:

```
$ node verify.mjs check
PASS title-exact <title>="XOE: Unknown Orbital Engine" document.title="XOE: Unknown Orbital Engine" h1=["XOE: Unknown Orbital Engine"]
PASS no-old-title "X Orbital Engine" text in HTML=0 on screen+aria/alt/title=0; code ids like x-orbital-engine (not shown, not a fail)=1
PASS ai-label-grok-bot "Grok Bot" in HTML=71; start menu shows "Grok Bot integration" + toggle=true
PASS ai-identity-line "I'm XOE, Unknown Orbital Engine" straight=2 curly=1; tutorial step 1 renders it=true; system-prompt rule=true
PASS no-ai-logos logo words=0 logo asset names=0 svg data URIs=0 (grok/xai inside=0) img grok/xai attrs=0
PASS no-keys xai-key=0 sk-key=0 bearer-token=0 webhook-url=0 stellar-secret=0 aws-key=0 github-token=0 webhook-env=0
PASS prices-coinbase-only other price APIs in HTML=[] runtime hosts requested=[api.coinbase.com,api.exchange.coinbase.com]
PASS hosts-allowlist hosts named=8 not allowed=[]
PASS relay-local-only relay ON base=http://127.0.0.1:18791 ip/localhost refs=[127.0.0.1:18791] (bare 127.0.0.1/localhost guard strings ignored)
PASS no-banned-figures "$86.10"=0 "$36,345"=0
PASS xo-classified HTML "Class: CLASSIFIED"=1 "Stats: CLASSIFIED"=1; rendered XO card classified=true stat numbers=false
PASS fees-funding-line fees lesson line present=true; "about 0.3% is a safer number" count=3
PASS no-paper-trading-copy "paper trading"/"Paper only" in HTML=0 on screen=0; allowed "paper or metal"=5
PASS tagline "Now, in the palm of your hands." in HTML=true on start menu=true
PASS no-project-x "Project X"=0
PASS build-id BUILD_VERSION=uoe-2026-11-10-v18.2
PASS no-page-errors page errors on load + pilot select + tutorial=0
SUMMARY check: PASS 17/17 rules · build X-Orbital-Engine-Build-2026-11-10-v18.2.html · sha256 b21c106b12d5ba18
```

The one code-id hit on v18.2 is `data-cover="x-orbital-engine-v6"` in `src/ui/CoverArt.tsx`, a DOM attribute that never shows on screen.

On a deliberately broken copy (old title, a fake 30-character `xai-` key, `$86.10`, `$36,345` and a CoinGecko URL added), `check` exits 1 with FAIL on `no-old-title`, `no-keys`, `prices-coinbase-only`, `hosts-allowlist` and `no-banned-figures`.
