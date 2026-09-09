const fs = require('fs');

const LOCALES_DATA = fs.readFileSync('functions/_locales.json', 'utf8');
// Compact JSON (single line)
const compact = JSON.stringify(JSON.parse(LOCALES_DATA));

const fn = `// Cloudflare Pages Function: 路径化 i18n 服务端渲染中间件
// 在 HTML 落到浏览器前,根据 cookie/路径确定 locale,用 HTMLRewriter
// 替换 title/meta/og/twitter 与所有 [data-i18n] 节点文本。
// 收益:首屏即正确语言,无 FOUC,无客户端额外网络请求。
//
// 同步注意:本文件由 scripts/build-middleware.js 从
// functions/_locales.json 生成;修改翻译需同步更新
// assets/js/locales/<lang>.js 后重新执行:
//
//     node scripts/extract-locales.js
//     node scripts/build-middleware.js

const LOCALES = ${compact};

const SUPPORTED = ['zh-CN', 'en', 'ja', 'zh-TW', 'es', 'de'];
const DEFAULT_LOCALE = 'zh-CN';

// 把 zh-TW 等归到默认走根路径;其他语言走 /xx/ 前缀
const pathLocalePrefix = (locale) => locale === DEFAULT_LOCALE ? '' : '/' + locale;

function pickLocale(request) {
  // 1) Cookie:用户之前在客户端主动切换的语言
  const cookieHeader = request.headers.get('cookie') || '';
  const m = cookieHeader.match(/(?:^|;\\s*)ml_lang=([^;]+)/);
  if (m && SUPPORTED.indexOf(m[1]) !== -1) return m[1];
  // 2) 路径前缀
  const url = new URL(request.url);
  const pm = url.pathname.match(/^\\/(zh-CN|en|ja|zh-TW|es|de)(?=\\/|$)/);
  if (pm && SUPPORTED.indexOf(pm[1]) !== -1) return pm[1];
  // 3) Accept-Language(粗匹配)
  const al = (request.headers.get('accept-language') || '').toLowerCase();
  for (const sup of SUPPORTED) {
    if (al.indexOf(sup.toLowerCase()) !== -1) return sup;
  }
  const base = al.split(',')[0]?.split('-')[0];
  const map = { zh: 'zh-CN', en: 'en', ja: 'ja', es: 'es', de: 'de' };
  if (base && map[base]) return map[base];
  return DEFAULT_LOCALE;
}

// 从 /en/foo 之类的路径剥离语言前缀,得到真正的静态资源路径
function stripLangPrefix(p) {
  const stripped = (p || '').replace(/^\\/(zh-CN|en|ja|zh-TW|es|de)(?=\\/|$)/, '');
  return stripped || '/';
}

export const onRequest = async (context) => {
  const { request, env } = context;
  const locale = pickLocale(request);
  const messages = LOCALES[locale];
  const url = new URL(request.url);

  // 自己走静态资源(因为 _redirects 已删除,Function 必须接管路径路由)
  // /en/ -> /, /en/pages/privacy.html -> /pages/privacy.html
  const assetPath = stripLangPrefix(url.pathname) + url.search;
  const assetRequest = new Request(new URL(assetPath, request.url), request);
  let response = await env.ASSETS.fetch(assetRequest);

  // 静态资源非 HTML(如 /assets/*)直接返回,不替换
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  if (!messages) return response;

  // 用 HTMLRewriter 流式替换关键节点
  const rewriter = new HTMLRewriter()
    // <html lang="..."> 与 data-locale
    .on('html', {
      element(el) {
        el.setAttribute('lang', locale.split('-')[0]);
        el.setAttribute('data-locale', locale);
        // 移除 i18n-loading 类:内容已在服务端渲染正确,无需再 hide
        const cls = (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean);
        if (cls.indexOf('i18n-loading') !== -1) {
          el.setAttribute('class', cls.filter(c => c !== 'i18n-loading').join(' '));
        }
      }
    })
    // <title>
    .on('title', {
      text(t) {
        if (messages['meta.title']) t.replace(messages['meta.title']);
      }
    })
    // meta description / keywords
    .on('meta[name="description"]', {
      element(el) {
        const v = messages['meta.description'];
        if (v) el.setAttribute('content', v);
      }
    })
    .on('meta[name="keywords"]', {
      element(el) {
        const v = messages['meta.keywords'];
        if (v) el.setAttribute('content', v);
      }
    })
    // og:title / og:description / og:image:alt
    .on('meta[property="og:title"]', {
      element(el) {
        const v = messages['og.title'];
        if (v) el.setAttribute('content', v);
      }
    })
    .on('meta[property="og:description"]', {
      element(el) {
        const v = messages['og.description'];
        if (v) el.setAttribute('content', v);
      }
    })
    .on('meta[property="og:image:alt"]', {
      element(el) {
        if (messages['meta.title']) el.setAttribute('content', messages['meta.title']);
      }
    })
    // twitter:title / twitter:image:alt
    .on('meta[name="twitter:title"]', {
      element(el) {
        const v = messages['twitter.title'];
        if (v) el.setAttribute('content', v);
      }
    })
    .on('meta[name="twitter:image:alt"]', {
      element(el) {
        if (messages['meta.title']) el.setAttribute('content', messages['meta.title']);
      }
    })
    // 所有带 data-i18n 的节点:替换文本内容
    .on('[data-i18n]', {
      element(el) {
        const key = el.getAttribute('data-i18n');
        const val = key && messages[key];
        if (val == null) return;
        const attr = el.getAttribute('data-i18n-attr');
        if (attr) {
          el.setAttribute(attr, val);
        } else if (el.hasAttribute('data-i18n-html')) {
          el.setInnerContent(val, { html: true });
        } else {
          el.setInnerContent(val);
        }
      }
    });

  const transformed = rewriter.transform(response);

  // 注入服务端已渲染的语言包 + 当前 locale,避免客户端重复请求
  const injection = '<script>(function(){try{var L=' + JSON.stringify(locale) + ';var M=' + JSON.stringify(messages) + ';window.__I18N__=window.__I18N__||{};window.__I18N__[L]=M;window.__SSR_LOCALE__=L;}catch(e){}})();</script>';

  const headers = new Headers(transformed.headers);
  // 确保 HTML 文档类型,避免 MIME 不匹配
  if (!headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8');

  // 用 transformStream 在 body 末尾注入
  const body = transformed.body;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      let injected = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // 找到 </head> 关闭标签前注入
        if (!injected) {
          const text = new TextDecoder().decode(value);
          const idx = text.indexOf('</head>');
          if (idx !== -1) {
            const before = text.slice(0, idx);
            const after = text.slice(idx);
            controller.enqueue(encoder.encode(before + injection + after));
            injected = true;
          } else {
            controller.enqueue(value);
          }
        } else {
          controller.enqueue(value);
        }
      }
      // 如果流结束还没找到 </head>,末尾注入
      if (!injected) controller.enqueue(encoder.encode(injection));
      controller.close();
    }
  });

  return new Response(stream, { status: transformed.status, headers });
};
`;

fs.writeFileSync('functions/_middleware.js', fn);
console.log('Wrote functions/_middleware.js, ' + fs.statSync('functions/_middleware.js').size + ' bytes');