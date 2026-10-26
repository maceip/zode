/**
 * @file The five views of the app.
 *
 * @module views/index
 */

import { createAgentView } from './agent.js';
import { createCollectionView } from './collection.js';
import { createLibraryView } from './library.js';
import { createNowPlayingView } from './now-playing.js';
import { createSearchView } from './search.js';

export { createAgentView, createCollectionView, createLibraryView, createNowPlayingView, createSearchView };

/**
 * @typedef {object} View
 * @property {string} id
 * @property {string} title
 * @property {HTMLElement} el
 * @property {() => void} [refresh]
 * @property {() => void} [destroy]
 */

/**
 * Create every view.
 *
 * @param {object} ctx
 * @returns {{list: View[], get: (id: string) => View|undefined}}
 */
export function createViews(ctx) {
  const list = [
    createNowPlayingView(ctx),
    createCollectionView(ctx),
    createLibraryView(ctx),
    createSearchView(ctx),
    createAgentView(ctx),
  ];
  const byId = new Map(list.map((view) => [view.id, view]));
  return {
    list,
    /** @param {string} id */
    get: (id) => byId.get(id),
  };
}
