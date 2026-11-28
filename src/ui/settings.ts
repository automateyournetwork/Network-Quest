// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { PresentationSettings } from '../state/types';
import './styles/accessibility.css';

/** One set of native controls moves between Settings and Sound and reading. */
export function createPresentationControls(doc: Document, actions: {
  preview(patch: Partial<PresentationSettings>): void;
  change(patch: Partial<PresentationSettings>): void;
  reload(): void;
}) {
  const abort = new AbortController(), listener = { signal: abort.signal };
  const group = doc.createElement('fieldset'), legend = doc.createElement('legend');
  group.className = 'nq-presentation-settings';
  legend.textContent = 'Audio levels and reading preferences';
  group.append(legend);
  const ranges = ([
    ['musicVolume', 'Music volume'], ['effectsVolume', 'Effects volume'],
    ['voiceVolume', 'Voice volume'], ['textScale', 'Text size'],
  ] as const).map(([key, title]) => {
    const label = doc.createElement('label'), slider = doc.createElement('input'), value = doc.createElement('span');
    slider.type = 'range'; slider.min = key === 'textScale' ? '1' : '0';
    slider.max = key === 'textScale' ? '2' : '1';
    // The preference API accepts the full numeric range. Preserve previously saved fractions.
    slider.step = 'any'; slider.setAttribute('aria-label', title);
    value.setAttribute('aria-hidden', 'true');
    const describe = () => {
      value.textContent = `${Math.round(slider.valueAsNumber * 100)}%`;
      slider.setAttribute('aria-valuetext', value.textContent);
    };
    slider.addEventListener('input', () => { describe(); actions.preview({ [key]: slider.valueAsNumber }); }, listener);
    slider.addEventListener('change', () => actions.change({ [key]: slider.valueAsNumber }), listener);
    label.append(title, slider, value); group.append(label);
    return { key, slider, describe };
  });
  const captionLabel = doc.createElement('label'), captions = doc.createElement('input');
  captions.type = 'checkbox'; captionLabel.append(captions, 'Show sound captions'); group.append(captionLabel);
  captions.addEventListener('change', () => actions.change({ captions: captions.checked }), listener);
  const motionLabel = doc.createElement('label'), motion = doc.createElement('select');
  motion.setAttribute('aria-label', 'Reduced motion');
  for (const [value, name] of [['system', 'Follow system'], ['on', 'On'], ['off', 'Off']] as const) {
    const option = doc.createElement('option'); option.value = value; option.textContent = name; motion.append(option);
  }
  motionLabel.append('Reduced motion', motion); group.append(motionLabel);
  motion.addEventListener('change', () => actions.change({ reducedMotion: motion.value as PresentationSettings['reducedMotion'] }), listener);

  const status = doc.createElement('p'), reload = doc.createElement('button');
  status.className = 'nq-media-preferences-status'; status.setAttribute('role', 'status');
  reload.type = 'button'; reload.textContent = 'Reload account presentation preferences';
  reload.addEventListener('click', actions.reload, listener);
  group.append(status, reload);
  type Control = HTMLInputElement | HTMLSelectElement | HTMLButtonElement;
  function lock(control: Control, unavailable: boolean) {
    // A native disabled input drops keyboard focus during the PATCH. Keep the
    // active control in place until the response, while rejecting further edits.
    const retainFocus = unavailable && doc.activeElement === control;
    control.disabled = unavailable && !retainFocus;
    if (retainFocus) control.setAttribute('aria-disabled', 'true');
    else control.removeAttribute('aria-disabled');
  }
  const guard = (event: Event) => {
    if (event instanceof KeyboardEvent && (event.key === 'Tab' || event.key === 'Escape')) return;
    if (event.target instanceof Element && event.target.closest('[aria-disabled="true"]')) event.preventDefault();
  };
  for (const type of ['keydown', 'pointerdown', 'click', 'wheel']) {
    group.addEventListener(type, guard, { ...listener, capture: true, passive: false });
  }
  return {
    render(host: HTMLElement, settings: PresentationSettings, message: string, account: { authenticated: boolean; busy: boolean; reviewRequired: boolean }) {
      if (group.parentElement !== host) host.append(group);
      const locked = account.busy || account.reviewRequired;
      for (const { key, slider, describe } of ranges) {
        lock(slider, locked);
        if (slider.valueAsNumber !== settings[key]) slider.value = String(settings[key]);
        describe();
      }
      lock(captions, locked); captions.checked = settings.captions;
      lock(motion, locked); motion.value = settings.reducedMotion;
      if (status.textContent !== message) status.textContent = message;
      reload.hidden = !account.authenticated; lock(reload, account.busy);
    },
    dispose() { abort.abort(); group.remove(); },
  };
}
