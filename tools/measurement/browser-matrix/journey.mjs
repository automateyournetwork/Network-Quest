// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// This observer lives in a separate same-origin test document. The guest frame
// loads the regular built index, JS, CSS and media. Only the driver sends input.
const frame = document.querySelector('iframe[title="Guest game"]');
const app = frame?.contentWindow ?? window;
const doc = app.document;
const result = { started: new Date().toISOString(), ua: navigator.userAgent,
  viewport: [app.innerWidth, app.innerHeight], hostViewport: [innerWidth, innerHeight],
  dpr: devicePixelRatio, rooms: [], readings: [], actions: [], trusted: {}, errors: [] };
const params = new URL(location).searchParams;
const requested = params.get('size').split('x').map(Number);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const visible = el => el && !el.closest('[hidden], [inert]') && el.getClientRects().length
  && app.getComputedStyle(el).visibility !== 'hidden';
const usable = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
const name = el => {
  if (!el) return '';
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.labels?.length) return el.labels[0].textContent.trim();
  const copy = el.cloneNode(true);
  copy.querySelectorAll('[aria-hidden=true]').forEach(child => child.remove());
  return copy.textContent.trim();
};
const get = label => [...doc.querySelectorAll('button, input, textarea')].find(el => usable(el) && name(el) === label);
const wait = async (read, label) => {
  const until = performance.now() + 15000;
  while (performance.now() < until) {
    const value = read();
    if (value) return value;
    await sleep(30);
  }
  throw Error('Timed out waiting for ' + label);
};
const post = async (route, body) => {
  const reply = await fetch('/' + route, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  if (!reply.ok) throw Error('Driver ' + route + ' ' + reply.status + ' ' + await reply.text());
};
const native = async input => {
  await post('input', input);
  if (/Version\/.+Safari\//.test(navigator.userAgent)) await sleep(input.kind === 'text' ? 900 : 140);
};
app.addEventListener('error', event => result.errors.push(String(event.message)));
app.addEventListener('unhandledrejection', event => result.errors.push(String(event.reason)));
const clicks = [];
const focusTrace=[];
for (const kind of ['keydown','keyup','keypress','click']) doc.addEventListener(kind, e => {
  focusTrace.push([kind,e.key,name(e.target.closest?.('button,input,textarea') || e.target).slice(0,45),e.defaultPrevented]);
  if (focusTrace.length>20) focusTrace.shift();
});
doc.addEventListener('click', event => {
  const control = event.target.closest('button, input, textarea');
  if (event.isTrusted && control) clicks.push(name(control));
}, true);
for (const kind of ['keydown','click','input']) doc.addEventListener(kind, event => {
  const key = kind + (event.isTrusted ? 'Trusted' : 'Untrusted');
  result.trusted[key] = (result.trusted[key] || 0) + 1;
}, true);
const focused = () => doc.activeElement;
let phase = 'boot';
async function reach(resolve) {
  // Estimate a forward stride from current tabbable DOM order. The actual
  // browser must land on the exact original element before it can activate.
  const observed = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const el = await wait(resolve,phase);
    if (doc.hasFocus() && focused() === el && (!frame || document.activeElement === frame)) return;
    const active = focused();
    const stops = [...doc.querySelectorAll('button, input, textarea, a[href], summary, select, [tabindex]')]
      .filter(item => visible(item) && !item.disabled && item.tabIndex >= 0);
    const from = stops.indexOf(active), to = stops.indexOf(el);
    const distance = to - from;
    const reverse = doc.hasFocus() && from >= 0 && to >= 0 && distance < 0;
    const count = attempt < 3 && from >= 0 && to >= 0 && distance ? Math.min(Math.abs(distance), 30) : 1;
    observed.push([name(active).slice(0, 52), reverse ? -count : count, doc.hasFocus()]);
    await native({kind:'tab', count, reverse});
  }
  throw Error('Native Tab did not reach ' + phase + ', observed ' + JSON.stringify(observed));
}
async function activate(el, label, value) {
  phase = label;
  const visibleTarget = await wait(el, label);
  visibleTarget.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
  if (params.get('input') === 'pointer') {
    const r = visibleTarget.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = doc.elementFromPoint(x, y);
    if (hit !== visibleTarget && !visibleTarget.contains(hit)) throw Error('Pointer target obscured: ' + label);
    await native({kind:'pointer', x:Math.round(x + (frame?.offsetLeft ?? 0)), y:Math.round(y + (frame?.offsetTop ?? 0))});
    if (value !== undefined) await native({kind:'text',value});
  } else {
    for (let attempt = 0; attempt < 4; attempt++) {
      await reach(el);
      if (navigator.userAgent.includes('Firefox/')) await sleep(attempt ? 500 : 90);
      const before = clicks.length;
      await native(value !== undefined ? {kind:'text',value} : {kind:visibleTarget.type === 'checkbox' ? 'space' : 'enter'});
      if (value !== undefined || clicks.slice(before).includes(name(visibleTarget))) break;
      if (clicks.length !== before || attempt === 3) throw Error('Native keyboard activation missed ' + label + ' actual ' + clicks.slice(before).join(','));
    }
  }
  if (value !== undefined) await wait(() => el()?.value === value, 'complete native typing in ' + label);
  result.actions.push(label);
}
const direct = label => activate(() => get(label), label);
const close = async () => {
  const el = doc.querySelector('.nq-frame-window.nq-window-active .nq-window-close');
  if (usable(el)) await direct(name(el));
};
const click = async label => {
  phase = label;
  if (['Diagnostics','Repair plan','Validate repair'].includes(label)) await close();
  if (!get(label)) {
    await close();
    if (!get(label)) {
      await sleep(24);
      const scene = [...doc.querySelectorAll('.nq-frame-window[aria-label="Scene objects and exits"] button')].some(b => name(b) === label);
      if (scene) await direct('Scene');
      else if (['New Adventure','Settings','Credits','Restore Save','Save'].includes(label)) await direct('Game');
    }
  }
  await direct(label);
};
const roomNames = ["The Arrival Lift","The Titan's Workshop","The Copper Warrens","The Echo Cavern","The Photon Gardens",
  "The Prism Vault","The Skywell","The Storm Observatory","The Shell Market","The Clockworks","The Backhoe Rift","The Iron Threshold"];
async function room(index) {
  const id = 'spec001:R' + String(index).padStart(2,'0');
  await close();
  await wait(() => [...doc.querySelectorAll('h1,h2,h3')].some(el => visible(el) && el.textContent.trim() === roomNames[index-1]), id + ' heading');
  const rendered = await wait(() => doc.querySelector(`.nq-graybox[data-room-id="${id}"][data-rendered=true]`), id + ' rendering');
  const painted = rendered.querySelector('canvas');
  const overflow = [doc.documentElement.scrollWidth-app.innerWidth, doc.documentElement.scrollHeight-app.innerHeight];
  if (overflow.some(n => n>1)) throw Error(id + ' viewport overflow ' + overflow);
  if (!painted?.width || !painted.height) throw Error(id + ' missing room canvas');
  result.rooms.push({id, heading:roomNames[index-1], canvas:[painted.width,painted.height], overflow});
  await post('room',{id, actions:result.actions.length});
}
const walk = async (n, label = 'Walk to '+roomNames[n-1]) => { await click('Walk'); await click(label); await room(n); };
async function measure(complete) {
  await click('Diagnostics'); await click('Take measurement');
  const last = () => [...doc.querySelectorAll('ol[aria-label="Recorded measurements"] > li')].at(-1);
  const button = () => [...(last()?.querySelectorAll('button') ?? [])].find(b => name(b)==='Submit this reading' && usable(b));
  await activate(button,'Submit this reading');
  const panel = doc.querySelector('[role=dialog][aria-label=Diagnostics]');
  if (panel.textContent.includes('Objective complete.') !== complete) throw Error('Measured objective completion disagrees');
  result.readings.push(last().textContent);
  await click('Close diagnostics');
}
const sequence = async (...labels) => { for (const label of labels) await click(label); };
const suite=params.get('suite') ?? 'baseline';
const extra=suite==='baseline' ? null : (await import('/refinements.mjs')).refinements({doc,app,get,wait,click,close,walk,reach,result,suite,input:params.get('input')});
try {
  if (result.viewport.some((n,i) => n !== requested[i])) throw Error('Guest viewport mismatch');
  await wait(() => get('New Adventure'),'New Adventure title');
  await extra?.title();
  await click('New Adventure'); await room(1); await extra?.inGame();
  if (app.innerWidth === 390) await post('capture',{phase:'R01 arrival',hostViewport:[innerWidth,innerHeight]});
  await sequence('Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await walk(2);
  await sequence('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await activate(() => get('Hypothesis'),'Hypothesis','Compare before and after intervention, then test endpoint service.');
  await sequence('Pin hypothesis','Close notebook','Continue as guest');
  await walk(3);
  await sequence('Use','Read and keep the supplied compatibility card','Read and keep the diagnosed-defect card; this is not a performed measurement');
  await measure(false); await sequence('Use','Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
  await walk(4); await sequence('Use','Read and keep the before-record instructions; retain an actual measured open result','Read and keep the repeater role and limits','Conclude: a repeater needs the physical connection restored');
  await measure(true); await extra?.floor('R04','Dry cavern ledge',false); await walk(3); await walk(2); await walk(5);
  await extra?.discover();
  await sequence('Use','Read and keep all five supplied compatibility checks','Select the supplied fully matching optic/fiber pair: all five fields match',
    'Inspect the original connection at the dock before any intervention','Have the dock fit the supplied compatible replacement to the inspected connection','Reinspect the replaced connection to confirm the diagnosed defect was removed');
  await measure(true); await walk(6); await sequence('Use','Read and keep the current compatibility and inspection reminder','Select passive path B: total loss 9 dB');
  await measure(true); await walk(5); await extra?.recruit(); await walk(2,'Walk to The Titan’s Workshop'); await walk(7);
  await sequence('Use','Keep the path survey in the notebook','Keep the endpoint settings card','Select the alternate surveyed path','Match both endpoint band, channel and PHY settings');
  await measure(true); await walk(8); await sequence('Use','Keep the survey and freshness instructions','Isolate the local emitter and return to surveyed conditions','Select fictional scenario channel B at both endpoints');
  await measure(true); await walk(7); await walk(2); await walk(9);
  await sequence('Use','Read and record all separate equipment checks','Select 100/full','Choose complete kit B: 12 W + 11 W + 7 W');
  await measure(true); await extra?.floor('R09','Clear market aisle',true); await walk(2); await extra?.revisit(); await walk(10);
  await sequence('Use','Read and record the physical-role and upper-layer explanation','Use untimed step-by-step decoding',
    'Explain: sample physical signals representing bits; this does not discover addresses');
  for (const [position,pair] of ['00','10','11','01'].entries()) await sequence('Inspect sample position '+position,'Write '+pair+' for sample position '+position);
  await measure(true); await walk(11,'Walk toward The Backhoe Rift');
  await sequence('Repair plan','Copper replacement — 95 m','Permanent installation','Read and keep plan requirements','Review current plan',
    'I understand that execution changes the route and makes earlier readings stale','Execute reviewed plan','Close repair controls');
  await walk(12,'Walk to the validation balcony');
  await sequence('Validate repair','Read classification criteria','Measure repaired link','Run endpoint test','Classify permanent restoration');
  const ending = await wait(() => [...doc.querySelectorAll('[role=dialog]')].find(el => visible(el) && el.getAttribute('aria-label')==='The Steady Light'), 'The Steady Light');
  if (!ending.textContent.includes('separate endpoint service test')) throw Error('Endpoint validation evidence absent');
  result.ending = ending.getAttribute('aria-label');
  await sequence('Skip scene','Replay scene');
  if (app.innerWidth !== 390) await post('capture',{phase:'R12 permanent ending',hostViewport:[innerWidth,innerHeight]});
  // Continue belongs to the ending while the game menu has a distinct disabled Continue.
  await activate(() => [...ending.querySelectorAll('button')].find(el => usable(el) && name(el)==='Continue'), 'Continue ending');
  await room(12);
  if (new Set(result.rooms.map(r => r.id)).size !== 12 || result.errors.length) throw Error('Room or script error assertion failed');
  result.status = 'passed';
} catch (error) {
  Object.assign(result, {status:'failed', phase, focusTrace, error:String(error), focus:name(focused()).slice(0,90), hasFocus:doc.hasFocus(),targetHTML:focused()?.outerHTML.slice(0,480), snapshot:doc.body.innerText.slice(0,2700), resources:performance.getEntriesByType('resource').map(r=>r.name.split('/').at(-1)).slice(-10),
    controls:[...doc.querySelectorAll('button,input,textarea')].filter(usable).map(name).slice(0,45)});
}
result.finished = new Date().toISOString();
await post('result', result);
