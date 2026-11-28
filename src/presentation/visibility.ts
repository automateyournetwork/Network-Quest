// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
/** A new presentation can mount in a background tab, before any visibility event. */
export function observeVisibility(document: Document, signal: AbortSignal, setHidden: (hidden: boolean) => void) {
  if (signal.aborted) return;
  const sync = () => setHidden(document.hidden);
  document.addEventListener('visibilitychange', sync, { signal });
  sync();
}
