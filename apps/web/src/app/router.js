/**
 * @file The view router.
 *
 * Five views, one visible at a time. The router also understands deep links
 * (`zode://view/collection`, `zode://collection/album/alb-03`).
 *
 * @module app/router
 */

import { VIEW_NAMES, isKnownView } from '../bridge/contract.js';

/**
 * @typedef {object} Route
 * @property {string} view one of the five view ids
 * @property {string|null} kind optional item kind (`album`, `artist`, …)
 * @property {string|null} id optional item id
 * @property {string|null} query optional search query
 * @property {string|null} prompt optional agent prompt
 */

/**
 * Parse a deep link into a route.
 *
 * Supported shapes:
 *   `zode://view/collection`          → { view: 'collection' }
 *   `zode://collection/album/alb-03`   → { view: 'collection', kind: 'album', id: 'alb-03' }
 *   `zode://search?q=harbour`         → { view: 'search', query: 'harbour' }
 *   `zode://agent/new?prompt=…`       → { view: 'agent', prompt: '…' }
 *
 * @param {string} raw
 * @returns {Route}
 */
export function parseDeepLink(raw) {
  /** @type {Route} */
  const route = { view: 'now-playing', kind: null, id: null, query: null, prompt: null };
  if (typeof raw !== 'string' || raw.trim() === '') return route;

  let rest = raw.trim();
  const queryIndex = rest.indexOf('?');
  let queryString = '';
  if (queryIndex >= 0) {
    queryString = rest.slice(queryIndex + 1);
    rest = rest.slice(0, queryIndex);
  }
  rest = rest.replace(/^zode:\/\//i, '').replace(/^\/+/, '');

  const parts = rest.split('/').filter(Boolean);
  const params = new URLSearchParams(queryString);

  if (parts[0] === 'view') {
    route.view = isKnownView(parts[1]) ? /** @type {string} */ (parts[1]) : 'now-playing';
  } else if (parts.length > 0) {
    route.view = isKnownView(parts[0]) ? /** @type {string} */ (parts[0]) : 'now-playing';
    route.kind = parts[1] ?? null;
    route.id = parts[2] ?? null;
  }

  if (params.has('q')) route.query = params.get('q');
  if (params.has('query')) route.query = params.get('query');
  if (params.has('prompt')) route.prompt = params.get('prompt');
  if (params.has('view') && isKnownView(params.get('view'))) {
    route.view = /** @type {string} */ (params.get('view'));
  }
  if (route.view === 'agent' && parts[1] === 'new' && !route.prompt) {
    route.prompt = '';
  }
  return route;
}

/**
 * Create the router.
 *
 * @param {object} [options]
 * @param {(route: Route) => void} [options.onChange]
 * @param {string} [options.initial]
 * @returns {{navigate: (view: string, params?: Partial<Route>) => void, current: Route, onChange: (fn: (route: Route) => void) => void, handleDeepLink: (url: string) => Route}}
 */
export function createRouter({ onChange, initial = 'now-playing' } = {}) {
  /** @type {Route} */
  let current = { view: isKnownView(initial) ? initial : 'now-playing', kind: null, id: null, query: null, prompt: null };
  /** @type {Set<(route: Route) => void>} */
  const listeners = new Set();
  if (onChange) listeners.add(onChange);

  /**
   * @param {string} view
   * @param {Partial<Route>} [params]
   * @returns {void}
   */
  const navigate = (view, params = {}) => {
    const next = {
      view: isKnownView(view) ? view : current.view,
      kind: params.kind ?? null,
      id: params.id ?? null,
      query: params.query ?? null,
      prompt: params.prompt ?? null,
    };
    current = next;
    for (const listener of [...listeners]) {
      try {
        listener(next);
      } catch (error) {
        console.error('[zode] router listener threw', error);
      }
    }
  };

  return {
    navigate,
    get current() {
      return current;
    },
    /**
     * @param {(route: Route) => void} fn
     * @returns {() => void} unsubscribe
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /**
     * @param {string} url
     * @returns {Route} the route that was taken
     */
    handleDeepLink(url) {
      const route = parseDeepLink(url);
      navigate(route.view, route);
      return route;
    },
  };
}

/** The view ids, re-exported for convenience. */
export { VIEW_NAMES };
