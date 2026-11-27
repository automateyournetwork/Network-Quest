// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { illustrationBinding } from '../content/schema-types.generated';
import { publicPaths } from '../config';
import { appendSignalComparison } from './signal-comparison-figure';

export function illustrationDetails(doc: Document, binding: illustrationBinding, unavailableText?: string) {
  const details = doc.createElement('details'), summary = doc.createElement('summary');
  details.dataset['illustration'] = binding.assetId;
  summary.textContent = 'View illustration';
  const figure = doc.createElement('figure'), caption = doc.createElement('figcaption');
  figure.style.cssText = 'margin:.5em 0;max-width:100%';
  caption.textContent = binding.caption;
  figure.append(caption);
  if (binding.assetId === 'spec001:ASSET-ILLUSTRATION-14') appendSignalComparison(doc, figure);
  details.append(summary, figure);
  const image = doc.createElement('img');
  image.alt = binding.alt;
  image.style.cssText = 'display:block;width:min(100%,32rem);height:auto;margin-block:.3em';
  const status = doc.createElement('p');
  let started = false;
  function unavailable() {
    image.remove();
    status.textContent = (unavailableText ?? 'The illustration is unavailable.') + ' ' + binding.alt;
    figure.prepend(status);
  }
  // Keep the image request behind a native user-controlled disclosure. A hidden
  // panel, a generated roster or an undiscovered notebook fact loads no image.
  details.addEventListener('toggle', () => {
    if (!details.open || started) return;
    started = true;
    const base = publicPaths.gameBase;
    if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base) || !/^public\/assets\/illustrations\/(?:0[1-9]|1[0-9]|2[0-4])\.webp$/.test(binding.exportPath)) { unavailable(); return; }
    image.addEventListener('error', unavailable, { once: true });
    image.src = base + binding.exportPath.slice('public/'.length);
    figure.prepend(image);
  });
  return details;
}
