import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { parse, parseFragment, serialize } from 'parse5';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://morrowlogic.com';
const locales = ['en', 'zh-CN'];
const pages = [['index', '/'], ['privacy', '/pages/privacy']];
const pathFor = (locale, path) => (locale === 'en' ? '' : '/zh-CN') + path;
const get = (node, name) => node.attrs?.find(a => a.name === name)?.value;
function set(node, name, value) {
  const attr = node.attrs.find(a => a.name === name);
  if (attr) attr.value = value;
  else node.attrs.push({ name, value });
}
function text(node, value) { node.childNodes = [{ nodeName: '#text', value, parentNode: node }]; }
function visit(node, fn) {
  fn(node);
  for (const child of [...(node.childNodes || [])]) visit(child, fn);
}
function write(path, content) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
for (const locale of locales) {
  let messages;
  runInNewContext(readFileSync(resolve(root, `assets/js/locales/${locale}.js`), 'utf8'), {
    registerLocale: (name, dictionary) => { if (name === locale) messages = dictionary; }
  });
  for (const [page, base] of pages) {
    const doc = parse(readFileSync(resolve(root, `templates/${page}.html`), 'utf8'));
    const url = origin + pathFor(locale, base);
    visit(doc, node => {
      if (!node.tagName) return;
      const key = get(node, 'data-i18n');
      if (key) {
        if (!(key in messages)) throw new Error(`Missing ${locale}: ${key}`);
        const value = messages[key];
        const attr = get(node, 'data-i18n-attr');
        if (attr) set(node, attr, value);
        else if (get(node, 'data-i18n-html') !== undefined) {
          node.childNodes = parseFragment(value).childNodes;
          node.childNodes.forEach(child => { child.parentNode = node; });
        } else text(node, value);
      }
      if (node.tagName === 'html') { set(node, 'lang', locale); set(node, 'data-locale', locale); }
      if (get(node, 'rel') === 'canonical' || get(node, 'property') === 'og:url') {
        set(node, node.tagName === 'link' ? 'href' : 'content', url);
      }
      if (get(node, 'rel') === 'alternate') {
        const lang = get(node, 'hreflang');
        set(node, 'href', origin + pathFor(lang === 'x-default' ? 'en' : lang, base));
      }
      const lang = get(node, 'data-lang-option');
      if (lang) { set(node, 'href', pathFor(lang, base)); if (lang === locale) set(node, 'aria-current', 'page'); }
      if (get(node, 'data-lang-current') !== undefined) text(node, locale === 'en' ? 'English' : '简体中文');
      const pageLink = get(node, 'data-page-link');
      if (pageLink) set(node, 'href', pathFor(locale, pageLink));
      const anchor = get(node, 'data-home-anchor');
      if (anchor) set(node, 'href', pathFor(locale, '/') + '#' + anchor);
      if (node.tagName === 'script' && get(node, 'type') === 'application/ld+json') {
        const data = JSON.parse(node.childNodes[0].value);
        for (const entity of data['@graph']) {
          if (entity['@type'] === 'WebPage') {
            entity['@id'] = url + '#webpage'; entity.url = url;
            entity.name = messages[page === 'privacy' ? 'privacy.meta.title' : 'meta.title'];
            entity.inLanguage = locale;
          }
        }
        text(node, JSON.stringify(data));
      }
      if (node.tagName === 'script' && get(node, 'src') === '/assets/js/locales/en.js') {
        set(node, 'src', `/assets/js/locales/${locale}.js`);
      }
      // New URLs also bypass immutable copies cached by the previous release.
      for (const name of ['href', 'src']) {
        const asset = get(node, name);
        if (asset?.startsWith('/assets/')) {
          const hash = createHash('sha256').update(readFileSync(resolve(root, '.' + asset))).digest('hex').slice(0, 12);
          set(node, name, asset + '?v=' + hash);
        }
      }
    });
    const output = (locale === 'en' ? '' : 'zh-CN/') + (page === 'index' ? 'index.html' : 'pages/privacy.html');
    write(output, serialize(doc) + '\n');
    console.log(`Built ${output}`);
  }
}
const urls = pages.flatMap(([, base]) => locales.map(locale => `  <url><loc>${origin + pathFor(locale, base)}</loc>${['en', 'zh-CN', 'x-default'].map(lang => `<xhtml:link rel="alternate" hreflang="${lang}" href="${origin + pathFor(lang === 'x-default' ? 'en' : lang, base)}"/>`).join('')}</url>`));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
