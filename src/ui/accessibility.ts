// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

export function isEditingControl(target: Element): boolean {
  return !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"], [role="slider"]');
}

/** Leave modified keys, composition and a held key to their native owner. */
export function isPlainShortcut(event: KeyboardEvent, composing = false): boolean {
  return !event.defaultPrevented && !event.isComposing && !composing && event.keyCode !== 229
    && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/** Wrap only the ends of the browser's tab order. Native disclosures, including
 * the last summary in an inventory or evidence window, participate in both directions. */
export function containWindowTab(event: KeyboardEvent, window: HTMLElement): void {
  if (event.key !== 'Tab' || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
  const stops = [...window.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, details > summary:first-of-type, [tabindex]',
  )].filter(el => !el.matches(':disabled') && !el.closest('[inert], [hidden]') && !(el.hasAttribute('tabindex') && el.tabIndex < 0)
    && el.checkVisibility({ visibilityProperty: true }));
  const first = stops[0], last = stops.at(-1);
  const current = window.ownerDocument.activeElement;
  if (!first || !last) { event.preventDefault(); return; }
  if (event.shiftKey && (current === first || !stops.includes(current as HTMLElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (current === last || !window.contains(current))) {
    event.preventDefault();
    first.focus();
  }
}
