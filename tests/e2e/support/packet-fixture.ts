// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { Page } from '@playwright/test';
import type { PacketJourneyView } from '../../../src/ui/packet-journey';
import type { ReducerState } from '../../../src/state/reducer';
import { fixture } from '../../state/outcome-fixture';

export type PacketFault = 'none' | 'mismatch' | 'endpoint' | 'physical' | 'power' | 'capability' | 'symbols' | 'role';
declare global {
  interface Window {
    isolatedRepairPacket: {
      setFault(fault: PacketFault): void;
      snapshot(): ReducerState;
      view(): PacketJourneyView;
    };
  }
}

/** Explicit isolated controller fixture. Seeds accepted training prerequisites,
 * then calls actual plan preparation/execution/navigation and real packet
 * domain/controller/panel. This is not an actual New Adventure playthrough. */
export async function mountRepairPacketFixture(page: Page, base: string, route: 'copper' | 'fiber' | 'radio') {
  // The public development boundary deliberately does not serve tests/. Prepare
  // this isolated state in Node through real execution/navigation, then supply
  // it to the explicitly blank fixture document. Never expose a test import or
  // insert it into the full application's state.
  const prepared = fixture(route); prepared.prepare();
  if (prepared.execute().result.status !== 'handled' || prepared.move('R12').status !== 'handled') throw new Error('Isolated preparation/execution failed');
  const preparedState = prepared.state();
  const fixtureUrl = `${base}__t091-isolated-packet.html`;
  await page.route(fixtureUrl, intercepted => intercepted.fulfill({ status: 200, contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated packet controller fixture</title></head><body></body></html>' }));
  await page.goto(fixtureUrl);
  await page.evaluate(async ({ base, route, preparedState }) => {
    const { loadIntroductionContent } = await import(`${base}src/app/content.ts`) as typeof import('../../../src/app/content');
    const { createRepairScenarioResolver } = await import(`${base}src/state/repair-plan.ts`) as typeof import('../../../src/state/repair-plan');
    const { createRepairPacketSource } = await import(`${base}src/state/repair-packet.ts`) as typeof import('../../../src/state/repair-packet');
    const { createActionBus, contextFromRuntime } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../../src/ui/action-bus');
    const { createPacketJourneyController, createPacketJourneyPanel } = await import(`${base}src/ui/packet-journey.ts`) as typeof import('../../../src/ui/packet-journey');
    const { default: introContext } = await import(`${base}content/spec001/packet-context.json`);
    const { default: repairContext } = await import(`${base}content/spec001/packet-r12-context.json`);
    const { registry } = loadIntroductionContent(), resolve = createRepairScenarioResolver(registry);
    let fault: PacketFault = 'none';
    const resolver: import('../../../src/state/repair-plan').RepairScenarioResolver = (game, plan) => {
      const scenario = resolve(game, plan);
      if (!scenario) return scenario;
      if (fault === 'mismatch') return { ...scenario, receivedBits: '0100111001010000' };
      if (fault === 'endpoint') return { ...scenario, endpointResponse: 'service-unavailable' };
      if (fault === 'power') return { ...scenario, equipment: scenario.equipment && { ...scenario.equipment,
        allocation: { ...scenario.equipment.allocation, perPortConstraintsMet: false } } };
      if (fault === 'capability') return { ...scenario, equipment: scenario.equipment && { ...scenario.equipment,
        capability: { ...scenario.equipment.capability, selected: { rate: { value: 1000, unit: 'Mbps' }, duplex: 'full' } } } };
      if (fault === 'symbols') return { ...scenario, calibration: scenario.calibration && { ...scenario.calibration, decodedBits: '00001101' } };
      if (fault === 'role') return { ...scenario, calibration: scenario.calibration && { ...scenario.calibration, roleClaim: 'physical-repeater-resolves-IP-address' } };
      if (fault === 'physical') {
        if (route === 'copper') return { ...scenario, path: { kind: 'copper-path', compatible: true,
          lengths: [{ value: 105, unit: 'm' }], requiredConductors: [true, true, true, true] } };
        if (route === 'fiber') return { ...scenario, path: { kind: 'optical-passive', compatible: true, loss: { value: 10, unit: 'dB' } } };
        return { ...scenario, path: { kind: 'radio-link', viablePath: true, settingsCompatible: true,
          signal: { value: -65, unit: 'dBm' }, noise: { value: -78, unit: 'dBm' } } };
      }
      return scenario;
    };
    const game = preparedState.runtime.game!;
    const source = createRepairPacketSource({ registry, game, resolveScenario: resolver });
    const binding = { kind: 'repair' as const, identity: {}, source, world: game.world, context: contextFromRuntime(preparedState.runtime)! };
    const bus = createActionBus({ getContext: () => binding.context });
    const controller = createPacketJourneyController({ bus, context: introContext, repairContext, read: () => binding });
    const host = document.createElement('main'), title = document.createElement('h1'), opener = document.createElement('button');
    title.textContent = 'Isolated production packet controller — supplied fault scenario';
    opener.type = 'button'; opener.textContent = 'Open isolated repair inspection'; host.append(title, opener); document.body.replaceChildren(host);
    const panel = createPacketJourneyPanel(host, { dispatch: action => bus.dispatch(action), cancel: action => bus.cancel(action) });
    const refresh = () => { const projected = controller.project(); panel.render(projected.view, projected.capture); };
    bus.subscribe(() => refresh()); opener.addEventListener('click', () => { controller.open(); refresh(); }); refresh();
    window.isolatedRepairPacket = { setFault(value) { fault = value; refresh(); }, snapshot: () => structuredClone(preparedState), view: () => controller.project().view };
  }, { base, route, preparedState });
}
