/**
 * @file The application shell.
 *
 * Builds the window: the drag strip, the Metro left rail and the stage that
 * hosts the five views — and wires the bridge (§2) to them.
 *
 * @module app/app
 */

import { createDragZone } from './drag-zone.js';
import { createPlayer } from './player.js';
import { createRail } from './rail.js';
import { createRouter } from './router.js';
import { createAgentEngine } from '../data/agent.js';
import { albumTracks, artistAlbums, playlistTracks } from '../data/library.js';
import { createViews } from '../views/index.js';
import { h } from '../util/dom.js';

/**
 * @param {object} options
 * @param {Document} options.doc
 * @param {any} options.win
 * @param {any} options.zode the `window.zode` object
 * @param {any} options.bridge the {@link ZodeBridge} (for intent handlers)
 * @returns {object} the app
 */
export function createApp({ doc, win, zode, bridge }) {
  // ------------------------------------------------------------------ data
  const agent = createAgentEngine();
  const player = createPlayer();
  /** @type {any[]} every attachment seen this session */
  const attachments = [];

  // ------------------------------------------------------------------ dom
  const root = doc.getElementById('zode-root') ?? doc.body ?? doc.documentElement;
  const app = h(doc, 'div', { class: 'zode-app on-ink' });
  const shell = h(doc, 'div', { class: 'zode-shell' });
  const stage = h(doc, 'main', { class: 'zode-stage', attrs: { role: 'main' } });

  const router = createRouter({ initial: 'now-playing' });

  const views = createViews({
    doc,
    win,
    zode,
    player,
    agent,
    router,
    getAttachments: () => attachments,
  });

  for (const view of views.list) {
    view.el.setAttribute('data-active', 'false');
    stage.appendChild(view.el);
  }

  const rail = createRail({
    doc,
    onSelect: (id) => {
      router.navigate(id);
    },
  });

  shell.appendChild(rail.el);
  shell.appendChild(stage);
  app.appendChild(shell);
  root.appendChild(app);

  const dragZone = createDragZone({
    doc,
    zode,
    host: doc.body ?? root,
    actions: {
      onSearch: () => router.navigate('search'),
      onAgent: () => router.navigate('agent'),
    },
  });

  // -------------------------------------------------------------- routing
  const show = (route) => {
    for (const view of views.list) {
      const active = view.id === route.view;
      view.el.setAttribute('data-active', active ? 'true' : 'false');
      if (active && view.refresh) view.refresh();
    }
    rail.setActive(route.view);
    stage.scrollTop = 0;
  };

  router.onChange((route) => {
    show(route);
    if (route.view === 'search' && route.query) {
      const search = views.get('search');
      if (search) search.setQuery(route.query);
    }
    if (route.view === 'agent' && route.prompt !== null && route.prompt !== undefined) {
      agent.start(route.prompt, []);
    }
    zode.haptic('select').catch(() => {});
  });

  // --------------------------------------------------------------- intents
  // Contract §4 — every intent name has a handler.
  const intentHandlers = {
    'zode.search': (payload) => {
      const query = String(payload?.query ?? '');
      router.navigate('search', { query });
      const search = views.get('search');
      if (search) search.setQuery(query);
      return { query };
    },
    'zode.play': (payload) => {
      const id = String(payload?.id ?? '');
      const kind = String(payload?.kind ?? 'track');
      let trackId = null;
      if (kind === 'track') {
        trackId = id;
      } else if (kind === 'album') {
        trackId = albumTracks(id)[0]?.id ?? null;
      } else if (kind === 'playlist') {
        trackId = playlistTracks(id)[0]?.id ?? null;
      } else if (kind === 'artist') {
        const firstAlbum = artistAlbums(id)[0];
        trackId = firstAlbum ? albumTracks(firstAlbum.id)[0]?.id ?? null : null;
      }
      if (trackId) {
        player.select(trackId);
        player.play();
        router.navigate('now-playing');
      }
      return { id, kind, trackId };
    },
    'zode.pause': () => {
      player.pause();
      return { paused: true };
    },
    'zode.next': () => {
      player.next();
      return { trackId: player.state.trackId };
    },
    'zode.previous': () => {
      player.previous();
      return { trackId: player.state.trackId };
    },
    'zode.agent.newTask': (payload) => {
      const prompt = String(payload?.prompt ?? '');
      const list = Array.isArray(payload?.attachments) ? payload.attachments : [];
      const task = agent.start(prompt, list);
      router.navigate('agent');
      return { taskId: task.id };
    },
    'zode.agent.stop': () => {
      const task = agent.stop();
      return { stopped: Boolean(task) };
    },
    'zode.attach': (payload) => {
      const list = Array.isArray(payload?.attachments) ? payload.attachments : [];
      for (const attachment of list) receiveAttachment(attachment);
      return { count: list.length };
    },
    'zode.show': (payload) => {
      const view = String(payload?.view ?? 'now-playing');
      router.navigate(view);
      return { view };
    },
  };

  for (const [name, handler] of Object.entries(intentHandlers)) {
    if (bridge && typeof bridge.registerIntentHandler === 'function') {
      bridge.registerIntentHandler(name, handler);
    }
  }

  // ------------------------------------------------------------ attachments
  /**
   * An attachment arrived from the dock, a drop, the share sheet or the
   * picker. The agent view owns the haptics for it.
   *
   * @param {any} attachment
   * @returns {void}
   */
  const receiveAttachment = (attachment) => {
    if (!attachment) return;
    attachments.push(attachment);
    const agentView = views.get('agent');
    if (agentView) agentView.handleAttachment(attachment);
  };

  const offAttachment = zode.onAttachment((attachment) => {
    receiveAttachment(attachment);
  });

  const offIntent = zode.onIntent((event) => {
    if (!event || !event.intent) return;
    if (bridge && typeof bridge.dispatchIntent === 'function') {
      bridge.dispatchIntent(String(event.intent), event.payload ?? {});
    }
  });

  const offSearch = zode.onSearch((event) => {
    const query = String(event?.query ?? '');
    router.navigate('search', { query });
    const search = views.get('search');
    if (search) search.setQuery(query);
  });

  const offDeepLink = zode.onDeepLink((url) => {
    router.handleDeepLink(String(url));
  });

  // A notification action (contract §9) brings the user back into the app.
  const offNotificationAction = zode.onNotificationAction((action) => {
    if (action?.action === 'open-agent') router.navigate('agent');
    else router.navigate('now-playing');
  });

  // -------------------------------------------------------------- journal
  agent.on('task:done', (task) => {
    zode
      .journal({ title: 'Agent task finished', body: task.prompt })
      .catch(() => {});
    if (doc.hidden) {
      zode
        .notify({ title: 'Zode', body: `The agent finished: ${task.prompt}` })
        .catch(() => {});
    }
  });
  agent.on('task:error', (task) => {
    zode
      .journal({ title: 'Agent task failed', body: `${task.prompt} — ${task.error ?? 'error'}` })
      .catch(() => {});
  });

  // ------------------------------------------------------------ shortcuts
  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  const onKeyDown = (event) => {
    const target = /** @type {any} */ (event.target);
    const typing =
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault?.();
      router.navigate('search');
      const search = views.get('search');
      search?.focus?.();
      return;
    }
    if (!typing && event.key === ' ') {
      event.preventDefault?.();
      player.toggle();
    }
  };

  const target = win ?? globalThis;
  target.addEventListener?.('keydown', onKeyDown);

  // ------------------------------------------------------------------ boot
  show(router.current);

  return {
    el: app,
    bridge,
    dragZone,
    rail,
    stage,
    router,
    player,
    agent,
    views,
    attachments,
    /**
     * @param {string} view
     * @returns {void}
     */
    navigate(view) {
      router.navigate(view);
    },
    destroy() {
      offAttachment();
      offIntent();
      offSearch();
      offDeepLink();
      offNotificationAction();
      target.removeEventListener?.('keydown', onKeyDown);
      dragZone.destroy();
    },
  };
}
