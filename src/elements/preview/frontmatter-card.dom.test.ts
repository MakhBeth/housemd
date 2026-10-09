import '../../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import '../define';
import { translate } from '../../i18n/i18n';
import { EN_MESSAGES } from '../../i18n/messages';
import { splitFrontmatter, type Frontmatter } from '../../preview/frontmatter';
import { createI18nStore } from '../../state/i18nStore';
import { countListeners } from '../../testing/countListeners';
import type { ResolveImage } from './previewView';

const t = (key: string, params?: Record<string, string>) => translate(EN_MESSAGES, key, params);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const fm = (yaml: string): Frontmatter => splitFrontmatter(`---\n${yaml}\n---\n`).frontmatter!;

/** Risolutore finto: registra le richieste e risponde quando lo dice il test. */
function resolver() {
  const calls: string[] = [];
  const pending = new Map<string, (url: string | null) => void>();
  const resolve: ResolveImage = (src) => {
    calls.push(src);
    return new Promise((done) => pending.set(src, done));
  };
  return { resolve, calls, answer: (src: string, url: string | null) => pending.get(src)!(url) };
}

function mount(frontmatter: Frontmatter | null, resolveImage: ResolveImage = resolver().resolve) {
  const counted = countListeners(
    createI18nStore({ locale: 'en', messages: EN_MESSAGES, load: async (locale) => ({ locale, messages: { ...EN_MESSAGES, 'preview.frontmatterInvalid': 'NON VALIDO {detail}' } }), persist() {} }),
  );
  const el = document.createElement('hmd-frontmatter-card');
  el.frontmatter = frontmatter;
  el.resolveImage = resolveImage;
  el.i18n = counted.store;
  document.body.append(el);
  return { el, i18n: counted.store, listeners: counted.listeners };
}

test('nothing without frontmatter; an empty frontmatter is an empty card', async () => {
  const none = mount(null);
  await tick();
  assert.equal(none.el.childElementCount, 0);
  none.el.remove();
  const empty = mount(fm(''));
  await tick();
  assert.deepEqual([...empty.el.children].map((c) => [c.localName, c.className, c.childElementCount]), [['header', 'card', 0]]);
  empty.el.remove();
});

test('invalid YAML: a note with the error, no card', async () => {
  const frontmatter = fm('title: [');
  const { el } = mount(frontmatter);
  await tick();
  const note = el.firstElementChild!;
  assert.deepEqual([note.localName, note.className, note.getAttribute('role')], ['div', 'card-error', 'note']);
  assert.equal(note.textContent, t('preview.frontmatterInvalid', { detail: frontmatter.error! }));
  assert.equal(el.childElementCount, 1);
  el.remove();
});

test('the same tree as FrontmatterCard.tsx: title, meta (date and tags), description, extra fields', async () => {
  const { el } = mount(fm('title: Hello\ndate: 2026-01-15\ntags: [alpha, beta]\ndescription: Short\nauthor: Ada\nimage: pic.png'));
  await tick();
  const header = el.firstElementChild!;
  assert.deepEqual([header.localName, header.className], ['header', 'card']);
  // L'immagine non è ancora arrivata: nessun <img>.
  assert.deepEqual([...header.children].map((c) => [c.localName, c.className]), [
    ['p', 'card-title'], ['p', 'card-meta'], ['p', 'card-description'], ['dl', 'card-extra'],
  ]);
  const meta = header.children[1];
  assert.deepEqual([...meta.children].map((c) => [c.localName, c.className, c.textContent]), [
    ['time', '', 'January 15, 2026'], ['span', 'tag', 'alpha'], ['span', 'tag', 'beta'],
  ]);
  assert.equal(meta.firstElementChild!.getAttribute('datetime'), '2026-01-15');
  assert.deepEqual([...header.querySelectorAll('dl > div')].map((row) => [...row.children].map((c) => [c.localName, c.textContent])), [
    [['dt', 'author'], ['dd', 'Ada']],
  ]);
  el.remove();
});

test('the image comes first once resolved; the same image on a new frontmatter keeps the node and is not asked again', async () => {
  const r = resolver();
  const { el } = mount(fm('title: T\nimage: pic.png'), r.resolve);
  await tick();
  r.answer('pic.png', 'blob:pic');
  await tick();
  const img = el.querySelector('header')!.firstElementChild as HTMLImageElement;
  assert.deepEqual([img.localName, img.className, img.getAttribute('src'), img.getAttribute('alt')], ['img', 'card-image', 'blob:pic', '']);
  // Mentre si scrive l'anteprima passa un frontmatter nuovo a ogni debounce: niente lampeggio.
  el.frontmatter = fm('title: T2\nimage: pic.png');
  await tick();
  assert.equal(el.querySelector('img'), img);
  assert.deepEqual(r.calls, ['pic.png']);
  // Risolutore nuovo (altro file, altra configurazione): immagine tolta finché non arriva di nuovo.
  const r2 = resolver();
  el.resolveImage = r2.resolve;
  await tick();
  assert.equal(el.querySelector('img'), null);
  assert.deepEqual(r2.calls, ['pic.png']);
  el.remove();
});

test('a late answer for an image no longer shown is ignored', async () => {
  const r = resolver();
  const { el } = mount(fm('image: a.png'), r.resolve);
  await tick();
  el.frontmatter = fm('image: b.png');
  await tick();
  r.answer('a.png', 'blob:a');
  await tick();
  assert.equal(el.querySelector('img'), null);
  r.answer('b.png', 'blob:b');
  await tick();
  assert.equal(el.querySelector('img')!.getAttribute('src'), 'blob:b');
  el.remove();
});

test('duplicate tags are shown twice (no key error)', async () => {
  const { el } = mount(fm('tags: [a, a]'));
  await tick();
  assert.deepEqual([...el.querySelectorAll('.tag')].map((s) => s.textContent), ['a', 'a']);
  el.remove();
});

test('a language change reformats the date and the error in place', async () => {
  const { el, i18n } = mount(fm('date: 2026-01-15'));
  await tick();
  const time = el.querySelector('time')!;
  await i18n.setLocale('it');
  await tick();
  assert.equal(el.querySelector('time'), time);
  assert.equal(time.textContent, '15 gennaio 2026');
  el.frontmatter = fm('title: [');
  await tick();
  assert.match(el.firstElementChild!.textContent!, /^NON VALIDO /);
  el.remove();
});

test('detached: no listener left, a pending image is dropped and asked again on return', async () => {
  const r = resolver();
  const { el, listeners } = mount(fm('image: a.png'), r.resolve);
  await tick();
  el.remove();
  assert.equal(listeners(), 0);
  r.answer('a.png', 'blob:a');
  await tick();
  assert.equal(el.querySelector('img'), null);
  document.body.append(el);
  await tick();
  assert.deepEqual(r.calls, ['a.png', 'a.png']);
  el.remove();
});
