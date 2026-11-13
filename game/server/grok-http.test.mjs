import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { guestMiddleware } from './grok-http.mjs'
test('local guest relay rejects foreign origin/host, oversize and malformed body', async () => {
 const server = createServer((req,res) => guestMiddleware(req,res,()=>{res.statusCode=404;res.end()}))
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const port=server.address().port
 const send = (headers,body='{}') => new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api/grok',method:'POST',headers:{'content-type':'application/json',...headers}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))}); req.on('error',reject);req.end(body)})
 try {
  assert.equal(await send({origin:'https://evil.example'}),403)
  assert.equal(await send({host:'evil.example'}),403)
  assert.equal(await send({'content-length':9000},'a'.repeat(9000)),413)
  assert.equal(await send({},'not json'),400)
  assert.equal(await send({'sec-fetch-site':'cross-site'}),403)
 } finally { await new Promise(r=>server.close(r)) }
})
