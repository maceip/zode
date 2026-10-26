/**
 * @file Entry point.
 *
 * Installs the bridge, then builds the app on top of it. Nothing else in the
 * app talks to a platform transport.
 *
 * @module main
 */

import { installZode } from './bridge/zode.js';
import { createApp } from './app/app.js';

const { bridge, api } = installZode();

const app = createApp({
  doc: document,
  win: window,
  zode: api,
  bridge,
});

// Handy when poking at the app from the webview inspector.
window.zodeApp = app;
