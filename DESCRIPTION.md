<!-- Form description (20-2000 characters). Draft: opener wording pending Eddie's final OK. -->
XOE is a Solana coin on Pump Fun that is paired with NEAR (Wrapped NEAR), and it powers XOE: Unknown Orbital Engine, a fast-paced mech game with a built-in trading-bot simulation that teaches players how to trade safely with paper money before they ever risk real funds.

Problem: new traders learn by losing real money. XOE teaches wallets, keys, fees, scams, phishing, leverage, stop-loss and take-profit inside an arcade game, using a paper-money trading desk (order book, limit/stop orders, trailing stop, alerts, P/L journal, coach tips).

Real economy on NEAR: when a player clears a colony, a game attester account records the achievement on NEAR testnet (rewards.attest). The player then claims it (rewards.claim), and the rewards contract mints XOE through a NEP-141 token contract with a rollback callback. One claim per achievement, per-player and global caps, pause switch.

NEAR tech: Rust near-sdk 5 contracts, NEP-141/145/148, cross-contract calls with callbacks, near-api-js, sandbox integration tests (36 tests pass), live on testnet: token.xoe-game.testnet and rewards.xoe-game.testnet. Designed to link Solana addresses and connect to the live wNEAR-paired coin later via Omni Bridge / Intents (bridge is simulated today).

Demo: game plus a live testnet panel; press Simulate colony clear, then Claim, and watch the XOE balance rise with explorer links. Testnet only, play money, no mainnet. Prototype limits: demo uses server-held testnet keys, placeholder amounts, no audit.
