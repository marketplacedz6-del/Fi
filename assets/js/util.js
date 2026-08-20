/* ===== أدوات مساعدة عامة ===== */
(function () {
  'use strict';

  // SHA-256 خالص بالجافاسكريبت (يعمل في كل البيئات — لا يعتمد على crypto.subtle)
  EH.sha256 = function (s) {
    function safe_add(x, y) { var lsw = (x & 0xFFFF) + (y & 0xFFFF), msw = (x >> 16) + (y >> 16) + (lsw >> 16); return (msw << 16) | (lsw & 0xFFFF); }
    function S(X, n) { return (X >>> n) | (X << (32 - n)); }
    function R(X, n) { return (X >>> n); }
    function Ch(x, y, z) { return (x & y) ^ ((~x) & z); }
    function Maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
    function Sigma0256(x) { return S(x, 2) ^ S(x, 13) ^ S(x, 22); }
    function Sigma1256(x) { return S(x, 6) ^ S(x, 11) ^ S(x, 25); }
    function Gamma0256(x) { return S(x, 7) ^ S(x, 18) ^ R(x, 3); }
    function Gamma1256(x) { return S(x, 17) ^ S(x, 19) ^ R(x, 10); }
    var K = [0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,
      0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,
      0xE49B69C1,0xEFBE4786,0x0FC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,
      0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x06CA6351,0x14292967,
      0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,
      0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,
      0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,
      0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2];
    function core(m, l) {
      var HASH = [0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19];
      var W = new Array(64), a, b, c, d, e, f, g, h, i, j, T1, T2;
      m[l >> 5] |= 0x80 << (24 - l % 32);
      m[((l + 64 >> 9) << 4) + 15] = l;
      for (i = 0; i < m.length; i += 16) {
        a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
        for (j = 0; j < 64; j++) {
          if (j < 16) W[j] = m[j + i];
          else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
          T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
          T2 = safe_add(Sigma0256(a), Maj(a, b, c));
          h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
        }
        HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]);
        HASH[3] = safe_add(d, HASH[3]); HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]);
        HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
      }
      return HASH;
    }
    function str2binb(str) {
      var bin = [], mask = (1 << 8) - 1, i;
      for (i = 0; i < str.length * 8; i += 8) bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (24 - i % 32);
      return bin;
    }
    function binb2hex(binarray) {
      var hex_tab = '0123456789abcdef', str = '', i;
      for (i = 0; i < binarray.length * 4; i++) str += hex_tab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8 + 4)) & 0xF) + hex_tab.charAt((binarray[i >> 2] >> ((3 - i % 4) * 8)) & 0xF);
      return str;
    }
    var utf8 = unescape(encodeURIComponent(String(s == null ? '' : s)));
    return binb2hex(core(str2binb(utf8), utf8.length * 8));
  };

  // هروب النصوص
  EH.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // قراءة معامل من الرابط
  EH.qs = function (name) {
    var m = new URLSearchParams(window.location.search);
    return m.get(name) || '';
  };

  // localStorage آمن
  EH.lsGet = function (key, def) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  };
  EH.lsSet = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  };
  EH.lsDel = function (key) {
    try { localStorage.removeItem(key); } catch (e) {}
  };

  // Toast منبثقة
  EH.toast = function (msg, type) {
    var t = document.getElementById('eh-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'eh-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'eh-toast show ' + (type || 'info');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.className = 'eh-toast'; }, 3200);
  };

  // تحقق من رقم الهاتف الجزائري
  EH.validPhone = function (p) {
    if (!p) return false;
    var s = String(p).replace(/[\s-]/g, '');
    if (/^(\+213|00213)/.test(s)) s = '0' + s.replace(/^(\+213|00213)/, '');
    return /^0(5|6|7)\d{8}$/.test(s);
  };
  EH.normalizePhone = function (p) {
    var s = String(p || '').replace(/[\s-]/g, '');
    if (/^(\+213|00213)/.test(s)) s = '0' + s.replace(/^(\+213|00213)/, '');
    return s;
  };

  // أي صورة لا تُحمَّل تُستبدل تلقائياً بصورة بديلة
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.src && t.src.indexOf('placeholder.webp') === -1) {
      t.src = 'assets/img/placeholder.webp';
    }
  }, true);

  // debounce
  EH.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, c = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(c, a); }, ms || 200);
    };
  };

  // عناصر DOM مختصرة
  EH.$ = function (sel, root) { return (root || document).querySelector(sel); };
  EH.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // إدراج أقسام الهيدر/الفوتر المشتركة
  EH.injectCommon = function () {
    // إزالة أي drawer سابق (الاستدعاء قد يتكرر بعد تحميل البيانات)
    var prevDrawer = document.querySelector('body > .main-nav.drawer-nav');
    if (prevDrawer) prevDrawer.remove();
    var h = document.getElementById('eh-header');
    var f = document.getElementById('eh-footer');
    var cartCount = 0;
    try {
      cartCount = (EH.lsGet(EH.CONFIG.LS.cart, []) || []).reduce(function (s, it) { return s + (it.qty || 0); }, 0);
    } catch (e) {}

    var stCommon = (EH.getSettings && EH.getSettings()) || {};
    if (h) {
      h.innerHTML =
        '<div class="topbar"><div class="container topbar-in"><span>🚚 توصيل لجميع الولايات 58 — الدفع عند الاستلام</span><span class="topbar-phone">📞 <a href="tel:' + EH.esc(stCommon.phone || '') + '">' + EH.esc(stCommon.phone || '') + '</a></span></div></div>' +
        '<div class="container header-main">' +
        '  <button class="icon-btn menu-btn" id="eh-menu-btn" aria-label="القائمة">☰</button>' +
        '  <a class="brand" href="index.html"><img src="assets/img/brand/logo-trans.webp" alt="Elegance Home & Style" width="150" height="48" id="eh-logo-img"></a>' +
        '  <nav class="main-nav" id="eh-nav">' +
        '    <a href="index.html" data-nav="home">الرئيسية</a>' +
        '    <a href="shop.html?cat=fragrance" data-nav="fragrance">عطور المنزل</a>' +
        '    <a href="shop.html?cat=fashion" data-nav="fashion">الأزياء</a>' +
        '    <a href="shop.html" data-nav="all">كل المنتجات</a>' +
        '    <a href="checkout.html" data-nav="checkout">إتمام الطلب</a>' +
        '  </nav>' +
        '  <div class="header-actions">' +
        '    <button class="icon-btn" id="eh-search-btn" aria-label="بحث">🔍</button>' +
        '    <a class="icon-btn cart-btn" href="checkout.html" aria-label="السلة">🛒<span class="cart-badge" id="eh-cart-badge">' + cartCount + '</span></a>' +
        '  </div>' +
        '</div>' +
        '<div class="search-bar hidden" id="eh-search-bar"><div class="container"><input type="search" id="eh-search-input" placeholder="ابحث عن منتج…" aria-label="بحث"></div></div>' +
        '<div class="nav-overlay hidden" id="eh-nav-overlay"></div>';
    }
    if (f) {
      var s = stCommon;
      f.innerHTML =
        '<div class="container footer-grid">' +
        '  <div><img src="assets/img/brand/logo-trans.webp" alt="Elegance" width="140" loading="lazy"><p class="footer-about">' + EH.esc(s.footerText || '') + '</p></div>' +
        '  <div><h4>روابط سريعة</h4><a href="index.html">الرئيسية</a><a href="shop.html?cat=fragrance">عطور المنزل</a><a href="shop.html?cat=fashion">الأزياء</a><a href="checkout.html">إتمام الطلب</a></div>' +
        '  <div><h4>خدمة الزبائن</h4><a href="tel:' + EH.esc(s.phone || '') + '">الهاتف: ' + EH.esc(s.phone || '') + '</a>' +
        (s.whatsapp ? '<a href="https://wa.me/' + EH.esc(String(s.whatsapp).replace(/^0/, '213')) + '" target="_blank" rel="noopener">واتساب</a>' : '') +
        (s.facebook ? '<a href="' + EH.esc(s.facebook) + '" target="_blank" rel="noopener">فيسبوك</a>' : '') +
        (s.instagram ? '<a href="' + EH.esc(s.instagram) + '" target="_blank" rel="noopener">انستغرام</a>' : '') +
        (s.tiktokUrl ? '<a href="' + EH.esc(s.tiktokUrl) + '" target="_blank" rel="noopener">تيك توك</a>' : '') +
        '</div>' +
        '  <div><h4>سياسات المتجر</h4><a href="checkout.html">الدفع عند الاستلام</a><a href="checkout.html">التوصيل لجميع الولايات</a><a href="checkout.html">الاستبدال والإرجاع</a></div>' +
        '</div>' +
        '<div class="footer-bottom"><div class="container">© ' + new Date().getFullYear() + ' ' + EH.esc(s.storeName || 'Elegance Home & Style') + ' — جميع الحقوق محفوظة</div></div>';
    }

    // حدث زر القائمة — ننقل القائمة خارج الهيدر (لأن backdrop-filter يكسر position:fixed)
    var mb = document.getElementById('eh-menu-btn');
    var nav = document.getElementById('eh-nav');
    var ov = document.getElementById('eh-nav-overlay');
    var drawer = null;
    if (h && nav) {
      drawer = document.createElement('nav');
      drawer.className = 'main-nav drawer-nav';
      drawer.setAttribute('aria-label', 'القائمة');
      drawer.innerHTML = nav.innerHTML;
      document.body.appendChild(drawer);
    }
    if (mb) {
      var toggle = function () {
        if (nav) nav.classList.toggle('open');
        if (drawer) drawer.classList.toggle('open');
        if (ov) ov.classList.toggle('hidden');
      };
      mb.addEventListener('click', toggle);
      if (ov) ov.addEventListener('click', function () {
        if (nav) nav.classList.remove('open');
        if (drawer) drawer.classList.remove('open');
        ov.classList.add('hidden');
      });
    }
    var sb = document.getElementById('eh-search-btn');
    var sbar = document.getElementById('eh-search-bar');
    if (sb && sbar) {
      sb.addEventListener('click', function () { sbar.classList.toggle('hidden'); setTimeout(function () { var i = document.getElementById('eh-search-input'); if (i) i.focus(); }, 50); });
      var si = document.getElementById('eh-search-input');
      if (si) si.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { window.location.href = 'shop.html?q=' + encodeURIComponent(si.value); }
      });
    }
    // تمييز رابط التنقل الحالي
    var page = document.body.getAttribute('data-page');
    EH.$$('[data-nav="' + page + '"]').forEach(function (l) { l.classList.add('active'); });
  };

  // إعادة بناء شارة السلة
  EH.refreshCartBadge = function () {
    var b = document.getElementById('eh-cart-badge');
    if (!b) return;
    var items = EH.lsGet(EH.CONFIG.LS.cart, []) || [];
    var n = items.reduce(function (s, it) { return s + (it.qty || 0); }, 0);
    b.textContent = n;
    b.classList.toggle('hidden', n === 0);
  };

  // مشاركة أحداث التتبع عبر كل الصفحات
  EH.track = function (event, data) {
    data = data || {};
    var s = (EH.getSettings && EH.getSettings()) || {};
    var currency = s.currency || 'DZD';
    try {
      if (window.fbq) {
        if (event === 'ViewContent') fbq('track', 'ViewContent', { content_ids: data.content_ids || [], content_type: 'product', value: data.value || 0, currency: currency });
        else if (event === 'AddToCart') fbq('track', 'AddToCart', { content_ids: data.content_ids || [], content_type: 'product', value: data.value || 0, currency: currency });
        else if (event === 'Purchase') fbq('track', 'Purchase', { value: data.value || 0, currency: currency, content_ids: data.content_ids || [] });
      }
      if (window.ttq) {
        if (event === 'ViewContent') ttq.track('ViewContent', { contents: data.contents || [], content_type: 'product', value: data.value || 0, currency: currency });
        else if (event === 'AddToCart') ttq.track('AddToCart', { contents: data.contents || [], content_type: 'product', value: data.value || 0, currency: currency });
        else if (event === 'Purchase') ttq.track('CompletePayment', { contents: data.contents || [], value: data.value || 0, currency: currency });
      }
      if (window.gtag) {
        gtag('event', event === 'Purchase' ? 'purchase' : event === 'AddToCart' ? 'add_to_cart' : 'view_item', {
          value: data.value || 0, currency: currency,
          items: data.contents || [{ id: (data.content_ids || [])[0] || '', quantity: 1 }]
        });
      }
    } catch (e) {}
    // سجل محلي للأحداث (للفحص)
    try {
      var log = EH.lsGet('eh.v1.events', []);
      log.push({ e: event, d: data, t: Date.now() });
      EH.lsSet('eh.v1.events', log.slice(-200));
    } catch (e) {}
  };
})();
