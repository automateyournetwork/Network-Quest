// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
/** Local fixture instrumentation only; production JS/media bytes remain unchanged. */
export function installT067Probe() {
  performance.setResourceTimingBufferSize(10000);
  const events = [], decodes = [], errors = [], visibility = [], textures = new Map(), contexts = new WeakMap();
  // Observe the allocation calls actually submitted to WebGL. This estimates API
  // storage, not driver residency. Unknown formats remain unknown rather than zero.
  const formatBytes = (format, type) => {
    if ([32819, 32820, 33635].includes(type)) return 2;
    const channels = { 6408: 4, 6407: 3, 6403: 1, 33319: 2, 6406: 1, 6409: 1, 6410: 2 }[format];
    const component = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5124: 4, 5125: 4, 5126: 4, 5131: 2, 36193: 2 }[type];
    return channels && component ? channels * component : null;
  };
  for (const proto of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    const context = gl => {
      if (!contexts.has(gl)) {
        contexts.set(gl, { unit: 33984, bound: new Map() });
        gl.canvas.addEventListener('webglcontextlost', () => { for (const [texture, record] of textures) if (record.context === gl) textures.delete(texture); });
      }
      return contexts.get(gl);
    };
    const bound = (gl, target) => context(gl).bound.get(`${context(gl).unit}:${target >= 34069 && target <= 34074 ? 34067 : target}`);
    const wrap = (name, observe) => { if (typeof proto[name] !== 'function') return; const original = proto[name]; proto[name] = function (...args) { const result = original.apply(this, args); observe(this, args); return result; }; };
    wrap('activeTexture', (gl, a) => { context(gl).unit = a[0]; });
    wrap('bindTexture', (gl, a) => { context(gl).bound.set(`${context(gl).unit}:${a[0]}`, a[1]); if (a[1] && !textures.has(a[1])) textures.set(a[1], { context: gl, levels: new Map(), unknown: [] }); });
    wrap('deleteTexture', (_gl, a) => textures.delete(a[0]));
    wrap('texImage2D', (gl, a) => {
      const record = textures.get(bound(gl, a[0])); if (!record) return;
      const width = a.length >= 9 ? a[3] : a[5]?.width, height = a.length >= 9 ? a[4] : a[5]?.height;
      const bytes = formatBytes(a.length >= 9 ? a[6] : a[3], a.length >= 9 ? a[7] : a[4]);
      record.levels.set(`${a[0]}:${a[1]}`, { width, height, bytes: bytes && Number.isFinite(width * height) ? width * height * bytes : null, bytesPerPixel: bytes });
    });
    wrap('texStorage2D', (gl, a) => {
      const record = textures.get(bound(gl, a[0])); if (!record) return;
      const bytes = { 32856: 4, 32849: 3, 34836: 16, 34842: 8, 33327: 4, 33325: 2 }[a[2]];
      for (let level = 0; level < a[1]; level++) { const width = Math.max(1, a[3] >> level), height = Math.max(1, a[4] >> level); record.levels.set(`${a[0]}:${level}`, { width, height, bytes: bytes ? width * height * bytes : null, bytesPerPixel: bytes ?? null }); }
    });
    wrap('compressedTexImage2D', (gl, a) => { const record = textures.get(bound(gl, a[0])); if (record) record.levels.set(`${a[0]}:${a[1]}`, { width: a[3], height: a[4], bytes: a[6]?.byteLength ?? null, compressed: true }); });
    wrap('generateMipmap', (gl, a) => {
      const record = textures.get(bound(gl, a[0])); if (!record) return;
      for (const [key, base] of [...record.levels]) if (key.endsWith(':0')) {
        let width = base.width, height = base.height, level = 0;
        while (width > 1 || height > 1) { width = Math.max(1, width >> 1); height = Math.max(1, height >> 1); level++; record.levels.set(`${key.slice(0, -1)}${level}`, { width, height, bytes: base.bytesPerPixel ? width * height * base.bytesPerPixel : null, generatedMipmap: true }); }
      }
    });
  }
  addEventListener('error', event => errors.push({ kind: 'error', message: event.message }));
  addEventListener('unhandledrejection', event => errors.push({ kind: 'rejection', message: String(event.reason) }));
  document.addEventListener('visibilitychange', () => {
    visibility.push({ ms: performance.now(), hidden: document.hidden, scene: snapshot() });
    for (const delay of [250, 1500]) setTimeout(() => { void report({ type: 'native-visibility', ms: performance.now(), delay, hidden: document.hidden, scene: snapshot() }); }, delay);
  });
  addEventListener('resize', () => { void report({ type: 'viewport', viewport: [innerWidth, innerHeight], outer: [outerWidth, outerHeight], dpr: devicePixelRatio }); });
  const decode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = async function () {
    const began = performance.now();
    try { const result = await decode.call(this); decodes.push({ type: 'image', began, durationMs: performance.now() - began, width: this.naturalWidth, height: this.naturalHeight, success: true }); return result; }
    catch (error) { decodes.push({ type: 'image', began, durationMs: performance.now() - began, success: false }); throw error; }
  };
  const snapshot = () => {
    const node = document.querySelector('.nq-graybox'), canvas = node?.querySelector('canvas');
    return { dataset: node ? { ...node.dataset } : null, canvas: canvas ? [canvas.width, canvas.height] : null,
      viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, gl: window.__nqMeasurement.snapshot(),
      textureAllocations: [...textures.values()].map(r => ({ levels: [...r.levels.values()] })),
      estimatedWebglTextureBytes: [...textures.values()].some(r => [...r.levels.values()].some(l => l.bytes === null)) ? null : [...textures.values()].reduce((sum, r) => sum + [...r.levels.values()].reduce((n, l) => n + l.bytes, 0), 0),
      domImageDecodedBytes: [...document.querySelectorAll('.nq-room-layer')].reduce((sum, img) => sum + img.naturalWidth * img.naturalHeight * 4, 0) };
  };
  const resources = () => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].filter(r => !r.name.includes('/__t067/report')).map(r => ({
    path: new URL(r.name).pathname, status: r.responseStatus ?? null, initiator: r.initiatorType, startMs: r.startTime, durationMs: r.duration,
    encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize, transferSize: r.transferSize, responseEnd: r.responseEnd, protocol: r.nextHopProtocol,
  }));
  const report = async value => {
    await fetch('/__t067/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async (fn, label, timeout = 20000) => { const began = performance.now(); while (!fn()) { if (performance.now() - began > timeout) throw new Error(`Timeout: ${label}`); await sleep(10); } return fn(); };
  const button = name => [...document.querySelectorAll('button')].find(b => {
    const copy = b.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
    return (b.getAttribute('aria-label') ?? copy.textContent.trim()) === name && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
  });
  const click = async name => { const b = await wait(() => button(name), `button ${name}`); b.click(); events.push({ ms: performance.now(), action: name }); };
  const room = id => wait(() => document.querySelector(`.nq-graybox[data-room-id="spec001:${id}"][data-rendered="true"]`), id);
  const frames = async (phase, ms = 4000) => {
    const before = snapshot(), began = performance.now(); window.__nqMeasurement.begin();
    await sleep(ms); const measured = window.__nqMeasurement.end(), after = snapshot();
    return { phase, began, durationMs: performance.now() - began, before, after, measured,
      actualRenderDelta: Number(after.dataset?.renderCount ?? 0) - Number(before.dataset?.renderCount ?? 0) };
  };
  const run = async () => {
    const parameters = new URL(location.href).searchParams;
    const identity = { browserUserAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], outer: [outerWidth, outerHeight], dpr: devicePixelRatio, sample: parameters.get('sample'), cache: parameters.get('cache') };
    await report({ type: 'loaded', ...identity });
    if (parameters.get('t067') !== 'auto') return;
    try {
      const expected = parameters.get('viewport')?.split('x').map(Number);
      if (!expected || expected[0] !== innerWidth || expected[1] !== innerHeight) throw new Error(`Viewport mismatch: expected ${expected}; actual ${innerWidth},${innerHeight}`);
      await wait(() => button('New Adventure'), 'shell');
      const shellReadyMs = performance.now(), shellResources = resources();
      await click('New Adventure'); await room('R01');
      const firstRoomReadyMs = performance.now(), firstRoomResources = resources(), initial = snapshot();
      const idle = await frames('R01 idle');
      await click('Look'); await click('Power indication');
      const exploration = await frames('R01 observation and reaction');
      const disposal = [];
      for (let cycle = 0; cycle < 5; cycle++) {
        await click('Walk'); await click("Walk to The Titan's Workshop"); await room('R02'); disposal.push({ cycle, room: 'R02', ...snapshot() });
        await click('Walk to The Arrival Lift'); await room('R01'); disposal.push({ cycle, room: 'R01', ...snapshot() });
      }
      await click('Text scene'); await wait(() => !document.querySelector('.nq-graybox'), 'text scene'); const text = snapshot();
      await click('Low detail scene'); await room('R01'); const low = await frames('R01 low detail', 2000);
      await click('Retry visual scene'); await room('R01');
      const canvas = document.querySelector('.nq-graybox canvas'), gl = canvas.getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Actual context-loss extension unavailable');
      extension.loseContext(); await wait(() => !document.querySelector('.nq-graybox'), 'context loss fallback');
      const lost = { scene: snapshot(), text: document.body.innerText.includes('power') && document.body.innerText.includes('link') };
      await click('Retry visual scene'); await room('R01'); const recovered = snapshot();
      await click('New Adventure'); await click('Start new adventure'); await room('R01'); const reset = snapshot();
      const value = { type: 'sample', status: 'completed', ...identity, shellReadyMs, shellResources, firstRoomReadyMs, firstRoomResources, initial,
        idle, exploration, disposal, text, low, lost, recovered, reset, resources: resources(), decodes, events, errors, visibility };
      window.__nqT067.result = value; scrollTo(0, 0); await report(value);
    } catch (error) { const value = { type: 'sample', status: 'failed', ...identity, error: String(error), resources: resources(), decodes, events, errors, visibility, scene: snapshot() }; window.__nqT067.result = value; await report(value); }
  };
  window.__nqT067 = { snapshot, frames, resources, events, errors, visibility, decodes, report, result: null };
  addEventListener('DOMContentLoaded', () => { void run(); }, { once: true });
}
