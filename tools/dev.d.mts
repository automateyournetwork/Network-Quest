// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
/** Isolated local development transport; never loads production configuration. */
export function startDev(options: {
  cert: string;
  key: string;
  port?: number;
  php?: string;
  probeRouter?: string;
}): Promise<{
  origin: string;
  url: string;
  stop: () => Promise<void>;
  phpPid: number;
  phpPort: number;
  runDirectory: string;
}>;
