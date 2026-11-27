// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { GameState } from '../state/types';
import { currentThresholdEnding } from './outcome-audio-events';
import type { RoomDecorationFactory } from './three-room';

/** Raise one native relief into PR115's recessed folio after a recorded classification. */
export function createThresholdMural(game: () => GameState | null): RoomDecorationFactory {
  return (scene, stage) => {
    const folios = (['E01','E02','E03'] as const).map(outcome => {
      const node = scene.getObjectByName('Mural' + outcome);
      if (!node || node.userData['outcome'] !== outcome || !Number.isFinite(node.userData['displayOffsetZ'])) {
        throw new Error('Unregistered Threshold mural');
      }
      node.position.z += node.userData['displayOffsetZ'];
      return { node, outcome };
    });
    const update = () => {
      const earned = currentThresholdEnding(game());
      for (const { node, outcome } of folios) node.visible = outcome === earned;
      stage.dataset['muralFolio'] = earned ?? 'blank';
    };
    update();
    return { updateView: update, layout() {}, dispose() { delete stage.dataset['muralFolio']; } };
  };
}
