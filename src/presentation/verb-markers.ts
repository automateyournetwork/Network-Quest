// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { AppShellView, SceneObjectView } from '../ui/app-shell';

export function selectedSceneVerb(view: Pick<AppShellView, 'controls'>) {
  return view.controls.find(control => control.pressed && control.action.kind === 'select-verb')?.id;
}

/** Keep each clickable caption inside its stage and clear of neighboring pins. */
export function fitVerbLabels(layer: HTMLElement) {
  const bounds = layer.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const pins = [...layer.querySelectorAll<HTMLElement>('.nq-graybox-pin[data-verb-target]')];
  const obstacles = pins.map(pin => pin.getBoundingClientRect());
  for (const [index, pin] of pins.entries()) {
    const caption = pin.querySelector<HTMLElement>('.nq-verb-label');
    if (!caption) continue;
    const anchor = obstacles[index]!, width = caption.offsetWidth, height = caption.offsetHeight;
    const center = anchor.left + anchor.width / 2, middle = anchor.top + anchor.height / 2;
    const centered = center - width / 2, below = anchor.bottom + 2, above = anchor.top - height - 2;
    const positions = [[centered, below], [centered, above], [anchor.right + 2, middle - height / 2],
      [anchor.left - width - 2, middle - height / 2], [centered, below + height + 2], [centered, above - height - 2]] as const;
    let best: DOMRect | undefined, bestArea = Infinity;
    for (const [x, y] of positions) {
      const left = Math.max(bounds.left + 2, Math.min(bounds.right - width - 2, x));
      const top = Math.max(bounds.top + 2, Math.min(bounds.bottom - height - 2, y));
      const area = obstacles.reduce((sum, r) => sum
        + Math.max(0, Math.min(left + width, r.right + 1) - Math.max(left, r.left - 1))
        * Math.max(0, Math.min(top + height, r.bottom + 1) - Math.max(top, r.top - 1)), 0);
      if (area < bestArea) { best = new DOMRect(left, top, width, height); bestArea = area; }
      if (!area) break;
    }
    if (!best) continue;
    caption.style.setProperty('--label-x', `${best.left + width / 2 - center}px`);
    caption.style.setProperty('--label-y', `${best.top - anchor.bottom + pin.clientTop}px`);
    obstacles.push(best);
  }
}

/** Decorate the existing pick targets. Every interaction still uses the captured scene action. */
export function updateVerbMarkers(pins: ReadonlyMap<string, HTMLElement>, objects: readonly SceneObjectView[]) {
  const fewTargets = objects.filter(object => object.verbTarget === 'available').length <= 3;
  let changed = false;
  for (const object of objects) {
    const pin = pins.get(object.id);
    if (!pin) continue;
    const target = object.verbTarget;
    let label = '';
    // A region may resolve to the entry anchor. Only the actual position gets
    // a Here marker; the full Scene list retains both original commands.
    const regionAlias = target === 'current' && object.actions[0]?.id.startsWith('walk-region:');
    if (pin.dataset['verbTarget'] !== (regionAlias ? undefined : target)) changed = true;
    if (!target || regionAlias) delete pin.dataset['verbTarget'];
    else pin.dataset['verbTarget'] = target;
    if (target === 'current') {
      pin.title = `${object.label} · You are here`;
    } else if (target === 'unavailable') {
      pin.title = `${object.label} · ${object.actions[0]?.unavailableReason ?? 'Unavailable for this verb'}`;
    } else {
      pin.title = object.label;
      if (target === 'available') {
        if (object.id.startsWith('exit:')) label = object.label.replace(/^(?:Walk (?:to|toward)|Return toward) (?:the )?/i, '');
        else if (fewTargets) label = object.label;
      }
    }
    let caption = pin.querySelector<HTMLElement>('.nq-verb-label');
    if (!label && caption) { caption.remove(); changed = true; }
    else if (label) {
      if (!caption) { caption = pin.ownerDocument.createElement('span'); caption.className = 'nq-verb-label'; pin.append(caption); }
      if (caption.textContent !== label) { caption.textContent = label; changed = true; }
    }
  }
  const layer = pins.values().next().value?.parentElement;
  if (changed && layer?.isConnected) fitVerbLabels(layer);
}
