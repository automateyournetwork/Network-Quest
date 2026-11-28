// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { isDeepStrictEqual } from 'node:util';
import type { Asset, AssetEvidenceRecord, AssetUse } from './asset-types.ts';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const pair = (value: unknown): value is [number,number] =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const rows = (value: unknown) => Array.isArray(value) ? value.map(record) : [];
function unique(value: unknown, field: string, id: string) {
  const matches = rows(value).filter(row => row[field] === id);
  return matches.length === 1 ? matches[0]! : {};
}

/** A native model drawn into a sprite atlas has an exact frame and native input;
 * sharing an atlas with another asset does not establish a placement. */
export function observedSpriteSubject(model: Asset, use: Asset['usedBy'][number], atlas: Asset | undefined,
  proof: AssetEvidenceRecord | undefined, bindings: readonly AssetUse[],
  json: (path: string) => unknown, hashAt: (path: string) => string | undefined) {
  const via = use.spriteSubject, room = use.contentId.slice(8);
  if (!via || !/^R[0-9]{2}$/.test(room) || !model.model || !['prop-model','character-model'].includes(model.kind)
    || atlas?.kind !== 'sprite-sheet' || !atlas.derivedFrom.includes(model.assetId)
    || !proof || proof.assetId !== model.assetId || proof.type !== 'usage' || proof.status !== 'passed'
    || proof.details['visible'] !== true || proof.details['meaningful'] !== true) return false;
  const id = model.semanticIdentity.slice(8), stagePath = 'content/spec001/presentation/'+room+'.json';
  const composition = record(json(stagePath)), subject = unique(composition['subjects'],'assetId',model.assetId);
  const roomData = record(json('content/spec001/rooms/'+room+'.json'));
  const resident = model.kind === 'prop-model'
    ? rows(roomData['propInstances']).some(p => p['assetId'] === model.assetId && p['propId'] === model.semanticIdentity)
    : Array.isArray(roomData['characterIds']) && roomData['characterIds'].includes(model.semanticIdentity);
  const hotspot = rows(roomData['hotspots']).find(h => h['id'] === subject['objectId'] && h['subjectId'] === model.semanticIdentity);
  if (!resident || model.interactiveOrEvidence && (!hotspot || !Array.isArray(hotspot['verbs']) || !hotspot['verbs'].length)) return false;
  const registered = bindings.find(b => b.assetId === atlas.assetId && b.contentId === use.contentId && b.use === 'sprite-animation');
  const sheet = atlas.exports.find(e => e.file.path === registered?.exportPath)?.file;
  const exported = model.exports.find(e => e.file.path === proof.details['modelExport'])?.file;
  const native = model.sources.find(s => s.role === 'native' && s.file.path === model.model!.blendSourcePath)?.file;
  const stage = atlas.sources.find(s => s.role === 'native' && s.file.format === 'blend')?.file;
  const production = atlas.production.find(p => p.method === 'blender-rendered');
  if (!sheet || !native || !exported || !stage || !production || !atlas.usedBy.some(u => u.contentId === use.contentId && u.use === 'sprite-animation')
    || composition['roomId'] !== use.contentId || subject['id'] !== id || subject['atlasId'] !== atlas.assetId) return false;
  const capture = record(json(via.drawsPath)), inspection = record(json(via.stageInspectionPath));
  const draw = unique(capture['subjects'],'assetId',model.assetId), group = unique(inspection['subjects'],'assetId',model.assetId);
  const input = unique(record(json(production.settingsPath))['inputs'],'assetId',model.assetId);
  const imported = [native,exported].find(f => f.path === input['source'] && f.sha256 === input['sha256']);
  const frame = rows(record(record(subject['clips'])[String(draw['clip'])])['frames']).find(f => f['at'] === draw['at']);
  const sheetSize = unique(composition['atlases'],'assetId',atlas.assetId);
  if (!imported || !production.referenceHashes.includes(imported.sha256) || !pair(frame?.['offset']) || !pair(subject['size'])
    || !pair(composition['stageSize']) || !pair(subject['footpoint']) || !pair(subject['pivot'])) return false;
  const [x,y] = frame['offset'], [width,height] = subject['size'];
  if (![x,y,width,height].every(Number.isInteger) || x < 0 || y < 0 || width <= 0 || height <= 0
    || typeof sheetSize['width'] !== 'number' || typeof sheetSize['height'] !== 'number'
    || x+width > sheetSize['width'] || y+height > sheetSize['height']
    || !isDeepStrictEqual(draw['sourceRect'],[x,y,width,height])) return false;
  const [fx,fy]=subject['footpoint'], [px,py]=subject['pivot'];
  const placement = [Math.round(fx-px),Math.round(fy-py),...subject['size']];
  if (placement[0]! >= composition['stageSize'][0] || placement[1]! >= composition['stageSize'][1]
    || placement[0]!+width <= 0 || placement[1]!+height <= 0) return false;
  const expected = {assetId:model.assetId, atlasId:atlas.assetId, objectId:subject['objectId'], clip:draw['clip'], at:draw['at'],
    sourceRect:draw['sourceRect'], drawnRect:placement, atlasPath:sheet.path, atlasSha256:sheet.sha256};
  return capture['roomId'] === use.contentId && capture['status'] === 'passed' && isDeepStrictEqual(draw,expected)
    && isDeepStrictEqual(proof.details['draw'],expected) && inspection['path'] === stage.path && inspection['sha256'] === stage.sha256
    && group['collection'] === id+' stage' && Array.isArray(group['meshObjects']) && group['meshObjects'].length > 0
    && isDeepStrictEqual(proof.details['stageObjects'],group['meshObjects']) && proof.details['nativeModel'] === native.path
    && [sheet,native,exported,stage].every(f => hashAt(f.path) === f.sha256 && proof.hashes.includes(f.sha256))
    && [stagePath,production.settingsPath,via.drawsPath,via.stageInspectionPath].every(p => { const sum=hashAt(p); return !!sum && proof.hashes.includes(sum); });
}
