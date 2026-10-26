/**
 * @file The top drag strip (contract §5).
 *
 * The strip is a fixed height band at the very top of the document:
 *
 *   • `pointerdown`  → `zode.window.dragStart(screenX, screenY)`
 *   • `dblclick`     → `zode.window.toggleFillScreen()` (300 ms debounce)
 *
 * The page must never text-select while the pointer is on the strip, hence
 * `user-select: none` plus `preventDefault()` on both events.
 *
 * Controls that live *inside* the strip call `stopPropagation()` on their own
 * `pointerdown` listener, and are additionally marked with
 * `data-zode-drag-ignore` so the strip ignores them even if a control forgets
 * to stop the event.
 *
 * @module app/drag-zone
 */

import { DRAG_ZONE_HEIGHT } from '../bridge/contract.js';
import { createIcon } from './icons.js';
import { h } from '../util/dom.js';

/** Attribute that marks the strip, so native code and tests can find it. */
export const DRAG_ZONE_ATTRIBUTE = 'data-zode-drag-zone';

/** Attribute a control uses to opt out of the drag behaviour. */
export const DRAG_ZONE_IGNORE_ATTRIBUTE = 'data-zode-drag-ignore';

/** Debounce for the fill-screen toggle (contract §5 — 300 ms). */
export const DOUBLE_CLICK_DEBOUNCE_MS = 300;

/** How long after the second pointer press we still treat it as a double click. */
const POINTER_FALLBACK_MS = 60;

/** Maximum distance (px) between two presses for them to count as a double click. */
const POINTER_FALLBACK_DISTANCE = 8;

/**
 * Is the event target a control that opts out of the drag behaviour?
 *
 * @param {any} target
 * @returns {boolean}
 */
function isControlTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest(`[${DRAG_ZONE_IGNORE_ATTRIBUTE}]`));
}

/**
 * Create the drag strip.
 *
 * @param {object} options
 * @param {Document} options.doc
 * @param {any} options.zode the `window.zode` bridge
 * @param {HTMLElement} [options.host] where to insert the strip, defaults to `document.body`
 * @param {{onSearch?: () => void, onAgent?: () => void}} [options.actions] quick actions inside the strip
 * @returns {{el: HTMLElement, destroy: () => void, toggleFillScreen: () => void}}
 */
export function createDragZone({ doc, zode, host, actions = {} }) {
  const strip = h(doc, 'div', {
    class: 'zode-drag-zone',
    attrs: { [DRAG_ZONE_ATTRIBUTE]: 'true', 'aria-hidden': 'false' },
  });
  strip.style.setProperty('height', `var(--drag-zone-height, ${DRAG_ZONE_HEIGHT}px)`);
  // Belt and braces: the stylesheet says the same, but the strip must never
  // start a text selection or show a resize cursor (contract §5).
  strip.style.setProperty('user-select', 'none');
  strip.style.setProperty('-webkit-user-select', 'none');
  strip.style.setProperty('cursor', 'default');

  // ------------------------------------------------------------- wordmark
  const brand = h(doc, 'div', { class: 'zode-drag-brand' });
  brand.appendChild(h(doc, 'span', { class: 'u-bracket zode-drag-mark', text: '[' }));
  brand.appendChild(h(doc, 'span', { class: 'zode-drag-word', text: 'ZODE' }));
  brand.appendChild(h(doc, 'span', { class: 'u-bracket zode-drag-mark', text: ']' }));
  strip.appendChild(brand);

  const hint = h(doc, 'span', {
    class: 'zode-drag-hint',
    text: 'drag to move · double-click to fill',
  });
  strip.appendChild(h(doc, 'div', { class: 'zode-drag-spacer' }));
  strip.appendChild(hint);

  // -------------------------------------------------------- quick actions
  // Controls inside the strip must not start a window drag: they stop the
  // event themselves and are marked so the strip can ignore them.
  /**
   * @param {string} icon
   * @param {string} label
   * @param {() => void} onClick
   * @returns {HTMLElement}
   */
  const makeAction = (icon, label, onClick) => {
    const button = h(doc, 'button', {
      class: 'zode-drag-action',
      attrs: { type: 'button', [DRAG_ZONE_IGNORE_ATTRIBUTE]: 'true', 'aria-label': label, title: label },
    });
    button.appendChild(createIcon(doc, icon, { size: 14 }));
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  };

  if (actions.onSearch) {
    strip.appendChild(makeAction('search', 'Search (⌘F)', actions.onSearch));
  }
  if (actions.onAgent) {
    strip.appendChild(makeAction('agent', 'New agent task', actions.onAgent));
  }

  // ------------------------------------------------------------ behaviour
  /** @type {number} */
  let lastToggleAt = 0;
  /** @type {{time: number, x: number, y: number}|null} */
  let lastPress = null;
  /** @type {any} */
  let fallbackTimer = null;

  /**
   * Toggle "fill the screen" — guarded by the 300 ms debounce so that one
   * double click can never fire it twice.
   *
   * @returns {boolean} true when the toggle was actually fired
   */
  const requestToggle = () => {
    const now = Date.now();
    if (now - lastToggleAt < DOUBLE_CLICK_DEBOUNCE_MS) return false;
    lastToggleAt = now;
    try {
      const result = zode.window.toggleFillScreen();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* a shell that cannot fill the screen must not break the page */
    }
    return true;
  };

  const onPointerDown = (event) => {
    if (isControlTarget(event.target)) return;

    // Never start a text selection on the strip.
    event.preventDefault?.();

    const now = Date.now();
    const x = Number(event.screenX ?? 0);
    const y = Number(event.screenY ?? 0);
    const previous = lastPress;
    lastPress = { time: now, x, y };

    // A double click arrives as two presses; the `dblclick` event follows the
    // second one. This fallback only fires when the browser does not deliver
    // `dblclick` (it waits a moment so a real `dblclick` always wins).
    if (
      previous &&
      now - previous.time < DOUBLE_CLICK_DEBOUNCE_MS &&
      Math.abs(x - previous.x) <= POINTER_FALLBACK_DISTANCE &&
      Math.abs(y - previous.y) <= POINTER_FALLBACK_DISTANCE
    ) {
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        requestToggle();
      }, POINTER_FALLBACK_MS);
    }

    // Contract §5: the native shell performs a real window drag.
    zode.window.dragStart(x, y);
  };

  const onDblClick = (event) => {
    if (isControlTarget(event.target)) return;
    event.preventDefault?.();
    requestToggle();
  };

  strip.addEventListener('pointerdown', onPointerDown);
  strip.addEventListener('dblclick', onDblClick);

  const parent = host ?? doc.body ?? doc.documentElement;
  if (parent.firstChild) parent.insertBefore(strip, parent.firstChild);
  else parent.appendChild(strip);

  return {
    el: strip,
    toggleFillScreen: requestToggle,
    destroy() {
      strip.removeEventListener('pointerdown', onPointerDown);
      strip.removeEventListener('dblclick', onDblClick);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      if (strip.parentNode) strip.parentNode.removeChild(strip);
    },
  };
}
