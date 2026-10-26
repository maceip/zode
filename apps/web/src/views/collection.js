/**
 * @file The Collection view.
 *
 * Horizontal Metro carousels: square album tiles, flat playlist tiles and
 * artist tiles, each under an uppercase tracked section label.
 *
 * @module views/collection
 */

import {
  ALBUMS,
  ARTISTS,
  PLAYLISTS,
  RECENTLY_PLAYED_ALBUM_IDS,
  albumArt,
  artistArt,
  getAlbum,
  playlistArt,
} from '../data/library.js';
import { createIcon } from '../app/icons.js';
import { h } from '../util/dom.js';

/**
 * @param {object} ctx
 * @param {Document} ctx.doc
 * @param {any} ctx.player
 * @param {any} ctx.router
 * @returns {{id: string, title: string, el: HTMLElement}}
 */
export function createCollectionView(ctx) {
  const { doc, player, router } = ctx;
  const el = h(doc, 'section', { class: 'view view-collection', attrs: { 'data-view': 'collection' } });

  /**
   * A section header in the uppercase tracked label style.
   *
   * @param {string} label
   * @param {string} [note]
   * @returns {HTMLElement}
   */
  const header = (label, note) => {
    const node = h(doc, 'div', { class: 'collection-header' });
    node.appendChild(h(doc, 'h2', { class: 'u-label', text: label }));
    if (note) node.appendChild(h(doc, 'span', { class: 'collection-note u-label', text: note }));
    return node;
  };

  /**
   * A horizontally scrolling row of tiles.
   *
   * @param {HTMLElement[]} tiles
   * @returns {HTMLElement}
   */
  const row = (tiles) => {
    const scroller = h(doc, 'div', { class: 'collection-row' });
    for (const tile of tiles) scroller.appendChild(tile);
    return scroller;
  };

  // ------------------------------------------------------------- albums
  /**
   * @param {string} albumId
   * @returns {HTMLElement}
   */
  const albumTile = (albumId) => {
    const album = getAlbum(albumId);
    if (!album) return h(doc, 'div');
    const tile = h(doc, 'button', {
      class: 'collection-tile',
      attrs: { type: 'button', 'data-album': album.id },
    });
    const art = h(doc, 'div', { class: 'collection-art u-tile' });
    art.style.setProperty('background', albumArt(album));
    tile.appendChild(art);
    tile.appendChild(h(doc, 'span', { class: 'collection-title', text: album.title }));
    tile.appendChild(h(doc, 'span', { class: 'collection-sub u-label', text: album.artistName }));
    tile.addEventListener('click', () => {
      const first = album.trackIds[0];
      if (first) player.select(first);
      router.navigate('now-playing');
    });
    return tile;
  };

  const recently = h(doc, 'div', { class: 'collection-section' });
  recently.appendChild(header('Recently played', `${RECENTLY_PLAYED_ALBUM_IDS.length} albums`));
  recently.appendChild(row(RECENTLY_PLAYED_ALBUM_IDS.map(albumTile)));

  const albums = h(doc, 'div', { class: 'collection-section' });
  albums.appendChild(header('Albums', `${ALBUMS.length} in the library`));
  albums.appendChild(row(ALBUMS.map((album) => albumTile(album.id))));

  // ---------------------------------------------------------- playlists
  const playlistTile = (playlist) => {
    const tile = h(doc, 'button', {
      class: 'collection-tile',
      attrs: { type: 'button', 'data-playlist': playlist.id },
    });
    const art = h(doc, 'div', { class: 'collection-art u-tile' });
    art.style.setProperty('background', playlistArt(playlist));
    art.appendChild(createIcon(doc, 'library', { size: 22 }));
    art.classList.add('collection-art-glyph');
    tile.appendChild(art);
    tile.appendChild(h(doc, 'span', { class: 'collection-title', text: playlist.title }));
    tile.appendChild(h(doc, 'span', { class: 'collection-sub u-label', text: `${playlist.trackIds.length} tracks` }));
    tile.addEventListener('click', () => {
      const first = playlist.trackIds[0];
      if (first) player.select(first);
      router.navigate('now-playing');
    });
    return tile;
  };

  const playlists = h(doc, 'div', { class: 'collection-section' });
  playlists.appendChild(header('Playlists'));
  playlists.appendChild(row(PLAYLISTS.map(playlistTile)));

  // ------------------------------------------------------------ artists
  const artistTile = (artist) => {
    const tile = h(doc, 'button', {
      class: 'collection-tile collection-tile-artist',
      attrs: { type: 'button', 'data-artist': artist.id },
    });
    const art = h(doc, 'div', { class: 'collection-art u-tile' });
    art.style.setProperty('background', artistArt(artist));
    art.appendChild(h(doc, 'span', { class: 'collection-initial', text: artist.name.slice(0, 1).toUpperCase() }));
    art.classList.add('collection-art-glyph');
    tile.appendChild(art);
    tile.appendChild(h(doc, 'span', { class: 'collection-title', text: artist.name }));
    tile.appendChild(h(doc, 'span', { class: 'collection-sub u-label', text: artist.genre }));
    tile.addEventListener('click', () => {
      router.navigate('library');
    });
    return tile;
  };

  const artists = h(doc, 'div', { class: 'collection-section' });
  artists.appendChild(header('Artists', `${ARTISTS.length} artists`));
  artists.appendChild(row(ARTISTS.map(artistTile)));

  el.appendChild(recently);
  el.appendChild(albums);
  el.appendChild(playlists);
  el.appendChild(artists);

  return { id: 'collection', title: 'Collection', el };
}
