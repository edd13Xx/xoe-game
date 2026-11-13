import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
const html=readFileSync('review/baseline-v18.2.html')
const server=createServer((_req,res)=>{res.setHeader('content-type','text/html');res.end(html)})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const child=spawn(process.execPath,['docs/history/accept-v18.2.mjs'],{stdio:'inherit',env:{...process.env,XENO_URL:`http://127.0.0.1:${server.address().port}`,XENO_ARTIFACTS:process.cwd()+'/review/legacy-accept'}})
const timer=setTimeout(()=>child.kill('SIGTERM'),45000)
const code=await new Promise(r=>child.on('exit',r));clearTimeout(timer);await new Promise(r=>server.close(r));console.log('Archived v18.2 accept exit:',code);process.exitCode=code??1
