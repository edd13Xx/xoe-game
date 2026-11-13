import type { SceneId } from "../game/sprites.ts"
import cinematic1 from "../assets/scenes/cinematic-1.webp"
import cinematic2 from "../assets/scenes/cinematic-2.webp"
import cinematic3 from "../assets/scenes/cinematic-3.webp"
import wake from "../assets/scenes/wake.webp"
import missingPilot from "../assets/scenes/missing-pilot.webp"
import autoBattle from "../assets/scenes/auto-battle.webp"
import cockpitInvite from "../assets/scenes/cockpit-invite.webp"
import practice from "../assets/scenes/practice.webp"
import nearLoss from "../assets/scenes/near-loss.webp"
import rescue from "../assets/scenes/rescue.webp"
import navigate from "../assets/scenes/navigate.webp"

/** Fresh v16 neon-vector stills for every opening / cinematic / story scene. */
export const SCENE_ART: Partial<Record<SceneId, string>> = {
  "cinematic-1": cinematic1,
  "cinematic-2": cinematic2,
  "cinematic-3": cinematic3,
  wake,
  "missing-pilot": missingPilot,
  "auto-battle": autoBattle,
  "cockpit-invite": cockpitInvite,
  practice,
  "near-loss": nearLoss,
  rescue,
  navigate,
}

export const SCENE_ART_IDS = Object.keys(SCENE_ART) as SceneId[]
