/**
 * @file The seeded Zode library.
 *
 * Everything in here is deterministic: the same tracks, the same durations and
 * the same order on every machine, so screenshots and tests are stable.
 *
 * @module data/library
 */

/**
 * @typedef {object} Track
 * @property {string} id
 * @property {string} title
 * @property {string} albumId
 * @property {string} albumTitle
 * @property {string} artistId
 * @property {string} artistName
 * @property {number} duration seconds
 * @property {number} trackNumber
 * @property {number} year
 */

/**
 * @typedef {object} Album
 * @property {string} id
 * @property {string} title
 * @property {string} artistId
 * @property {string} artistName
 * @property {number} year
 * @property {string} genre
 * @property {string[]} trackIds
 */

/**
 * @typedef {object} Artist
 * @property {string} id
 * @property {string} name
 * @property {string} genre
 * @property {string[]} albumIds
 */

/**
 * @typedef {object} Playlist
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string[]} trackIds
 */

/**
 * @typedef {object} SearchResult
 * @property {string} id
 * @property {string} title
 * @property {string} [subtitle]
 * @property {'track'|'album'|'artist'|'playlist'|'task'|'file'|'action'} kind
 * @property {Record<string, unknown>} [payload]
 */

/**
 * A tiny deterministic PRNG (mulberry32). Same seed → same sequence, on every
 * platform and every run.
 *
 * @param {number} seed
 * @returns {() => number} values in [0, 1)
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The one and only seed. Change it and every screenshot changes with it. */
export const LIBRARY_SEED = 0x5a4f4445; // "ZODE"

/**
 * The raw catalogue. Track titles are authored (so the library reads like a
 * real record shop); durations are generated from the seeded PRNG.
 */
const CATALOGUE = [
  {
    artist: 'Neon Harbour',
    album: 'Coastal Static',
    year: 2007,
    genre: 'Indie Rock',
    tracks: ['Low Tide Radio', 'Harbour Lights', 'Ferry Song', 'Salt and Static', 'North Pier'],
  },
  {
    artist: 'Violet Meridian',
    album: 'Meridian',
    year: 2008,
    genre: 'Dream Pop',
    tracks: ['Longitude', 'Violet Hour', 'Slow Orbit', 'Cassette Sky', 'Meridian', 'Nightbus'],
  },
  {
    artist: 'Small Hours',
    album: 'Small Hours',
    year: 2009,
    genre: 'Folktronica',
    tracks: ['Three in the Morning', 'Kettle', 'Paper Route', 'Blue Hour'],
  },
  {
    artist: 'The Copper Lines',
    album: 'Copper & Rust',
    year: 2007,
    genre: 'Post Punk',
    tracks: ['Oxide', 'Tin Roof', 'Rust Belt Radio', 'Cold Joint', 'Copper Wire'],
  },
  {
    artist: 'Ada Lune',
    album: 'Lune',
    year: 2010,
    genre: 'Folk',
    tracks: ['Aubade', 'Half Past Four', 'Paper Moon', 'Lune', 'Winter Count'],
  },
  {
    artist: 'Polaroid Youth Club',
    album: 'Polaroid Season',
    year: 2009,
    genre: 'Indie Pop',
    tracks: ['Flashbulb', 'Disposable', 'Kodak', 'Sugar Rush', 'Picture Show'],
  },
  {
    artist: 'Fathom Field',
    album: 'Fathom',
    year: 2008,
    genre: 'Ambient',
    tracks: ['Soundings', 'Bathymetry', 'Deep Field', 'Sonar'],
  },
  {
    artist: 'Mira Sound System',
    album: 'Mira',
    year: 2011,
    genre: 'Electronic',
    tracks: ['System', 'Nightbus 2', 'Telemetry', 'Aurora Machine', 'Mira', 'Signal Lost'],
  },
  {
    artist: 'Harbour Static',
    album: 'Harbour Static',
    year: 2006,
    genre: 'Ambient Dub',
    tracks: ['Static Harbour', 'Buoy', 'Foghorn', 'Breakwater', 'Salt Marsh', 'Low Tide'],
  },
  {
    artist: 'Fathom Field',
    album: 'Field Notes',
    year: 2011,
    genre: 'Ambient',
    tracks: ['Field Notes I', 'Field Notes II', 'Shoal', 'Gull Season'],
  },
];

/**
 * Deterministic playlist definitions (track titles are resolved to ids).
 */
const PLAYLIST_DEFS = [
  {
    title: 'Late Shift',
    description: 'Slow, warm tracks for the last bus home.',
    tracks: ['Half Past Four', 'Paper Moon', 'Violet Hour', 'Kettle', 'Soundings', 'Aubade'],
  },
  {
    title: 'Windows Down',
    description: 'Windows open, volume up, nothing urgent.',
    tracks: ['Harbour Lights', 'Flashbulb', 'Telemetry', 'Ferry Song', 'System', 'Kodak'],
  },
  {
    title: 'Deep Focus',
    description: 'Long, even textures for working through something.',
    tracks: ['Deep Field', 'Bathymetry', 'Shoal', 'Gull Season', 'Field Notes I', 'Sonar'],
  },
];

/**
 * @type {Artist[]}
 */
export const ARTISTS = [];

/**
 * @type {Album[]}
 */
export const ALBUMS = [];

/**
 * @type {Track[]}
 */
export const TRACKS = [];

/**
 * @type {Playlist[]}
 */
export const PLAYLISTS = [];

/** @type {Map<string, Track>} */
const trackIndex = new Map();
/** @type {Map<string, Album>} */
const albumIndex = new Map();
/** @type {Map<string, Artist>} */
const artistIndex = new Map();
/** @type {Map<string, Artist>} artists by name, so an artist with two albums stays one artist */
const artistByName = new Map();
/** @type {Map<string, Playlist>} */
const playlistIndex = new Map();

/**
 * Build the library from the catalogue. Called once, at module load.
 */
function buildLibrary() {
  const random = mulberry32(LIBRARY_SEED);
  let artistOrdinal = 0;
  let albumOrdinal = 0;
  let trackOrdinal = 0;

  for (const entry of CATALOGUE) {
    let artist = artistByName.get(entry.artist);
    if (!artist) {
      artistOrdinal += 1;
      artist = {
        id: `art-${String(artistOrdinal).padStart(2, '0')}`,
        name: entry.artist,
        genre: entry.genre,
        albumIds: [],
      };
      artistByName.set(artist.name, artist);
      artistIndex.set(artist.id, artist);
      ARTISTS.push(artist);
    }

    albumOrdinal += 1;
    const album = {
      id: `alb-${String(albumOrdinal).padStart(2, '0')}`,
      title: entry.album,
      artistId: artist.id,
      artistName: artist.name,
      year: entry.year,
      genre: entry.genre,
      trackIds: [],
    };
    albumIndex.set(album.id, album);
    ALBUMS.push(album);
    artist.albumIds.push(album.id);

    entry.tracks.forEach((title, position) => {
      trackOrdinal += 1;
      // 2:00 – 6:20, deterministic.
      const duration = 120 + Math.floor(random() * 260);
      const track = {
        id: `trk-${String(trackOrdinal).padStart(3, '0')}`,
        title,
        albumId: album.id,
        albumTitle: album.title,
        artistId: artist.id,
        artistName: artist.name,
        duration,
        trackNumber: position + 1,
        year: album.year,
      };
      trackIndex.set(track.id, track);
      TRACKS.push(track);
      album.trackIds.push(track.id);
    });
  }

  PLAYLIST_DEFS.forEach((definition, index) => {
    const trackIds = definition.tracks
      .map((title) => TRACKS.find((track) => track.title === title)?.id)
      .filter((id) => Boolean(id));
    const playlist = {
      id: `pl-${String(index + 1).padStart(2, '0')}`,
      title: definition.title,
      description: definition.description,
      trackIds,
    };
    playlistIndex.set(playlist.id, playlist);
    PLAYLISTS.push(playlist);
  });
}

buildLibrary();

/**
 * @param {string} id
 * @returns {Track|undefined}
 */
export function getTrack(id) {
  return trackIndex.get(id);
}

/**
 * @param {string} id
 * @returns {Album|undefined}
 */
export function getAlbum(id) {
  return albumIndex.get(id);
}

/**
 * @param {string} id
 * @returns {Artist|undefined}
 */
export function getArtist(id) {
  return artistIndex.get(id);
}

/**
 * @param {string} id
 * @returns {Playlist|undefined}
 */
export function getPlaylist(id) {
  return playlistIndex.get(id);
}

/**
 * @param {string} albumId
 * @returns {Track[]}
 */
export function albumTracks(albumId) {
  const album = albumIndex.get(albumId);
  if (!album) return [];
  return album.trackIds.map((id) => trackIndex.get(id)).filter(Boolean);
}

/**
 * @param {string} artistId
 * @returns {Album[]}
 */
export function artistAlbums(artistId) {
  const artist = artistIndex.get(artistId);
  if (!artist) return [];
  return artist.albumIds.map((id) => albumIndex.get(id)).filter(Boolean);
}

/**
 * @param {string} playlistId
 * @returns {Track[]}
 */
export function playlistTracks(playlistId) {
  const playlist = playlistIndex.get(playlistId);
  if (!playlist) return [];
  return playlist.trackIds.map((id) => trackIndex.get(id)).filter(Boolean);
}

/**
 * The albums shown first in the Collection carousel — a fixed rotation, so the
 * view is identical on every launch.
 * @type {string[]}
 */
export const RECENTLY_PLAYED_ALBUM_IDS = ALBUMS.slice(0, 8).map((album) => album.id);

/**
 * The Metro accent palette used for generated cover art.
 *
 * These are exactly the accent colours declared in `packages/shared/tokens.css`
 * (`--zode-accent-*`). A curated set beats a random hue: every cover is
 * distinct, but the collection still reads as one deliberate system rather
 * than a colour wheel.
 *
 * @type {ReadonlyArray<{a: string, b: string, c: string}>}
 */
export const METRO_ART_PALETTE = [
  { a: '#f25022', b: '#8c2f10', c: '#171717' }, // orange
  { a: '#00a0e1', b: '#00536e', c: '#141414' }, // blue
  { a: '#7a3e9d', b: '#432253', c: '#171717' }, // purple
  { a: '#a4c400', b: '#556100', c: '#141414' }, // green
  { a: '#00aba9', b: '#005b58', c: '#141414' }, // teal
  { a: '#f2c80f', b: '#8d7209', c: '#171717' }, // yellow
];

/**
 * A stable, well-distributed hue for an id.
 *
 * The naive `hash * 31 + charCode` fold collapses for sequential ids
 * (`alb-01`, `alb-02`, … differ by one in the final character), which made
 * every cover land on the same hue. This is an FNV-1a fold followed by an
 * avalanche mix, so near-identical ids scatter across the whole range.
 *
 * @param {string} id
 * @returns {number} hue in degrees
 */
export function albumHue(id) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Avalanche (murmur3 finalizer).
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash % 360;
}

/**
 * Pick a palette entry for an entity.
 *
 * Ids are ordinal (`alb-01`, `art-03`, …), so the numeric suffix drives the
 * choice directly — which guarantees adjacent items never share a colour.
 *
 * @param {string} id
 * @returns {{a: string, b: string, c: string}}
 */
function paletteFor(id) {
  const suffix = Number((id.match(/(\d+)\s*$/) || [])[1] ?? NaN);
  const index = Number.isFinite(suffix)
    ? (suffix - 1) % METRO_ART_PALETTE.length
    : albumHue(id) % METRO_ART_PALETTE.length;
  return METRO_ART_PALETTE[index];
}

/**
 * Generate the CSS background for an album tile.
 *
 * @param {Album} album
 * @returns {string} a CSS `background` value
 */
export function albumArt(album) {
  const p = paletteFor(album.id);
  const angle = 135 + (albumHue(album.id) % 6) * 18;
  return `linear-gradient(${angle}deg, ${p.a} 0%, ${p.b} 58%, ${p.c} 100%)`;
}

/**
 * A flat colour for a playlist tile.
 *
 * @param {Playlist} playlist
 * @returns {string} a CSS `background` value
 */
export function playlistArt(playlist) {
  const p = paletteFor(playlist.id);
  const angle = 120 + (albumHue(playlist.id) % 8) * 14;
  return `linear-gradient(${angle}deg, ${p.a} 0%, ${p.b} 100%)`;
}

/**
 * A flat colour for an artist tile.
 *
 * @param {Artist} artist
 * @returns {string} a CSS `background` value
 */
export function artistArt(artist) {
  const p = paletteFor(artist.id);
  const angle = 150 + (albumHue(artist.id) % 5) * 20;
  return `linear-gradient(${angle}deg, ${p.b} 0%, ${p.c} 100%)`;
}

/**
 * Format a duration in seconds as `m:ss` (or `h:mm:ss` when long).
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format a duration as a signed remaining time, e.g. `-2:14`.
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatRemaining(seconds) {
  return `-${formatDuration(Math.max(0, seconds))}`;
}

/**
 * @param {string} haystack
 * @param {string} needle
 * @returns {boolean}
 */
function matches(haystack, needle) {
  return haystack.toLowerCase().includes(needle);
}

/**
 * Search the library. The browser fallback uses this; native shells answer
 * `search.query` with their own (Spotlight / Windows Search) index instead.
 *
 * @param {string} query
 * @param {{limit?: number}} [options]
 * @returns {SearchResult[]}
 */
export function searchLibrary(query, { limit = 60 } = {}) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [];

  /** @type {SearchResult[]} */
  const results = [];

  for (const track of TRACKS) {
    if (matches(track.title, needle) || matches(track.artistName, needle) || matches(track.albumTitle, needle)) {
      results.push({
        id: track.id,
        title: track.title,
        subtitle: `${track.artistName} — ${track.albumTitle}`,
        kind: 'track',
        payload: { id: track.id, kind: 'track', duration: track.duration },
      });
    }
  }

  for (const album of ALBUMS) {
    if (matches(album.title, needle) || matches(album.artistName, needle) || matches(album.genre, needle)) {
      results.push({
        id: album.id,
        title: album.title,
        subtitle: `${album.artistName} · ${album.year}`,
        kind: 'album',
        payload: { id: album.id, kind: 'album' },
      });
    }
  }

  for (const artist of ARTISTS) {
    if (matches(artist.name, needle) || matches(artist.genre, needle)) {
      results.push({
        id: artist.id,
        title: artist.name,
        subtitle: artist.genre,
        kind: 'artist',
        payload: { id: artist.id, kind: 'artist' },
      });
    }
  }

  for (const playlist of PLAYLISTS) {
    if (matches(playlist.title, needle) || matches(playlist.description, needle)) {
      results.push({
        id: playlist.id,
        title: playlist.title,
        subtitle: playlist.description,
        kind: 'playlist',
        payload: { id: playlist.id, kind: 'playlist' },
      });
    }
  }

  return results.slice(0, limit);
}

/**
 * Every library item, flattened — used by the Search view to show a browse
 * list before a query is typed.
 *
 * @returns {SearchResult[]}
 */
export function browseResults() {
  return [
    ...TRACKS.map(
      (track) =>
        /** @type {SearchResult} */ ({
          id: track.id,
          title: track.title,
          subtitle: `${track.artistName} — ${track.albumTitle}`,
          kind: 'track',
          payload: { id: track.id, kind: 'track', duration: track.duration },
        }),
    ),
    ...ALBUMS.map(
      (album) =>
        /** @type {SearchResult} */ ({
          id: album.id,
          title: album.title,
          subtitle: `${album.artistName} · ${album.year}`,
          kind: 'album',
          payload: { id: album.id, kind: 'album' },
        }),
    ),
  ];
}
