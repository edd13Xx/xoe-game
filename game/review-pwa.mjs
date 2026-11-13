import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('review/pwa')
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('outside');const data=await readFile(file);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/html');res.end(data)}catch{res.statusCode=404;res.end('Not found')}})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'allow'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
await context.route('https://**',r=>r.abort())
const result={base:'loopback only',errors}
try{
 await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready)
 await page.reload();await page.waitForTimeout(300)
 result.controlled=await page.evaluate(()=>!!navigator.serviceWorker.controller)
 result.caches=await page.evaluate(()=>caches.keys())
 result.cachePaths=await page.evaluate(async()=>{const c=await caches.open((await caches.keys())[0]);return(await c.keys()).map(r=>new URL(r.url).pathname)})
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Start',exact:true}).waitFor({timeout:8000})
 result.offlineLaunch=true
 await page.screenshot({path:'review/pwa-offline.png'})
 result.manifest=JSON.parse(await fs.promises.readFile('review/pwa/manifest.webmanifest','utf8'))
}catch(e){result.failure=String(e)}finally{await browser.close();await new Promise(r=>server.close(r))}
fs.writeFileSync('review/pwa-runtime.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
