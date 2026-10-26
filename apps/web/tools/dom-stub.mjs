/**
 * A very small DOM stub — just enough to boot the Zode web app inside Node
 * for the self check. Node built-ins only.
 *
 * It provides `window`, `document` (with `addEventListener` / `createElement`),
 * `navigator` and a `fetch` that can read `file://` URLs, so the haptic
 * programs can be loaded from `assets/haptics.json`.
 *
 * @module tools/dom-stub
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * A DOM-ish event.
 */
export class StubEvent {
  /**
   * @param {string} type
   * @param {Record<string, any>} [init]
   */
  constructor(type, init = {}) {
    this.type = type;
    this.target = init.target ?? null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.bubbles = init.bubbles ?? true;
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.screenX = init.screenX ?? 0;
    this.screenY = init.screenY ?? 0;
    this.key = init.key ?? '';
    this.metaKey = init.metaKey ?? false;
    this.ctrlKey = init.ctrlKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
    this.detail = init.detail ?? 0;
    this.dataTransfer = init.dataTransfer ?? null;
    this.files = init.files ?? null;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

/**
 * Create an event for the stub.
 *
 * @param {string} type
 * @param {Record<string, any>} [init]
 * @returns {StubEvent}
 */
export function createEvent(type, init = {}) {
  return new StubEvent(type, init);
}

/**
 * A minimal `classList`.
 */
class StubClassList {
  /** @param {StubElement} element */
  constructor(element) {
    this.element = element;
  }

  get _set() {
    const raw = this.element.getAttribute('class') ?? '';
    return new Set(raw.split(/\s+/).filter(Boolean));
  }

  /** @param {string} name */
  add(name) {
    const set = this._set;
    set.add(name);
    this.element.setAttribute('class', [...set].join(' '));
  }

  /** @param {string} name */
  remove(name) {
    const set = this._set;
    set.delete(name);
    this.element.setAttribute('class', [...set].join(' '));
  }

  /** @param {string} name */
  contains(name) {
    return this._set.has(name);
  }

  /**
   * @param {string} name
   * @param {boolean} [force]
   */
  toggle(name, force) {
    const has = this.contains(name);
    const next = force === undefined ? !has : Boolean(force);
    if (next) this.add(name);
    else this.remove(name);
    return next;
  }
}

/**
 * A minimal `style` object.
 */
function createStyle() {
  const style = {
    /** @param {string} name @param {string} value */
    setProperty(name, value) {
      style[name] = value;
    },
    /** @param {string} name */
    getPropertyValue(name) {
      return style[name] ?? '';
    },
    removeProperty(name) {
      delete style[name];
    },
  };
  return style;
}

/**
 * Does an element match a single compound selector (`tag`, `.class`, `#id`,
 * `[attr]`, or a combination of them)?
 *
 * @param {StubElement} element
 * @param {string} selector
 * @returns {boolean}
 */
function matchesCompound(element, selector) {
  if (typeof selector !== 'string' || selector.trim() === '') return false;
  if (/\s/.test(selector.trim())) return false; // no descendant combinators
  const parts = selector.match(/^[a-zA-Z][\w-]*|#[\w-]+|\.[\w-]+|\[[^\]]+\]/g);
  if (!parts) return false;
  for (const part of parts) {
    if (part.startsWith('#')) {
      if (element.getAttribute('id') !== part.slice(1)) return false;
    } else if (part.startsWith('.')) {
      if (!element.classList.contains(part.slice(1))) return false;
    } else if (part.startsWith('[')) {
      const inner = part.slice(1, -1).trim();
      const equals = inner.indexOf('=');
      if (equals < 0) {
        if (!element.hasAttribute(inner)) return false;
      } else {
        const name = inner.slice(0, equals).trim();
        let value = inner.slice(equals + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (element.getAttribute(name) !== value) return false;
      }
    } else if (element.tagName !== part.toUpperCase()) {
      return false;
    }
  }
  return true;
}

/**
 * A minimal element.
 */
export class StubElement {
  /**
   * @param {StubDocument} ownerDocument
   * @param {string} tagName
   * @param {string|null} [namespaceURI]
   */
  constructor(ownerDocument, tagName, namespaceURI = null) {
    this.ownerDocument = ownerDocument;
    this.tagName = String(tagName).toUpperCase();
    this.nodeName = this.tagName;
    this.namespaceURI = namespaceURI;
    /** @type {StubElement[]} */
    this.children = [];
    /** @type {StubElement|null} */
    this.parentNode = null;
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    this.style = createStyle();
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    this._text = '';
    this.classList = new StubClassList(this);
    this.scrollTop = 0;
    this.value = '';
    this.files = null;
    this.disabled = false;
    this.focused = false;
    this.dataset = new Proxy(
      {},
      {
        get: (_target, key) => this.getAttribute(`data-${String(key)}`) ?? undefined,
        set: (_target, key, value) => {
          this.setAttribute(`data-${String(key)}`, String(value));
          return true;
        },
      },
    );
  }

  get className() {
    return this.getAttribute('class') ?? '';
  }

  set className(value) {
    this.setAttribute('class', String(value));
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get lastChild() {
    return this.children[this.children.length - 1] ?? null;
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._text = String(value ?? '');
    this.children = [];
  }

  /** @param {string} name */
  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  /** @param {string} name */
  getAttribute(name) {
    const value = this.attributes.get(String(name));
    return value === undefined ? null : value;
  }

  /** @param {string} name */
  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  /** @param {string} name */
  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  /** @param {StubElement} child */
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  /** @param {StubElement} child */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  /**
   * @param {StubElement} child
   * @param {StubElement|null} reference
   */
  insertBefore(child, reference) {
    if (!reference) return this.appendChild(child);
    const index = this.children.indexOf(reference);
    if (index < 0) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  /** @param {string} type @param {Function} handler */
  addEventListener(type, handler) {
    if (typeof handler !== 'function') return;
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }

  /** @param {string} type @param {Function} handler */
  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  /**
   * @param {StubEvent} event
   * @returns {boolean} false when `preventDefault()` was called
   */
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    let node = /** @type {StubElement|null} */ (this);
    while (node) {
      event.currentTarget = node;
      const bucket = node._listeners.get(event.type);
      if (bucket) {
        for (const handler of [...bucket]) {
          try {
            handler.call(node, event);
          } catch (error) {
            console.error(`[dom-stub] listener for "${event.type}" threw`, error);
          }
        }
      }
      if (!event.bubbles || event.propagationStopped) break;
      node = node.parentNode;
    }
    return !event.defaultPrevented;
  }

  /** @param {string} selector */
  closest(selector) {
    let node = /** @type {StubElement|null} */ (this);
    while (node) {
      if (matchesCompound(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  /** @param {string} selector */
  querySelector(selector) {
    for (const child of this.children) {
      if (matchesCompound(child, selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  /** @param {string} selector */
  querySelectorAll(selector) {
    /** @type {StubElement[]} */
    const found = [];
    for (const child of this.children) {
      if (matchesCompound(child, selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }

  focus() {
    this.focused = true;
  }

  blur() {
    this.focused = false;
  }

  click() {
    this.dispatchEvent(new StubEvent('click', { target: this }));
    // Simulate the browser file picker: a chosen file arrives with a
    // `change` event.
    if (this.tagName === 'INPUT' && this.type === 'file') {
      this.files = this.files ?? [
        { name: 'Zune Playlist.m3u', type: 'audio/x-mpeg', size: 2048 },
      ];
      this.dispatchEvent(new StubEvent('change', { target: this }));
    }
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  }

  // The Fullscreen API lives on the element in a real browser.
  async requestFullscreen() {
    this.ownerDocument.fullscreenElement = this;
  }

  async exitFullscreen() {
    this.ownerDocument.fullscreenElement = null;
  }
}

/**
 * A minimal document.
 */
export class StubDocument {
  constructor() {
    /** @type {StubElement} */
    this.documentElement = new StubElement(this, 'html');
    /** @type {StubElement} */
    this.body = new StubElement(this, 'body');
    this.documentElement.appendChild(this.body);
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {StubElement|null} */
    this.fullscreenElement = null;
    this.hidden = false;
    this.title = '';
  }

  /** @param {string} tagName */
  createElement(tagName) {
    return new StubElement(this, tagName);
  }

  /**
   * @param {string} namespaceURI
   * @param {string} tagName
   */
  createElementNS(namespaceURI, tagName) {
    return new StubElement(this, tagName, namespaceURI);
  }

  /** @param {string} text */
  createTextNode(text) {
    const node = new StubElement(this, '#text');
    node.textContent = text;
    return node;
  }

  /** @param {string} id */
  getElementById(id) {
    const search = (node) => {
      for (const child of node.children) {
        if (child.getAttribute('id') === id) return child;
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(this.documentElement);
  }

  /** @param {string} type @param {Function} handler */
  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }

  /** @param {string} type @param {Function} handler */
  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  /** @param {StubEvent} event */
  dispatchEvent(event) {
    const bucket = this._listeners.get(event.type);
    if (bucket) {
      for (const handler of [...bucket]) {
        try {
          handler.call(this, event);
        } catch (error) {
          console.error(`[dom-stub] listener for "${event.type}" threw`, error);
        }
      }
    }
    return !event.defaultPrevented;
  }

  async requestFullscreen() {
    this.fullscreenElement = this.documentElement;
  }

  async exitFullscreen() {
    this.fullscreenElement = null;
  }
}

/**
 * Install the stub globals.
 *
 * @param {object} [options]
 * @param {string} [options.userAgent]
 * @returns {{window: any, document: StubDocument, restore: () => void}}
 */
export function installDomStub({ userAgent = 'ZodeSelfCheck/1.0 (node)' } = {}) {
  const document = new StubDocument();
  const listeners = new Map();

  const window = {
    document,
    navigator: { userAgent },
    location: { href: 'http://localhost/', search: '', hash: '', origin: 'http://localhost' },
    /** @param {string} type @param {Function} handler */
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    /** @param {string} type @param {Function} handler */
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    /** @param {StubEvent} event */
    dispatchEvent(event) {
      const bucket = listeners.get(event.type);
      if (bucket) {
        for (const handler of [...bucket]) handler.call(window, event);
      }
      return !event.defaultPrevented;
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };

  const previous = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    fetch: Object.getOwnPropertyDescriptor(globalThis, 'fetch'),
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  };

  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
    writable: true,
  });

  // A fetch that can read file:// URLs — the app loads its haptic programs
  // from assets/haptics.json.
  Object.defineProperty(globalThis, 'fetch', {
    value: async (input) => {
      const url = String(input);
      if (!url.startsWith('file:')) {
        throw new Error(`[dom-stub] fetch is only stubbed for file: URLs (got ${url})`);
      }
      const path = fileURLToPath(url);
      const body = await readFile(path, 'utf8');
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(body);
        },
        async text() {
          return body;
        },
      };
    },
    configurable: true,
    writable: true,
  });

  const restore = () => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };

  return { window, document, restore };
}
