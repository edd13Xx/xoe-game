import { handleGuestGrok } from './grok-adapter.mjs'
export const MAX_GUEST_BODY = 8192
export function guestMiddleware(req, res, next) {
  if (req.url?.split('?')[0] !== '/api/grok') return next()
  const send = (status, error) => { if (res.writableEnded) return; res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error })) }
  if (req.method !== 'POST') return send(405, 'POST required')
  const host = req.headers.host || ''
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) return send(403, 'Local relay only')
  if ((req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'Same-origin request required')
  if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(415, 'JSON required')
  if (Number(req.headers['content-length']) > MAX_GUEST_BODY) { req.resume(); return send(413, 'Body too large') }
  let size = 0
  const chunks = []
  req.on('data', (chunk) => { size += chunk.length; if (size > MAX_GUEST_BODY) { chunks.length = 0; send(413, 'Body too large') } else if (!res.writableEnded) chunks.push(chunk) })
  req.on('end', async () => {
    if (res.writableEnded) return
    let input
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return send(400, 'Invalid JSON') }
    try { const result = await handleGuestGrok(input); res.statusCode = result.status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(result.body)) } catch { send(503, 'Grok Bot relay unavailable') }
  })
  req.on('error', () => send(400, 'Request interrupted'))
}
