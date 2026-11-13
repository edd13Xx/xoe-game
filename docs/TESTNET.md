# XOE on NEAR TESTNET: accounts and transactions

TESTNET ONLY. Play money. No mainnet, no real funds. Reward amounts, caps and max supply are PLACEHOLDERS.
Explorer: https://testnet.nearblocks.io

| Role | Account |
|---|---|
| Owner / parent | [xoe-game.testnet](https://testnet.nearblocks.io/address/xoe-game.testnet) |
| XOE token (NEP-141, 18 decimals) | [token.xoe-game.testnet](https://testnet.nearblocks.io/address/token.xoe-game.testnet) |
| Rewards contract v2 (minter, NEAR-address linking) | [rewards-v2.xoe-game.testnet](https://testnet.nearblocks.io/address/rewards-v2.xoe-game.testnet) |
| Rewards contract v1 (retired, no longer a minter) | [rewards.xoe-game.testnet](https://testnet.nearblocks.io/address/rewards.xoe-game.testnet) |
| Attester (game-server role) | [attester.xoe-game.testnet](https://testnet.nearblocks.io/address/attester.xoe-game.testnet) |
| Demo player | [player1.xoe-game.testnet](https://testnet.nearblocks.io/address/player1.xoe-game.testnet) |
| wNEAR mock (simulation only) | [wnear-mock.xoe-game.testnet](https://testnet.nearblocks.io/address/wnear-mock.xoe-game.testnet) |

Config: token symbol `XOE`, name `Unknown Orbital Engine`, max supply 1,000,000 XOE. Rewards contract v2 is the only minter.
Per-player cap 1,000 XOE, global cap 100,000 XOE. Rewards: `colony_<id>` 50 XOE for each of the 10 colonies
(plus legacy `colony_cleared` 50), `boss_beaten` 100, `game_finished` 200.

## Deployment transactions (11 Nov 2026)
* xoe-game.testnet created: [95Eh8Y8VbNpe1eGHStdVerkvZDWVLPvgiPB2jQrga417](https://testnet.nearblocks.io/txns/95Eh8Y8VbNpe1eGHStdVerkvZDWVLPvgiPB2jQrga417)
* token deploy + `new_default_meta`: [3QaRwEFKLGo5C1dbddBp2kApJiad9V5Znu1V6NkwBePC](https://testnet.nearblocks.io/txns/3QaRwEFKLGo5C1dbddBp2kApJiad9V5Znu1V6NkwBePC)
* rewards deploy + `new`: [CvdevZ94J3fhF4mGhU7J483GGzdg2fQWwy2UfttSBZJj](https://testnet.nearblocks.io/txns/CvdevZ94J3fhF4mGhU7J483GGzdg2fQWwy2UfttSBZJj)
* `add_minter(rewards)` on token: [FTAZKRFnhSdJnivLULab7DAkgePCcSL38KWDnQXCr1dJ](https://testnet.nearblocks.io/txns/FTAZKRFnhSdJnivLULab7DAkgePCcSL38KWDnQXCr1dJ)
* first end-to-end smoke test: attest [AC5B4f1EWKZcd4eCuhYdBhRo34pR93kwYyuaTm1d2y4m](https://testnet.nearblocks.io/txns/AC5B4f1EWKZcd4eCuhYdBhRo34pR93kwYyuaTm1d2y4m), claim (mints 50 XOE) [A4Y7uQqNsDk2UbjeU19ca89nzSagpPhcuN5m1wscLrkk](https://testnet.nearblocks.io/txns/A4Y7uQqNsDk2UbjeU19ca89nzSagpPhcuN5m1wscLrkk)
* double claim rejected ("Already claimed"): [FaynNSH83E8prxwABTiZsa9fz5WzqptF6HUwe8ZGXKw](https://testnet.nearblocks.io/txns/FaynNSH83E8prxwABTiZsa9fz5WzqptF6HUwe8ZGXKw)

## Rewards v2 redeploy (13 Nov 2026): NEAR-address linking
The rewards contract was rebuilt for native NEAR (players link a NEAR address with `link_near_address`). The stored state layout changed, so it was deployed to a new account instead of upgrading the old one. The demo (`demo/config.json`) points at `rewards-v2.xoe-game.testnet`.
* create `rewards-v2.xoe-game.testnet`: [see account](https://testnet.nearblocks.io/address/rewards-v2.xoe-game.testnet)
* deploy + `new`: [967S3yocjKqyAGvbZsyogFVzKWKW1Sh12vPotwDtmpe](https://testnet.nearblocks.io/txns/967S3yocjKqyAGvbZsyogFVzKWKW1Sh12vPotwDtmpe)
* `add_minter(rewards-v2)` on token: [C1nPaEriTAwu9TD7dPRTMyXL88MGodh4kVuXR5fWw2HQ](https://testnet.nearblocks.io/txns/C1nPaEriTAwu9TD7dPRTMyXL88MGodh4kVuXR5fWw2HQ)
* `remove_minter(rewards)` (old v1) on token: [4xmiVcEJk4hWoyjV4hzG1DRfeF6HoMtJGBw6PJ8iREag](https://testnet.nearblocks.io/txns/4xmiVcEJk4hWoyjV4hzG1DRfeF6HoMtJGBw6PJ8iREag)
* 13 rewards copied over with `set_reward` (same amounts); caps 1,000 XOE per player, 100,000 XOE global
* demo player `link_near_address`: [5U5uc9wUj5LWf52iX1F2h99m1HocZQQMac3bqQKVJZfn](https://testnet.nearblocks.io/txns/5U5uc9wUj5LWf52iX1F2h99m1HocZQQMac3bqQKVJZfn)
* end to end: attest [AbJNv9sJ5WYM16sBNYRmL4BwqdvM8q6ZmwcSmkZBfF7Z](https://testnet.nearblocks.io/txns/AbJNv9sJ5WYM16sBNYRmL4BwqdvM8q6ZmwcSmkZBfF7Z), claim (mints 50 XOE) [AzYoDPVk43hDkHNZR8D3bq8Bkd85aUd2NodVcrKquFTG](https://testnet.nearblocks.io/txns/AzYoDPVk43hDkHNZR8D3bq8Bkd85aUd2NodVcrKquFTG), double claim rejected ("Already claimed")
* The deployments below this section (11 and 13 Nov, earlier) refer to the v1 contract `rewards.xoe-game.testnet`.

## Hackathon setup (13 Nov 2026)
* One reward per colony added with `set_reward`, e.g. [6jkBztzp…](https://testnet.nearblocks.io/txns/6jkBztzpeVAKwvrcSeB8Pw5onT16C7mv8sbLefPPWHBP), [2LVNnznH…](https://testnet.nearblocks.io/txns/2LVNnznHpd9jUzYzhj1FpR2dyypout4N4Pu1QKBjdEaw), [GX8QN87Q…](https://testnet.nearblocks.io/txns/GX8QN87QhRRi1KBzKJpv3CQJ3vwwxQiMBSRMpVVNKX7d)
* Per-player cap raised to 1,000 XOE with `set_caps`: [C4vMmEcB…](https://testnet.nearblocks.io/txns/C4vMmEcB64ZoBfN895PavLSGpDwPjTjVxCDb8jmzPh4Y)
* Demo runs (attest then claim) are listed on the token and rewards account pages above and in the recorded video `media/demo-flow.mp4`.

Check it yourself, no keys needed:
```bash
cd demo && npm install && npm run state
```
