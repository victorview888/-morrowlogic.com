const fs = require('fs');
const path = require('path');
const locales = ['zh-CN', 'en', 'ja', 'zh-TW', 'es', 'de'];
const all = {};
for (const loc of locales) {
  const code = fs.readFileSync(path.join('assets', 'js', 'locales', loc + '.js'), 'utf8');
  const m = code.match(/registerLocale\([^,]+,\s*(\{[\s\S]*?\})\s*\)\s*;/);
  if (!m) { console.error('Parse failed for ' + loc); process.exit(1); }
  const fn = new Function('return (' + m[1] + ')');
  all[loc] = fn();
  console.log(loc + ': ' + Object.keys(all[loc]).length + ' keys');
}
fs.writeFileSync('functions/_locales.json', JSON.stringify(all));
console.log('Wrote functions/_locales.json, ' + fs.statSync('functions/_locales.json').size + ' bytes');