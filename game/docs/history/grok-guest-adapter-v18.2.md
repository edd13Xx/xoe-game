# Optional guest Grok adapter

This is not enabled in the standalone HTML file. The page can post typed text to a same-origin `/api/grok` route. That route exists only when the local Vite server or preview server is running. It stays unconfigured unless both of these are set in the server environment:

- `XAI_GROK_GUEST_ENABLED=1`
- `XAI_API_KEY` set only on the server

Optional: `XAI_MODEL`. If omitted, the adapter sends `grok-3`. This build does not verify that a key, a model, or a budget exists.

There is no sign-in, no key field, and no player account. A guest id is a random browser session value used only for the in-memory counter.

Limits in one server process: 500 input characters, 600 output characters, 8 requests per guest id, 30 requests total, and 1 request in flight. These counters reset when the process stops. They are not shared across machines and a guest can start a new id. They are not production abuse protection.

Still required before any hosted use: a private secret store, a spend cap, an authenticated or localhost-only bind, a distributed limit, and an operator decision that a paid call is allowed. This workspace does not make that call.

Browser speech of a reply uses the selected device voice. That playback is not Grok audio and is not a call voice.

## Owner design notes, not implemented (Nov 8, 2026, evening CST)

Without Grok connected, the future rule is that nothing saves at all: no saves, no account, no rewards, and no memory persistence. Vault rewards and any saved progress would require Grok connected. If the player is a guest, rewards they would have earned would go into a vault pool rather than personally to them. Pool mechanics, source, and custody are undefined. This file does not implement that.

The same future no-save rule would cover the device-voice preference. The owner confirmed that conflict and left the voice preference in place until a separate authorization. Current local voice storage is the approved picker behavior, not enforcement of the future rule.

## OWNER PROPOSAL / UNVERIFIED DEPENDENCY

Not implemented. Not an entitlement. The owner has said that eventual Grok use should respect a player account that is legitimately connected, and envisions Ultra-tier users having a slight advantage through more usage, described as "more margin," while a no-sign-in guest remains available. Consumer subscription access, limits, OAuth, credit portability, and the meaning of "margin" are unverified. "Margin" is not established here as gameplay or financial leverage. This note does not add tier detection, bonuses, billing, or account connection.
