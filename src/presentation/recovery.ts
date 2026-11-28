// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

/** The semantic room is usable immediately. Give an optional visual or audio start
 * one foreground readiness window before returning control to its recovery UI. */
export const MEDIA_LOAD_TIMEOUT_MS = 12_000;

export function startMediaDeadline(expire: () => void): () => void {
  const timer = setTimeout(expire, MEDIA_LOAD_TIMEOUT_MS);
  return () => clearTimeout(timer);
}

/** decode() rejects when its source changes. Releasing the source also tells the
 * browser to abandon decoding a retired room while a replacement is loading. */
export async function decodeRoomImage(image: HTMLImageElement, url: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const cancel = () => image.removeAttribute('src');
  signal.addEventListener('abort', cancel, { once: true });
  try {
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

/** Opening a native disclosure requests its illustration. Closing a pending
 * disclosure retires that request. Opening again retries a failed request. */
export function bindDisclosedImage(details: HTMLDetailsElement, figure: HTMLElement, image: HTMLImageElement,
  url: string, failureText: string): () => void {
  const status = image.ownerDocument.createElement('p');
  status.setAttribute('role', 'status');
  let pending: AbortController | undefined, ready = false, failed = false;
  function refresh() {
    if (!details.open) { pending?.abort(); pending = undefined; return; }
    if (ready || pending) return;
    const owner = new AbortController(); pending = owner;
    const cancel = startMediaDeadline(() => owner.abort());
    status.remove(); figure.prepend(image);
    // Firefox retains a failed 200 response in its decoded-image cache. A
    // deliberate retry must request fresh bytes from the same registered path.
    const source = failed ? url + '?retry=' + crypto.randomUUID() : url;
    void decodeRoomImage(image, source, owner.signal).then(() => {
      if (pending === owner) ready = true;
    }, () => {
      if (pending !== owner) return;
      failed = true;
      image.remove(); image.removeAttribute('src');
      status.textContent = failureText + ' Close and reopen to retry.';
      figure.prepend(status);
    }).finally(() => { cancel(); if (pending === owner) pending = undefined; });
  }
  details.addEventListener('toggle', refresh);
  refresh();
  return () => { details.removeEventListener('toggle', refresh); pending?.abort(); pending = undefined; };
}

/** Browsers may leave play() pending when the stream never supplies playable
 * bytes. The audio owner disposes the voice on rejection and retains its text. */
export function boundedPlayback(started: Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = startMediaDeadline(() => reject(new DOMException('Audio playback timed out', 'TimeoutError')));
    started.then(() => { cancel(); resolve(); }, error => { cancel(); reject(error); });
  });
}
