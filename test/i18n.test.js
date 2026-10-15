// -----------------------------------------------------------------------------
// Every text Gladys shows exists in the four languages of its interface
// (English, French, German, Spanish): the manifest, the message tables of the
// code, the feature names, and the four documentation files (same sections).
// German says "du", never the polite "Sie"; Spanish says "usted".
// -----------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import { LANGS, MESSAGES, NAMES, REPORT_TEXT, TEXT, testReport } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const EXPECTED = ['en', 'fr', 'de', 'es'];
const POLITE_GERMAN = /(?<!\p{L})(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})/u;
// Informal Spanish forms where "usted" is expected.
const INFORMAL_SPANISH = /(?<!\p{L})(tú|tu|tus|contigo|introduce|elige|comprueba)(?!\p{L})/iu;

// Upper bounds, in characters: what the Gladys interface shows without cutting.
const MAX = {
  catalog: 100,
  widgetLabel: 30,
  label: 60,
  placeholder: 60,
  description: 300,
  message: 200,
  short: 40,
  featureName: 40,
};

const sorted = (keys) => [...keys].sort();

function textProblems(text, path, lang, max) {
  if (typeof text !== 'string' || text.trim() === '') {
    return [`${path} is empty`];
  }
  const found = [];
  if (text.length > max) {
    found.push(`${path} has ${text.length} characters (${max} at most)`);
  }
  if (lang === 'de' && POLITE_GERMAN.test(text)) {
    found.push(`${path} uses the polite German form: "${text}"`);
  }
  if (lang === 'es' && INFORMAL_SPANISH.test(text)) {
    found.push(`${path} uses the informal Spanish form: "${text}"`);
  }
  return found;
}

/** Checks one multi-language object; returns its problems. */
function problems(value, path, max) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be a multi-language object`];
  }
  const found = [];
  if (JSON.stringify(sorted(Object.keys(value))) !== JSON.stringify(sorted(EXPECTED))) {
    found.push(`${path} has [${Object.keys(value)}], expected exactly [${EXPECTED}]`);
  }
  for (const [lang, text] of Object.entries(value)) {
    found.push(...textProblems(text, `${path}.${lang}`, lang, max));
  }
  return found;
}

/** Every multi-language object of the manifest, with its length limit. */
function manifestTexts(root) {
  const texts = [];
  const walk = (value, path, key) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, key));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const isText =
      ['label', 'description', 'placeholder'].includes(key) ||
      Object.keys(value).some((child) => EXPECTED.includes(child));
    if (isText) {
      const max =
        path === 'manifest.description' || /^manifest\.widgets\[\d+\]\.description$/.test(path)
          ? MAX.catalog
          : /^manifest\.widgets\[\d+\]\.label$/.test(path)
            ? MAX.widgetLabel
            : (MAX[key] ?? MAX.label);
      texts.push({ path, value, max });
      return;
    }
    for (const [child, item] of Object.entries(value)) {
      walk(item, `${path}.${child}`, child);
    }
  };
  walk(root, 'manifest', null);
  return texts;
}

// Tables written one language at a time: same keys everywhere, no empty text.
function tableProblems(table, name, max, render = (value) => value) {
  const found = [];
  if (JSON.stringify(sorted(Object.keys(table))) !== JSON.stringify(sorted(EXPECTED))) {
    found.push(`${name} has [${Object.keys(table)}], expected exactly [${EXPECTED}]`);
  }
  for (const lang of EXPECTED) {
    const entries = table[lang] ?? {};
    if (
      JSON.stringify(sorted(Object.keys(entries))) !== JSON.stringify(sorted(Object.keys(table.en)))
    ) {
      found.push(`${name}.${lang} does not have the keys of ${name}.en`);
    }
    for (const [key, value] of Object.entries(entries)) {
      found.push(...textProblems(render(value), `${name}.${lang}.${key}`, lang, max));
    }
  }
  return found;
}

test('the configuration and the code offer the four languages', () => {
  assert.deepEqual(LANGUAGES, EXPECTED);
  assert.deepEqual(LANGS, EXPECTED);
});

test('every text of the manifest is in English, French, German and Spanish', () => {
  const texts = manifestTexts(manifest);
  assert.ok(texts.length >= 60, `only ${texts.length} texts found in the manifest`);
  assert.deepEqual(
    texts.flatMap(({ path, value, max }) => problems(value, path, max)),
    [],
  );
});

test('the manifest name is the same in every language (a brand)', () => {
  assert.equal(typeof manifest.name, 'string');
});

test('the feature names and the short texts exist in every language', () => {
  assert.deepEqual(tableProblems(NAMES, 'NAMES', MAX.featureName), []);
  assert.deepEqual(tableProblems(TEXT, 'TEXT', MAX.short), []);
  // Widget buttons: 24 characters at most.
  for (const lang of EXPECTED) {
    for (const key of ['power', 'channelDown', 'channelUp', 'mute']) {
      assert.ok(TEXT[lang][key].length <= 24, `TEXT.${lang}.${key}`);
    }
  }
});

test('every message exists in every language', () => {
  assert.deepEqual(
    Object.entries(MESSAGES).flatMap(([key, value]) =>
      problems(value, `MESSAGES.${key}`, MAX.message),
    ),
    [],
  );
});

test('the test report exists in every language', () => {
  const render = (value) => (typeof value === 'function' ? value(12, 'Favourites (TV)') : value);
  assert.deepEqual(tableProblems(REPORT_TEXT, 'REPORT_TEXT', MAX.message, render), []);
  const report = testReport({
    invalidSlots: [3],
    receivers: [
      {
        slot: 1,
        host: '192.0.2.20',
        answered: true,
        authRefused: false,
        name: 'Salon',
        webif: 'OWIF 2.2.0',
        channels: 12,
        bouquet: 'Favourites (TV)',
      },
      { slot: 2, host: '192.0.2.21', answered: false, authRefused: true },
    ],
  });
  assert.deepEqual(problems(report, 'testReport', 500), []);
  assert.match(report.de, /Receiver 2 \(192\.0\.2\.21\): Benutzer oder Passwort abgelehnt\./);
});

test('the guard catches a missing language, an empty text, polite German, informal Spanish', () => {
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: '', es: 'a' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a'.repeat(61), es: 'a' }, 'x', 60).length, 1);
  for (const polite of ['Wählen Sie', 'Ihr Gerät', 'Ihre IP', 'mit Ihrem']) {
    assert.equal(problems({ en: 'a', fr: 'a', de: polite, es: 'a' }, 'x', 60).length, 1, polite);
  }
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a', es: 'Elige tu receptor' }, 'x', 60).length, 1);
  assert.deepEqual(
    problems({ en: 'a', fr: 'a', de: 'Siebenschläfer', es: 'Elija su receptor' }, 'x', 60),
    [],
  );
  const forgotten = structuredClone(manifest);
  delete forgotten.scene_actions[0].fields[1].placeholder.de;
  assert.deepEqual(
    manifestTexts(forgotten).flatMap(({ path, value, max }) => problems(value, path, max)),
    [
      'manifest.scene_actions[0].fields[1].placeholder has [en,fr,es], expected exactly [en,fr,de,es]',
    ],
  );
});

// --- Documentation ------------------------------------------------------------

const docs = Object.fromEntries(
  await Promise.all(
    EXPECTED.map(async (lang) => [
      lang,
      await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8'),
    ]),
  ),
);

/** The structure of a doc: its level-2 and level-3 headings, as levels only. */
const outline = (text) =>
  text
    .split('\n')
    .filter((line) => /^#{1,3} /.test(line))
    .map((line) => line.match(/^#+/)[0].length);

test('the four documentation files have the same sections', () => {
  const reference = outline(docs.en);
  assert.ok(reference.filter((level) => level === 2).length >= 8, 'en.md has its sections');
  for (const lang of EXPECTED) {
    assert.deepEqual(outline(docs[lang]), reference, `docs/${lang}.md sections`);
    assert.ok(docs[lang].length >= 300);
  }
});

test('the documentation says the integration was developed without the hardware', () => {
  const marks = {
    en: /without the hardware/i,
    fr: /sans le matériel/i,
    de: /ohne die Hardware/i,
    es: /sin el hardware/i,
  };
  for (const lang of EXPECTED) {
    assert.match(docs[lang], marks[lang], `docs/${lang}.md`);
  }
});

test('German documentation says "du", never "Sie"', () => {
  assert.ok(!POLITE_GERMAN.test(docs.de.replace(/`[^`]*`/g, '')));
});
