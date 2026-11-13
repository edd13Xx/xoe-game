# Xeno offline build and Stellar testnet vault gap report

Plan only. This session did not connect to a network, deploy, sign, fund an account, mint, or send a transaction. The legacy vault was not modified. SDK version numbers below are not proof that anything is compatible or connected.

Evidence was the attached legacy README, Cargo manifest, guide-service package manifest, web config, and testnet deploy note, plus the owner instructions for the game. Those attachments are claims and configuration records. They are not contract source. This session did not re-run the recorded smoke tests and did not query a ledger, so recorded chain behavior stays unverified.

## What this prototype aligned

The playable slice is still only the approved opening plus a compact Planet X terrace.

- Opening order is unchanged: adult pilot, wake, missing original pilot (not dead), auto-battle before Zoe's cockpit invitation, optional skippable cinematic, practice pause and explicit resume, practice win or loss, the same near-loss, SIS rescue, terrace.
- Final Fantasy is not copied. The roster is an original character menu. Sprites are drawn in-repo.
- The minimap fades into space and only hints an unmarked spinward density. It publishes no boss coordinate, name, or ticker.
- Canon hooks exist for the Universal Vault story, Zoe discovering she is key, a later unsuccessful rescue (distinct from SIS), Xeno as an escape-machine, open Planet X, underground areas, two unnamed contrasting moons, a space overworld, and a 24-hour clock. Only the terrace and its local clock preview are implemented.
- Balances are split on purpose:
  - In-game reward balance, currently 0. The 28% death rule applies only here and never creates a deposit.
  - Earned practice-trading balance. Recorded as the positive balance a player made during a practice trade, and the recorded input to upgrades and to fictional energy, power, and life. Not computed. Not a deposit.
  - Fictional energy, power, and life. Unconfigured. No bar, consumption, scaling, or settlement. Deposits do not create it. "Liquidation means the end." ABC is undefined. The future final boss is not a market price.
  - Vault settlement after beating the game. Recorded. Formula undefined. Not implemented.
- Health, damage, and combo remain recorded words with undefined formulas. They are not opening systems.
- Grok is an unconfigured menu option. Status text is "Not connected / integration not configured."

## What is not implemented

Open world, moons as places, underground play, space overworld, escape, Zoe's discovery, the unsuccessful rescue, upgrades, any numeric energy model, any earned-balance amount, any reward payout, and any ledger connection.

## Assistant roster question

Eddie asked whether adding more actual assistant bots could break the Xeno build.

Checked by reading this prototype's runtime dependencies and source. No team API, roster endpoint, or agent directory was called. The Project X visitor page was not modified and is not imported.

This runtime does not depend on an actual Grok Bot roster, agent ids, or team APIs.

- Runtime dependencies are `react` and `react-dom` only.
- A source check rejects network clients, Stellar SDK imports, agent-id patterns, and ticker symbols in `src/` and `index.html`.
- `RUNTIME_COUPLING` records no agent ids and no team API.
- Story characters are Mara Venn, Elias Cho, Nia Okonkwo, Zoe, SIS, and Xeno. They are opening cast, not roster bots. "Connect to Grok" does not address a bot, an agent id, or an account. Decline leaves play intact.
- The legacy guide-service described in the attached README is a separate testnet process. This game does not call it.

Adding or removing bots on an actual assistant roster elsewhere does not change this build, because nothing here subscribes to that roster. A later patch could add that coupling. The offline source check is there so a network or agent-id dependency fails tests instead of arriving quietly.

No bot was created for this question. No character was added for it.

## Tickers that were not added

An owner question about three tickers was not resolved. KAS and Casper were called out as ambiguous. This build adds no tickers and no market data. The historical final-boss note that used BTC as a placeholder is not a price, a feed, or a ticker in the game. The word is omitted from the runtime on purpose.

XEN, ZOE, XOE, and XENOCOIN are discussed only in this report as unresolved names from the legacy record. They are not game assets.

## Recorded legacy vault, unverified

The attached README describes a Stellar Soroban share vault branded Zeno. It says the public ticker is XEN and that this supersedes XOE, ZOE, and XENO, and that the guide character is XENO. It points at `docs/brand.md`, which was not in the attachment, so that branding file was not read. ZOE is described as a valueless testnet asset. The guide assistant in that README is also called Zeno. None of that was wired into this game.

The README says the vault holds one asset: USDC in a production description, and the native XLM SAC on testnet. Users deposit and receive shares. It claims yield comes only from `donate_fees`, with a protocol fee of 170 to 440 bps (1.7% to 4.4%) on those donated rewards, not on deposits. It names views and actions including `deposit`, `withdraw`, `donate_fees`, `queue_fees`, `harvest`, pause, and a timelocked upgrade. It says shares are not a token. It says the contract was not formally verified, fuzzed, or audited.

Those are README claims. This draft does not contain `contracts/vault/src/lib.rs` or wasm. Claimed behavior is not verified contract behavior.

The Cargo manifest pins workspace dependency `soroban-sdk` at `29.0.1`. The guide-service manifest depends on `@stellar/stellar-sdk` with the range `^17.4.0`. No package lock was attached, so this session cannot confirm an exact install of 17.4.0. An exact SDK pin would still not prove the deployed wasm matches that SDK or that the JS client can call it safely.

The web config and deploy note record, and this report does not contact:

- Testnet passphrase `Test SDF Network ; September 2015`
- RPC host `soroban-testnet.stellar.org`
- v3 contract `CCTD2WXU4EZCADBEP4O6KOQIF3LCL7FGTLUFLKE6VCLQDF264KKN6EX3`, described as current code, native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Older v1 and v2 contract ids, kept only as history in the note
- Test asset `ZOE` with issuer `GAQREQTXRVZW2IQWVOSQ72EAY46LQNAU5YO5DOBBPRWLBF5CO7XBVZ7O` and SAC `CBIZQFO2LONHAJZLO62QB352SBNOKW7S6HW4TDILFNZQUSI447DW6KYW`
- Separate swap-router and fee-rebate contract ids

The deploy note also records admin and signer public addresses and a past smoke test. Those addresses are not reused here and are not repeated. The smoke numbers were not re-executed. Public addresses are not a game integration.

No attached file defines an asset code, issuer, SAC, or contract named XENOCOIN. The legacy financial contract must not be treated as if a Xeno coin reward method already exists.

## Rule collisions

Do not merge these into one formula.

| Record | What it actually is | What it is not |
| --- | --- | --- |
| 28% death rule | In-game reward balance only. Local and provisional if a balance ever exists. | Not a vault deposit. Not the 170–440 bps fee. Not energy. |
| Earned practice-trading balance | Recorded path from practice results toward upgrades and fictional energy. Formula missing. | Not a real deposit. Not computed in this opening. |
| Fictional energy / "liquidity life blood capital" | Story energy. Life and power source in the recovered note. Liquidation ends it. ABC undefined. | Not a BTC price. Not a deposit-to-power curve. No bar. |
| Post-game vault entry | Recorded timing: after the game is beaten. | Settlement formula undefined. Not `donate_fees`. |
| Vault fee 170–440 bps | README claim about a share of donated vault rewards. Unverified against source. | Not the game death rule. Not a player reward claim. |
| `deposit` / `withdraw` | README claim: user share accounting for the vault's single asset. | Not game energy. Not XENOCOIN collection. |
| `donate_fees` / `queue_fees` / `harvest` | README claim: fee donations into the share vault. | Not an implemented or approved game reward faucet. |

The offline game is not the authority for a payout. A Stellar ledger would be the authority only after a reviewed design that does not exist yet. This prototype's practice ledger is local and is not that ledger.

## Missing pieces before any testnet reward collection

1. **Asset identifier.** There is no verified code, issuer, SAC id, or contract id for the reward asset. XEN is a branding claim without an asset id in the attachments. ZOE is a separate recorded test asset. The v3 vault is recorded against native XLM. XENOCOIN is not defined. The owner has to name the exact asset before any client is written. KAS, Casper, and the BTC placeholder are not candidates in this build.

2. **Interface.** No Rust source, ABI, generated bindings, or error list is in this draft. README function names are not a typed interface. No reward, eligibility, or idempotency method is even claimed. `deposit` and `donate_fees` must not be assumed to be that method.

3. **Build correspondence.** Confirm, later and separately, that any wasm under test was built from reviewed source with a known Soroban SDK, and that the JS client version is a lockfile pin rather than a caret. SDK 29.0.1 and JS SDK 17.4.0, even if both installs were proven, would still not prove this game can call that wasm.

4. **Identity, signing, and custody.** This game has no wallet. It must not embed the recorded admin, demo user, or multisig signers. A future design needs a player identity model, a custody choice, and a rule that secret keys never enter the repo or the client. This session creates no accounts.

5. **Network and test tokens.** The config records testnet RPC, passphrase, XLM SAC, and ZOE. This client does not use them. Testnet fee sponsorship and friendbot-style funding described in the legacy README are out of scope. Mainnet is out of scope.

6. **Eligibility, validation, and idempotency.** "After beating the game" is not a check. The offline client can be edited, so it cannot attest to its own reward. A future design needs a trusted statement of completion, a replay rule, and an idempotency key. None of those exist. They should be specified before a contract method is proposed.

7. **Units and formulas.** The README cap figure uses 7-decimal style integers for the vault asset. Nothing maps in-game reward units, the 28% rule, or the uncomputed practice balance onto those integers. Energy scaling was searched for in the attached vault docs and was not found. The recovered chat bridge says practice-earned balance feeds fictional energy and upgrades, and that real deposits do not. It still has no numbers. Do not invent a conversion, a power curve, or a settlement formula to fill the gap.

8. **Which contract, if any.** Connecting "XENOCOIN reward collection" to the recorded v3 share vault would mix a game reward with user-principal share accounting and fee donations. That mapping is not authorized by the README or by this build. A reward path needs its own reviewed interface, or an explicit owner decision that some other existing contract is in scope. Upgrade of the current vault is a separate, high-risk admin action in the README's own risk list and is not part of this plan's permission.

9. **Tests and security approval.** The README says the vault is not audited. This game's tests only prove the offline client stays offline and that local rules do not deposit. A future testnet dry run needs a new approval, throwaway test identities, and tests that cannot hit mainnet. This session does not start that dry run.

## Concrete later sequence

Do not run these now.

1. Owner writes down the exact reward asset: code, issuer or contract id, and decimals. Reject the task if the id is still "XENOCOIN" without those fields.
2. Owner decides whether any existing contract is even a candidate. Until that decision, leave v3, the swap router, and the fee rebate untouched.
3. Obtain the matching source or a published spec and diff it against the README. Treat mismatches as open, not as permission to guess.
4. Write the settlement, eligibility, and idempotency rules in prose, including how they stay distinct from the 28% in-game rule and from the vault fee. Leave energy numeric design blocked until a historical formula is actually in hand.
5. Add a mocked client test in a future change that still has no RPC. Only a later approved change may point a throwaway testnet client at a reviewed contract.
6. Security review before any value can move. No mainnet, no real trading, and no secrets in the client.

## Offline game versus ledger

| | This prototype | Stellar testnet record |
| --- | --- | --- |
| Authority | Local story state only | Would be the ledger only after a reviewed integration |
| Connection | None | Not used |
| Balances | Labels, a zero reward balance, an uncomputed practice balance | Unverified share vault for a recorded XLM SAC |
| Energy | Unconfigured fictional hook | No energy method found in the attachments |
| Reward collection | Not implemented | No XENOCOIN method found |
