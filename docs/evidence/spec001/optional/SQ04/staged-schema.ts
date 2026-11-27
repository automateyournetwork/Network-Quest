// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated T099 proposal. This never edits the canonical/shared schema.
import proposal from './optional-activity.schema.json' with { type: 'json' };

export function buildMaintenanceSchema(input: unknown): any {
  const schema: any = structuredClone(input), quest = schema.$defs.quest;
  const originalRules = structuredClone(quest.properties.ruleIds), originalAlternatives = structuredClone(quest.properties.alternatives);
  const emptyAlternative = structuredClone(schema.$defs.alternative);
  emptyAlternative.properties.id = { const: 'spec001:ACTION-SQ04-combine' };
  emptyAlternative.properties.ruleIds = { const: [] };
  const notebook = JSON.parse(JSON.stringify(proposal).replaceAll('#/$defs/', '#/$defs/maintenance_'));
  for (const [key, value] of Object.entries(notebook.$defs)) schema.$defs[`maintenance_${key}`] = value;
  delete notebook.$defs; delete notebook.$id; delete notebook.$schema;
  schema.$defs.maintenanceActivity = notebook;
  quest.properties.optionalActivity = { anyOf: [quest.properties.optionalActivity ?? { $ref: '#/$defs/optionalActivity' }, { $ref: '#/$defs/maintenanceActivity' }] };
  quest.properties.ruleIds = { ...originalRules, minItems: 0 };
  quest.properties.alternatives = { ...originalAlternatives, items: { anyOf: [{ $ref: '#/$defs/alternative' }, emptyAlternative] } };
  quest.allOf = [...(quest.allOf ?? []), {
    if: { required: ['optionalActivity'], properties: { optionalActivity: { type: 'object', required: ['kind'], properties: { kind: { const: 'notebook-combination' } } } } },
    then: { properties: { id: { const: 'spec001:SQ04' }, ruleIds: { const: [] }, alternatives: { type: 'array', minItems: 1, maxItems: 1, items: emptyAlternative } } },
    else: { properties: { ruleIds: originalRules, alternatives: originalAlternatives } },
  }];
  return schema;
}
