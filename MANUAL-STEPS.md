# What Eddie does by hand (in order)

Nothing below has been done. No push, no public repo, no post, no form submission has happened.
Deadline: **Sat Nov 14 2026, 5:59 PM CST** (23:59 UTC). Do these early; the form cannot be edited once sent.

## 0. Before you start (5 min)
* Read `README.md`, `DESCRIPTION.md`, `X-POST.md` and approve the wording (the opening sentence about XOE is a draft pending your OK).
* Watch `media/demo-flow.mp4` and look at `media/*.png`.
* Decide the **NEAR mainnet account that receives the prize** (a named account like `xxx.near`, or a 64-character implicit account created in your NEAR wallet). The assistant must not invent it.
* Decide the **LICENSE** holder name (the LICENSE file says "XOE project"; change it if you want your name).

## 1. GitHub: create the public repo and push (10 min)
1. Sign in to GitHub as `edd13Xx` (the box browser is not signed in; do it on your phone or computer, or sign in on the box desktop when asked).
2. Create a new **public** repository `xoe-game` (no README, no license, no .gitignore).
3. Push `/workspace/xoe-near-hackathon` to it: either ask the assistant to push once you are signed in or have granted the Cursor GitHub App access to `edd13Xx/xoe-game` at https://github.com/apps/cursor/installations/new, or upload via GitHub's "add files" if you prefer. The local repo has two commits and two tags (`pre-hackathon`, `hackathon-submission`); push the tags too (`git push origin main --tags`).
4. Open the repo URL in a private window to confirm it is public and the README renders. Repo URL = `https://github.com/edd13Xx/xoe-game`.

## 2. X: publish the demo post (5 min)
1. Open `X-POST.md`, put the repo link in `<REPO_LINK>`.
2. Attach `media/demo-flow.mp4` (and optionally `media/desktop-3-claimed.png`).
3. The post must say it was built at NEAR HACKATHON, tag @NEARProtocol and #NEARHackathon (it does).
4. Post it from your account, then copy the post link (looks like `https://x.com/<you>/status/<id>`).

## 3. Submit the form at https://nearhackathon.com/#apply (10 min)
Have the repo link and the X post link ready. Fields:
| Field | Value |
|---|---|
| Project name | `XOE: Unknown Orbital Engine` (2-80 chars) |
| Team lead name | your name |
| Email | your contact email |
| Team size | `1` (or as true) |
| Tracks | `Games With Real Economies` (`games`). Optional second: `Memecoins With Mechanics` (`memecoins`) since the game mints an NEP-141 token with rules |
| NEAR account for payout | the **mainnet** account you chose in step 0 |
| Repo link | `https://github.com/edd13Xx/xoe-game` |
| Demo post link | your X post link |
| What you built (20-2000 chars) | paste `DESCRIPTION.md` (1,496 characters) |
| Consent | tick: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

One submission per repo, cannot be edited (changes go through https://nearhackathon.com/request-changes). Read the form once more before pressing send.

## 4. After submitting
* Keep the repo public through Nov 18 (judging Nov 16 to 18).
* If the assistant should also run the demo for judges: keep the box server up (`cd demo && npm start`), though the README, video and explorer links work without it.
