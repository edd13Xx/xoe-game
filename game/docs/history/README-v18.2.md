# XOE: Unknown Orbital Engine — offline opening prototype

Title: **XOE: Unknown Orbital Engine** (Eddie, Nov 10, 2026). XOE is the short name. Build files keep the `X-Orbital-Engine-Build-*` names.

Private, offline, browser prototype of the Unknown Orbital Engine opening. This is a lightweight Vite + TypeScript + React client and a 2D canvas. It is a prototype platform choice, not a permanent engine commitment.

The design page that recorded the opening was explicitly not an authorization to build. Development here follows Eddie's later start approval on Nov 7, 2026 at 5:25 PM CST, the 5:28 PM CST vault/story alignment, and the recovered energy-bridge notes. Dialogue below is **draft**. It is not a recovered screenplay.

No network. No wallet. No Stellar SDK. No live assistant. No deployment.

## Run

```bash
npm install
npm run dev
```

Dev server: [http://127.0.0.1:4317](http://127.0.0.1:4317)

That address is a local preview on the same computer. It is not a public website. This repo has no host, domain, or deploy config. The first screen is the local front page. **Start** opens character setup for the existing opening. **Back to front** returns there and clears that visit. **Restart paper practice** resets the paper fixture only. The line on that screen is “Now, in the palm of your hands.” The picture is the supplied file `src/assets/xo-front-page-owner.jpg`, 1320×1227, SHA-256 `2f2db5669303a7d1f2de42680f26c2e6720ec770ff21b267959f2b1bc52e6304`, shown whole. That file prints XO, the short form, and its bytes are not edited.

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` writes a self-contained `dist/index.html` (scripts and styles inlined) plus the local favicon. Serve `dist/` with `npm run preview`. Opening the file directly can be blocked by the browser for module or canvas audio reasons; preview is the supported offline check.

`npm run accept` drives a local Playwright pass. Start the server first and set `XENO_URL` if it is not `http://127.0.0.1:4317`. The script aborts any request whose host is not loopback.

There is one roster character named XOE. XO is the short form, including the letters printed on the cover. XOE is the mascot. The opening does not assign XOE a starter mech. XOE is presented as Sentinel. That profile does not confirm the class by itself. Suit color does not change practice, rescue, or balances. XOE can be confirmed without a rename.

The normal XOE picture is `src/assets/xoe-sprite.png`, the 16×16 SIS cell shape mirrored and recolored violet and teal. It has no sword. On the stage, other pilots are `PILOT_ROWS` at 2 pixels per cell (32×34). XOE uses that same cell size, so the stage box is 32×32 logical pixels (64×64 device pixels on the 640×360 canvas). The roster portraits of the other pilots are drawn at 12 pixels per cell inside a 144-pixel card. XOE uses that same 12 pixels per cell, so the front page and roster show the whole 16×16 sprite at 192 pixels, nearest-neighbor, with the card wide enough that the sprite is not cropped. A slow float and a visor glimmer are display motion only. They stop when reduced motion is on or the page is hidden. The near-loss beat draws a transparent ring fitted around that body. The ring flares and fades. It is a staged picture for that existing beat. There is no hit detector and no damage change. The richer still `src/assets/xoe-original-stylized-weapons-v2.jpg` (864×1152, SHA-256 `49260dacdb36f8ebb216d16936e974611d94555092b052691b31696018c12327`) is drawn only on wake and auto-battle. The cover stays separate and is not animated. Paper trading does not start a new image request and does not play video. Files are inlined once. This note does not claim a measured bandwidth saving. Frame rate and physical-phone responsiveness were not measured. A passing test is not a performance result. Current owner stance, provisional: triple-A visual quality takes priority over smoothness, including in combat. A slowdown is acceptable when the picture needs it. Do not add slowness on purpose, and do not make the art worse to go faster. Mara Venn, Elias Cho, Nia Okonkwo, Zoe, SIS, the drones, and the walker keep their existing pixel rows.

Keyboard: arrows or WASD only along the fixed terrace route. `B` buys and `S` sells during the paper sequence. Touch uses the same route and the same paper buttons.

## Open the built file

`npm run build` writes `dist/index.html` with the script and styles inlined, plus `dist/favicon.svg`. The page links the icon as `./favicon.svg`, so keep those two files in one folder.

On a desktop, open `index.html` from that folder in Chrome or Edge. This environment verified that file only through a local static preview and a headless desktop browser, not by handing the file to a separate phone. If a desktop browser blocks the inline module or stays silent until a click, serve the folder with any local static server on that same computer. Do not use another machine's loopback address.

On an iPhone, this project was not run on a physical device. A 390×844 viewport check is not an iPhone test. Safari often will not run a local `file://` module page from the Files app. A practical offline approach on the phone is a local static server on the same Wi-Fi, or opening the HTML only after iOS allows local files. That limitation was not re-tested on hardware here.

Reduced motion follows `prefers-reduced-motion`. Decorative canvas motion also stops while the practice pause is up and while the tab is hidden. The practice clock pauses while the tab is hidden so a miss is not scored in the background.

## Draft dialogue

| Beat | Speaker | Draft line |
| --- | --- | --- |
| Wake | Scene | You wake in a battle already involving XOE. Drones are closing in to kill you. Danger is sensed. |
| Missing pilot | Scene | XOE's original pilot is missing. Not dead. |
| Auto-battle | Scene | Auto-battle activates before any invitation into the cockpit. |
| Invitation | Zoe | Jump in, if you want to survive. |
| Practice pause | Zoe | This is practice. The battle and the trade are the same exchange. Nothing here is a real trade. I will wait until you resume. |
| Near loss | Scene | The practice line nearly breaks. The practice result does not change the rescue. |
| Rescue | SIS | You ain't nothing. |

The SIS line is an allowed example taunt, not a locked script. Cinematic captions are draft too. Pilot names Mara Venn, Elias Cho, and Nia Okonkwo are provisional adult roster labels.

## How to enter the paper sequence

1. The roster header is XOE: Unknown Orbital Engine. The role label is Pilot. The selection line is: Choose your pilot. XO is the official mascot of Unknown Orbital Engine using Grok bot. Select XOE to confirm it, or choose another character. That mascot wording is fictional project identity. It does not issue coins or connect a live Grok bot. XOE is the default character and the default name, pronounced Zoe. XO is the short form printed on the front-page picture. The spaced form of the full name is X O E. Choose Female, Male, or the NA checkbox, and choose one class. Those groups are single-choice. Then confirm the simulation disclaimer. The button reads start when ready and stays off until every one of those is explicit. Mara Venn is presented as Sentinel, Elias Cho as Striker, and Nia Okonkwo as Recon. The notice “Recon is for experienced players only.” is a label, not a separate mode. Those profiles are qualitative only. The fictional CLASSIFIED lines are roster flavor, not files and not bonuses.
2. Read the simulation disclaimer. Trading here is paper only and no real money moves. Confirm it. Begin stays off until that confirmation.
3. Continue through the wake, the missing pilot, auto-battle, and Zoe's invitation.
4. Skip the cinematic, or play it and finish or skip it.
5. The battle encounter opens as **Practice paused**. Resume practice. Buy and sell stay off until that resume.
6. Each step shows one mock fixture print. **Buy 1 paper unit** (B) or **Sell 1 paper unit** (S). The screen shows mark = cash + (position × print), then result = mark − 1000. A negative position is allowed and lowers the mark. Restart paper practice resets the board. Exit paper practice leaves early. After four actions, Continue story returns to the near-loss, the SIS rescue, and the terrace.
7. On the terrace, only one route can be walked: east from pad (2, 4) to column 11, then south to the sealed hatch at (11, 8). Other directions do nothing. The hatch does not open a new area.

## Provisional paper fixture

The battle encounter and the trade are the same paper sequence. It is a simulation with embedded mock prints: 100, 110, 90, then 120 paper units. Starting paper cash is 1000. Buy spends the current print and adds 1 to the paper position when cash covers it. Sell adds the print to paper cash and subtracts 1 from the paper position, which may go below zero. The paper result is paper cash plus position times the current fixture print, minus 1000.

These amounts are a reversible demo fixture. They are not a token price, a market quote, a brokerage account, or a canonical economy. A gain, a loss, and an early exit all return through the same rescue. The paper result is not written to the in-game reward balance, the 28% death rule, the vault, energy, or the uncomputed earned-practice balance.

No damage, health, or combo formula is included. Suit colors do not change the fixture or the rescue.

## Separated balances

These are labels and hooks. They are not a live ledger.

- **In-game reward balance.** Starts at 0. This opening never adds to it. The recorded death rule removes 28% of this balance only. Local demo rounding is floor division (`100` leaves `72`, vault deposit `0`). That rounding is provisional. It is not a settlement formula. It never creates a deposit.
- **Earned practice-trading balance.** Recorded as a positive balance made during a practice trade, usable by the player, and the recorded way upgrades would work. Not computed. No formula was recovered. This opening does not write it. It is not fed by real deposits. The 28% rule does not apply to it.
- **Fictional energy, power, and life.** Recorded as coming from that earned practice balance, not from deposits. The recorded phrase is "liquidity life blood capital." It is fictional. There is no numeric bar, consumption rate, deposit-to-power scaling, or settlement formula. "Liquidation means the end." ABC is undefined and is not listed. The future final boss is not revealed and is not a market price or ticker.
- **Vault.** Story hook only inside the game: rewards are recorded to enter a vault after the game is beaten. Settlement is undefined and not implemented. The Stellar testnet share vault is not connected. See `docs/testnet-vault-gap-report.md`.

Health, damage, and combo are recorded whole-game words only (drawdown room, adverse move size, consecutive green candles). Formulas are undefined. They are not opening systems, charts, or market data.

## Build state

Implemented:

- Adult pilot roster with an original character-menu layout, keyboard and touch.
- Opening order: wake, missing pilot (not dead), auto-battle, then Zoe's cockpit invitation.
- Optional in-engine cinematic with play, next, and skip.
- Practice trade-as-battle as an offline paper sequence. The battle encounter pauses for Zoe, then resume opens buy and sell against the mock fixture. Restart, exit, and continue-story are available. Gain, loss, and early exit share the same rescue.
- Dialogue menu: bubble text, audio only with no dialogue text, or connect to Grok.
- Grok status is exactly "Not connected / integration not configured." Decline continues play. Speech uses `speechSynthesis` only when the browser exposes a local voice. If it does not, the game says audio is unavailable and does not call a network voice.
- Compact Planet X terrace, keyboard and touch, 24-hour terrace clock preview.
- Fogged directional pixel minimap. Spinward glimmer only. No boss coordinates and no boss name.
- Sealed hatch hook. Underground does not open.
- Separated balance panel and unplayable canon hooks.
- Local scoff sound from the Web Audio oscillator. No audio files are downloaded.
- Tests for the opening, pause, cinematic skip, win/loss rescue, offline source, dialogue menu, movement, minimap, death rule, and roster independence.

Not implemented:

- The rest of the game. Open Planet X, underground areas, two moons as destinations, and the space overworld are data hooks only.
- Zoe discovering she is key. The later unsuccessful rescue. XOE's escape. These are hooks. The opening SIS rescue is unchanged and is not that later rescue.
- Combat after this opening paper sequence. Live trading, shops, and upgrades. Health, damage, and combo formulas.
- A numeric energy bar or any energy, scaling, or settlement formula. The paper result is not an energy or reward formula.
- An earned practice-trading balance amount. ABC. A revealed final boss.
- A second battle. The auto-battle beat stays narration and does not open another paper session.
- Damage, health, and combo rules. They are still undefined, so they are not in the paper fixture.
- The cut-to-black ending. It is not encountered in this opening.
- Real or testnet vault calls, wallets, secrets, deposits, withdrawals, transfers, minting, prices, tickers, or market data.
- Grok, guide-service, or any assistant roster. No agent id. No team API.
- Accounts, deployment, and publication.

## Device voice

Open **Voice settings** on any screen. The list is only what this browser reports. Choose a voice and use **Preview**. **Reset to browser default** clears the saved choice. When this browser allows storage, the choice is kept in local storage under `xeno.deviceVoice.v1`. That save is the previously approved device-voice preference. It is not a game save, an account, or a Grok connection.

The same words stay on screen: “Pilot, you can change this voice in Voice settings or reset it to the browser default.” Opening Voice settings speaks that line once with the selected device voice if speech is idle. It does not repeat on every story line. If speech is unavailable, the text remains. No voice is labeled as XOE’s call voice. This check did not verify that a speaker actually made sound.

## Optional guest Grok

A separate box accepts typed text only. There is no sign-in and no key field. **Send to Grok** calls a same-origin `/api/grok` route. In this standalone file that route is absent, so the status is **Grok unavailable/not configured**. Story play continues. A reply, if a configured server later returns one, is spoken with the selected device voice. That playback is not Grok audio. Setup and limits are in `docs/grok-guest-adapter.md`. No live call was made for this build.

## Owner design notes, not implemented (Nov 8, 2026, evening CST)

These notes are not enforcement.

Corrected rule, superseding the narrower “paper trades only” wording: without Grok connected, nothing saves at all. No saves, no account, no rewards, and no memory persistence. Vault rewards and any saved progress require Grok connected. Terms for account, vault, reward, and enforcement are undefined. A Grok connection by itself does not establish identity, custody, entitlements, or reward legality.

Paired note: if a player uses the site as a guest, rewards they would have earned go into a vault pool rather than personally to them. Pool, accounting, transfer, source, and custody are undefined. This build does not move value or show a pool balance.

The owner confirmed that “guest has no memory” can conflict with the remembered device-voice choice. For now the voice preference stays as previously approved. The future no-save rule would also cover that preference. Changing or removing it needs a separate authorization. This documentation does not do that.

HUD wording, recorded Nov 8, 2026, evening CST. Not a built meter and not a settled formula.

Historical wording, kept and not treated as the current HUD rule: XOE coins were described as collectibles. The owner compared losing them on a hit or a death to Sonic collectibles. That comparison is a note only. No Sonic name, art, or assets are in the game. The owner said to collect them, lose them if hit or die, and only carry what can be picked up. The exact phrase was: “Whatever leftover margin remains is the XOE coin balance.” Experience was called life force and identified with a fake-cash balance. Coins would only purchase items in town. A level-up system and a dynamically determined boss worth based on difficulty, including a beginner mode, were described. No conversion, retention, loss amount, carry capacity, experience threshold, price, or boss-value algorithm was given. It was not said whether a hit or a death drops all coins or only some.

Refinement for these HUD concepts, which supersedes that historical experience / life-force / fake-cash description for the bar and the meter: “XOE coin is the energy bar, and the balance is the life meter. You need XOE coin to have full energy.” The current relay explicitly identifies its balance as the life meter. No conversion among fake cash, experience, and coins is defined. Maximum energy, consumption, regeneration, a death threshold, and real value are not defined. This does not rewrite the separate earlier fictional phrase “liquidity life blood capital.” That phrase remains an unimplemented story note. No coin, energy bar, life meter, town shop, or level-up code is in this build.

Critical-state assistance, recorded Nov 8, 2026, evening CST. Desired mechanic only. Not implemented.

A special ability unlocks when Pilot hits “critical levels.” Then SIS appears. The spelling is S-I-S, written SIS. If Pilot is friends with SIS, she drops XOE coins that are automatically picked up and absorbed, and Pilot’s balance increases “a little bit.” No critical metric, threshold, friendship test, drop amount, cooldown, repeat rule, or special-ability action is defined. How that increase relates to the energy bar, the life meter, or “whatever leftover margin remains” is undefined arithmetic. This build does not add the ability, the appearance, or the drop.

Follow-up, same evening: SIS alternates between outcomes depending on when or how the critical level is reached. What happens varies. The exact branch conditions remain open. “Alternates” is not recorded here as a strict toggle, a random chance, a coin rescue every time, a refusal, or any other specified behavior. No further outcomes are listed because none were given.

## OWNER PROPOSAL / UNVERIFIED DEPENDENCY

Not implemented and not an entitlement. The owner envisions that eventual Grok use would respect a legitimately connected player account, with Ultra-tier users having a slight advantage through more usage, called “more margin,” while a no-sign-in guest remains available. Subscription access, limits, OAuth, credits, and the meaning of “margin” are unverified. “Margin” is not gameplay or financial leverage here.

## Unresolved

- Who or what sensed the danger.
- The missing pilot's identity. Status is missing, not dead. No name was recovered for this build.
- Provisional pilot names.
- Final dialogue, including the SIS taunt.
- What "becoming one with the user" means technically. It is narrative only. It is not account access and not agent autonomy.
- Whether this browser has a local voice. The game detects that at runtime.
- Grok setup. It is not configured.
- Moon names and surfaces. Underground layout. Open-world geography.
- The historical energy formula, still unrecovered as numbers. Deposit-to-power scaling was not found and was not invented.
- Post-game vault settlement. Asset identity for a game reward. See the gap report.
- KAS and Casper were mentioned with ambiguous identity. They are not in this build. No third ticker was added.

## Roadmap, not this build

Later regions, moons, overworld travel, underground stories, Zoe's discovery, the unsuccessful rescue, the escape, upgrades, fictional energy with a real formula once one is recovered, and any reviewed testnet reward path. None of that is playable now. The gap report is a plan, not a connection.


## Light phone build (this copy only)

Assets recompressed to WebP at half resolution for phone sharing. Unused draft sprites removed. Gameplay unchanged. Original full-res build kept separately.


## Integrated journey (this copy)

After the Planet X terrace sealed hatch, the Pilot can travel the colony route (wallets, keys, blocks, fees, scams), choose one irreversible moon path, face a gated Ragnarok quiz fight, then cut to black.

- **XOE** is the scripted offline UI voice and companion (`XOE responses are scripted (offline)`). Not live Grok. SIS rescue stays separate.
- **Ragnarok** uses a gated quiz. The unrecovered 5–15% boss math is **not** implemented.
- **Moons (names approved by Eddie):** Xelm (cold/keys, ability Seal Refocus) and Sol (fiery/speed, ability Chain Ward). Irreversible per run. Abilities still pending Eddie approval.
- **Music:** original Web Audio chiptune loops (title, colony, ragnarok, ending→silence). Starts after first tap. Toggle + volume saved like device voice.
- Target phone single-file under ~150 KB. Do not treat moon names/abilities as owner canon until Eddie approves.


## Market panel (read-only)

XLM quote via CoinGecko (Coinbase spot fallback). No API key. Refresh ≥60s. Learning only — not advice. Offline shows “Live price unavailable (offline)” and never invents prices.
