/**
 * @file The Metro left rail.
 *
 * A column of large, flat, square icon tiles — no chrome, no borders, no
 * rounded corners. The active tile is filled with the Zune orange.
 *
 * @module app/rail
 */

import { createIcon } from './icons.js';
import { h } from '../util/dom.js';

/**
 * @typedef {object} RailItem
 * @property {string} id view id
 * @property {string} label
 * @property {string} icon key of the icon set
 */

/**
 * The five views of the app (contract §4, `zode.show`).
 * @type {RailItem[]}
 */
export const RAIL_ITEMS = [
  { id: 'now-playing', label: 'Now Playing', icon: 'now-playing' },
  { id: 'collection', label: 'Collection', icon: 'collection' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'agent', label: 'Agent', icon: 'agent' },
];

/**
 * Create the rail.
 *
 * @param {object} options
 * @param {Document} options.doc
 * @param {(id: string) => void} [options.onSelect]
 * @param {RailItem[]} [options.items]
 * @returns {{el: HTMLElement, setActive: (id: string) => void, items: RailItem[]}}
 */
export function createRail({ doc, onSelect, items = RAIL_ITEMS }) {
  const nav = h(doc, 'nav', {
    class: 'zode-rail',
    attrs: { 'aria-label': 'Views', role: 'tablist' },
  });

  /** @type {Map<string, HTMLElement>} */
  const tiles = new Map();

  for (const item of items) {
    const tile = h(doc, 'button', {
      class: 'zode-rail-tile',
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-label': item.label,
        'data-view': item.id,
        title: item.label,
      },
    });
    tile.appendChild(createIcon(doc, item.icon, { size: 26 }));
    tile.appendChild(h(doc, 'span', { class: 'zode-rail-label', text: item.label }));
    tile.addEventListener('click', () => {
      if (onSelect) onSelect(item.id);
    });
    nav.appendChild(tile);
    tiles.set(item.id, tile);
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  const setActive = (id) => {
    for (const [viewId, tile] of tiles) {
      const active = viewId === id;
      tile.setAttribute('aria-current', active ? 'true' : 'false');
      tile.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  };

  return { el: nav, setActive, items };
}
