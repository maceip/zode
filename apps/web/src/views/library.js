/**
 * @file The Library view.
 *
 * A dense two-column list of every track: index number on the left, title and
 * artist in the middle, duration hard right.
 *
 * @module views/library
 */

import { TRACKS, formatDuration } from '../data/library.js';
import { h } from '../util/dom.js';

/**
 * @param {object} ctx
 * @param {Document} ctx.doc
 * @param {any} ctx.player
 * @param {any} ctx.router
 * @returns {{id: string, title: string, el: HTMLElement, refresh: () => void}}
 */
export function createLibraryView(ctx) {
  const { doc, player, router } = ctx;
  const el = h(doc, 'section', { class: 'view view-library', attrs: { 'data-view': 'library' } });

  const head = h(doc, 'div', { class: 'library-header' });
  head.appendChild(h(doc, 'h2', { class: 'u-label', text: 'All tracks' }));
  head.appendChild(
    h(doc, 'span', {
      class: 'library-count u-label',
      text: `${TRACKS.length} tracks · ${TRACKS.reduce((sum, track) => sum + track.duration, 0) / 60 | 0} min`,
    }),
  );

  const grid = h(doc, 'div', { class: 'library-grid' });
  const left = h(doc, 'ol', { class: 'library-column' });
  const right = h(doc, 'ol', { class: 'library-column' });

  /** @type {Map<string, HTMLElement>} */
  const rows = new Map();

  TRACKS.forEach((track, index) => {
    const row = h(doc, 'li', {
      class: 'library-row',
      attrs: { 'data-track': track.id, role: 'button', tabindex: '0' },
    });
    row.appendChild(
      h(doc, 'span', { class: 'library-index u-mono', text: String(index + 1).padStart(2, '0') }),
    );
    const main = h(doc, 'span', { class: 'library-main' });
    main.appendChild(h(doc, 'span', { class: 'library-title', text: track.title }));
    main.appendChild(
      h(doc, 'span', { class: 'library-sub u-label', text: `${track.artistName} — ${track.albumTitle}` }),
    );
    row.appendChild(main);
    row.appendChild(
      h(doc, 'span', { class: 'library-duration u-mono', text: formatDuration(track.duration) }),
    );
    row.addEventListener('click', () => {
      player.select(track.id);
      router.navigate('now-playing');
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault?.();
        player.select(track.id);
        router.navigate('now-playing');
      }
    });
    rows.set(track.id, row);
    (index % 2 === 0 ? left : right).appendChild(row);
  });

  grid.appendChild(left);
  grid.appendChild(right);

  el.appendChild(head);
  el.appendChild(grid);

  const refresh = () => {
    const currentId = player.state.trackId;
    for (const [trackId, row] of rows) {
      row.classList.toggle('is-current', trackId === currentId);
    }
  };

  player.subscribe(refresh);
  refresh();

  return { id: 'library', title: 'Library', el, refresh };
}
