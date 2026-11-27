// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { optionalSchemaProposal } from './schema-proposal';
import candidate from '../SQ01/SQ01.candidate.json' with { type: 'json' };
import projection from '../SQ01/SQ01.current-schema.json' with { type: 'json' };
import power from '../SQ02/SQ02.candidate.json' with { type: 'json' };
const original = JSON.parse(readFileSync(new URL('./content-schema-before-T100.json', import.meta.url), 'utf8'));
const proposed = optionalSchemaProposal(original), ajv = new Ajv({ strict: true, allErrors: true }); addFormats(ajv);
const validate = ajv.compile(proposed);
describe('T100 staged bounded schema extension', () => {
  it('accepts the actual full SQ01 payload and preserves the historical projection', () => {
    expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(projection), JSON.stringify(validate.errors)).toBe(true);
  });
  it.each(['practice', 'exit', 'timing', 'arbitrary-reward', 'unknown-variant'])('rejects %s omission or expansion', kind => {
    const broken: any = structuredClone(candidate);
    if (kind === 'practice') delete broken.optionalActivity.controls.practice;
    if (kind === 'exit') delete broken.optionalActivity.controls.exit;
    if (kind === 'timing') broken.optionalActivity.timingDefault = 'on';
    if (kind === 'arbitrary-reward') broken.optionalActivity.reward.url = 'https://example.invalid/image.png';
    if (kind === 'unknown-variant') broken.optionalActivity.kind = 'arbitrary-evaluator';
    expect(validate(broken)).toBe(false);
  });
  it('adds only explicit quest/minigame fields and one effect, retaining original definitions', () => {
    const unextended = structuredClone(proposed);
    const definitions = unextended['$defs'];
    for (const key of Object.keys(definitions)) if (!Object.hasOwn(original.$defs, key)) delete definitions[key];
    delete definitions.quest.properties.optionalActivity;
    delete definitions.minigame.properties.optionalActivity;
    delete definitions.minigame.properties.completionAchievementId;
    definitions.minigame.required = definitions.minigame.required.filter((key: string) => key !== 'completionAchievementId');
    definitions.effect.oneOf.pop();
    expect(unextended).toEqual(original);
  });
  it('can stage the independent power audit without opening arbitrary variants or merging inputs', () => {
    const combinedAjv = new Ajv({ strict: true, allErrors: true }); addFormats(combinedAjv);
    const combined = combinedAjv.compile(optionalSchemaProposal(original, true));
    expect(combined(candidate), JSON.stringify(combined.errors)).toBe(true);
    expect(combined(power), JSON.stringify(combined.errors)).toBe(true);
    const mixed: any = structuredClone(power); mixed.optionalActivity.delivery.samples = candidate.optionalActivity.delivery.samples;
    expect(combined(mixed)).toBe(false);
    const unknown: any = structuredClone(power); unknown.optionalActivity.kind = 'arbitrary-evaluator'; expect(combined(unknown)).toBe(false);
  });
});
