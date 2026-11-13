declare module "./server/grok-adapter.mjs" {
  export function handleGuestGrok(body: unknown): Promise<{ status: number; body: Record<string, unknown> }>
}
