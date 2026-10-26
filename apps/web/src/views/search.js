/**
 * @file The Search view.
 *
 * A search field plus results grouped by kind: track, album, artist,
 * playlist, task, file and action.
 *
 * The query is sent through the bridge (`zode.search`), so a native shell can
 * answer with its own system index (Spotlight / Windows Search) while the
 * browser falls back to the in-memory library.
 *
 * @module views/search
 */

import { SEARCH_RESULT_KINDS } from '../bridge/contract.js';
import { h } from '../util/dom.js';

/**
 * The label of every result group, in the order they are shown.
 * @type {Record<string, string>}
 */
export const GROUP_LABELS = {
  action: 'Actions',
  track: 'Tracks',
  album: 'Albums',
  artist: 'Artists',
  playlist: 'Playlists',
  task: 'Agent tasks',
  file: 'Files',
};

/**
 * @param {object} ctx
 * @param {Document} ctx.doc
 * @param {any} ctx.zode
 * @param {any} ctx.player
 * @param {any} ctx.router
 * @param {any} ctx.agent
 * @param {() => any[]} [ctx.getAttachments]
 * @returns {{id: string, title: string, el: HTMLElement, setQuery: (query: string) => void, run: (query: string) => Promise<void>, focus: () => void}}
 */
export function createSearchView(ctx) {
  const { doc, zode, player, router, agent } = ctx;
  const getAttachments = ctx.getAttachments ?? (() => []);

  const el = h(doc, 'section', { class: 'view view-search', attrs: { 'data-view': 'search' } });

  // --------------------------------------------------------------- field
  const field = h(doc, 'div', { class: 'search-field' });
  const input = h(doc, 'input', {
    class: 'search-input',
    attrs: {
      type: 'search',
      placeholder: 'Search tracks, albums, artists…',
      'aria-label': 'Search',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });
  field.appendChild(input);

  const status = h(doc, 'p', { class: 'search-status u-label', text: 'Type to search the library' });

  const results = h(doc, 'div', { class: 'search-results' });

  el.appendChild(field);
  el.appendChild(status);
  el.appendChild(results);

  // -------------------------------------------------------------- actions
  /**
   * The app level actions the search can offer.
   * @type {{id: string, title: string, run: () => void}[]}
   */
  const actions = [
    { id: 'action.play-all', title: 'Play everything', run: () => player.play() },
    { id: 'action.shuffle', title: 'Shuffle the library', run: () => player.next() },
    { id: 'action.collection', title: 'Open the collection', run: () => router.navigate('collection') },
    { id: 'action.library', title: 'Open the library', run: () => router.navigate('library') },
    {
      id: 'action.agent',
      title: 'Ask the agent',
      run: () => {
        router.navigate('agent');
      },
    },
  ];

  /**
   * Local results the shell index does not know about.
   *
   * @param {string} needle
   * @returns {any[]}
   */
  const localResults = (needle) => {
    /** @type {any[]} */
    const found = [];

    for (const action of actions) {
      if (action.title.toLowerCase().includes(needle) || action.id.includes(needle)) {
        found.push({ id: action.id, title: action.title, kind: 'action', payload: { id: action.id } });
      }
    }

    for (const task of agent?.tasks ?? []) {
      if (task.prompt.toLowerCase().includes(needle)) {
        found.push({
          id: task.id,
          title: task.prompt,
          subtitle: task.state,
          kind: 'task',
          payload: { id: task.id },
        });
      }
    }

    for (const attachment of getAttachments()) {
      if (String(attachment.name).toLowerCase().includes(needle)) {
        found.push({
          id: attachment.id,
          title: attachment.name,
          subtitle: attachment.source,
          kind: 'file',
          payload: { id: attachment.id },
        });
      }
    }

    return found;
  };

  // ------------------------------------------------------------- rendering
  /**
   * @param {any} result
   * @returns {HTMLElement}
   */
  const resultRow = (result) => {
    const row = h(doc, 'button', {
      class: 'search-row',
      attrs: { type: 'button', 'data-kind': result.kind, 'data-id': result.id },
    });
    row.appendChild(h(doc, 'span', { class: 'search-row-kind u-label', text: result.kind }));
    row.appendChild(h(doc, 'span', { class: 'search-row-title', text: result.title }));
    if (result.subtitle) {
      row.appendChild(h(doc, 'span', { class: 'search-row-sub u-label', text: result.subtitle }));
    }
    row.addEventListener('click', () => {
      if (result.kind === 'track') {
        player.select(result.id);
        router.navigate('now-playing');
      } else if (result.kind === 'action') {
        const action = actions.find((candidate) => candidate.id === result.id);
        if (action) action.run();
      }
    });
    return row;
  };

  /**
   * @param {any[]} all
   * @returns {void}
   */
  const render = (all) => {
    while (results.firstChild) results.removeChild(results.firstChild);

    const groups = new Map();
    for (const result of all) {
      const kind = SEARCH_RESULT_KINDS.includes(result.kind) ? result.kind : 'action';
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(result);
    }

    if (groups.size === 0) {
      results.appendChild(h(doc, 'p', { class: 'search-empty u-body', text: 'Nothing found.' }));
      return;
    }

    for (const kind of SEARCH_RESULT_KINDS) {
      const group = groups.get(kind);
      if (!group || group.length === 0) continue;
      const section = h(doc, 'div', { class: 'search-group' });
      section.appendChild(
        h(doc, 'h3', { class: 'u-label', text: GROUP_LABELS[kind] ?? kind }),
      );
      const list = h(doc, 'div', { class: 'search-group-list' });
      for (const result of group) list.appendChild(resultRow(result));
      section.appendChild(list);
      results.appendChild(section);
    }
  };

  // ------------------------------------------------------------- behaviour
  /**
   * @param {string} query
   * @returns {Promise<void>}
   */
  const run = async (query) => {
    const needle = String(query ?? '').trim();
    if (!needle) {
      status.textContent = 'Type to search the library';
      render([]);
      return;
    }
    status.textContent = 'Searching…';
    let shellResults = [];
    try {
      shellResults = await zode.search(needle);
    } catch {
      shellResults = [];
    }
    const merged = [...shellResults];
    for (const local of localResults(needle.toLowerCase())) {
      if (!merged.some((existing) => existing.id === local.id && existing.kind === local.kind)) {
        merged.push(local);
      }
    }
    render(merged);
    status.textContent = `${merged.length} result${merged.length === 1 ? '' : 's'}`;
  };

  /** @type {any} */
  let debounce = null;
  input.addEventListener('input', () => {
    if (debounce !== null) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      run(input.value);
    }, 120);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault?.();
      if (debounce !== null) clearTimeout(debounce);
      debounce = null;
      run(input.value);
    }
  });

  /**
   * @param {string} query
   * @returns {void}
   */
  const setQuery = (query) => {
    input.value = String(query ?? '');
    run(input.value);
  };

  return { id: 'search', title: 'Search', el, setQuery, run, focus: () => input.focus?.() };
}
