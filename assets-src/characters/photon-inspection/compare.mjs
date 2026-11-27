// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Compare the retained model and its inspection derivative using the T063 browser camera.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import path from 'node:path';
import { firefox } from 'playwright';
import { localTls } from '../../../tests/e2e/support/local-tls.ts';

const output = process.argv[2];
assert.ok(output, 'Pass the directory containing sample.py output.');
const original = 'public/assets/models/CH03.glb';
const derivative = 'public/assets/models/CH03-inspection.glb';
const native = 'assets-src/characters/photon-inspection/CH03.blend';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const glbs = await Promise.all([original, derivative].map(file => readFile(file)));
const nativePoses = JSON.parse(await readFile(path.join(output, 'native-poses.json'), 'utf8'));

// Compare actual accessor bytes independent of the order of exported buffers.
function retainedData(buffer) {
  const jsonSize = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonSize));
  const binary = buffer.subarray(28 + jsonSize);
  const accessors = gltf.accessors.map(accessor => {
    const view = gltf.bufferViews[accessor.bufferView];
    const count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const size = { 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType] * count;
    assert.ok(Number.isInteger(size) && size > 0);
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? size;
    const digest = createHash('sha256');
    for (let i = 0; i < accessor.count; i++) {
      const offset = start + i * stride;
      assert.ok(offset + size <= binary.length);
      digest.update(binary.subarray(offset, offset + size));
    }
    return [accessor.type, accessor.componentType, accessor.count, digest.digest('hex')];
  });
  const meshes = gltf.meshes.map(mesh => mesh.primitives.map(primitive => ({
    attributes: Object.fromEntries(Object.entries(primitive.attributes).map(([name, i]) => [name, accessors[i]])),
    indices: accessors[primitive.indices], material: primitive.material,
  })));
  const clips = Object.fromEntries(gltf.animations.map(animation => [animation.name,
    animation.channels.map(channel => {
      const sampler = animation.samplers[channel.sampler];
      return {
        node: gltf.nodes[channel.target.node].name, path: channel.target.path,
        interpolation: sampler.interpolation ?? 'LINEAR',
        times: accessors[sampler.input], values: accessors[sampler.output],
      };
    }),
  ]));
  return { meshes, materials: gltf.materials, clips };
}

const [before, after] = glbs.map(retainedData);
assert.deepEqual(after.meshes, before.meshes);
assert.deepEqual(after.materials, before.materials);
for (const name of ['idle', 'fly', 'reaction']) assert.deepEqual(after.clips[name], before.clips[name]);
assert.deepEqual(Object.keys(after.clips).sort(), ['ability', 'fly', 'idle', 'reaction']);
const report = {
  checkedAt: new Date().toISOString(),
  files: Object.fromEntries(await Promise.all([original, derivative, native].map(async file =>
    [file, hash(await readFile(file))]))),
  retainedMeshCount: after.meshes.length, retainedMaterialCount: after.materials.length,
  byteMatchedAnimationSamplers: ['idle', 'fly', 'reaction'],
  comparedClip: 'ability', contactFrame: 24, frames: [],
};

const tls = await localTls();
let server;
let context;
try {
  // Serve only this fixed fixture, the already approved benchmark models and Three modules.
  const fixture = new Map([
    ['/', 'assets-src/rooms/R01-browser-harness.html'], ['/placements', 'assets-src/rooms/R01-placements.json'],
    ['/models/CH03.glb', derivative], ...['CH01', 'R01', 'R01-architecture',
      ...Array.from({ length: 10 }, (_, i) => 'R01-PR' + String(i + 1).padStart(3, '0'))]
      .map(id => ['/models/' + id + '.glb', 'public/assets/models/' + id + '.glb']),
  ]);
  server = createServer({
    cert: await readFile(path.join(tls.directory, 'leaf.pem')),
    key: await readFile(path.join(tls.directory, 'leaf.key')),
  }, async (request, response) => {
    const url = new URL(request.url, 'https://127.0.0.1');
    const threeModule = /^\/three\/(build|examples\/jsm)\/[\w/-]+(?:\.module|\.core)?\.js$/.test(url.pathname);
    const file = fixture.get(url.pathname) ?? (threeModule ? 'node_modules' + url.pathname : undefined);
    if (request.method !== 'GET' || !file) { response.writeHead(404).end(); return; }
    try {
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript'
        : file.endsWith('.json') ? 'application/json' : 'model/gltf-binary';
      response.writeHead(200, { 'Content-Type': type }).end(await readFile(file));
    } catch { response.destroy(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  context = await firefox.launchPersistentContext(tls.profile, {
    headless: true, ignoreHTTPSErrors: false, viewport: { width: 640, height: 360 }, deviceScaleFactor: 1,
    env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('https://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.ready, undefined, { timeout: 30000 });
  const info = await page.evaluate(() => {
    window.inspect.show('CH03', false);
    document.getElementById('label').textContent = 'Photon · optical inspection';
    return window.inspect.info('CH03');
  });
  const ability = info.clips.find(clip => clip.name === 'ability');
  assert.equal(ability.duration, 2);
  assert.ok(ability.varyingTracks >= 4);
  report.browser = context.browser().version();
  report.triangles = info.triangles;
  report.varyingTracks = ability.varyingTracks;
  for (const [frame, pose] of Object.entries(nativePoses)) {
    const samples = await page.evaluate(seconds => {
      window.inspect.clip('CH03', 'ability', seconds);
      return window.inspect.meshSamples('CH03');
    }, Number(frame) / 24);
    assert.equal(Object.keys(samples).length, after.meshes.length);
    assert.equal(Object.keys(pose).length, after.meshes.length);
    let error = 0;
    for (const [name, expected] of Object.entries(pose)) {
      const actual = samples[name.replaceAll('.', '')];
      assert.equal(actual.length, 16);
      error = Math.max(error, ...actual.map((value, i) => Math.abs(value - expected[i])));
    }
    assert.ok(error < 1e-5, `Frame ${frame}: native and exported pose differ by ${error}.`);
    report.frames.push({ frame: Number(frame), meshes: Object.keys(pose).length, maxComponentError: error });
    if (frame === '0' || frame === '24') await page.screenshot({ path: path.join(output, 'browser-' + frame + '.png') });
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await context?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await tls.stop();
}
