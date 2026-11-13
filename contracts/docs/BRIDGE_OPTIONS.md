# Bridge options (superseded)

Superseded on 13 Nov 2026. XOE is now a **native NEAR token**, live on NEAR mainnet at
`xoe.token.primitives.near` (owner `xoe-official.near`, 1,000,000,000 supply, 18 decimals).
There is nothing to bridge, so the bridge research, the simulated bridge intents and the
wNEAR pairing were removed from the rewards contract and the docs.

The older research notes live in git history (this file before the `near-native-rebrand` branch).

What happens instead:

1. Players claim XOE straight from the game, with no vault in between.
2. A player links one NEAR address to receive their XOE (`link_near_address`).
3. The demo claim runs on NEAR **testnet** today (`token.xoe-game.testnet`, `rewards-v2.xoe-game.testnet`,
   see `docs/TESTNET.md`). The direct no-vault mainnet claim is the next build step.
