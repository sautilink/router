import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const [html, app, theme, catalogText] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/router-theme.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/router-catalog.json', import.meta.url), 'utf8'),
]);
const catalog = JSON.parse(catalogText);

// Minimal DOM/event doubles exercise the production script and real page markup.
// They implement focus, attributes and event delivery, not the UI's decisions.
class EventTarget {
  listeners = new Map();
  parentNode = null;
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  dispatch(type, properties = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (let target = this; target; target = properties.bubbles === false ? null : target.parentNode) {
      for (const callback of target.listeners.get(type) || []) callback(event);
    }
    return event;
  }
}
class Element extends EventTarget {
  constructor(document, tag, attributes = {}) {
    super();
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.text = '';
    this.style = {};
    this.value = attributes.value || '';
    this.hidden = 'hidden' in attributes;
    this.disabled = 'disabled' in attributes;
    this.tabIndex = Number(attributes.tabindex || 0);
    this.dataset = Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
    this.scrollCalls = [];
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => !names.includes(name)).join(' '); },
      toggle: (name, force = !this.classList.contains(name)) => { force ? this.classList.add(name) : this.classList.remove(name); return force; },
    };
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get className() { return this.getAttribute('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get href() { return this.getAttribute('href') || ''; }
  set href(value) { this.setAttribute('href', value); }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.text = String(value); this.children = []; }
  get options() { return this.querySelectorAll('option'); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  append(...children) {
    for (const child of children) {
      if (child.tagName === '#FRAGMENT') { this.append(...child.children); continue; }
      child.parentNode = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) { this.text = ''; this.children = []; this.append(...children); }
  matches(selector) {
    const parts = selector.trim().split(/\s+/);
    if (parts.length > 1) {
      if (!this.matches(parts.pop())) return false;
      for (let node = this.parentNode; node instanceof Element; node = node.parentNode) {
        if (node.matches(parts.join(' '))) return true;
      }
      return false;
    }
    const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && this.id !== id) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
    if (classes.some((name) => !this.classList.contains(name))) return false;
    return [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)].every(([, name, value]) => this.hasAttribute(name) && (value === undefined || this.getAttribute(name) === value));
  }
  querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node instanceof Element; node = node.parentNode) if (node.matches(selector)) return node; return null; }
  contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; }
  focus() {
    if (this.disabled || this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.dispatch('focus', { bubbles: false });
    this.dispatch('focusin');
  }
  click() { if (!this.disabled) return this.dispatch('click'); }
  scrollIntoView(options) { this.scrollCalls.push(options); }
}
function parsePage(document) {
  const root = new Element(document, 'root');
  const stack = [root];
  const source = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const voids = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
  for (const match of source.matchAll(/<[^>]+>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const name = token.match(/^<([\w-]+)/)?.[1];
      if (!name) continue;
      const attributes = Object.fromEntries([...token.slice(name.length + 1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(([, key, double, single, bare]) => [key, double ?? single ?? bare ?? '']));
      const element = new Element(document, name, attributes);
      stack.at(-1).append(element);
      if (!voids.has(element.tagName) && !token.endsWith('/>')) stack.push(element);
    } else {
      stack.at(-1).text += token;
    }
  }
  document.documentElement = root.querySelector('html');
  document.documentElement.parentNode = document;
  document.body = root.querySelector('body');
  document.activeElement = document.body;
  document.querySelectorAll = (selector) => root.querySelectorAll(selector);
  document.querySelector = (selector) => root.querySelector(selector);
  document.createElement = (tag) => new Element(document, tag);
  document.createDocumentFragment = () => new Element(document, '#fragment');
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
function page({ savedTheme = null, blockedStorage = false, failedCatalog = false, delayedCatalog = false, delayedContext = false, reducedMotion = false } = {}) {
  const document = new EventTarget();
  parsePage(document);
  const storage = new Map(savedTheme ? [['sautilink-router-theme', savedTheme]] : []);
  const localStorage = {
    getItem(key) { if (blockedStorage) throw Error('blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw Error('blocked'); storage.set(key, value); },
  };
  const window = new EventTarget();
  const media = new Map();
  window.matchMedia = (query) => {
    if (!media.has(query)) { const result = new EventTarget(); result.matches = query.includes('reduced-motion') ? reducedMotion : query.includes('max-width'); media.set(query, result); }
    return media.get(query);
  };
  window.setTimeout = () => 1;
  window.clearTimeout = () => {};
  const opened = [];
  window.open = (...args) => opened.push(args);
  const copied = [];
  const requests = [];
  const catalogGate = deferred();
  const contextGate = deferred();
  const fetch = async (url) => {
    requests.push(url);
    if (url === '/assets/router-catalog.json') {
      if (delayedCatalog) await catalogGate.promise;
      if (failedCatalog) return { ok: false };
      return { ok: true, json: async () => structuredClone(catalog) };
    }
    if (url === '/api/context') {
      if (delayedContext) await contextGate.promise;
      return { ok: true, json: async () => ({ country: 'KE' }) };
    }
    throw Error(`Unexpected request: ${url}`);
  };
  const navigator = { userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone', maxTouchPoints: 1, language: 'en-KE', languages: ['en-KE'], onLine: true, clipboard: { writeText: async (text) => copied.push(text) } };
  const context = { document, window, navigator, localStorage, fetch, location: { protocol: 'https:' }, Intl };
  runInNewContext(theme, context, { filename: 'assets/router-theme.js' });
  runInNewContext(app, context, { filename: 'assets/app.js' });
  const get = (selector) => document.querySelector(selector);
  return {
    document, window, storage, media, opened, copied, requests, get,
    ready: () => new Promise((resolve) => setImmediate(resolve)),
    releaseCatalog: catalogGate.resolve,
    releaseContext: contextGate.resolve,
    input(value) { const input = get('#setup-search'); input.focus(); input.value = value; input.dispatch('input'); },
    key(key) { return get('#setup-search').dispatch('keydown', { key }); },
    pick(value) { this.input(value); this.key('ArrowDown'); this.key('Enter'); },
  };
}

test('default light theme is stable and saved dark remains available with accurate control state', async () => {
  const light = page();
  await light.ready();
  assert.equal(light.document.documentElement.dataset.theme, 'light');
  assert.equal(light.get('meta[name="theme-color"]').getAttribute('content'), '#ffffff');
  light.get('[data-theme-toggle]').click();
  assert.equal(light.document.documentElement.dataset.theme, 'dark');
  assert.equal(light.get('[data-theme-toggle]').getAttribute('aria-label'), 'Use light theme');
  assert.equal(light.get('[data-theme-toggle]').getAttribute('aria-pressed'), 'true');
  assert.equal(light.storage.get('sautilink-router-theme'), 'dark');
  const dark = page({ savedTheme: 'dark' });
  assert.equal(dark.document.documentElement.dataset.theme, 'dark');
  await dark.ready();
  const blocked = page({ blockedStorage: true });
  await blocked.ready();
  blocked.get('[data-theme-toggle]').click();
  assert.equal(blocked.document.documentElement.dataset.theme, 'dark');
});

test('catalog controls remain disabled until real catalog data is ready', async () => {
  const env = page({ delayedCatalog: true });
  assert.equal(env.get('#country-select').disabled, true);
  assert.equal(env.get('#setup-search').disabled, true);
  assert.doesNotThrow(() => env.key('ArrowDown'));
  env.releaseCatalog();
  await env.ready();
  assert.equal(env.get('#country-select').disabled, false);
  assert.equal(env.get('#setup-search').disabled, false);
  assert.equal(env.get('#country-select').value, 'KE');
  assert.ok(env.get('#directory-grid').children.length > 0);
  assert.deepEqual(env.requests, ['/assets/router-catalog.json', '/api/context']);
});

test('catalog failure gives a usable fallback without enabling broken setup controls', async () => {
  const env = page({ failedCatalog: true });
  await env.ready();
  assert.equal(env.get('#setup-search').disabled, true);
  assert.equal(env.get('#directory-search').disabled, true);
  assert.match(env.get('#setup-hint').textContent, /common gateway/i);
  assert.match(env.get('#directory-summary').textContent, /temporarily unavailable/i);
  assert.equal(env.get('#country-select').options[0].textContent, 'Directory unavailable');
  assert.equal(env.document.querySelectorAll('.gateway-card').length, 6);
  assert.equal(env.get('.gateway-card').href, 'http://192.168.1.1');
  assert.match(env.get('#device-guide-title').textContent, /iPhone or iPad/);
});

test('keyboard combobox selection opens the catalog route without changing router actions', async () => {
  const env = page();
  await env.ready();
  env.input('tp-link');
  assert.equal(env.get('#setup-search').getAttribute('aria-expanded'), 'true');
  assert.equal(env.key('ArrowDown').defaultPrevented, true);
  const optionId = env.get('#setup-search').getAttribute('aria-activedescendant');
  assert.equal(env.get(`#${optionId}`).getAttribute('aria-selected'), 'true');
  assert.equal(env.document.activeElement, env.get('#setup-search'));
  env.key('Enter');
  assert.equal(env.get('#recommendation').hidden, false);
  assert.equal(env.get('#primary-route').href, 'http://tplinkwifi.net');
  assert.equal(env.get('#setup-search').getAttribute('aria-expanded'), 'false');
  assert.equal(env.get('#setup-search').hasAttribute('aria-activedescendant'), false);
  assert.equal(env.get('#setup-progress').getAttribute('aria-valuenow'), '3');
  assert.deepEqual(env.get('#alternative-routes').querySelectorAll('a').map((link) => link.href), ['http://192.168.0.1', 'http://192.168.1.1']);
  assert.equal(env.opened.length, 0);
});

test('official app recommendation and local alternatives retain their original destinations', async () => {
  const env = page();
  await env.ready();
  env.pick('eero');
  assert.equal(env.get('#primary-route').href, 'https://eero.com/app');
  assert.equal(env.get('#primary-route-label').textContent, 'Open official setup app');
  assert.match(env.get('#local-route-note').textContent, /official product page/);
  assert.deepEqual(env.requests, ['/assets/router-catalog.json', '/api/context']);
});

test('changing a selected query removes the stale recommendation; empty results stay clear', async () => {
  const env = page();
  await env.ready();
  env.pick('mikrotik');
  assert.equal(env.get('#primary-route').href, 'http://192.168.88.1');
  env.input('unknown-router-zzzz');
  assert.equal(env.get('#recommendation').hidden, true);
  assert.equal(env.get('#setup-suggestions').hidden, true);
  assert.equal(env.get('#setup-progress').getAttribute('aria-valuenow'), '2');
  assert.match(env.get('#setup-hint').textContent, /No matching/);
  env.get('#clear-setup-search').click();
  assert.equal(env.get('#setup-search').value, '');
  assert.equal(env.get('#recommendation').hidden, true);
  assert.ok(env.get('#quick-picks').children.length > 0);
});

test('Escape, Tab and focus leaving dismiss suggestions without choosing or clearing input', async () => {
  const env = page();
  await env.ready();
  env.input('huawei');
  env.key('ArrowDown');
  env.key('Escape');
  assert.equal(env.get('#setup-suggestions').hidden, true);
  assert.equal(env.get('#setup-search').value, 'huawei');
  assert.equal(env.get('#recommendation').hidden, true);
  env.key('ArrowDown');
  env.key('Tab');
  assert.equal(env.get('#setup-suggestions').hidden, true);
  env.key('ArrowUp');
  env.get('#directory-search').focus();
  assert.equal(env.get('#setup-suggestions').hidden, true);
  assert.equal(env.get('#setup-search').hasAttribute('aria-activedescendant'), false);
});

test('directory keyboard tabs update the active panel and search results', async () => {
  const env = page();
  await env.ready();
  const providers = env.get('#tab-providers');
  providers.dispatch('keydown', { key: 'ArrowRight' });
  const brands = env.get('#tab-brands');
  assert.equal(env.document.activeElement, brands);
  assert.equal(brands.tabIndex, 0);
  assert.equal(providers.tabIndex, -1);
  assert.equal(env.get('#directory-results').getAttribute('aria-labelledby'), 'tab-brands');
  assert.equal(env.get('.country-filter-wrap').hidden, true);
  const search = env.get('#directory-search');
  search.value = 'mikrotik'; search.dispatch('input');
  assert.equal(env.get('#directory-grid').children.length, 1);
  assert.match(env.get('#directory-grid').textContent, /MikroTik/);
  search.value = 'unknown-router-zzzz'; search.dispatch('input');
  assert.equal(env.get('#directory-empty').hidden, false);
  assert.equal(env.get('#show-more').hidden, true);
  brands.dispatch('keydown', { key: 'Home' });
  assert.equal(env.get('.country-filter-wrap').hidden, false);
});

test('a directory selection brings the correct setup into focus and respects reduced motion', async () => {
  const env = page({ reducedMotion: true });
  await env.ready();
  env.get('#tab-brands').click();
  const search = env.get('#directory-search');
  search.value = 'mikrotik'; search.dispatch('input');
  env.get('#directory-grid').children[0].click();
  assert.equal(env.get('#primary-route').href, 'http://192.168.88.1');
  assert.equal(env.document.activeElement, env.get('#setup-search'));
  assert.equal(env.get('#setup-suggestions').hidden, true);
  assert.equal(env.get('#setup').scrollCalls.at(-1).behavior, 'auto');
});

test('a late region hint preserves the country the visitor already chose', async () => {
  const env = page({ delayedContext: true });
  await env.ready();
  env.get('#country-select').value = 'UG';
  env.get('#country-select').dispatch('change');
  env.releaseContext();
  await env.ready();
  assert.equal(env.get('#country-select').value, 'UG');
  assert.equal(env.get('#directory-country').value, 'UG');
});

test('mobile menu opens with focus and closes correctly on Escape, outside click and resize', async () => {
  const env = page();
  await env.ready();
  const toggle = env.get('[data-menu-toggle]');
  const menu = env.get('#mobile-nav');
  toggle.click();
  assert.equal(menu.hidden, false);
  assert.equal(env.document.activeElement, menu.querySelector('a'));
  env.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(menu.hidden, true);
  assert.equal(env.document.activeElement, toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  env.get('#setup').click();
  assert.equal(menu.hidden, true);
  toggle.click();
  env.media.get('(max-width: 620px)').dispatch('change', { matches: false });
  assert.equal(menu.hidden, true);
  assert.equal(env.document.activeElement, env.get('.brand'));
});

test('device instructions can still be copied with their original content', async () => {
  const env = page();
  await env.ready();
  env.get('#copy-guide').click();
  await env.ready();
  assert.equal(env.copied.length, 1);
  assert.match(env.copied[0], /Find the gateway on iPhone or iPad/);
  assert.match(env.copied[0], /1\. Open Settings, then Wi-Fi\./);
  assert.match(env.copied[0], /3\. Look for Router under IPv4 Address\./);
  assert.equal(env.get('#toast').textContent, 'Gateway steps copied');
});
