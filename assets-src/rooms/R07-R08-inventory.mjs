// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AssetFileReader,loadAuthoredAssetContent,missingRegisteredAssetUses} from '../../tools/asset-files.ts';
const read=async f=>JSON.parse(await readFile(f, 'utf8'));
const candidate=await read(process.argv[2] ?? 'assets-src/manifest.json');
const bindings=(await Promise.all(['R07','R08'].map(async id=>(await read('content/spec001/rooms/'+id+'.json')).mediaBindings))).flat();
const key=b=>JSON.stringify([b.assetId,b.exportPath,b.contentId,b.use]);
const target=new Set(bindings.map(key));
const root=await AssetFileReader.create(process.cwd());
const authored=await loadAuthoredAssetContent(root);
const found=authored.uses.filter(u=>target.has(key(u)));
assert.deepEqual([...new Set(found.map(key))].sort(),[...target].sort());
const issues=missingRegisteredAssetUses({...candidate,conditionalBindings:[]},found,[]);
assert.deepEqual(issues,[]);
const output={mode:'inventory',scope:'Exact R07 and R08 bound exports after T138 additive joins. The canonical reverse-use checker consumed both rooms from the authored content loader.',registeredBindings:target.size,issues,conditionalBindings:0};
await writeFile('docs/evidence/spec001/final-rooms/T138/reverse-uses.json',JSON.stringify(output,null,2)+'\n');
console.log(output);
