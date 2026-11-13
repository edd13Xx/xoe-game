/** Reviewed educational team copy; gameplay and scoring unchanged. */
export const LESSON_BANNERS: Record<string, string> = {
  "wallet": "A wallet uses keys; the network keeps the balances.",
  "keys": "Share a Stellar G address; never share a secret S key.",
  "blocks": "Stellar groups transactions into ledgers, its version of blocks.",
  "fees": "Fees can rise when many payments compete at once.",
  "scams": "Real helpers never ask for your secret key.",
  "trustline": "A trustline is how you opt in to hold an asset.",
  "stroops": "One XLM equals 10,000,000 stroops, the smallest unit.",
  "volatility": "Prices can fall as well as rise; nothing is promised.",
  "phishing": "Never type secrets into a link someone sent you.",
  "seed-backup": "Keep your recovery phrase offline: never photos, cloud, or sharing."
}

export const FLIGHT_FAQ = [
  {
    "question": "What is a wallet?",
    "answer": "A wallet is a tool that holds your keys and helps you sign payments. Your balances live on the Stellar network, not as coins stored inside an app. This lesson is educational and paper-only."
  },
  {
    "question": "What is the difference between a public key and a secret key?",
    "answer": "A Stellar public account address starts with G. You can share it so someone can pay you. A secret key starts with S; it signs payments and must stay private—never share it."
  },
  {
    "question": "Why must I never share a secret key or recovery phrase?",
    "answer": "Anyone who has the S key or the recovery phrase can control the account. Real helpers will not ask for them. If someone does, stop and share nothing."
  },
  {
    "question": "Does Stellar use mined blocks?",
    "answer": "Stellar groups transactions into ledgers, which are its version of blocks. The network agrees on each ledger with the Stellar Consensus Protocol, not by mining. Validators, not proof-of-work, reach that agreement."
  },
  {
    "question": "How fast do ledgers close, and when is a payment final?",
    "answer": "Ledgers usually close about every five seconds, though the exact time can vary. Once a transaction is in a closed ledger, it is final. The network does not reverse it, so check the details before you send."
  },
  {
    "question": "What is a stroop?",
    "answer": "A stroop is the smallest unit of XLM. One XLM equals 10,000,000 stroops, or 0.0000001 XLM per stroop. Fees and tiny amounts are often counted in stroops."
  },
  {
    "question": "How much is the usual network fee?",
    "answer": "For ordinary operations, the network minimum is 100 stroops per operation. When traffic is light, that is typically what you pay. You set a maximum you are willing to pay per operation; you are charged only what is needed to get into the ledger."
  },
  {
    "question": "Can fees go higher than 100 stroops?",
    "answer": "Yes, if many transactions compete for space, the network can use surge pricing and the effective fee can rise. Smart-contract transactions can also have extra resource fees on top of an inclusion fee."
  },
  {
    "question": "How much XLM does a new account need?",
    "answer": "A new account usually must hold at least two base reserves. The base reserve is currently 0.5 XLM, so that minimum is 1 XLM. Each extra subentry, such as an ordinary trustline, adds another 0.5 XLM to the minimum; a sponsor can cover reserves in some cases."
  },
  {
    "question": "What is a trustline?",
    "answer": "A trustline is how an account opts in to hold a particular non-XLM asset. XLM itself does not need one. Each ordinary trustline is a subentry and adds 0.5 XLM to the account’s minimum reserve (a liquidity-pool share trustline counts as two)."
  },
  {
    "question": "Why do some exchanges ask for a memo?",
    "answer": "Some services use one shared Stellar account for many customers and use a memo to know who to credit. If they ask for a memo, include the exact memo they give you, or funds may be hard to match. Some services now use muxed addresses that start with M instead; follow the instructions they provide."
  },
  {
    "question": "How should I back up a recovery phrase?",
    "answer": "Write it down and keep it offline, such as on paper or metal, in a place only you control. Do not photograph it, store it in the cloud, or share it. This game will never ask for a real seed or secret key."
  },
  {
    "question": "What is phishing?",
    "answer": "Phishing is when a fake site, message, or “helper” tries to trick you into giving up keys or a recovery phrase. Logos and display names are not proof of identity. Open official sites yourself; never type secrets into a link someone sent you."
  },
  {
    "question": "Can the price of XLM go down?",
    "answer": "Yes, XLM’s price can move a lot, including down. A falling mark can shrink a paper total even if you did not sell. Nothing in this lesson promises a profit or tells you to buy, hold, or sell."
  },
  {
    "question": "Is this lesson a real trade or financial advice?",
    "answer": "No. These stops are educational, and in-game practice is paper-only. No answers here authorize real accounts, real payments, or real-money decisions."
  }
] as const
