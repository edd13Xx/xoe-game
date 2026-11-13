# XOE rewards on NEAR (NEP-141 token + rewards contract)

Contracts for the NEAR HACKATHON 2026 entry. **Deployed to NEAR TESTNET only** (play money, no mainnet,
no real funds). The sandbox tests below run on a throwaway local NEAR node. Live testnet accounts and
how they are used are in the repo root `README.md`. The Solana addresses used in tests are made up.
Reward amounts, caps and supply are placeholders until the final tokenomics are decided.

Built 11 Nov 2026, around 6:20 PM CST (America/Indiana/Knox), with near-sdk-rs 5.30.1.

## What it does, in plain English

1. A player links **one** Solana address to their NEAR account (and that Solana address can't
   be linked to anyone else).
2. When the player beats something in the game, the **game server** (the "attester") tells the
   contract "player X earned achievement Y".
3. The player presses **Claim**. The rewards contract checks it hasn't been claimed, checks the
   caps, and asks the XOE token contract to mint the reward to the player.
4. Optional, **SIMULATED**: the player can send XOE or mock wNEAR to the rewards contract with
   the message `bridge_to_solana`. The contract keeps the tokens and writes down an "intent" to
   send them to the player's linked Solana address. No real bridge is called.

## Contracts

| Folder | What it is |
|---|---|
| `contracts/xoe-token` | XOE token. NEP-141 + NEP-145 storage + NEP-148 metadata. Symbol `XOE`, name `Unknown Orbital Engine`, 18 decimals (placeholder). Owner adds/removes **minters**. Optional hard `max_supply`. |
| `contracts/xoe-rewards` | Reward table, per-player cap, global cap, one claim per achievement, pause/unpause, Solana link (base58, 32-byte check), attester-only attest, claim mints via the token. Rolls a claim back if the mint fails. Also hosts the **bridge mock** (`ft_on_transfer` + intents). |
| `contracts/wnear-mock` | **SIMULATION** stand-in for `wrap.near`: wrap NEAR 1:1 (`near_deposit`), unwrap (`near_withdraw`), NEP-141 transfers. |
| `integration-tests` | Sandbox tests that deploy all three to a local node. |
| `docs/BRIDGE_OPTIONS.md` | Real bridge options (Omni Bridge, NEAR Intents, Wormhole, Rainbow, Allbridge) with links. |

```mermaid
flowchart LR
    Game[XOE game server<br/>= attester] -- attest(player, achievement) --> R
    P[Player NEAR account] -- link_solana(addr) + 0.01 NEAR --> R
    P -- claim(achievement) --> R[xoe-rewards]
    R -- ft_mint (minter role) --> T[xoe-token XOE]
    T -- XOE balance --> P
    R -. on_claim_mint callback<br/>roll back if mint failed .-> R
    P -- near_deposit --> W[wnear-mock<br/>SIMULATION]
    P -- ft_transfer_call msg=bridge_to_solana --> T
    P -- ft_transfer_call msg=bridge_to_solana --> W
    T -- ft_on_transfer --> R
    W -- ft_on_transfer --> R
    R -- records --> I[(Bridge intent<br/>SIMULATED: to linked Solana addr)]
    I -. real bridge later<br/>e.g. Omni Bridge .-> S[(Solana)]
```

## Main methods

* Token: `new_default_meta(owner_id, max_supply?)`, `add_minter`, `remove_minter` (owner, 1 yocto),
  `ft_mint(account_id, amount, memo?)` (minters only), plus standard `ft_*` / `storage_*`.
* Rewards: `new(owner_id, attester_id, token_id, per_player_cap, global_cap)`;
  owner (1 yocto): `set_reward`, `remove_reward`, `set_caps`, `set_attester`, `set_owner`,
  `pause`, `unpause`, `add_bridge_token`, `remove_bridge_token`, `sim_mark_intent_completed`;
  player: `link_solana` (0.01 NEAR), `claim` (give it ~100 Tgas);
  attester: `attest`; views: `get_config`, `list_rewards`, `get_solana_address`,
  `get_near_account`, `is_attested`, `is_claimed`, `get_player_issued`, `list_intents`, `get_intent`.
* wNEAR mock: `new`, `near_deposit`, `near_withdraw`, `simulation_label`, standard `ft_*`.

Pause blocks linking, attesting, claiming, and new bridge intents.

## How to run

```bash
cd contracts
./scripts/test.sh     # unit tests + sandbox tests (about 1.5 min)
./scripts/build.sh    # wasm for all three + SHA-256 into wasm-sha256.txt
```

Needs the toolchain from `/workspace/xeno-near/SETUP.md` (Rust 1.95 pinned, wasm32 target,
cargo-near, `OPENSSL_NO_VENDOR=1`; the scripts set PATH and that variable).

The sandbox tests use `near-sandbox` + `near-api` (what `cargo near new` uses today) rather than
the older `near-workspaces` crate. Same idea: a real local NEAR node.

## Test results (11 Nov 2026, ~6:18 PM CST)

* xoe-token unit: **7 passed**
* xoe-rewards unit: **23 passed**
* wnear-mock unit: **2 passed**
* Sandbox integration: **4 passed** (`link_rules`, `attest_claim_caps_pause`,
  `failed_mint_rolls_back_claim`, `wnear_mock_bridge_flow`), covering about 45 checked steps
* **36 / 36 passed, 0 failed**

Covered: link, invalid Solana address, both duplicate-link directions, missing deposit,
non-attester (player and stranger), unknown achievement, unlinked player, claim before attest,
attest + claim mints, double claim, double attest, per-player cap, global cap, pause/unpause,
non-owner admin, non-minter mint, failed-mint rollback and retry, wNEAR wrap/unwrap,
bridge intent for wNEAR and XOE, refunds for un-listed token / wrong msg / unlinked sender.

## Wasm builds (`cargo near build non-reproducible-wasm`)

| Contract | Path | Bytes | SHA-256 |
|---|---|---|---|
| xoe-token | `target/near/xoe_token/xoe_token.wasm` | 201123 | `2973cd9048bcac4c1f98d5573ece3c3b5b4ed07084dec3f921bd2f697d4481a6` |
| xoe-rewards | `target/near/xoe_rewards/xoe_rewards.wasm` | 207140 | `338c1fab7e8a0c9ee01964eb657fc9b5587a6ade0536c8a4593662b9b9868f2e` |
| wnear-mock | `target/near/wnear_mock/wnear_mock.wasm` | 146934 | `7375bfa96073268bbca66906508b0fa0a4cad65f87a1722931522fcee773e6b3` |

Non-reproducible builds: hashes can change on another machine. Use a reproducible build before any launch.

## Simulated vs real

| Piece | Status |
|---|---|
| XOE token logic, minter role, caps, claims, Solana link checks | Real contract code, tested on a local node only |
| Accounts (`owner.sandbox`, `player1.sandbox`, ...) | Made up, exist only in the local node |
| Solana addresses in tests | Made up byte patterns, not anyone's wallet |
| Game attester | A sandbox account. No real game server, no signed proofs from gameplay |
| wNEAR | **Mock** contract, not `wrap.near` |
| Bridge to Solana | **Simulated**: an intent record only. No bridge call, nothing reaches Solana |
| Linking proof | Not real: a player can type any valid-looking Solana address. They don't prove they own it yet |

## Known limits (prototype)

* **Anti-cheat:** the contract believes the attester. Anyone holding the attester key can award
  achievements up to the caps. Real launch needs server-side checks, rate limits, and a protected key.
* **Solana ownership isn't proven.** Before payouts to Solana, require a signed message from the
  Solana wallet (ed25519) when linking.
* The base58 check confirms a 32-byte key; it doesn't check the curve (program addresses are off-curve anyway).
* The rewards contract must be registered (`storage_deposit`) on a token before it can receive it for bridge intents.
* Bridged tokens just sit in the rewards contract; there's no refund/cancel path yet.
* Decimals (18), caps, and reward amounts in tests are placeholders.

## Checklist before any real launch

- [ ] **Eddie decides tokenomics:** total/max supply, decimals, reward amount per achievement,
      per-player and global caps, whether XOE has any market value at all.
- [ ] **Legal / securities review** of a reward token with value (and of any Solana payouts).
- [ ] **Security audit** of all contracts (plus fuzzing and upgrade/ownership plan, ideally multisig owner).
- [ ] **Attester key management:** key in an HSM/KMS, rotation plan, limited-access key, monitoring, alerts.
- [ ] **Anti-cheat** on the game server; signed, verifiable achievement proofs if possible.
- [ ] **Solana ownership proof** at link time.
- [ ] **Pick and integrate a real bridge** (see `docs/BRIDGE_OPTIONS.md`; Omni Bridge looks best for wrapped XOE on Solana), audit that path too.
- [ ] Replace the wNEAR mock with `wrap.testnet` / `wrap.near` if wNEAR is used at all.
- [ ] Reproducible wasm builds and published source.
- [ ] **Testnet account, only with Eddie's OK**, then a testnet run, then mainnet only after all of the above.
- [ ] Keep the game's paper/sim labels until real rewards are approved and live.
