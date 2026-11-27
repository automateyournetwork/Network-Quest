// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
export default defineConfig({envDir:false,test:{environment:'node',include:['docs/evidence/spec001/companions-t104/current-joined/technical-fields.test.ts'],passWithNoTests:false,allowOnly:false,reporters:['default'],clearMocks:true,restoreMocks:true}});
