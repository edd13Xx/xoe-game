# XOE: Unknown Orbital Engine
## White Paper, version 1.0 (13 November 2026)

Built by Eddie Rivera and his AI assistant, Bot, for the NEAR HACKATHON 2026 (Games With Real Economies).

**Status in one line:** XOE is a native NEAR token live on NEAR mainnet. The game and the rewards demo are an early-development prototype that runs on NEAR testnet with play money. No mainnet rewards are live.

## 1. Overview

XOE is a native NEAR token, live on NEAR mainnet at xoe.token.primitives.near. It powers XOE: Unknown Orbital Engine, a fast-paced mech game with a built-in trading-bot simulation that teaches players how to trade safely with paper money before they ever risk real funds.

The idea is simple. New traders usually learn by losing real money. XOE moves that lesson into an arcade game, where mistakes cost oxygen and armor instead of savings, and where players can earn XOE for what they learn and finish.

## 2. The game

- **Genre.** A trading-bot game simulation that teaches. You pilot a mech, explore space as an RPG, fight skirmishes, and clear colonies.
- **Story.** An in-depth storyline is already written: a mech pilot's journey across 10 colonies, then the moons Sol and Xelm toward the Ragnarok gate, as a spiritual-mechanical entity approaches the planet. Grok is woven into the narrative.
- **Trading simulator.** A paper-money trading desk with an order book, market, limit and stop orders, stop-loss and take-profit, trailing stop, price alerts and a profit-and-loss journal. Chart timeframes run from 1 minute to 1 month. Prices are simulated. They are not a real market and not a real XOE price.
- **Grok coach.** Grok rides in the cockpit as XOE's AI voice. Tips arrive as urgent battle warnings. The Grok call is made from the server, so no key is ever exposed to the player. If Grok does not answer within six seconds, a rule-based backup coach answers instead, so play never stalls.
- **Teaching without jargon.** RSI and EMA are computed from the simulated prices and drive the coach, but the player never hears those terms. Enemies hide in the RSI levels. Downside risk is a monster or a black hole below. A low balance is low oxygen. Players learn to read charts by surviving.
- **Lessons.** Wallets, keys, fees, scams, phishing, seed backup, leverage, stop-loss and take-profit, taught inside the colonies.

## 3. The XOE token (NEAR mainnet)

| Item | Value |
|---|---|
| Network | NEAR mainnet |
| Contract | xoe.token.primitives.near |
| Standard | Native NEAR fungible token |
| Owner account | xoe-official.near |
| Total supply | 1,000,000,000 XOE |
| Decimals | 18 |
| Market or liquidity pool | None yet |

The token has no market price and no pool today, so wallets show it without a price. Nothing in this paper is a price claim, a promise of value, or financial advice.

## 4. Rewards architecture (NEAR testnet prototype)

The reward system is built and running on NEAR testnet only, as a separate play-money token with no value. It shows how the mainnet design is meant to work.

**Contracts (Rust, near-sdk 5, NEP-141, NEP-145, NEP-148):**

- Token: token.xoe-game.testnet. Symbol XOE, name Unknown Orbital Engine, 18 decimals. Only accounts the owner has added as minters can mint.
- Rewards: rewards-v2.xoe-game.testnet. This is the only minter. It holds the reward table, the caps, the attester, the pause switch and the NEAR address links. It replaced the earlier rewards contract, which is retired and is no longer a minter.
- Attester: attester.xoe-game.testnet, the game-server role that records achievements.
- Demo player: player1.xoe-game.testnet.

**Flow:**

1. **Link.** A player links one NEAR address to their account with link_near_address. The contract checks it is a valid NEAR account id, and an address cannot be linked to two players.
2. **Attest.** When the player wins something in the game, the game server's attester account calls attest for that player and achievement. Only the attester can do this.
3. **Claim.** The player calls claim. The contract checks the achievement was attested and not yet claimed, checks the caps, and asks the token contract to mint.
4. **Mint and rollback.** The mint is a cross-contract call with a callback. If the mint fails, the claim is rolled back.
5. **No vault.** Nothing holds a pile of tokens waiting to be handed out. Rewards are minted at claim time.

**Controls:**

- One claim per achievement per player.
- A per-player cap and a global cap. Testnet placeholders: 1,000 XOE per player and 100,000 XOE global.
- A pause switch that blocks linking, attesting and claiming.
- Owner-only reward table, caps, attester and minter changes.
- Reward amounts are placeholders: 50 XOE for each of the 10 colonies, 100 for the boss, 200 for finishing the game.

**What we verified on testnet.** An end-to-end run on rewards-v2 linked a NEAR address, attested a colony win and claimed it. The claim minted 50 XOE and moved the demo player's balance from 290 to 340. A second claim for the same achievement was rejected. Transaction links are in docs/TESTNET.md in the repository.

**What is not built yet.** Today the demo claim mints to the claiming testnet account. Paying straight to the linked NEAR address is the next build step.

**Tests.** The game passes 500 unit tests and the demo passes 10. The contracts pass 32 tests: 7 token, 20 rewards, 2 for a legacy helper that is no longer used, and 3 sandbox integration tests on a local NEAR node.

## 5. Roadmap

1. **Direct claim, no vault.** The rewards contract mints straight to the player's linked NEAR address. Testnet first.
2. **Mainnet rewards.** Connect the same design to the mainnet XOE token, only after the steps below.
3. **Security audit.** An independent audit of the contracts and the attester design before any real money moves.
4. **Key handling.** Replace the server-held testnet keys with production key management for the attester role.
5. **XOE to USDC pool.** In a later phase, a liquidity pool lets players swap rewards. It uses the same reward contracts with a new mint and pool. No real money moves through any swap until the audit is done.
6. **Tokenomics.** Final reward amounts, caps and supply plans are decided before mainnet. Today's numbers are placeholders.

## 6. Risks and disclaimers

- **Early prototype.** The game and the rewards demo are in early development and may contain bugs.
- **Testnet only.** The rewards demo uses NEAR testnet and play money. It touches no mainnet funds, and testnet XOE has no value.
- **No audit.** The contracts have not been audited.
- **Server-held keys.** The demo uses testnet keys held by the demo server. This is acceptable for a prototype and not for production.
- **Placeholder numbers.** Reward amounts, caps and testnet supply are placeholders, not tokenomics.
- **Simulated prices.** Trading prices in the game are simulated for learning. They are not a real market, not a real XOE price, and no trade in the game is real.
- **No market yet.** Mainnet XOE has no pool or market today. Nothing here promises one, or any value.
- **Not financial advice.** This paper is information about a game and a prototype. It is not an offer, a promise of returns, or advice.
- **Third-party services.** The coach depends on the xAI Grok API, which can be slow or unavailable. The rule-based backup covers that.

## 7. Links

- XOE on NEAR mainnet: https://nearblocks.io/token/xoe.token.primitives.near
- Testnet token: https://testnet.nearblocks.io/address/token.xoe-game.testnet
- Testnet rewards v2: https://testnet.nearblocks.io/address/rewards-v2.xoe-game.testnet

Win or lose, XOE is building on NEAR. That was the plan before we ever heard about this hackathon, and it stays the plan after.
