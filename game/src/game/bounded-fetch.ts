/** Timeout covers headers AND body. Public quote failures feed the existing exponential backoff. */
export async function boundedFetch(fetcher: (url: string, init?: RequestInit) => Promise<Response>, url: string, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { signal: controller.signal, credentials: "omit", redirect: "error" })
        if (typeof response.arrayBuffer !== "function") return response // structurally typed test adapter
        const bytes = await response.arrayBuffer()
        return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers })
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Coinbase quote timed out")) }, timeoutMs) }),
    ])
  } finally { if (timer) clearTimeout(timer) }
}
