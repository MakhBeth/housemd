import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { isLocale, placeholders, SUPPORTED_LOCALES } from './i18n';

const dir = fileURLToPath(new URL('./locales/', import.meta.url));
const read = (locale: string): Record<string, unknown> => JSON.parse(readFileSync(`${dir}${locale}.json`, 'utf8'));
const en = read('en') as Record<string, string>;

for (const locale of SUPPORTED_LOCALES) {
  test(`${locale}.json has exactly the keys of en.json, no empty strings and the same placeholders`, () => {
    const messages = read(locale);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(messages)) {
      assert.equal(typeof value, 'string', `${locale}: ${key} non è una stringa`);
      assert.ok((value as string).trim().length > 0, `${locale}: ${key} è vuota`);
      assert.deepEqual(placeholders(value as string), placeholders(en[key]), `${locale}: segnaposto di ${key}`);
    }
  });
}

test('every file in locales/ is a supported locale', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.deepEqual(files.map((f) => f.slice(0, -5)).filter((l) => !isLocale(l)), []);
  assert.equal(files.length, SUPPORTED_LOCALES.length);
});

test('the non-reference locales are real translations, not copies of en.json', () => {
  for (const locale of SUPPORTED_LOCALES.filter((l) => l !== 'en' && l !== 'it')) {
    const messages = read(locale) as Record<string, string>;
    const keys = Object.keys(en);
    const copied = keys.filter((key) => messages[key] === en[key]);
    // Alcune voci restano identiche per natura (HouseMD, Editor, Split…): mai più di un quinto.
    assert.ok(copied.length / keys.length < 0.2, `${locale}: ${copied.length} valori identici all'inglese`);
  }
});
