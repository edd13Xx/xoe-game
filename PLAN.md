# PLAN: XOE for NEAR HACKATHON (Games With Real Economies)
Written Fri Nov 13 2026, 7:40 AM CST. Deadline Sat Nov 14, 5:59 PM CST. Rule: ONE working demo, no polish that doesn't serve the submission.

## Assessment (checked this morning)
- The NEAR prototype from Nov 11 is at /workspace/xeno-near/xoe-rewards (near-sdk 5: xoe-token NEP-141/145/148, xoe-rewards attest/claim/caps/pause/Solana link, wnear-mock). 36/36 tests passed on Nov 11.
- It is ALREADY DEPLOYED to NEAR TESTNET (Eddie approved Nov 11). I re-checked live RPC today: token.xoe-game.testnet (XOE, 18 dec, supply 50), rewards.xoe-game.testnet (3 rewards, caps, not paused), player1.xoe-game.testnet holds 40 XOE. Funded accounts exist, keys are in the box credentials folder (never printed or committed).
- Missing: (a) no web UI/game link to the contracts, (b) no attester service the game can call, (c) no public repo layout/README/screenshots/video, (d) game is 618 MB with node_modules; repo must be clean.
- GitHub: connector can read only; edd13Xx/xoe-game is not visible to it (does not exist or not granted); it has no create-repo/push tool. Eddie must create the public repo and push (or sign in on the box browser). Nothing pushed.
- Game (Vite/Preact single-file HTML) is the paper/sim desk; stays unchanged apart from a tiny opt-in achievement event.

## Plan and ETAs (CST, Fri Nov 13)
1. 7:40-9:30  Clean repo: contracts/ + game/ source + demo/ (near-api-js page + small attester server). Opt-in `xoe:achievement` event in the game. Re-run contract tests and game gates.
2. 9:30-10:30 Working testnet demo: play/simulate achievement -> server attests on testnet -> player claims -> XOE balance changes on testnet, with explorer tx links. Scripted end-to-end run to prove it.
3. 10:30-11:15 README (what/problem/NEAR tech/run/judge steps "do X, see Y"/addresses/screenshots), form description, post draft, MANUAL-STEPS.md.
4. 11:15-12:15 Screenshots (phone + desktop) and a short mp4 of the demo flow.
5. 12:15-1:00 PM Final gate run, commit locally. Report to parent. Buffer until 5:59 PM Saturday for Eddie's manual steps (repo, X post, form).
