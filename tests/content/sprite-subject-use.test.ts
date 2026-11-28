// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { observedSpriteSubject } from '../../tools/sprite-subject-use.ts';
import type { Asset, AssetEvidenceRecord, AssetManifest } from '../../tools/asset-types.ts';

const json = (path: string) => JSON.parse(readFileSync(path,'utf8'));
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest = json('assets-src/manifest.json') as AssetManifest;
const overlay = json('assets-src/integration/R04-T141.json') as {updates: {assetId:string;interactiveOrEvidence:boolean;appendUsedBy:Asset['usedBy'][number]}[]};
const bindings = json('content/spec001/rooms/R04.json').mediaBindings;
function subject(change = overlay.updates[0]!) {
  const model = manifest.assets.find(a => a.assetId === change.assetId)!;
  const use = change.appendUsedBy, atlas = manifest.assets.find(a => a.assetId === use.spriteSubject?.atlasId)!;
  const proof = json(use.evidencePath) as AssetEvidenceRecord;
  return {model:{...model,interactiveOrEvidence:change.interactiveOrEvidence},use,atlas,proof};
}
describe('Echo Cavern sprite subjects', () => {
  it('matches each of thirteen separately modeled subjects to its native input, served atlas and drawn rectangle', () => {
    expect(overlay.updates.length).toBe(13);
    for (const change of overlay.updates) {
      const {model,use,atlas,proof} = subject(change);
      expect(observedSpriteSubject(model,use,atlas,proof,bindings,json,hash),model.assetId).toBe(true);
    }
  });
  it('rejects another subject, an unrelated atlas, an unavailable export and a frame absent from the live scene', () => {
    const {model,use,atlas,proof} = subject();
    const other = subject(overlay.updates[1]);
    expect(observedSpriteSubject(other.model,use,atlas,proof,bindings,json,hash)).toBe(false);
    expect(observedSpriteSubject(model,use,{...atlas,derivedFrom:[]},proof,bindings,json,hash)).toBe(false);
    expect(observedSpriteSubject(model,use,atlas,proof,[],json,hash)).toBe(false);
    expect(observedSpriteSubject(model,use,atlas,proof,bindings,json,p=>p===atlas.exports[0]!.file.path?undefined:hash(p))).toBe(false);
    const missingDraw = (p:string) => p===use.spriteSubject!.drawsPath ? {...json(p),subjects:[]} : json(p);
    expect(observedSpriteSubject(model,use,atlas,proof,bindings,missingDraw,hash)).toBe(false);
    const wrongFrame = (p:string) => {
      const data = json(p);
      if (p === use.spriteSubject!.drawsPath) data.subjects.find((s:{assetId:string})=>s.assetId===model.assetId).sourceRect[0]++;
      return data;
    };
    expect(observedSpriteSubject(model,use,atlas,proof,bindings,wrongFrame,hash)).toBe(false);
  });
});
