/**
 * @file The Metro icon set.
 *
 * Every icon is a flat, geometric SVG drawn in a 16×16 box — big square tiles
 * with no chrome, exactly like the Metro shell of Windows 8.
 *
 * @module app/icons
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {object} IconShape
 * @property {string} d path data
 * @property {boolean} [fill] fill the shape instead of stroking it
 */

/**
 * @type {Record<string, IconShape[]>}
 */
export const ICONS = {
  'now-playing': [{ d: 'M4.5 2.5 L12.5 8 L4.5 13.5 Z', fill: true }],
  collection: [
    { d: 'M2 2 H7.5 V7.5 H2 Z', fill: true },
    { d: 'M8.5 2 H14 V7.5 H8.5 Z', fill: true },
    { d: 'M2 8.5 H7.5 V14 H2 Z', fill: true },
    { d: 'M8.5 8.5 H14 V14 H8.5 Z', fill: true },
  ],
  library: [
    { d: 'M1.5 2.5 H14.5 V4 H1.5 Z', fill: true },
    { d: 'M1.5 6.5 H14.5 V8 H1.5 Z', fill: true },
    { d: 'M1.5 10.5 H14.5 V12 H1.5 Z', fill: true },
  ],
  search: [
    { d: 'M6.6 1.5 A5.1 5.1 0 1 0 6.6 11.7 A5.1 5.1 0 0 0 6.6 1.5 Z' },
    { d: 'M10.4 10.4 L14.4 14.4' },
  ],
  agent: [{ d: 'M8 0.8 L9.4 6 L14.2 7.4 L9.4 8.8 L8 14 L6.6 8.8 L1.8 7.4 L6.6 6 Z', fill: true }],
  play: [{ d: 'M4 2 L13 8 L4 14 Z', fill: true }],
  pause: [
    { d: 'M4 2 H6.6 V14 H4 Z', fill: true },
    { d: 'M9.4 2 H12 V14 H9.4 Z', fill: true },
  ],
  previous: [
    { d: 'M3 2 H5 V14 H3 Z', fill: true },
    { d: 'M13 2 L5.5 8 L13 14 Z', fill: true },
  ],
  next: [
    { d: 'M11 2 H13 V14 H11 Z', fill: true },
    { d: 'M3 2 L10.5 8 L3 14 Z', fill: true },
  ],
  attach: [
    { d: 'M11.5 2.5 L6 8 A2 2 0 0 0 8.8 10.8 L13 6.6' },
    { d: 'M3 13 H13' },
  ],
  stop: [{ d: 'M3 3 H13 V13 H3 Z', fill: true }],
  send: [{ d: 'M1.5 8 L14.5 2 L9.5 14.5 L7.5 9.5 Z', fill: true }],
};

/**
 * Build an icon element.
 *
 * @param {Document} doc
 * @param {string} name key of {@link ICONS}
 * @param {{size?: number, className?: string}} [options]
 * @returns {SVGElement}
 */
export function createIcon(doc, name, { size = 20, className = 'icon' } = {}) {
  const shapes = ICONS[name] ?? ICONS.collection;
  const svg = /** @type {any} */ (doc.createElementNS(SVG_NS, 'svg'));
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);
  for (const shape of shapes) {
    const path = /** @type {any} */ (doc.createElementNS(SVG_NS, 'path'));
    path.setAttribute('d', shape.d);
    if (shape.fill) {
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('stroke', 'none');
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'square');
    }
    svg.appendChild(path);
  }
  return svg;
}
