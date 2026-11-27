// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { Object3D } from 'three';
import type { FlagId } from '../domain/types';
import type { GameState } from '../state/types';
import type { RoomDecorationFactory } from './three-room';

type RadioFlags = Pick<GameState['world'], 'flags'>['flags'];
const pathFlag = 'spec001:FLAG-radio-path' as FlagId;
const channelFlag = 'spec001:FLAG-radio-channel' as FlagId;
const conditionsFlag = 'spec001:FLAG-radio-conditions' as FlagId;

/** Read only the player's selected apparatus settings. This projection never computes a measurement. */
export function createRadioDecoration(flags: () => RadioFlags | undefined): RoomDecorationFactory {
  return (scene, stage) => {
    const antenna = scene.children.find(root => {
      let match = false;
      root.traverse(node => { if (node.userData['objectId'] === 'spec001:HOTSPOT-radio-antenna') match = true; });
      return match;
    });
    const left = scene.getObjectByName('RainShutterLeft'), right = scene.getObjectByName('RainShutterRight');
    const channel = scene.getObjectByName('ChannelPointer'), isolation = scene.getObjectByName('IsolationPointer');
    const arrivalX = new Map<Object3D, number>();
    for (const part of [left, right, channel]) if (part) arrivalX.set(part, part.position.x);
    const started = performance.now();
    function settings() {
      const selected = flags();
      if (antenna) {
        const path = selected?.[pathFlag] ?? 'unaligned';
        antenna.rotation.y = path === 'aligned-existing' ? -.42 : path === 'alternate-path' ? .53 : 0;
        stage.dataset['antennaYaw'] = antenna.rotation.y.toFixed(2);
      }
      if (channel && isolation) {
        const selectedB = selected?.[channelFlag] === 'B';
        channel.position.x = arrivalX.get(channel)! + (selectedB ? .56 : 0);
        isolation.rotation.z = selected?.[conditionsFlag] === 'surveyed' ? -1.10 : 0;
        stage.dataset['channelPointer'] = selectedB ? 'B' : 'A';
        stage.dataset['isolationPointerAngle'] = isolation.rotation.z.toFixed(2);
      }
    }
    settings();
    return {
      updateView: settings,
      layout() {
        if (!left || !right) return;
        const reduced = stage.closest<HTMLElement>('.nq-room')?.dataset['reducedMotion'] === 'true';
        const remaining = reduced ? 0 : Math.max(0, 1 - (performance.now() - started) / 850);
        left.position.x = arrivalX.get(left)! + remaining * .34;
        right.position.x = arrivalX.get(right)! - remaining * .34;
        stage.dataset['shutterSeparation'] = (right.position.x - left.position.x).toFixed(2);
      },
      dispose() { arrivalX.clear(); },
    };
  };
}
