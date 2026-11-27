import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {t067Server} from '../../../../../../../tools/measurement/t067-frame-server.ts';
const output=new URL('.',import.meta.url).pathname, exec=promisify(execFile), sleep=ms=>new Promise(r=>setTimeout(r,ms)), hash=b=>createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(await readFile('docs/evidence/spec001/presentation/t067/frame-revision/freeze-2026-11-26T22-11-48-122Z.json'));
for(const r of frozen.records)if(hash(await readFile(r.path))!==r.sha256)throw new Error(`Frozen input changed: ${r.path}`);
const server=await t067Server({dist:'dist',log:output+'server.ndjson'}), result={recordedAt:new Date().toISOString(),scope:'Untimed native revised-title observe surface before smoke; no owner navigation or activation',frozenInputsMatched:frozen.records.length,origin:server.origin};
const safari=async code=>(await exec('/usr/bin/osascript',['-e',`tell application "Safari"\n${code}\nend tell`],{timeout:15000})).stdout.trim();
let id;
try {
 await safari(`make new document with properties {URL:${JSON.stringify(server.url+'?t067=observe')}}`);
 id=Number(await safari('return id of front window'));if(id===7338)throw new Error('Protected owner window returned');
 if(!(await safari(`return URL of current tab of window id ${id}`)).startsWith(server.origin+'/'))throw new Error('Fresh window ownership failed');
 const begin=Date.now();while(!server.reports.find(r=>r.type==='loaded')){if(Date.now()-begin>20000)throw new Error('No observe report');await sleep(100);}
 result.loaded=server.reports.find(r=>r.type==='loaded');result.windowId=id;result.frontmost=(await safari('return frontmost'))==='true';
 if(result.loaded.hidden||result.loaded.visibilityState!=='visible'||!result.frontmost)throw new Error('Fresh revised native surface is not foreground/DOM-visible');
 for(let attempt=0;attempt<4;attempt++){
  const latest=[...server.reports].reverse().find(r=>r.type==='loaded'||r.type==='viewport');const [w,h]=latest.viewport;if(w===1280&&h===720)break;
  const rect=(await safari(`return bounds of window id ${id}`)).split(',').map(Number);
  await safari(`set bounds of window id ${id} to {20,40,${20+rect[2]-rect[0]+1280-w},${40+rect[3]-rect[1]+720-h}}`);await sleep(350);
 }
 result.sized=[...server.reports].reverse().find(r=>r.type==='loaded'||r.type==='viewport');
 if(result.sized.viewport[0]!==1280||result.sized.viewport[1]!==720)throw new Error('Exact observe viewport unavailable');
 result.capture=output+'native-revised-title.png';await exec('/usr/sbin/screencapture',['-x','-l',String(id),result.capture]);result.captureSha256=hash(await readFile(result.capture));result.status='observe-completed';
} catch(error){result.status='observe-failed';result.error=String(error);}
finally {
 if(id&&id!==7338){const current=await safari(`return URL of current tab of window id ${id}`).catch(()=>null);if(current?.startsWith(server.origin+'/')){await safari(`close window id ${id}`);result.taskWindowClosed=true;}}
 await server.stop();result.scriptSha256=hash(await readFile(new URL(import.meta.url)));await writeFile(output+'result.json',JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify(result));process.exitCode=result.status==='observe-completed'?0:1;
