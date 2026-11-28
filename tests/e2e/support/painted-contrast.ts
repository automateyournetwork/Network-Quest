// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, type Locator } from '@playwright/test';

/** Sample the actual background at the positions of painted glyphs. Removing
 * only the text color for the second capture preserves gradients and imagery. */
export async function paintedContrast(target: Locator, selector: string) {
  await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const painted = await target.screenshot();
  const backdrop = await target.screenshot({ style: selector + ' { color: transparent !important; text-shadow: none !important; }' });
  const sample = await target.evaluate(async (el, images) => {
    const pixels = async (png: string) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const { width, height } = bitmap;
      const ctx = new OffscreenCanvas(width, height).getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return ctx.getImageData(0, 0, width, height).data;
    };
    const [actual, background] = await Promise.all([pixels(images.painted), pixels(images.backdrop)]);
    const foreground = getComputedStyle(el).color.match(/\d+/g)!.slice(0, 3).map(Number);
    const luminance = (r: number, g: number, b: number) => {
      const linear = (byte: number) => byte <= 10.31475 ? byte / 3294.6 : ((byte / 255 + .055) / 1.055) ** 2.4;
      return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
    };
    const ink = luminance(foreground[0]!, foreground[1]!, foreground[2]!);
    let contrast = Infinity, highestPaintedContrast = 1, glyphPixels = 0, solidGlyphPixels = 0;
    for (let i = 0; i < actual.length; i += 4) {
      // Ignore unchanged pixels. A half-covered edge still samples the same
      // background as a solid glyph and accommodates small anti-aliased fonts.
      let coverage = 0, expected = 0, solid = true;
      for (let c = 0; c < 3; c++) {
        coverage += Math.abs(actual[i+c]! - background[i+c]!);
        expected += Math.abs(foreground[c]! - background[i+c]!);
        solid &&= actual[i+c] === foreground[c];
      }
      const bg = luminance(background[i]!, background[i+1]!, background[i+2]!);
      if (coverage >= 12) {
        const seen = luminance(actual[i]!, actual[i+1]!, actual[i+2]!);
        highestPaintedContrast = Math.max(highestPaintedContrast, (Math.max(seen, bg) + .05) / (Math.min(seen, bg) + .05));
      }
      if (coverage < 12 || coverage < expected * .5) continue;
      glyphPixels++;
      if (solid) solidGlyphPixels++;
      contrast = Math.min(contrast, (Math.max(ink, bg) + .05) / (Math.min(ink, bg) + .05));
    }
    const obscured: string[] = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.textContent!.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
        if ([...range.getClientRects()].some(r => !el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)))) obscured.push(match[0]);
      }
    }
    return { foreground, glyphPixels, solidGlyphPixels, contrast, highestPaintedContrast, obscured };
  }, { painted: painted.toString('base64'), backdrop: backdrop.toString('base64') });
  expect.soft(sample.solidGlyphPixels, selector + ' has fully painted text').toBeGreaterThan(0);
  expect.soft(sample.obscured, selector + ' can be read after native scrolling').toEqual([]);
  expect.soft(sample.contrast, selector + ' minimum contrast at glyphs').toBeGreaterThanOrEqual(4.5);
  return sample;
}
