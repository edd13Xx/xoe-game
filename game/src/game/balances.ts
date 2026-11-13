/** Separated local concepts. None of these call a vault, a wallet, or a market. */

export const IN_GAME_REWARD_BALANCE = 0

export const BALANCE_IDS = {
  inGameReward: "in-game-reward-balance",
  earnedPracticeTrading: "earned-practice-trading-balance",
  vaultDeposit: "vault-deposit",
  fictionalEnergy: "fictional-energy-power-life",
} as const

export const EARNED_PRACTICE_TRADING_BALANCE = {
  id: BALANCE_IDS.earnedPracticeTrading,
  value: null,
  configured: false,
  formula: null,
  recordedSource: "a positive balance made during a practice trade",
  notFrom: "real-deposits",
  recordedUses: ["upgrades", "fictional-energy-power-life"],
  writesInThisOpening: false,
} as const

export const FICTIONAL_ENERGY = {
  id: BALANCE_IDS.fictionalEnergy,
  configured: false,
  numericBar: false,
  consumption: null,
  scaling: null,
  settlement: null,
  recordedSource: BALANCE_IDS.earnedPracticeTrading,
  notFrom: "real-deposits",
  recordedPhrase: "liquidity life blood capital",
  financialClaim: false,
  depositCreatesEnergy: false,
} as const

export const LIQUIDATION = {
  recorded: "liquidation means the end",
  abc: null,
  defined: false,
} as const

export const FINAL_BOSS = {
  implemented: false,
  revealed: false,
  financialClaim: false,
  usesMarketPrice: false,
  ticker: null,
} as const

export const UNDEFINED_COMBAT_HOOKS = {
  implemented: false,
  licenseToExpandOpening: false,
  health: { recordedAs: "drawdown-room", formula: null },
  damage: { recordedAs: "adverse-move-size", formula: null },
  combo: { recordedAs: "consecutive-green-candles", formula: null },
} as const

export const UPGRADES = {
  implemented: false,
  recordedSource: BALANCE_IDS.earnedPracticeTrading,
  formula: null,
} as const

export const DEATH_RULE = {
  percent: 28,
  appliesTo: BALANCE_IDS.inGameReward,
  appliesToVaultDeposit: false,
  appliesToEarnedPracticeBalance: false,
  appliesToEnergy: false,
  rounding: "provisional-floor",
  settlementFormula: null,
} as const

export interface InGameDeathResult {
  remaining: number
  removed: number
  vaultDeposit: 0
  touchedEarnedPracticeBalance: false
  touchedEnergy: false
}

/**
 * Provisional local integer demonstration of the recorded 28% in-game reward rule.
 * Rounding is floor division. This is not a vault settlement formula.
 */
export function applyInGameRewardDeathRule(balance: number): InGameDeathResult {
  if (!Number.isInteger(balance) || balance < 0) {
    throw new Error("In-game reward balance must be a non-negative integer")
  }
  const removed = Math.floor((balance * DEATH_RULE.percent) / 100)
  return {
    remaining: balance - removed,
    removed,
    vaultDeposit: 0,
    touchedEarnedPracticeBalance: false,
    touchedEnergy: false,
  }
}

export const DEATH_RULE_SAMPLE_INPUT = 100
