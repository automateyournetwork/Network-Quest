// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { projectEpilogue, validateEndingsContent } from '../../src/content/endings';
import { maintenanceHistoryUnlocked } from '../../src/state/optional-maintenance';
import { maintenanceFixture, activity, q, mid } from './maintenance-fixture';
const checked = validateEndingsContent(JSON.parse(readFileSync('content/spec001/endings.json','utf8'))); if (!checked.ok) throw new Error('Invalid actual ending');
const content = checked.value;
it.each([[false,false],[true,false],[false,true],[true,true]] as const)('projects history only with quest=%s and fact=%s; outcome and handover stay separate', (quest,fact) => {
  const f = maintenanceFixture(true); f.start(); f.mode('delivery'); f.send({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: activity.delivery.factIds } }); f.simple('exit-optional');
  for (const outcome of ['E01','E02','E03'] as const) {
    // Prepared accepted ending state tests presentation only; classification has its own real controller suite.
    const game = f.game(), event = { id: mid(91), outcome, attemptId: game.world.attemptId, route: 'copper', caveatIds: [] } as const;
    const prepared = { ...game, world: { ...game.world, route: 'copper', completedQuestIds: quest ? [q<'quest'>('SQ04')] : [], completedObjectiveIds: [...game.world.completedObjectiveIds,q<'objective'>('O12')] },
      notebook: { ...game.notebook, factIds: [...game.notebook.factIds.filter(id => id !== q('FACT-SQ04-history')), ...(fact ? [q<'fact'>('FACT-SQ04-history')] : []),q<'fact'>('FACT-repair-maintenance')] }, outcomeHistory: [event] } as never;
    const view = projectEpilogue(content, prepared, event as never); expect(view?.outcome).toBe(outcome); expect(view?.paragraphs.includes(activity.reward.epilogueText)).toBe(quest && fact);
    expect(view?.paragraphs).toContain(content.maintenance.recorded);
  }
});
it.each(['terminal-failure','shutdown'] as const)('actual %s rewind removes SQ04 receipt but retains history learning without personalization', kind => {
  const f = maintenanceFixture(true), before = f.game();
  // Prepared checkpoint location/lifecycle; actual completion and rewind use the production reducer.
  const checkpoint = { adventureId: before.adventureId, world: { ...structuredClone(before.world), roomId: q<'room'>('R11'), position: { safePositionId: q<'safe-position'>('R11.preparation') } } };
  f.start(); f.mode('delivery'); f.send({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: activity.delivery.factIds } }); f.simple('exit-optional'); expect(maintenanceHistoryUnlocked(f.game())).toBe(true);
  const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, checkpoint, activity: { kind } } });
  expect(f.raw({ kind: 'rewind-preparation', nextAttemptId: mid(99) as never }).status).toBe('applied');
  expect(f.game().world.completedQuestIds).toEqual([]); expect(f.game().notebook.factIds).toContain(q('FACT-SQ04-history')); expect(maintenanceHistoryUnlocked(f.game())).toBe(false);
});
