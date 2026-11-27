// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Proposed authoring types only. This file is outside production discovery.
import type * as S from '../../../../../src/content/schema-types.generated';
import type { ToySample } from '../../../../../src/domain/packet-journey';

interface ModeFeedback {
  readonly correct: string;
  readonly incorrect: string;
  readonly invalidInput: string;
}

export interface ToySymbolLoomActivity {
  readonly kind: 'toy-symbol-loom';
  readonly speakerId: 'spec001:CH21';
  readonly instructions: readonly string[];
  readonly profileId: 'spec001:PROFILE-SYMBOLS';
  readonly delivery: {
    readonly sourceCaseId: 'T12';
    readonly actionId: 'spec001:ACTION-MG01-decode';
    readonly samples: readonly ToySample[];
  };
  readonly practice: {
    readonly sourceCaseId: 'B-SYMBOL';
    readonly samples: readonly ToySample[];
    readonly explanation: string;
  };
  readonly feedback: {
    readonly practice: ModeFeedback;
    readonly delivery: ModeFeedback;
    readonly contentError: string;
    readonly alreadyCompleted: string;
  };
  readonly controls: {
    readonly practice: string;
    readonly delivery: string;
    readonly submit: string;
    readonly retry: string;
    readonly exit: string;
  };
  readonly recovery: { readonly exitExplanation: string; readonly retryExplanation: string };
  readonly reward: { readonly kind: 'optional-practice-only'; readonly factId: 'spec001:FACT-MG01-completion' };
  readonly entryContexts: readonly [{
    readonly roomId: 'spec001:R10';
    readonly safePositionId: 'spec001:R10.entry';
    readonly hotspotId: 'spec001:HOTSPOT-clockworks-loom';
  }];
  readonly returnPolicy: 'captured-entry';
  readonly timingDefault: 'off';
}

export type LoomDefinition = Readonly<Omit<S.minigame, 'optionalActivity'>> & {
  readonly id: 'spec001:MG01';
  readonly completionAchievementId: 'spec001:ACHIEVEMENT-MG01-complete';
  readonly optionalActivity: ToySymbolLoomActivity;
};

/** Input only. The actual captured action bus owns session/version provenance. */
export interface LoomAnswer { readonly bits: string }
