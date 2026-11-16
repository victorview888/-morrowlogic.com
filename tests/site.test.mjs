import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { chromium } from 'playwright';
import { createSiteServer } from '../scripts/serve.mjs';

const pages = [ ['index.html', '/', 'en'], ['zh-CN/index.html', '/zh-CN/', 'zh-CN'], ['pages/privacy.html', '/pages/privacy', 'en'], ['zh-CN/pages/privacy.html', '/zh-CN/pages/privacy', 'zh-CN'] ];
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
function nodes(doc) { return [doc, ...(doc.childNodes || []).flatMap(nodes)]; }
function content(node) { return node?.value || (node?.childNodes || []).map(content).join(''); }
for (const [file, path, lang] of pages) {
  test(`${path}: rendered translations, SEO, links and assets`, () => {
    const html = readFileSync(file, 'utf8');
    const all = nodes(parse(html));
    assert.equal(attr(all.find(n => n.tagName === 'html'), 'lang'), lang);
    const privacy = path.includes('privacy');
    assert.match(content(all.find(n => n.tagName === 'title')), privacy ? /Privacy Policy|隐私政策/ : /Multi-Brand|多品牌/);
    assert.equal(attr(all.find(n => attr(n, 'rel') === 'canonical'), 'href'), 'https://morrowlogic.com' + path);
    assert.equal(attr(all.find(n => attr(n, 'property') === 'og:url'), 'content'), 'https://morrowlogic.com' + path);
    const alternate = all.filter(n => attr(n, 'rel') === 'alternate');
    assert.equal(alternate.length, 3);
    for (const n of all.filter(n => attr(n, 'data-i18n'))) {
      const target = attr(n, 'data-i18n-attr');
      assert.ok(target ? attr(n, target) : content(n).trim(), `Empty translation: ${attr(n, 'data-i18n')}`);
    }
    for (const n of all.filter(n => ['a', 'link', 'script', 'img'].includes(n.tagName))) {
      const href = attr(n, 'href') || attr(n, 'src');
      if (!href || /^(mailto:|https?:\/\/)/.test(href) && !href.startsWith('https://morrowlogic.com/')) continue;
      assert.notEqual(href, '#', 'Placeholder link');
      const url = new URL(href, 'https://morrowlogic.com' + path);
      let local = resolve('.' + url.pathname);
      if (url.pathname.endsWith('/')) local += '/index.html';
      else if (!existsSync(local)) local += '.html';
      assert.ok(existsSync(local) && statSync(local).isFile(), `Missing ${href} in ${file}`);
      if (url.hash) {
        const ids = nodes(parse(readFileSync(local, 'utf8'))).map(n => attr(n, 'id'));
        assert.ok(ids.includes(url.hash.slice(1)), `Missing anchor ${href}`);
      }
    }
    const structured = JSON.parse(content(all.find(n => attr(n, 'type') === 'application/ld+json')));
    const page = structured['@graph'].find(n => n['@type'] === 'WebPage');
    assert.equal(page.url, 'https://morrowlogic.com' + path);
    assert.equal(page.inLanguage, lang);
    assert.doesNotMatch(html, /XXXXXXXX|Building XX|30\+ brand|8M MAU|200万|1000万/);
    if (lang === 'en') assert.doesNotMatch(content(all.find(n => n.tagName === 'main')), /[\u4e00-\u9fff]/);
  });
}
let server, browser, base;
before(async () => {
  server = createSiteServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

for (const width of [320, 390, 768, 1440]) {
  test(`browser: ${width}px, both languages, keyboard and mobile menu`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    for (const path of ['/', '/zh-CN/', '/pages/privacy', '/zh-CN/pages/privacy']) {
      await page.goto(base + path);
      assert.ok(await page.locator('h1').isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}: ${path}`);
      await page.locator('[data-lang-btn]').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('[data-lang-btn]').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-lang-btn]').getAttribute('aria-expanded'), 'false');
      if (width <= 980) {
        await page.locator('[data-burger]').click();
        assert.ok(await page.locator('.nav__menu').isVisible());
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-burger]').getAttribute('aria-expanded'), 'false');
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test('direct Chinese privacy URL overrides saved English; switching language preserves page and hash', async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('ml_lang', 'en'));
  await page.goto(base + '/zh-CN/pages/privacy#main');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.match(await page.title(), /隐私政策/);
  await page.locator('[data-lang-btn]').click();
  await page.locator('[data-lang-option="en"]').click();
  await page.waitForURL(base + '/pages/privacy#main');
  assert.match(await page.title(), /Privacy Policy/);
  await page.goBack();
  assert.match(await page.title(), /隐私政策/);
  await page.reload();
  assert.match(await page.title(), /隐私政策/);
  await page.close();
});

test('no JavaScript: full content, language links and email remain accessible', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of ['/', '/zh-CN/', '/pages/privacy', '/zh-CN/pages/privacy']) {
    await page.goto(base + path);
    assert.ok(await page.locator('h1').isVisible());
    assert.ok(await page.locator('[data-lang-option="en"]').isVisible());
    assert.ok(await page.locator('a[href^="mailto:"]').first().isVisible());
  }
  await context.close();
});

test('language links retain anchors selected after the page loads', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(base + '/?source=test');
  await page.locator('.hero__cta a[href="#cases"]').click();
  await page.waitForURL(base + '/?source=test#cases');
  await page.locator('[data-lang-btn]').click();
  await page.locator('[data-lang-option="zh-CN"]').click();
  await page.waitForURL(base + '/zh-CN/?source=test#cases');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.close();
});

async function fillForm(page) {
  await page.locator('[name="name"]').fill('Test & Example');
  await page.locator('[name="email"]').fill('test@example.com');
  await page.locator('[name="message"]').fill('Test inquiry, not a real submission.');
}
test('email draft is explicit, keeps input and sends no HTTP request', async () => {
  const page = await browser.newPage();
  const posts = [];
  page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  await page.goto(base + '/zh-CN/');
  await fillForm(page);
  await page.locator('[data-form] button').click();
  assert.match(await page.locator('[data-form-status]').textContent(), /尚未向服务器提交/);
  const href = await page.locator('[data-form-draft]').getAttribute('href');
  assert.ok(href.startsWith('mailto:business@morrowlogic.com?'));
  assert.ok(decodeURIComponent(href).includes('Test & Example'));
  assert.equal(await page.locator('[name="email"]').inputValue(), 'test@example.com');
  assert.deepEqual(posts, []);
  await page.close();
});
for (const outcome of ['success', 'http-failure', 'network-failure']) {
  test(`configured form: ${outcome}, pending state and retained input`, async () => {
    const page = await browser.newPage();
    await page.route('**/assets/js/config.js*', r => r.fulfill({ contentType: 'text/javascript', body: "window.ML_FORM_ENDPOINT = 'https://forms.example.test/inquiries';" }));
    let requests = 0;
    await page.route('https://forms.example.test/inquiries', async route => {
      requests++;
      assert.equal(route.request().method(), 'POST');
      assert.equal(route.request().postDataJSON().email, 'test@example.com');
      await new Promise(resolve => setTimeout(resolve, 250));
      if (outcome === 'network-failure') return route.abort('failed');
      return route.fulfill({ status: outcome === 'success' ? 200 : 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto(base + '/');
    await fillForm(page);
    await page.locator('[data-form] button').click();
    assert.equal(await page.locator('[data-form] button').isDisabled(), true);
    await page.waitForFunction(() => !document.querySelector('[data-form] button').disabled);
    const status = await page.locator('[data-form-status]').textContent();
    assert.match(status, outcome === 'success' ? /successfully/ : /could not submit/);
    assert.equal(await page.locator('[name="email"]').inputValue(), outcome === 'success' ? '' : 'test@example.com');
    assert.equal(requests, 1);
    await page.close();
  });
}
test('whitespace-only required fields do not generate a draft', async () => {
  const page = await browser.newPage();
  await page.goto(base + '/');
  await fillForm(page);
  await page.locator('[name="message"]').fill('   ');
  await page.locator('[data-form] button').click();
  assert.equal(await page.locator('[data-form-draft]').isVisible(), false);
  assert.equal(await page.locator('[name="message"]').evaluate(el => el.validity.valid), false);
  await page.close();
});

test('configured form times out and preserves the inquiry for retry', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.route('**/assets/js/config.js*', r => r.fulfill({ contentType: 'text/javascript', body: "window.ML_FORM_ENDPOINT = 'https://forms.example.test/timeout';" }));
  await page.route('https://forms.example.test/timeout', () => {});
  await page.goto(base + '/');
  await fillForm(page);
  await page.clock.install();
  const pending = page.waitForRequest('https://forms.example.test/timeout');
  await page.evaluate(() => document.querySelector('[data-form]').requestSubmit());
  await pending;
  await page.clock.fastForward(16000);
  await page.waitForFunction(() => !document.querySelector('[data-form] button').disabled);
  assert.match(await page.locator('[data-form-status]').textContent(), /could not submit/);
  assert.equal(await page.locator('[name="email"]').inputValue(), 'test@example.com');
  await page.close();
});
