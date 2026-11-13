# Grok Bot transport — v19

The release uses **the player's own xAI key, client-direct to fixed HTTPS api.x.ai chat/TTS endpoints**. Session-only by default, explicit Remember opt-in, OFF/Disconnect cancellation, timeout/error feedback and Built-in AI fallback are documented in the README. No real key was used during testing. Chat is non-streaming with a 256-token output cap. There is no consumer-subscription entitlement or account login integration.

`server/grok-adapter.mjs` is an inherited, server-only, dormant operator-key guest prototype. It is not shipped in the HTML and is not used by normal play. Its historical environment switches are not instructions or approval to configure it. The Vite development route now adds a loopback-host check, same-origin check, JSON-only parsing and an 8KiB body cap before calling that adapter. Process-local quotas are not production abuse protection.

`src/game/grok-bot-relay.ts` is a separate asynchronous tester-code relay hook. The v19 build explicitly disables it; even an alternate build can use only a local loopback base. A public relay or a server-owned key would violate the release's player-own-key/network scope unless Eddie changes that decision.

No generic/required AI gate, guest no-save policy, subscription access, tier advantage, paid margin, remote endpoint editing, server budget, or production deployment is added. Historical proposals and the old guest-adapter documentation remain, unmodified, in `docs/history/grok-guest-adapter-v18.2.md`.
