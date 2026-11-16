import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8080';
for (const [path, lang, title] of [
  ['/', 'en', 'Multi-Brand'], ['/zh-CN/', 'zh-CN', '多品牌'],
  ['/pages/privacy', 'en', 'Privacy Policy'], ['/zh-CN/pages/privacy', 'zh-CN', '隐私政策']
]) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes(`lang="${lang}"`), `Wrong language: ${path}`);
  assert.match(html, new RegExp(`<title[^>]*>[^<]*${title}`));
  console.log(`PASS ${path}: HTTP 200, expected language and title`);
}
for (const path of ['/assets/js/main.js', '/assets/js/i18n.js', '/assets/css/base.css', '/assets/js/locales/en.js', '/assets/js/locales/zh-CN.js']) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, path);
  assert.ok(!response.headers.get('content-type')?.includes('text/html'), `HTML fallback instead of asset: ${path}`);
  console.log(`PASS ${path}: asset available`);
}
