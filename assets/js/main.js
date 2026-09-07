/* =========================================================
   Morrow Logic — main.js
   导航 / 滚动揭示 / 数字计数 / Hero 星链 / 表单 / 返回顶部
   无依赖，兼容 file://
   ========================================================= */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 工具 ----
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  // ---- 导航：滚动态 + 移动端抽屉 + 当前区块高亮 + 进度条 ----
  function initNav() {
    var nav = $('#nav');
    if (!nav) return;
    var burger = $('[data-burger]');
    var menu = $('.nav__menu');
    var progress = $('[data-nav-progress]');

    var lastY = 0, ticking = false;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 8);
      if (progress) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
      }
      lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();

    // 移动端抽屉
    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = menu.classList.toggle('is-open');
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a[href^="#"]', menu).forEach(function (a) {
        a.addEventListener('click', function () {
          menu.classList.remove('is-open');
          burger.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // 当前区块高亮
    var links = $$('.nav__menu a[href^="#"]');
    var sections = links.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var id = '#' + e.target.id;
            links.forEach(function (a) {
              a.classList.toggle('is-active', a.getAttribute('href') === id);
            });
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  // ---- 滚动揭示 ----
  function initReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window) || REDUCED) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---- 数字计数 ----
  function initCounters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;
    function run(el) {
      if (el.dataset.done) return;
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      var isFloat = target % 1 !== 0;
      var start = performance.now();
      var dur = 1600;
      function tick(t) {
        var p = Math.min((t - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var v = target * eased;
        el.textContent = (isFloat ? v.toFixed(2) : Math.round(v)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = (isFloat ? target.toFixed(2) : target) + suffix;
      }
      requestAnimationFrame(tick);
      el.dataset.done = '1';
    }
    if (REDUCED || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) {
        el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  // ---- 卡片鼠标位置（高光跟随） ----
  function initCardSpotlight() {
    $$('.card').forEach(function (c) {
      c.addEventListener('mousemove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      });
    });
  }

  // ---- Hero Canvas 星链 ----
  function initHeroCanvas() {
    var c = $('[data-hero-canvas]');
    if (!c || REDUCED) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var ctx = c.getContext('2d');
    var w, h, points = [];
    var POINT_COUNT = 60;
    var LINK_DIST = 140;

    function resize() {
      var rect = c.parentElement.getBoundingClientRect();
      w = c.width = Math.floor(rect.width * dpr);
      h = c.height = Math.floor(rect.height * dpr);
      c.style.width = rect.width + 'px';
      c.style.height = rect.height + 'px';
      ctx.scale(dpr, dpr);
      seed();
    }
    function seed() {
      points = [];
      var count = POINT_COUNT;
      if (window.innerWidth < 720) count = 30;
      for (var i = 0; i < count; i++) {
        points.push({
          x: Math.random() * (w / dpr),
          y: Math.random() * (h / dpr),
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
        });
      }
    }
    function step() {
      var W = w / dpr, H = h / dpr;
      ctx.clearRect(0, 0, W, H);
      // 描线
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        for (var j = i + 1; j < points.length; j++) {
          var q = points[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            var a = (1 - d / LINK_DIST) * 0.35;
            ctx.strokeStyle = 'rgba(120,180,255,' + a + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      // 描点
      ctx.fillStyle = 'rgba(160,230,220,.85)';
      for (var k = 0; k < points.length; k++) {
        var pt = points[k];
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
      rafId = requestAnimationFrame(step);
    }
    var rafId = 0;
    if (window.innerWidth >= 600) {
      resize();
      step();
      var ro;
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(resize);
        ro.observe(c.parentElement);
      } else {
        window.addEventListener('resize', resize);
      }
    }
  }

  // ---- 平滑锚点 ----
  function initSmoothAnchor() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        var top = t.getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' });
        history.replaceState(null, '', id);
      });
    });
  }

  // ---- 返回顶部 ----
  function initToTop() {
    var btn = $('[data-to-top]');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('is-show', window.scrollY > 600);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    });
  }

  // ---- 表单（可配置端点，缺则降级 mailto） ----
  function initForm() {
    var form = $('[data-form]');
    if (!form) return;
    var ok = $('[data-form-ok]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // 简易校验
      var fields = $$('input, textarea, select', form);
      var data = {};
      var bad = false;
      fields.forEach(function (f) {
        if (f.required && !String(f.value).trim()) { bad = true; f.style.borderColor = '#ff7a7a'; }
        else { f.style.borderColor = ''; data[f.name] = f.value; }
      });
      if (bad) return;

      // 若页面声明了 ml_form_endpoint，则走 fetch；否则 mailto 兜底
      var endpoint = window.ML_FORM_ENDPOINT;
      if (endpoint) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (r) {
          if (!r.ok) throw new Error(r.statusText);
          form.reset();
          if (ok) ok.hidden = false;
        }).catch(function (err) {
          alert('Submit failed: ' + err.message);
        });
      } else {
        var subject = encodeURIComponent('[Morrow Logic] Inquiry from ' + (data.name || 'Website'));
        var body = encodeURIComponent(
          'Name: ' + (data.name || '') + '\n' +
          'Company: ' + (data.company || '') + '\n' +
          'Email: ' + (data.email || '') + '\n' +
          'Phone: ' + (data.phone || '') + '\n' +
          'Type: ' + (data.type || '') + '\n\n' +
          (data.message || '')
        );
        // 兜底：弹邮件草稿
        var mail = 'mailto:business@morrowlogic.com?subject=' + subject + '&body=' + body;
        window.location.href = mail;
        if (ok) ok.hidden = false;
      }
    });
  }

  // ---- 启动 ----
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    initNav();
    initReveal();
    initCounters();
    initCardSpotlight();
    initHeroCanvas();
    initSmoothAnchor();
    initToTop();
    initForm();
  });

})();
