/**
 * @file Tiny DOM helpers.
 *
 * The app builds its DOM imperatively — no template strings, no innerHTML —
 * so the whole UI can be created inside a small DOM stub during the self
 * check, and so nothing is ever injected as markup.
 *
 * @module util/dom
 */

/**
 * @typedef {object} ElementOptions
 * @property {string} [class] class name
 * @property {string} [text] text content
 * @property {Record<string, string>} [attrs] attributes
 * @property {Record<string, string>} [data] `data-*` attributes
 * @property {Record<string, string>} [style] CSS properties
 * @property {Record<string, EventListener>} [on] event listeners
 * @property {Node[]} [children]
 */

/**
 * Create an element.
 *
 * @param {Document} doc
 * @param {string} tag
 * @param {ElementOptions} [options]
 * @returns {HTMLElement}
 */
export function h(doc, tag, options = {}) {
  const node = /** @type {HTMLElement} */ (doc.createElement(tag));
  if (options.class) node.className = options.class;
  if (options.text != null) node.textContent = String(options.text);
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, String(value));
  }
  if (options.data) {
    for (const [key, value] of Object.entries(options.data)) {
      node.setAttribute(`data-${key}`, String(value));
    }
  }
  if (options.style) {
    for (const [key, value] of Object.entries(options.style)) {
      if (typeof node.style.setProperty === 'function') node.style.setProperty(key, value);
      else node.style[key] = value;
    }
  }
  if (options.on) {
    for (const [event, handler] of Object.entries(options.on)) {
      node.addEventListener(event, handler);
    }
  }
  for (const child of options.children ?? []) {
    if (child) node.appendChild(child);
  }
  return node;
}

/**
 * Clear an element's children.
 *
 * @param {HTMLElement} node
 * @returns {void}
 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Remove every child of a node and append the given ones.
 *
 * @param {HTMLElement} node
 * @param {Node[]} children
 * @returns {void}
 */
export function replaceChildren(node, children) {
  clear(node);
  for (const child of children) if (child) node.appendChild(child);
}
