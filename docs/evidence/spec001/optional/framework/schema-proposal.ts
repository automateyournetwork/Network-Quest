// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Staged T100 change only. The coordinator releases shared files before install.
import proposal from '../SQ01/optional-activity.schema.json' with { type: 'json' };
import powerProposal from '../SQ02/optional-activity.schema.json' with { type: 'json' };
export function optionalSchemaProposal(original: Record<string, any>, includePowerAudit = false): Record<string, any> {
  const next = structuredClone(original), definitions = next['$defs'];
  const local = structuredClone(proposal) as Record<string, any>;
  const rename = (value: any): void => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') value.$ref = value.$ref.replace('#/$defs/', '#/$defs/optional');
    Object.values(value).forEach(rename);
  };
  rename(local);
  for (const [name, schema] of Object.entries(local['$defs'])) definitions[`optional${name}`] = schema;
  delete local['$schema']; delete local['$id']; delete local['$comment']; delete local['$defs'];
  definitions['optionalActivity'] = local;
  if (includePowerAudit) {
    const power = structuredClone(powerProposal) as Record<string, any>;
    const renamePower = (value: any): void => { if (!value || typeof value !== 'object') return;
      if (typeof value.$ref === 'string') value.$ref = value.$ref.replace('#/$defs/', '#/$defs/optionalPower'); Object.values(value).forEach(renamePower); };
    renamePower(power);
    for (const [name, schema] of Object.entries(power['$defs'])) definitions[`optionalPower${name}`] = schema;
    delete power['$schema']; delete power['$id']; delete power['$comment']; delete power['$defs'];
    definitions['optionalActivity'] = { oneOf: [local, power] };
  }
  definitions['achievementId'] = { type: 'string', pattern: '^spec001:ACHIEVEMENT-[A-Za-z0-9][A-Za-z0-9._-]{0,35}$' };
  definitions['quest'].properties.optionalActivity = { $ref: '#/$defs/optionalActivity' };
  definitions['minigame'].properties.optionalActivity = { $ref: '#/$defs/optionalActivity' };
  definitions['minigame'].properties.completionAchievementId = { $ref: '#/$defs/achievementId' };
  definitions['minigame'].required.push('completionAchievementId');
  definitions['effect'].oneOf.push({ type: 'object', additionalProperties: false,
    properties: { kind: { const: 'complete-minigame' }, effectId: { $ref: '#/$defs/id' }, minigameId: { $ref: '#/$defs/minigameId' } },
    required: ['kind', 'effectId', 'minigameId'] });
  return next;
}
