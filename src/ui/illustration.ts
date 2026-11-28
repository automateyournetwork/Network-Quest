// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { illustrationBinding } from '../content/schema-types.generated';
import { publicPaths } from '../config';
import { appendSignalComparison } from './signal-comparison-figure';
import { bindDisclosedImage } from '../presentation/recovery';

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
  const failureText = (unavailableText ?? 'The illustration is unavailable.') + ' ' + binding.alt;
  const base = publicPaths.gameBase;
  if (/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base) && /^public\/assets\/illustrations\/(?:0[1-9]|1[0-9]|2[0-4])\.webp$/.test(binding.exportPath)) {
    bindDisclosedImage(details, figure, image, base + binding.exportPath.slice('public/'.length), failureText);
  } else {
    const status = doc.createElement('p'); status.textContent = failureText; figure.prepend(status);
  }
  return details;
}
