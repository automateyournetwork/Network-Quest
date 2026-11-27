// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
export default defineConfig({envDir:false,test:{environment:'node',include:['tests/domain/capabilities.test.ts','tests/state/objectives.test.ts','tests/state/party-abilities.test.ts','tests/state/equipment-scenarios.test.ts'],passWithNoTests:false,allowOnly:false,reporters:['default']}});
