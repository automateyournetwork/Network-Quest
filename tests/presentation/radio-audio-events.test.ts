// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, it } from 'vitest';
import type { AttemptId, FlagId, RoomId } from '../../src/domain/types';
import { radioAudioEvents } from '../../src/presentation/radio-audio-events';
import { fixture } from '../state/objectives-fixture';

it('sounds the cradle only for an actual change of bearing within the current run and Skywell visit', () => {
  const initial = fixture('O07').store.getState().runtime.game!;
  const path = 'spec001:FLAG-radio-path' as FlagId;
  const aligned = { ...initial, world: { ...initial.world, flags: { ...initial.world.flags, [path]: 'aligned-existing' } } };
  expect(radioAudioEvents(initial, aligned)).toEqual(['radio/antenna-moved']);
  expect(radioAudioEvents(aligned, aligned)).toEqual([]);
  expect(radioAudioEvents(aligned, { ...aligned, world: { ...aligned.world, flags: { ...aligned.world.flags, [path]: 'unaligned' } } })).toEqual(['radio/antenna-moved']);
  expect(radioAudioEvents(initial, { ...aligned, world: { ...aligned.world, roomId: 'spec001:R08' as RoomId } })).toEqual([]);
  expect(radioAudioEvents(initial, { ...aligned, world: { ...aligned.world, attemptId: 'changed-attempt' as AttemptId } })).toEqual([]);
});
