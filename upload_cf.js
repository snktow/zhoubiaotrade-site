// Deploy Africa site to Cloudflare Pages via CDP file upload injection.
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP = process.argv[2]; // ws endpoint
const SITE = process.argv[3]; // folder
const FILES = [];

function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(full, r);
    else FILES.push({ full, rel: r });
  }
}
walk(SITE, '');

async function main() {
  const ws = new WebSocket(CDP, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0; const pending = new Map();
  const send = (method, params, sessionId) => new Promise((res, rej) => {
    const msgId = ++id; pending.set(msgId, { res, rej });
    ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
  });
  ws.on('message', d => {
    const m = JSON.parse(d);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  await new Promise(r => ws.on('open', r));

  const targets = await send('Target.getTargets');
  const page = targets.targetInfos.find(t => t.url && t.url.includes('cloudflare.com'));
  if (!page) throw new Error('no cloudflare tab');
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  console.log('attached to', page.url);

  await send('DOM.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  // find the folder input (webkitdirectory)
  const { result } = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs=[...document.querySelectorAll('input[type=file]')];
      const idx = inputs.findIndex(i=>i.getAttribute('webkitdirectory')!==null);
      if (idx<0) return 'NOTFOUND';
      inputs[idx].setAttribute('data-cf-upload','1');
      return 'OK'+idx;
    })()`, returnByValue: true
  }, sessionId);
  console.log('input:', result.value);

  const { root } = await send('DOM.getDocument', { depth: -1 }, sessionId);
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[data-cf-upload="1"]' }, sessionId);
  if (!nodeId) throw new Error('input node not found');

  await send('DOM.setFileInputFiles', { nodeId, files: FILES.map(f => f.full) }, sessionId);
  console.log('injected', FILES.length, 'files');

  await new Promise(r => setTimeout(r, 3000));
  const after = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,800)', returnByValue: true }, sessionId);
  console.log('--- page after upload ---');
  console.log(after.result.value);
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
