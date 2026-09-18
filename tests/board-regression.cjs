'use strict';

// Run against a checkout with NEON_DOCS=/path/to/docs, or place this in tests/.
// This exercises the unmodified NeonBoards module with a small DOM adapter.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const candidates = [process.env.NEON_DOCS, path.resolve(__dirname, '../docs'), path.resolve(__dirname, '../neon-upgrade/docs')].filter(Boolean);
const DOCS = candidates.find(candidate => fs.existsSync(path.join(candidate, 'boards.js')));
if (!DOCS) throw new Error('Cannot find boards.js. Set NEON_DOCS to the application docs directory.');
const boardSource = fs.readFileSync(path.join(DOCS, 'boards.js'), 'utf8');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.handlers = new Map();
    this.dataset = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this._text = '';
    this.style = {setProperty(name, value) { this[name] = String(value); }};
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get isConnected() { return this._root === true || Boolean(this.parentNode?.isConnected); }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name === 'id') this.id = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  prepend(child) { child.remove(); child.parentNode = this; this.children.unshift(child); }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = []; this._text = ''; this.append(...children);
  }
  addEventListener(name, callback, options = {}) {
    const listeners = this.handlers.get(name) || [];
    listeners.push({callback, once: options.once}); this.handlers.set(name, listeners);
  }
  dispatch(name) {
    const listeners = [...(this.handlers.get(name) || [])];
    for (const listener of listeners) listener.callback({type: name, target: this, currentTarget: this});
    this.handlers.set(name, (this.handlers.get(name) || []).filter(listener => !listener.once));
  }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    const data = selector.match(/^\[data-([^=]+)="([^"]+)"\]$/);
    if (data) return String(this.dataset[data[1]]) === data[2];
    if (selector === 'dialog[open]') return this.tagName === 'dialog' && this.open;
    return this.tagName === selector;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => { for (const child of node.children) { if (child.matches(selector)) found.push(child); visit(child); } };
    visit(this); return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

const face = (text = '', imageId = '') => ({text, imageId});
const label = value => value?.text?.trim() || (value?.imageId ? 'Billedside' : 'Tom side');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function harness({faces = [face('', 'first'), face('', 'second')], outcome = 0, imageURL = async id => `blob:${id}`, reducedMotion = false, storedEffects, scheduleTimeout = setTimeout} = {}) {
  const body = new Element('body'); body._root = true;
  const ids = new Map();
  const node = (id, parent = body, tag = 'div', cls = '') => {
    const element = new Element(tag); element.id = id; element.className = cls; parent.append(element); if (id) ids.set(id, element); return element;
  };
  node('effects-button', body, 'button');
  const area = node('', body, 'section', 'play-area');
  const arena = node('', area, 'div', 'arena');
  node('', arena, 'div', 'die-stage');
  node('board-surface', arena);
  node('board-result-media', arena);
  node('result-value', arena, 'p');
  for (const id of ['count-label', 'roll-label', 'roll-hint', 'progress-label', 'reveal-particles']) node(id, area);
  for (const value of ['dice', 'slot', 'wheel']) { const button = node('', area, 'button', 'board-choice'); button.dataset.board = value; }
  const storage = new Map([['neon-terninger-board-v1', 'wheel']]);
  if (storedEffects !== undefined) storage.set('neon-terninger-effects-v1', storedEffects);
  const mediaListeners = new Set();
  const media = {
    matches: reducedMotion,
    addEventListener(type, callback) { if (type === 'change') mediaListeners.add(callback); },
    addListener(callback) { mediaListeners.add(callback); }
  };
  const setReducedMotion = value => {
    if (media.matches === value) return;
    media.matches = value;
    for (const callback of mediaListeners) callback({matches: value, media: '(prefers-reduced-motion: reduce)'});
  };
  const document = {
    body, getElementById: id => ids.get(id) || null,
    createElement: tag => new Element(tag), createElementNS: (_namespace, tag) => new Element(tag),
    querySelector: selector => body.querySelector(selector), querySelectorAll: selector => body.querySelectorAll(selector)
  };
  const context = vm.createContext({
    window: {}, document,
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value))},
    matchMedia: () => media,
    setTimeout: scheduleTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: callback => callback()
  });
  vm.runInContext(boardSource, context, {filename: path.join(DOCS, 'boards.js')});
  const state = {
    config: {count: 1, dice: Array.from({length: 4}, (_, index) => ({name: `Terning ${index + 1}`, faces}))},
    selected: 0, next: 0, busy: false,
    results: [outcome === null ? null : faces[outcome], null, null, null],
    resultIndices: [outcome, null, null, null]
  };
  let ui;
  const render = () => {
    // The real app owns this text and calls NeonBoards after its own render.
    ids.get('result-value').textContent = state.results[state.selected] ? label(state.results[state.selected]) : 'Hvad mon det bliver?';
    ui.render(state);
  };
  ui = context.window.NeonBoards.create({onChange: render, onSelect() {}, faceLabel: label, imageURL});
  return {ui, state, document, render, storage, setReducedMotion, get: id => ids.get(id), result: ids.get('board-result-media')};
}

const tests = [];
const test = (name, run) => tests.push({name, run});

const EFFECTS_KEY = 'neon-terninger-effects-v1';
function assertEffects(h, expected, disabled = false) {
  assert.equal(h.document.body.dataset.effects, expected, 'Effective motion setting');
  assert.equal(h.get('effects-button').getAttribute('aria-pressed'), String(expected === 'full'), 'Accessible toggle state');
  assert.equal(h.get('effects-button').disabled, disabled, 'Effects toggle availability');
  assert.match(h.get('effects-button').textContent, expected === 'full' ? /Effekter til/ : /Effekter fra/);
}

test('Without an explicit choice effects follow OS changes and remain user-controllable', () => {
  for (const storedEffects of [undefined, 'auto']) {
    const h = harness({outcome: null, storedEffects});
    h.render(); assertEffects(h, 'full');
    h.setReducedMotion(true); assertEffects(h, 'quiet');
    h.setReducedMotion(false); assertEffects(h, 'full');
    assert.equal(h.storage.get(EFFECTS_KEY), storedEffects, 'OS changes must not save an explicit choice');
  }
});

test('Explicit full effects override reduced OS motion and survive OS changes', () => {
  const h = harness({outcome: null, storedEffects: 'full', reducedMotion: true});
  h.render(); assertEffects(h, 'full');
  h.setReducedMotion(false); assertEffects(h, 'full');
  h.setReducedMotion(true); assertEffects(h, 'full');
  assert.equal(h.storage.get(EFFECTS_KEY), 'full');
});

test('Explicit quiet effects remain quiet after reload and OS changes', () => {
  const original = harness({outcome: null, storedEffects: 'quiet'});
  original.render(); assertEffects(original, 'quiet');
  original.setReducedMotion(true); assertEffects(original, 'quiet');
  original.setReducedMotion(false); assertEffects(original, 'quiet');
  const reloaded = harness({outcome: null, storedEffects: original.storage.get(EFFECTS_KEY)});
  reloaded.render(); assertEffects(reloaded, 'quiet');
});

test('Clicking effects under reduced OS motion turns them on in one click and persists the choice', () => {
  const h = harness({outcome: null, reducedMotion: true});
  h.render(); assertEffects(h, 'quiet');
  h.get('effects-button').dispatch('click');
  assertEffects(h, 'full'); assert.equal(h.storage.get(EFFECTS_KEY), 'full');
  const reloaded = harness({outcome: null, reducedMotion: true, storedEffects: h.storage.get(EFFECTS_KEY)});
  reloaded.render(); assertEffects(reloaded, 'full');
  h.get('effects-button').dispatch('click');
  assertEffects(h, 'quiet'); assert.equal(h.storage.get(EFFECTS_KEY), 'quiet');
  h.get('effects-button').dispatch('click');
  assertEffects(h, 'full'); assert.equal(h.storage.get(EFFECTS_KEY), 'full');
});

test('Turning automatic full effects off saves quiet and subsequent OS changes do not undo it', () => {
  const h = harness({outcome: null});
  h.render(); assertEffects(h, 'full');
  h.get('effects-button').dispatch('click');
  assertEffects(h, 'quiet'); assert.equal(h.storage.get(EFFECTS_KEY), 'quiet');
  h.setReducedMotion(true); assertEffects(h, 'quiet');
  h.setReducedMotion(false); assertEffects(h, 'quiet');
});

test('The effects toggle is disabled only while busy and cannot change preferences during a roll', () => {
  const h = harness({outcome: null, reducedMotion: true});
  h.render(); assertEffects(h, 'quiet');
  h.state.busy = true; h.render(); assertEffects(h, 'quiet', true);
  // Invoke the listener directly as well: its busy guard must protect callers.
  h.get('effects-button').dispatch('click'); assertEffects(h, 'quiet', true);
  assert.equal(h.storage.has(EFFECTS_KEY), false);
  h.setReducedMotion(false); assertEffects(h, 'full', true);
  h.get('effects-button').dispatch('click'); assertEffects(h, 'full', true);
  assert.equal(h.storage.has(EFFECTS_KEY), false);
  h.state.busy = false; h.render(); assertEffects(h, 'full');
  h.setReducedMotion(true); assertEffects(h, 'quiet');
});

test('An invalid stored effects preference safely falls back to the OS setting', () => {
  const h = harness({outcome: null, reducedMotion: true, storedEffects: 'invalid-setting'});
  h.render(); assertEffects(h, 'quiet');
  h.setReducedMotion(false); assertEffects(h, 'full');
});

test('The effective effects preference controls real wheel spin duration', async () => {
  for (const {storedEffects, reducedMotion, animated} of [
    {storedEffects: undefined, reducedMotion: true, animated: false},
    {storedEffects: undefined, reducedMotion: false, animated: true},
    {storedEffects: 'full', reducedMotion: true, animated: true},
    {storedEffects: 'quiet', reducedMotion: false, animated: false}
  ]) {
    const durations = [];
    const h = harness({outcome: null, storedEffects, reducedMotion, scheduleTimeout: (callback, duration) => {
      durations.push(duration); queueMicrotask(callback); return 0;
    }});
    h.render(); await h.ui.spin(0, 1, () => {});
    assert.equal(durations.length, 1, 'Exactly one spin completion delay');
    assert.equal(durations[0] > 1000, animated, `Unexpected spin duration for ${storedEffects || 'auto'} / OS reduce=${reducedMotion}`);
  }
});

test('Image-only wheel outcome loads in the large panel with a numbered label', async () => {
  const pending = deferred();
  const h = harness({faces: Array.from({length: 20}, (_, index) => face('', `picture-${index + 1}`)), outcome: 6, imageURL: () => pending.promise});
  h.render();
  assert.equal(h.result.hidden, false);
  assert.match(h.result.textContent, /Indlæser/);
  pending.resolve('blob:picture-7'); await flush();
  assert.equal(h.result.children.length, 1);
  const image = h.result.querySelector('img');
  assert.equal(image.src, 'blob:picture-7');
  assert.equal(image.alt, 'Billedside 7');
  assert.equal(image.className, 'wheel-result-image');
  assert.equal(h.get('result-value').textContent, 'Billedside 7');
});

test('Image plus text keeps the complete caption and image alternative text', async () => {
  const caption = 'En længere billedtekst med mellemrum, æ, ø og å, som skal bevares i resultatet.';
  const h = harness({faces: [face(caption, 'with-caption'), face('Anden side')], imageURL: async () => 'blob:caption'});
  h.render(); await flush();
  assert.equal(h.result.querySelector('img').alt, caption);
  assert.equal(h.get('result-value').textContent, caption);
});

test('Twenty image-only wheel fields have twenty distinct numbered labels', () => {
  const h = harness({faces: Array.from({length: 20}, (_, index) => face('', `picture-${index + 1}`)), outcome: null});
  h.render();
  const labels = h.document.querySelectorAll('.wheel-label').map(node => node.textContent);
  assert.deepEqual(labels, Array.from({length: 20}, (_, index) => `#${index + 1}`));
  assert.equal(new Set(labels).size, 20);
  assert.equal(h.result.hidden, true);
});

test('An awaited wheel image cannot reappear after switching to dice', async () => {
  const pending = deferred();
  const h = harness({imageURL: () => pending.promise});
  h.render(); h.ui.setMode('dice');
  assert.equal(h.result.hidden, true);
  pending.resolve('blob:obsolete'); await flush();
  assert.equal(h.result.children.length, 0);
  assert.equal(h.result.hidden, true);
  assert.equal(h.document.querySelector('.die-stage').hidden, false);
});

test('Rapid wheel-slot-wheel changes discard old images and keep the newest outcome', async () => {
  const old = deferred(), latest = deferred();
  const h = harness({imageURL: id => id === 'first' ? old.promise : latest.promise});
  h.render(); h.ui.setMode('slot');
  assert.equal(h.result.hidden, true);
  h.state.results[0] = h.state.config.dice[0].faces[1]; h.state.resultIndices[0] = 1;
  h.ui.setMode('wheel');
  old.resolve('blob:obsolete'); await flush();
  assert.equal(h.result.querySelector('img'), null);
  assert.match(h.result.textContent, /Indlæser/);
  latest.resolve('blob:latest'); await flush();
  assert.equal(h.result.children.length, 1);
  assert.equal(h.result.querySelector('img').src, 'blob:latest');
  assert.equal(h.result.querySelector('img').alt, 'Billedside 2');
});

test('A new roll clears the previous image and blocks its late response', async () => {
  const pending = deferred();
  const h = harness({imageURL: () => pending.promise});
  h.render(); h.state.busy = true; h.render();
  pending.resolve('blob:late'); await flush();
  assert.equal(h.result.hidden, true);
  assert.equal(h.result.children.length, 0);
});

test('Missing stored image produces an explicit visible fallback', async () => {
  const h = harness({imageURL: async () => ''}); h.render(); await flush();
  assert.equal(h.result.hidden, false);
  assert.equal(h.result.querySelector('img'), null);
  assert.match(h.result.textContent, /Billedet kunne ikke indlæses/);
});

test('A failed image decode produces the same fallback', async () => {
  const h = harness(); h.render(); await flush();
  h.result.querySelector('img').dispatch('error');
  assert.equal(h.result.querySelector('img'), null);
  assert.match(h.result.textContent, /Billedet kunne ikke indlæses/);
});

test('An error event from a detached old image cannot erase a newer result', async () => {
  const h = harness(); h.render(); await flush();
  const oldImage = h.result.querySelector('img');
  h.state.results[0] = h.state.config.dice[0].faces[1]; h.state.resultIndices[0] = 1;
  h.render(); await flush(); oldImage.dispatch('error');
  assert.equal(h.result.querySelector('img').src, 'blob:second');
  assert.equal(h.result.querySelector('img').alt, 'Billedside 2');
});

test('Text-only outcomes keep the media panel empty and hidden', async () => {
  const h = harness({faces: [face('Tekst uden billede'), face('Anden side')]});
  h.render(); await flush();
  assert.equal(h.result.hidden, true); assert.equal(h.result.children.length, 0);
  assert.equal(h.get('result-value').textContent, 'Tekst uden billede');
});

test('HTML and manifest assets exist and are included in the v9 offline cache', () => {
  const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, 'manifest.webmanifest'), 'utf8'));
  const sw = fs.readFileSync(path.join(DOCS, 'sw.js'), 'utf8');
  const swContext = vm.createContext({self: {addEventListener() {}}});
  vm.runInContext(sw + '\n;globalThis.audit = {CACHE, ASSETS};', swContext);
  const {CACHE, ASSETS} = swContext.audit;
  assert.match(CACHE, /^neon-terninger-v9(?:-|$)/);
  const urls = [...html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="(\.\/[^"?#]+)"/g)].map(match => match[1]);
  urls.push(...manifest.icons.map(icon => icon.src));
  for (const url of new Set([...urls, ...ASSETS])) {
    const file = path.join(DOCS, url === './' ? 'index.html' : url);
    assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `Missing asset: ${url}`);
  }
  for (const url of urls) assert.ok(ASSETS.includes(url), `Not cached: ${url}`);
  assert.ok(html.indexOf('src="./boards.js"') < html.indexOf('src="./app.js"'), 'NeonBoards must load before app.js');
  assert.match(html, /id="board-result-media"[^>]*hidden/);
  const css = fs.readFileSync(path.join(DOCS, 'boards.css'), 'utf8');
  assert.match(css, /\.board-result-media\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

(async () => {
  let failures = 0;
  for (const {name, run} of tests) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
  }
  console.log(`\n${tests.length - failures}/${tests.length} board regression tests passed (${DOCS}).`);
  if (failures) process.exitCode = 1;
})();
