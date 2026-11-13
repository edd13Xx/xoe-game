/** Story cast for this opening. These are not roster entries and not agent ids. */
export const STORY_CHARACTERS = [
  "Mara Venn",
  "Elias Cho",
  "Nia Okonkwo",
  "Zoe",
  "SIS",
  "Xeno",
] as const

/**
 * Runtime coupling to an actual assistant roster.
 * This prototype does not import, address, or call one.
 */
export const RUNTIME_COUPLING = {
  importsGrokBotRoster: false,
  assistantRosterIds: [] as readonly string[],
  callsTeamApi: false,
  storyCharactersAreRosterBots: false,
  projectXPageImported: false,
  liveAssistant: false,
} as const
