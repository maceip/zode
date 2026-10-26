/**
 * @file The (fake) player.
 *
 * There is no real audio decoder in the web app — this is a deterministic
 * playback clock that drives the Now Playing view.
 *
 * @module app/player
 */

import { TRACKS, getTrack } from '../data/library.js';

/**
 * @typedef {object} PlayerState
 * @property {string} trackId
 * @property {boolean} playing
 * @property {number} elapsed seconds
 */

/**
 * Create the player.
 *
 * @param {object} [options]
 * @param {number} [options.tickMs]
 * @param {() => number} [options.now]
 * @returns {object}
 */
export function createPlayer({ tickMs = 250, now = () => Date.now() } = {}) {
  /** @type {PlayerState} */
  const state = {
    trackId: TRACKS[0]?.id ?? '',
    playing: false,
    elapsed: 0,
  };
  /** @type {Set<(state: PlayerState) => void>} */
  const listeners = new Set();
  /** @type {any} */
  let timer = null;
  let lastTick = 0;

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener({ ...state });
      } catch (error) {
        console.error('[zode] player listener threw', error);
      }
    }
  };

  const stopTimer = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    lastTick = now();
    timer = setInterval(() => {
      const stamp = now();
      const delta = (stamp - lastTick) / 1000;
      lastTick = stamp;
      const track = getTrack(state.trackId);
      const duration = track?.duration ?? 0;
      if (duration > 0 && state.elapsed + delta >= duration) {
        state.elapsed = duration;
        notify();
        next();
        return;
      }
      state.elapsed += delta;
      notify();
    }, tickMs);
  };

  /**
   * @param {string} trackId
   * @returns {void}
   */
  const select = (trackId) => {
    if (!getTrack(trackId)) return;
    state.trackId = trackId;
    state.elapsed = 0;
    notify();
  };

  const play = () => {
    if (state.playing) return;
    state.playing = true;
    startTimer();
    notify();
  };

  const pause = () => {
    if (!state.playing) return;
    state.playing = false;
    stopTimer();
    notify();
  };

  const toggle = () => {
    if (state.playing) pause();
    else play();
  };

  const next = () => {
    const index = TRACKS.findIndex((track) => track.id === state.trackId);
    const nextTrack = TRACKS[(index + 1 + TRACKS.length) % TRACKS.length];
    if (nextTrack) {
      state.trackId = nextTrack.id;
      state.elapsed = 0;
    }
    notify();
  };

  const previous = () => {
    const index = TRACKS.findIndex((track) => track.id === state.trackId);
    const previousTrack = TRACKS[(index - 1 + TRACKS.length) % TRACKS.length];
    if (previousTrack) {
      state.trackId = previousTrack.id;
      state.elapsed = 0;
    }
    notify();
  };

  /**
   * @param {number} seconds
   * @returns {void}
   */
  const seek = (seconds) => {
    const track = getTrack(state.trackId);
    const duration = track?.duration ?? 0;
    state.elapsed = Math.max(0, Math.min(seconds, duration));
    notify();
  };

  return {
    get state() {
      return { ...state };
    },
    get currentTrack() {
      return getTrack(state.trackId);
    },
    /**
     * @param {(state: PlayerState) => void} fn
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    play,
    pause,
    toggle,
    next,
    previous,
    seek,
    select,
    destroy: stopTimer,
  };
}
