/* Static HTML selects the language; a shared URL always wins. */
(function (global) {
  'use strict';
  var supported = ['en', 'zh-CN'];
  var dictionaries = global.__I18N__ = global.__I18N__ || {};
  var current = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en';
  global.registerLocale = function (locale, messages) { dictionaries[locale] = messages; };
  global.I18N = {
    t: function (key) { return (dictionaries[current] || {})[key] || key; },
    getLocale: function () { return current; },
    setLocale: function (locale) {
      if (supported.indexOf(locale) === -1) return false;
      var base = location.pathname.replace(/^\/(zh-CN|en)(?=\/|$)/, '') || '/';
      location.assign((locale === 'en' ? '' : '/zh-CN') + base + location.search + location.hash);
      return true;
    }
  };
  document.documentElement.classList.add('js');
  var root = document.querySelector('[data-lang]');
  if (!root) return;
  var button = root.querySelector('[data-lang-btn]');
  var links = Array.from(root.querySelectorAll('[data-lang-option]'));
  function syncLinks() {
    links.forEach(function (link) {
      var target = new URL(link.href);
      target.search = location.search; target.hash = location.hash;
      link.href = target.href;
    });
  }
  syncLinks();
  links.forEach(function (link) { link.addEventListener('click', syncLinks); });
  function close() { root.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); }
  function open() { root.classList.add('is-open'); button.setAttribute('aria-expanded', 'true'); }
  button.addEventListener('click', function () { root.classList.contains('is-open') ? close() : open(); });
  root.addEventListener('keydown', function (event) {
    var index = links.indexOf(document.activeElement);
    if (event.key === 'Escape') { close(); button.focus(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); open();
      var next = index < 0 ? (event.key === 'ArrowDown' ? 0 : links.length - 1)
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links[next].focus();
    }
  });
  document.addEventListener('click', function (event) { if (!root.contains(event.target)) close(); });
  root.addEventListener('focusout', function (event) { if (!root.contains(event.relatedTarget)) close(); });
})(window);
