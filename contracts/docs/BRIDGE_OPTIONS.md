# Real bridge options for XOE rewards (research notes, not implemented)

Written 11 Nov 2026 (America/Indiana/Knox). Sources are official docs, read the same day.
Nothing here has been tried. The prototype only *records* a simulated intent.
**[UNVERIFIED]** marks anything not confirmed in an official doc.

## First, a plain-English point about "wrapped NEAR"

* **wNEAR** (`wrap.near` on mainnet, `wrap.testnet` on testnet) is just NEAR coin packaged as a
  NEP-141 token so contracts can move it like any other token. It is not a bridge by itself.
* **XOE** in this prototype is its own NEP-141 token on NEAR. To give players XOE *on Solana*, a
  bridge has to create a "wrapped XOE" SPL token on Solana and move balances across.
* So the real choices are: (a) pay XOE on NEAR only, (b) bridge XOE to Solana, or (c) pay in an
  existing asset (wNEAR, USDC, SOL) and route it to the player's Solana address.

## Options

| Option | NEAR <-> Solana? | How it verifies | Fit for XOE | Tradeoffs |
|---|---|---|---|---|
| **Omni Bridge** (NEAR's own multi-chain bridge) | Yes. Solana listed as "Wormhole + Chain Signatures". | Outbound from NEAR: NEAR MPC network (Chain Signatures) signs. Inbound from Solana: Wormhole VAA. | **Best match.** Docs show a one-time "NEAR Token -> Solana" deployment (log metadata on NEAR, deploy wrapped mint on Solana), then transfers. | Relies on NEAR MPC + Wormhole guardians (trust assumption). One-time deploy cost. Relayer fees. New-ish SDK. Testnet availability for custom tokens **[UNVERIFIED]**. |
| **NEAR Intents / 1Click API** | Yes. Solana "fully supported"; NEAR too. | Solver network fills intents; settlement on `intents.near`. | Good for paying out in *existing* assets (e.g. swap wNEAR/USDC to SOL at the player's Solana address). Not a way to create wrapped XOE. | Market-priced quotes, solver availability, fees (extra 0.25% if unauthenticated per docs). Needs liquidity for XOE if XOE itself is routed **[UNVERIFIED for a new token]**. |
| **Wormhole (Portal / Wrapped Token Transfers)** directly | Yes. NEAR and Solana both listed for Wrapped Token Transfers. NEAR token bridge `contract.portalbridge.near`. | 19 Wormhole guardians sign VAAs. | Possible, but Omni Bridge already uses Wormhole for Solana and is NEAR-native, so direct Wormhole is mostly redundant. | Guardian trust model; attesting a new token; UX for players. |
| **Rainbow Bridge** | **No.** NEAR <-> Ethereum (light-client, trustless). | Light clients both ways. | Not suitable for Solana. NEAR docs describe Omni Bridge as its successor approach. | Slow/expensive Ethereum side; Ethereum only. |
| **Allbridge Core** | **No NEAR.** Supports Solana, EVM, Tron, Sui, Stacks; stablecoins only (USDC/USDT/USDe). | CCTP / OFT / xReserve; pool contracts deprecated after a July 2026 incident (per their docs). | Not suitable for XOE. Its SDK can route via NEAR Intents, which is the same as option 2. | Stablecoins only; no NEAR chain. |

## Recommendation (for Eddie to decide)

1. Launch on NEAR only first (XOE stays a NEP-141 on NEAR; Solana address is just a linked ID).
2. If Solana payout is a must, use **Omni Bridge** to deploy wrapped XOE on Solana, after audit.
3. Use **NEAR Intents** only if rewards are paid in an existing asset (wNEAR/USDC/SOL).

## Links

* Omni Bridge overview (supported chains): https://docs.near.org/chain-abstraction/omnibridge/overview
* How Omni Bridge works (also covers Rainbow Bridge history): https://docs.near.org/chain-abstraction/omnibridge/how-it-works
* Omni Bridge SDK, Solana guide: https://bridge.near.tools/guides/solana
* Omni Bridge SDK, token deployment (NEAR token -> Solana): https://bridge.near.tools/guides/advanced/token-deployment
* Omni Bridge source: https://github.com/Near-One/omni-bridge
* NEAR Intents supported chains: https://docs.near-intents.org/resources/chain-support
* NEAR Intents 1Click quickstart: https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/introduction
* Wormhole Wrapped Token Transfers networks: https://wormhole.com/docs/products/token-transfers/wrapped-token-transfers/reference/supported-networks/
* Allbridge Core docs: https://docs-core.allbridge.io/
