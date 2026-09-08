/* =========================================================
   Morrow Logic — i18n.js
   轻量多语言引擎，无依赖，兼容 file:// 直开
   用法：
     - HTML 节点上加 data-i18n="key"  -> 替换 textContent
     - HTML 节点上加 data-i18n-attr="attr" data-i18n="key"
       -> 把 attr 设为翻译值（常用于 meta、hreflang 等）
   ========================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'ml_lang';
  var DEFAULT_LOCALE = 'zh-CN';

  var SUPPORTED = ['zh-CN', 'en', 'ja', 'zh-TW', 'es', 'de'];
  var SUPPORTED_NAMES = {
    'zh-CN': '简体中文',
    'en': 'English',
    'ja': '日本語',
    'zh-TW': '繁體中文',
    'es': 'Español',
    'de': 'Deutsch'
  };
  var SCRIPT_BASE = 'assets/js/locales/';

  // 已加载语言包：window.__I18N__[locale] = messages
  var dict = global.__I18N__ = global.__I18N__ || {};
  var current = DEFAULT_LOCALE;

  // 路径 ↔ 语言映射：默认 zh-CN 走根路径，其他语言走 /xx/
  function pathFor(locale) {
    if (locale === DEFAULT_LOCALE) return '/';
    return '/' + locale + '/';
  }
  function localeFromPath(p) {
    var m = (p || '').match(/^\/(zh-CN|en|ja|zh-TW|es|de)\/?$/);
    return m ? m[1] : '';
  }
  // 去除已有语言前缀；返回本页面"裸"路径（用于切换语言时复用）
  function stripLangPrefix(p) {
    var stripped = (p || '').replace(/^\/(zh-CN|en|ja|zh-TW|es|de)(?=\/|$)/, '');
    return stripped || '/';
  }
  // 给"裸"路径加语言前缀；默认语言不加
  function prependLang(basePath, locale) {
    if (locale === DEFAULT_LOCALE) return basePath;
    if (basePath === '/') return '/' + locale + '/';
    return '/' + locale + basePath;
  }

  function detectInitial() {
    // 1) localStorage 用户偏好
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    // 2) URL 路径前缀（SEO 友好的路径化语言）
    var fromPath = localeFromPath(location.pathname);
    if (fromPath) return fromPath;
    // 3) navigator.language（仅首次访问且无路径时）
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav) {
      if (SUPPORTED.indexOf(nav) !== -1) return nav;
      var base = nav.split('-')[0];
      var map = { zh: 'zh-CN', en: 'en', ja: 'ja', es: 'es', de: 'de' };
      if (map[base]) return map[base];
      if (base === 'zh') {
        if (/tw|hk|mo/i.test(nav)) return 'zh-TW';
        return 'zh-CN';
      }
    }
    return DEFAULT_LOCALE;
  }

  function loadScript(locale) {
    return new Promise(function (resolve, reject) {
      if (dict[locale]) return resolve(dict[locale]);
      var s = document.createElement('script');
      s.src = SCRIPT_BASE + locale + '.js';
      s.async = false;
      s.onload = function () { resolve(dict[locale] || {}); };
      s.onerror = function () { reject(new Error('i18n: failed to load ' + locale)); };
      document.head.appendChild(s);
    });
  }

  function apply(messages) {
    var nodes = document.querySelectorAll('[data-i18n]');
    var missing = [];
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = messages[key];
      if (val == null) {
        missing.push(key);
        return;
      }
      var attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, val);
      } else if (el.hasAttribute('data-i18n-html')) {
        // 显式开启 HTML 模式（默认 textContent 防 XSS）
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });
    // 文档级 lang 与 meta
    document.documentElement.setAttribute('lang', current.split('-')[0]);
    document.documentElement.setAttribute('data-locale', current);

    // hreflang 链接：路径化版本（SEO 友好）
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (lk) {
      var hl = lk.getAttribute('hreflang');
      if (hl === 'x-default') return;
      var code = hl;
      if (SUPPORTED.indexOf(hl) === -1) return;
      lk.setAttribute('href', location.origin + pathFor(code));
    });

    // canonical 跟随当前语言（从 data-canonical-base 读取本页面基础路径）
    document.querySelectorAll('link[rel="canonical"]').forEach(function (lk) {
      var relBase = lk.getAttribute('data-canonical-base');
      if (!relBase) return;
      var langPrefix = (current === DEFAULT_LOCALE) ? '' : '/' + current;
      lk.setAttribute('href', location.origin + langPrefix + relBase);
    });

    // 语言切换按钮的当前显示
    var cur = document.querySelector('[data-lang-current]');
    if (cur) cur.textContent = SUPPORTED_NAMES[current] || current;

    // 语言列表的选中态
    document.querySelectorAll('[data-lang-option]').forEach(function (li) {
      li.setAttribute('aria-selected', li.getAttribute('data-lang-option') === current ? 'true' : 'false');
    });

    // 标题/OG 同步（这些用 data-i18n-attr 也已覆盖）
    if (messages['meta.title']) document.title = messages['meta.title'];

    if (missing.length) {
      console.warn('[i18n] missing keys in ' + current + ':', Array.from(new Set(missing)));
    }
    document.documentElement.classList.remove('i18n-loading');
  }

  function setLocale(locale, opts) {
    opts = opts || {};
    if (SUPPORTED.indexOf(locale) === -1) locale = DEFAULT_LOCALE;
    current = locale;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch (e) {}
    var promise = dict[locale] ? Promise.resolve(dict[locale]) : loadScript(locale);
    return promise.then(apply).then(function () {
      // 同步 URL 路径（路径化语言）
      try {
        if (opts.fromUser !== false) {
          // 用 canonical-base 推断本页面基础路径，避免剥离错误
          var baseAttr = document.querySelector('link[rel="canonical"]');
          var canonicalBase = baseAttr && baseAttr.getAttribute('data-canonical-base');
          var basePath = canonicalBase || stripLangPrefix(location.pathname) || '/';
          var newPath = prependLang(basePath, locale);
          if (newPath !== location.pathname) {
            history.pushState({ locale: locale }, '', newPath + location.search + location.hash);
          }
        }
      } catch (e) {}
      // 触发自定义事件，便于 main.js 重新渲染数字等
      window.dispatchEvent(new CustomEvent('localechange', { detail: { locale: locale } }));
    });
  }

  function getLocale() { return current; }
  function t(key) { return (dict[current] || {})[key] || ''; }

  // ---- 语言切换 UI ----
  function bindUI() {
    var root = document.querySelector('[data-lang]');
    if (!root) return;
    var btn = root.querySelector('[data-lang-btn]');
    var list = root.querySelector('[data-lang-list]');

    function close() {
      root.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function open() {
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      root.classList.contains('is-open') ? close() : open();
    });
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    list.querySelectorAll('[data-lang-option]').forEach(function (li) {
      var code = li.getAttribute('data-lang-option');
      li.addEventListener('click', function () {
        close();
        if (code !== current) setLocale(code);
      });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (code !== current) setLocale(code);
        }
      });
    });
  }

  // 暴露给 locale 文件的注册函数
  global.registerLocale = function (locale, messages) {
    dict[locale] = messages;
  };

  // 启动
  document.addEventListener('DOMContentLoaded', function () {
    bindUI();
    var initial = detectInitial();
    setLocale(initial, { fromUser: false });

    // 处理浏览器前进/后退：URL 路径变化时同步语言
    window.addEventListener('popstate', function () {
      var loc = localeFromPath(location.pathname);
      if (loc && loc !== current) {
        setLocale(loc, { fromUser: false });
      } else if (!loc && current !== DEFAULT_LOCALE) {
        setLocale(DEFAULT_LOCALE, { fromUser: false });
      }
    });
  });

  global.I18N = { setLocale: setLocale, getLocale: getLocale, t: t };
})(window);
