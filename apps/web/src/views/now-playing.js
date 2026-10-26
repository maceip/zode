/**
 * @file The Now Playing view.
 *
 * A large square Metro tile of album art, a big light-weight title, a
 * horizontal scrubber and a transport row — the Zune's "now playing" screen
 * rebuilt with Metro geometry.
 *
 * @module views/now-playing
 */

import { albumArt, formatDuration, formatRemaining, getAlbum } from '../data/library.js';
import { createIcon } from '../app/icons.js';
import { h, replaceChildren } from '../util/dom.js';

/**
 * @param {object} ctx
 * @param {Document} ctx.doc
 * @param {any} ctx.zode
 * @param {any} ctx.player
 * @returns {{id: string, title: string, el: HTMLElement, refresh: () => void}}
 */
export function createNowPlayingView(ctx) {
  const { doc, player } = ctx;

  const el = h(doc, 'section', { class: 'view view-now-playing', attrs: { 'data-view': 'now-playing' } });

  const art = h(doc, 'div', { class: 'np-art u-tile' });
  const artLabel = h(doc, 'div', { class: 'np-art-label u-label' });

  const title = h(doc, 'h1', { class: 'np-title u-display' });
  const artist = h(doc, 'p', { class: 'np-artist u-subtitle' });
  const albumLine = h(doc, 'p', { class: 'np-album u-label' });

  // -------------------------------------------------------------- scrubber
  const scrubber = h(doc, 'div', {
    class: 'np-scrubber',
    attrs: { role: 'slider', 'aria-label': 'Playback position', tabindex: '0' },
  });
  const scrubberTrack = h(doc, 'div', { class: 'np-scrubber-track' });
  const scrubberFill = h(doc, 'div', { class: 'np-scrubber-fill' });
  const scrubberHandle = h(doc, 'div', { class: 'np-scrubber-handle' });
  scrubberTrack.appendChild(scrubberFill);
  scrubberTrack.appendChild(scrubberHandle);
  scrubber.appendChild(scrubberTrack);

  const elapsed = h(doc, 'span', { class: 'np-time u-mono', text: '0:00' });
  const remaining = h(doc, 'span', { class: 'np-time u-mono', text: '-0:00' });
  const times = h(doc, 'div', { class: 'np-times' });
  times.appendChild(elapsed);
  times.appendChild(remaining);

  // -------------------------------------------------------------- transport
  const transport = h(doc, 'div', { class: 'np-transport' });

  /**
   * @param {string} icon
   * @param {string} label
   * @param {() => void} onClick
   * @returns {HTMLElement}
   */
  const makeButton = (icon, label, onClick) => {
    const button = h(doc, 'button', {
      class: 'np-button',
      attrs: { type: 'button', 'aria-label': label, title: label },
    });
    button.appendChild(createIcon(doc, icon, { size: 22 }));
    button.addEventListener('click', onClick);
    return button;
  };

  const previousButton = makeButton('previous', 'Previous', () => player.previous());
  const playButton = makeButton('play', 'Play', () => player.toggle());
  const nextButton = makeButton('next', 'Next', () => player.next());
  playButton.classList.add('np-button-primary');

  transport.appendChild(previousButton);
  transport.appendChild(playButton);
  transport.appendChild(nextButton);

  const upNext = h(doc, 'p', { class: 'np-upnext u-label' });

  // ---------------------------------------------------------------- layout
  const info = h(doc, 'div', { class: 'np-info' });
  info.appendChild(title);
  info.appendChild(artist);
  info.appendChild(albumLine);
  info.appendChild(scrubber);
  info.appendChild(times);
  info.appendChild(transport);
  info.appendChild(upNext);

  const artColumn = h(doc, 'div', { class: 'np-art-column' });
  artColumn.appendChild(art);
  artColumn.appendChild(artLabel);

  el.appendChild(artColumn);
  el.appendChild(info);

  // ------------------------------------------------------------ behaviour
  const refresh = () => {
    const track = player.currentTrack;
    if (!track) return;
    const album = getAlbum(track.albumId);
    title.textContent = track.title;
    artist.textContent = track.artistName;
    albumLine.textContent = album ? `${album.title} · ${album.year}` : '';
    art.style.setProperty('background', album ? albumArt(album) : 'var(--zode-ink-3)');
    artLabel.textContent = album ? album.title : '';

    const duration = track.duration ?? 0;
    const position = Math.min(player.state.elapsed, duration);
    const ratio = duration > 0 ? position / duration : 0;
    scrubberFill.style.setProperty('width', `${(ratio * 100).toFixed(2)}%`);
    scrubberHandle.style.setProperty('left', `${(ratio * 100).toFixed(2)}%`);
    elapsed.textContent = formatDuration(position);
    remaining.textContent = formatRemaining(Math.max(0, duration - position));
    scrubber.setAttribute('aria-valuenow', String(Math.round(position)));
    scrubber.setAttribute('aria-valuemax', String(Math.round(duration)));

    const playing = player.state.playing;
    replaceChildren(playButton, [createIcon(doc, playing ? 'pause' : 'play', { size: 22 })]);
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    el.classList.toggle('is-playing', playing);
  };

  /**
   * Seek by clicking (or dragging) the scrubber.
   *
   * @param {PointerEvent} event
   * @returns {void}
   */
  const onScrub = (event) => {
    const track = player.currentTrack;
    if (!track) return;
    const rect = scrubberTrack.getBoundingClientRect?.();
    if (!rect || !rect.width) return;
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    player.seek(ratio * track.duration);
  };

  scrubber.addEventListener('pointerdown', (event) => {
    event.preventDefault?.();
    onScrub(event);
    const move = (moveEvent) => onScrub(moveEvent);
    const up = () => {
      globalThis.removeEventListener?.('pointermove', move);
      globalThis.removeEventListener?.('pointerup', up);
    };
    globalThis.addEventListener?.('pointermove', move);
    globalThis.addEventListener?.('pointerup', up);
  });

  scrubber.addEventListener('keydown', (event) => {
    const track = player.currentTrack;
    if (!track) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault?.();
      player.seek(player.state.elapsed + 5);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault?.();
      player.seek(player.state.elapsed - 5);
    }
  });

  player.subscribe(refresh);
  refresh();

  return { id: 'now-playing', title: 'Now Playing', el, refresh };
}
