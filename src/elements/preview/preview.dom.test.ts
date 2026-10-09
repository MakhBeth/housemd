import '../../testing/domEnv';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { DEFAULT_CONFIG } from '../../config/config';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import { waitFor } from '../../testing/waitFor';

// jsdom non ha ResizeObserver: basta che esista (le ancore si rifanno comunque a ogni render).
Object.assign(globalThis, { ResizeObserver: class { observe() {} disconnect() {} } });

const t = (key: string, params?: Record<string, string>) => translate(EN_MESSAGES, key, params);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cartella finta: i file elencati esistono, gli altri mancano; `slow` aspetta `release` prima di rispondere. */
function folder(present: Record<string, string>, slow?: { path: string; release: Promise<void> }) {
  const reads: string[] = [];
  const readBlob = async (path: string): Promise<Blob> => {
    reads.push(path);
    if (slow && path === slow.path) await slow.release;
    if (path in present) return new Blob([present[path]]);
    throw new Error(`manca ${path}`);
  };
  return { readBlob, reads };
}

function mount(props: { text: string; path?: string; readBlob?: (path: string) => Promise<Blob> }) {
  const counted = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'preview.imageMissing': 'MANCA {path}' } }), persist() {} }),
  );
  const el = document.createElement('hmd-preview');
  el.text = props.text;
  el.path = props.path ?? 'note.md';
  el.files = ['note.md', 'idea.md'];
  el.config = DEFAULT_CONFIG;
  el.readBlob = props.readBlob ?? folder({}).readBlob;
  el.highlight = [];
  el.i18n = counted.store;
  document.body.append(el);
  const events: [string, unknown][] = [];
  for (const type of ['hmd-open', 'hmd-open-wiki', 'hmd-top-line'] as const) {
    el.addEventListener(type, (event) => events.push([type, (event as CustomEvent).detail]));
  }
  const parts = () => {
    const scroller = el.firstElementChild as HTMLDivElement;
    const article = scroller.firstElementChild as HTMLElement;
    return { scroller, article, body: article.lastElementChild as HTMLDivElement };
  };
  const h1 = () => parts().body.querySelector('h1')?.textContent ?? null;
  return { el, i18n: counted.store, listeners: counted.listeners, events, parts, h1 };
}

test('the tree of Preview.tsx: scroller, prose article, body filled through the sanitizer', async () => {
  const { el, parts } = mount({ text: '# Title\n\ntext <script>window.__x = 1</script>' });
  const { scroller, article, body } = parts();
  assert.deepEqual([scroller.localName, scroller.className, article.localName, article.className, body.localName, body.className], [
    'div', 'scroller', 'article', 'prose', 'div', '',
  ]);
  await waitFor(() => body.querySelector('h1') !== null);
  assert.equal(article.childElementCount, 1);
  assert.equal(body.querySelector('h1')!.className, 'hmd-l-0');
  assert.equal(body.querySelector('script'), null);
  el.remove();
});

test('frontmatter: the card comes before the body only when there is one; the frame keeps its nodes', async () => {
  const { el, parts, h1 } = mount({ text: '---\ntitle: Hello\n---\n# Body' });
  const { scroller, article, body } = parts();
  await waitFor(() => article.firstElementChild!.localName === 'hmd-frontmatter-card' && article.firstElementChild!.textContent === 'Hello');
  assert.equal(article.lastElementChild, body);
  el.path = 'other.md';
  el.text = '# Plain';
  await waitFor(() => h1() === 'Plain');
  assert.equal(article.querySelector('hmd-frontmatter-card'), null);
  assert.equal(parts().scroller, scroller);
  assert.equal(parts().body, body);
  el.remove();
});

test('text changes wait the debounce; a path change renders right away', async () => {
  const { el, h1 } = mount({ text: '# One' });
  await waitFor(() => h1() === 'One');
  el.text = '# Two';
  await sleep(60);
  assert.equal(h1(), 'One');
  await waitFor(() => h1() === 'Two', 1000);
  el.text = '# Three';
  el.path = 'other.md';
  await sleep(20);
  assert.equal(h1(), 'Three');
  el.remove();
});

test('a pending debounce never brings back the previous file', async () => {
  const { el, h1 } = mount({ text: '# A1', path: 'a.md' });
  await waitFor(() => h1() === 'A1');
  el.text = '# A2';
  await sleep(30); // timer di a.md in volo
  el.path = 'b.md';
  el.text = '# B';
  await waitFor(() => h1() === 'B', 100);
  await sleep(250);
  assert.equal(h1(), 'B');
  el.remove();
});

test('links: wiki and relative markdown become events; external links and anchors stay native', async () => {
  const { el, events, parts } = mount({ text: '[[idea]] [rel](sub/other.md) [pic](image.png) [out](https://example.com) [top](#top)' });
  const { body } = parts();
  await waitFor(() => body.querySelectorAll('a').length === 5);
  // Registrato dopo quello dell'elemento: legge se il clic è stato fermato, poi lo ferma (jsdom non naviga).
  const prevented: boolean[] = [];
  const record = (event: Event) => {
    prevented.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener('click', record);
  for (const name of ['idea', 'rel', 'pic', 'out', 'top']) {
    [...body.querySelectorAll('a')].find((a) => a.textContent === name)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  document.removeEventListener('click', record);
  assert.deepEqual(prevented, [true, true, true, false, false]);
  assert.deepEqual(events, [['hmd-open-wiki', { target: 'idea' }], ['hmd-open', { path: 'sub/other.md' }]]);
  const out = [...body.querySelectorAll('a')].find((a) => a.textContent === 'out')!;
  assert.deepEqual([out.getAttribute('target'), out.getAttribute('rel')], ['_blank', 'noopener noreferrer']);
  el.remove();
});

test('local images load through readBlob; missing ones get the class and a native title', async () => {
  const fs = folder({ 'assets/pixel.png': 'png' });
  const { el, parts } = mount({ text: '![pixel](assets/pixel.png)\n\n![missing](missing.png)\n\n![remote](https://example.com/r.png)', readBlob: fs.readBlob });
  const { body } = parts();
  const img = (alt: string) => body.querySelector<HTMLImageElement>(`img[alt="${alt}"]`);
  await waitFor(() => img('pixel')?.getAttribute('src')?.startsWith('blob:') === true);
  await waitFor(() => img('missing')?.classList.contains('missing-image') === true);
  assert.equal(img('missing')!.getAttribute('title'), t('preview.imageMissing', { path: 'missing.png' }));
  assert.equal(img('remote')!.getAttribute('src'), 'https://example.com/r.png');
  assert.deepEqual([...fs.reads].sort(), ['assets/pixel.png', 'missing.png']);
  el.remove();
});

test('a late image of a superseded render does not touch it (cancelled)', async () => {
  let release!: () => void;
  const fs = folder({}, { path: 'slow.png', release: new Promise<void>((done) => (release = done)) });
  const { el, parts } = mount({ text: '![slow](slow.png)', readBlob: fs.readBlob });
  const { body } = parts();
  await waitFor(() => body.querySelector('img') !== null && fs.reads.includes('slow.png'));
  const old = body.querySelector('img')!;
  el.path = 'other.md';
  el.text = 'no images';
  await waitFor(() => body.querySelector('img') === null);
  release();
  await sleep(20);
  assert.equal(old.classList.contains('missing-image'), false);
  assert.equal(old.hasAttribute('title'), false);
  el.remove();
});

test('scroll: the top line goes out as hmd-top-line, except right after scrollToLine', async () => {
  let now = 1000;
  mock.method(performance, 'now', () => now);
  const { el, events, parts } = mount({ text: '# A\n\ntext' });
  const { scroller, body } = parts();
  await waitFor(() => body.querySelector('h1') !== null);
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.at(-1)![0], 'hmd-top-line');
  const count = events.length;
  el.scrollToLine(1);
  scroller.dispatchEvent(new Event('scroll'));
  now += 149;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, count);
  now += 2;
  scroller.dispatchEvent(new Event('scroll'));
  assert.equal(events.length, count + 1);
  mock.restoreAll();
  el.remove();
});

test('a language change renders the body again (missing image title)', async () => {
  const { el, i18n, parts } = mount({ text: '![missing](missing.png)' });
  await waitFor(() => parts().body.querySelector('img')?.classList.contains('missing-image') === true);
  await i18n.setLocale('it');
  await waitFor(() => parts().body.querySelector('img')?.getAttribute('title') === 'MANCA missing.png');
  el.remove();
});

test('detached: the pending debounce does not render, no listener is left', async () => {
  const { el, listeners, h1 } = mount({ text: '# One' });
  await waitFor(() => h1() === 'One');
  el.text = '# Two';
  await sleep(30); // timer in volo
  el.remove();
  assert.equal(listeners(), 0);
  await sleep(250);
  assert.equal(h1(), 'One');
});
