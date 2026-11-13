<!-- Form description (20-2000 characters). Draft: opener wording pending Eddie's final OK. -->
XOE is a native NEAR token, live on NEAR mainnet at xoe.token.primitives.near, and it powers XOE: Unknown Orbital Engine, a fast-paced mech game with a built-in trading-bot simulation that teaches players how to trade safely with paper money before they ever risk real funds.

XOE already has an in-depth storyline: a mech pilot's journey across 10 colonies, then the moons Sol and Xelm toward the Ragnarok gate, as a spiritual-mechanical entity approaches the planet, with Grok woven into the narrative.

Problem: new traders learn by losing real money. XOE teaches wallets, keys, fees, scams, phishing, leverage, stop-loss and take-profit inside an arcade game, using a paper-money trading desk (order book, limit/stop orders, trailing stop, alerts, P/L journal) with a coach powered by the xAI Grok API (server-side key, instant rule-based fallback).

Real economy on NEAR: when a player clears a colony, a game attester account records the achievement on NEAR testnet (attest) on the rewards-v2 contract. The player then claims it (claim), and the contract mints XOE through a NEP-141 token contract with a rollback callback. One claim per achievement, per-player and global caps, pause switch.

NEAR tech: Rust near-sdk 5 contracts, NEP-141/145/148, cross-contract calls with callbacks, sandbox integration tests (32 tests pass), live on testnet: token.xoe-game.testnet and rewards-v2.xoe-game.testnet. Players link a NEAR address (link_near_address) and claim from the game with no vault. Today the demo claim mints to the claiming testnet account; paying straight to the linked address, then mainnet, is the next build step.

Demo: game plus a live testnet panel; press Simulate colony clear, then Claim, and watch the XOE balance rise with explorer links. Testnet only, play money. Prototype limits: server-held testnet keys, placeholder amounts, no audit.

Win or lose, XOE is building on NEAR. That was the plan before we ever heard about this hackathon, and it stays the plan after.
