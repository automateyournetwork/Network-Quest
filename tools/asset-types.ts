// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
/** Data contract for the offline audit. Test fixtures never supply production types. */
export type AssetKind = 'character-model' | 'prop-model' | 'room-model' | 'scene-layer' | 'portrait' | 'illustration' | 'sprite-sheet' | 'music' | 'ambience' | 'effect' | 'voice';
export type AssetCounts = { characterModels: number; props: number; interactiveProps: number; roomsWithImageSet: number; sceneLayers: number; portraits: number; illustrations: number; music: number; ambience: number; effects: number; voices: number };
export type AssetIssue = { code: string; assetId?: string; path?: string };
export type AssetValidationResult = { valid: boolean; issues: AssetIssue[]; counts: AssetCounts };
export type AssetEntity = { id: string; kind: string; speakerId?: string; text?: string };
export type AssetUse = { assetId: string; contentId: string; use: string; exportPath: string; interactiveOrEvidence: boolean };
export type AssetEvidenceRecord = {
  type: 'review' | 'production' | 'rights' | 'usage' | 'retrieval'; assetId: string;
  hashes: string[]; status: 'passed' | 'pending' | 'failed'; actor: 'human' | 'agent' | 'tool';
  reviewer: string; date: string; environment: string; check?: string; details: Record<string, unknown>;
};
export type AssetEvidenceSnapshot = {
  files: Readonly<Record<string, Uint8Array>>; records: Readonly<Record<string, AssetEvidenceRecord>>;
  content: { entities: AssetEntity[]; uses: AssetUse[] };
};
export type AssetFile = { path: string; sha256: string; bytes: number; format: string };
export type AssetSource = {
  file: AssetFile; role: string; application: string; version: string; reopenEvidencePath?: string;
  retrieval?: { url: string; archiveSha256: string; memberPath: string; release: string; instructionsPath: string };
};
export type AssetProduction = {
  method: string; tool: string; version: string; modelRevision: string; eventId: string;
  settingsPath: string; promptOrScriptPath: string; referenceHashes: string[]; outputHashes: string[]; notes: string;
};
export type AssetVerification = { check: string; status: string; reviewer: string; date: string; hashes: string[]; environment: string; evidencePath: string; findings: string };
export type Asset = {
  assetId: string; semanticIdentity: string; kind: AssetKind; status: string; countsTowardQuota: boolean;
  interactiveOrEvidence: boolean; variantOf: string | null; derivedFrom: string[];
  sources: AssetSource[];
  exports: { file: AssetFile; mimeType: string; sourceHashes: string[]; tool: string; preset: string; integrationEvidencePath: string }[];
  production: AssetProduction[];
  rights: { reviewStatus: string; creators: string[]; licenseIds: string[]; noticePaths: string[]; sourceUrls: string[]; termsSnapshotPaths: string[]; inputPermissionPaths: string[]; aiDisclosure: string };
  usedBy: { contentId: string; use: string; evidencePath: string }[]; verification: AssetVerification[];
  model?: { blendSourcePath: string; objectIds: string[]; units: string; axes: string; pivot: string; collisionProxy: string; animationClips: string[]; triangles: number; textureBytes: number };
  image?: { width: number; height: number; colorSpace: string; alpha: boolean; cameraRecordPath: string; layerRole: string; registrationPath: string };
  audio?: { nativeProjectPath: string; masterPath: string; codec: string; sampleRate: number; channels: number; durationSeconds: number; loopStartSample: number | null; loopEndSample: number | null; loudnessLufs: number; peakDbfs: number; captionId: string | null; voiceRecordPath?: string };
};
export type AssetManifest = { schemaVersion: 1; episodeId: 'spec001'; assets: Asset[] };
export const minimums: Readonly<AssetCounts> = Object.freeze({ characterModels: 25, props: 150, interactiveProps: 50, roomsWithImageSet: 12, sceneLayers: 36, portraits: 25, illustrations: 24, music: 8, ambience: 12, effects: 40, voices: 60 });
export const emptyCounts = (): AssetCounts => ({ characterModels: 0, props: 0, interactiveProps: 0, roomsWithImageSet: 0, sceneLayers: 0, portraits: 0, illustrations: 0, music: 0, ambience: 0, effects: 0, voices: 0 });
