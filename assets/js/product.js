/* ===== صفحة تفاصيل المنتج ===== */
(function () {
  'use strict';
  // رسم الهيدر والفوتر فوراً — لا تبقى الصفحة فارغة أبداً
  try { EH.injectCommon(); EH.refreshCartBadge(); } catch (e) {}

  var pid = EH.qs('id');
  var product = null;
  var sel = {};           // {color, size, capacity}
  var qty = 1;
  var activeImg = 0;
  var zoomed = false, zoomScale = 1, zoomX = 0, zoomY = 0;

  function priceNow() { return EH.Product.price(product, sel); }
  function priceOld() { return EH.Product.oldPrice(product, sel); }

  function render() {
    var root = document.getElementById('product-root');
    var imgs = product.images && product.images.length ? product.images : [{ src: 'assets/img/placeholder.webp' }];

    var gallery = '<div class="gallery">' +
      '<div class="gallery-main" id="gal-main">' +
      '<img id="gal-img" src="' + EH.esc(EH.resolveImg(imgs[0].src)) + '" alt="' + EH.esc(product.name) + '" width="900" height="900">' +
      '</div>' +
      (imgs.length > 1 ? '<div class="gallery-thumbs" id="gal-thumbs">' + imgs.map(function (im, i) {
        return '<button class="' + (i === 0 ? 'active' : '') + '" data-i="' + i + '"><img src="' + EH.esc(EH.resolveImg(im.src)) + '" alt="" loading="lazy" width="150" height="150"></button>';
      }).join('') + '</div>' : '') +
      '</div>';

    // المتغيرات
    var opts = '';
    var outAll = EH.Product.stockTotal(product) <= 0;

    if (product.variantMode === 'fashion') {
      opts += '<div class="opt-group"><label>اللون:</label><div class="opt-row" id="opt-colors">' +
        (product.colors || []).map(function (c, i) {
          var colorOut = (product.sizes || []).every(function (s) { return EH.Product.stockOf(product, { color: c.name, size: s }) <= 0; });
          return '<button class="opt-btn color-swatch ' + (i === 0 ? 'active' : '') + (colorOut ? ' out' : '') + '" data-color="' + EH.esc(c.name) + '" style="background:' + EH.esc(c.hex || '#ccc') + '" title="' + EH.esc(c.name) + '"></button>';
        }).join('') + '</div></div>';
      opts += '<div class="opt-group"><label>المقاس:</label><div class="opt-row" id="opt-sizes">' +
        (product.sizes || []).map(function (s, i) {
          return '<button class="opt-btn ' + (i === 0 ? 'active' : '') + '" data-size="' + EH.esc(s) + '">' + EH.esc(s) + '</button>';
        }).join('') + '</div></div>';
      if (product.colors && product.colors.length) sel.color = product.colors[0].name;
      if (product.sizes && product.sizes.length) sel.size = product.sizes[0];
    } else if (product.variantMode === 'fragrance') {
      opts += '<div class="opt-group"><label>الحجم:</label><div class="opt-row" id="opt-caps">' +
        (product.capacities || []).map(function (c, i) {
          var out = EH.Product.stockOf(product, { capacity: c.label }) <= 0;
          return '<button class="opt-btn ' + (i === 0 ? 'active' : '') + (out ? ' out' : '') + '" data-cap="' + EH.esc(c.label) + '">' + EH.esc(c.label) +
            (c.delta ? ' <small style="opacity:.7">(+' + EH.fmt(c.delta) + ')</small>' : '') + '</button>';
        }).join('') + '</div></div>';
      if (product.capacities && product.capacities.length) sel.capacity = product.capacities[0].label;
    }

    // حالة المخزون
    var stockInfo = outAll
      ? '<div class="notice err" style="padding:10px 14px;border-radius:10px;background:#fdecea;color:#b91c1c;font-weight:800;font-size:13.5px">نفد من المخزون حالياً</div>'
      : '<div style="font-size:13px;color:var(--ok);font-weight:800;margin:6px 0 0">✔ متوفر — اطلب الآن والدفع عند الاستلام</div>';

    // الفيديو
    var videoBlock = product.video
      ? '<div class="opt-group"><video controls preload="none" poster="' + EH.esc(EH.resolveImg(imgs[0].src)) + '" style="width:100%;border-radius:12px"><source src="' + EH.esc(product.video) + '" type="video/mp4"></video></div>'
      : '';

    var discount = EH.Product.hasDiscount(product) ? Math.round((1 - priceNow() / priceOld()) * 100) : 0;

    var info =
      '<div class="pg-info">' +
      '<div class="pg-cat">' + (product.category === 'fragrance' ? 'عطور المنزل' : 'الأزياء') + '</div>' +
      '<h1>' + EH.esc(product.name) + '</h1>' +
      '<div class="pg-price"><span class="now" id="price-now">' + EH.fmt(priceNow()) + '</span>' +
      (priceOld() ? '<span class="old" id="price-old">' + EH.fmt(priceOld()) + '</span>' : '') +
      (discount ? '<span class="save">خصم ' + discount + '%</span>' : '') + '</div>' +
      '<div class="pg-sku">رمز المنتج: <span id="pg-sku">' + EH.esc(EH.Product.skuFor(product, sel)) + '</span></div>' +
      stockInfo +
      opts + videoBlock +
      '<div class="qty-row"><span style="font-weight:800;font-size:14px">الكمية:</span>' +
      '<div class="qty-stepper"><button id="qty-minus">−</button><input id="qty-input" type="number" value="1" min="1" max="99"><button id="qty-plus">+</button></div>' +
      '<span style="font-size:12.5px;color:var(--muted)" id="stock-hint"></span></div>' +
      '<div class="add-actions">' +
      '<button class="btn" id="add-btn" ' + (outAll ? 'disabled' : '') + '>🛒 أضف إلى السلة</button>' +
      '<button class="btn buy-now-btn" id="buy-btn" ' + (outAll ? 'disabled' : '') + '>اشترِ الآن</button>' +
      '</div>' +
      '<div class="tabs">' +
      '<button class="tab-btn active" data-tab="desc">الوصف</button>' +
      '<button class="tab-btn" data-tab="ship">التوصيل والدفع</button>' +
      '<button class="tab-btn" data-tab="ret">الاستبدال</button>' +
      '</div>' +
      '<div class="tab-panel active" id="tab-desc"><p>' + EH.esc(product.desc || '') + '</p></div>' +
      '<div class="tab-panel" id="tab-ship"><ul class="ship-info">' +
      '<li>🚚 التوصيل متوفر لجميع الولايات الـ 58 (باب المنزل أو نقطة الاستلام).</li>' +
      '<li>💵 الدفع عند الاستلام — لا تدفعي أي شيء مسبقاً.</li>' +
      '<li>📦 يتم تجهيز الطلب خلال 24-48 ساعة.</li>' +
      '<li>⏱️ مدة التوصيل: 2-5 أيام عمل حسب الولاية.</li>' +
      '</ul></div>' +
      '<div class="tab-panel" id="tab-ret"><ul class="ship-info">' +
      '<li>🔄 يمكن استبدال المنتج خلال 7 أيام من الاستلام.</li>' +
      '<li>✅ يجب أن يكون المنتج بحالته الأصلية مع التغليف.</li>' +
      '<li>📞 للاستبدال تواصلوا معنا عبر الهاتف أو واتساب.</li>' +
      '</ul></div>' +
      '</div>';

    root.innerHTML = '<div class="pg-grid">' + gallery + info + '</div>';

    // أحداث المعرض
    var main = document.getElementById('gal-main');
    var img = document.getElementById('gal-img');
    EH.$$('#gal-thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        activeImg = Number(b.getAttribute('data-i'));
        EH.$$('#gal-thumbs button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        img.src = EH.resolveImg(imgs[activeImg].src);
        img.alt = product.name;
      });
    });
    // التكبير
    main.addEventListener('click', function () { openZoom(img.src); });
    // سحب للمعرض (لمس)
    var startX = 0;
    main.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40 && imgs.length > 1) {
        var next = dx > 0 ? activeImg - 1 : activeImg + 1;
        if (next >= 0 && next < imgs.length) {
          activeImg = next;
          img.src = EH.resolveImg(imgs[activeImg].src);
          EH.$$('#gal-thumbs button').forEach(function (x, i) { x.classList.toggle('active', i === activeImg); });
        }
      }
    }, { passive: true });

    function syncMainColor() {
      // عند اختيار لون: نعرض صورة اللون إن وجدت
      var m = imgs.filter(function (im) { return im.color && im.color === sel.color; })[0];
      if (m) { img.src = EH.resolveImg(m.src); }
    }

    // أزرار المتغيرات
    EH.$$('#opt-colors .color-swatch').forEach(function (b) {
      b.addEventListener('click', function () {
        sel.color = b.getAttribute('data-color');
        EH.$$('#opt-colors .color-swatch').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        // تحديث صورة المنتج حسب اللون
        var m = imgs.filter(function (im) { return im.color === sel.color; })[0];
        if (m) { img.src = EH.resolveImg(m.src); }
        // اختيار أول مقاس متاح لهذا اللون
        var avail = (product.sizes || []).filter(function (s2) {
          return EH.Product.stockOf(product, { color: sel.color, size: s2 }) > 0;
        });
        if (avail.length && avail.indexOf(sel.size) === -1) {
          sel.size = avail[0];
          EH.$$('#opt-sizes .opt-btn').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-size') === sel.size);
          });
        }
        refreshOptionStates();
        updateAvailability();
      });
    });
    EH.$$('#opt-sizes .opt-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        sel.size = b.getAttribute('data-size');
        EH.$$('#opt-sizes .opt-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        refreshOptionStates();
        updateAvailability();
      });
    });
    EH.$$('#opt-caps .opt-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        sel.capacity = b.getAttribute('data-cap');
        EH.$$('#opt-caps .opt-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        updatePrices();
      });
    });

    // الكمية
    var qInput = document.getElementById('qty-input');
    document.getElementById('qty-minus').addEventListener('click', function () { setQty(qty - 1); });
    document.getElementById('qty-plus').addEventListener('click', function () { setQty(qty + 1); });
    qInput.addEventListener('change', function () { setQty(parseInt(qInput.value, 10) || 1); });

    // التبويبات
    EH.$$('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        EH.$$('.tab-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        EH.$$('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        document.getElementById('tab-' + b.getAttribute('data-tab')).classList.add('active');
      });
    });

    // الأزرار الرئيسية
    document.getElementById('add-btn').addEventListener('click', function () { doAdd(false); });
    document.getElementById('buy-btn').addEventListener('click', function () { doAdd(true); });

    // الشريط الثابت
    var sticky = document.getElementById('sticky-bar');
    if (sticky) {
      var sp = document.getElementById('sticky-price');
      var sa = document.getElementById('sticky-add');
      sp.textContent = EH.fmt(priceNow());
      sa.addEventListener('click', function () { doAdd(false); });
      window.addEventListener('scroll', function () {
        var rect = root.getBoundingClientRect();
        var show = rect.top < -200 && !outAll;
        sticky.classList.toggle('show', show);
        document.body.classList.toggle('has-sticky', show);
      }, { passive: true });
    }

    refreshOptionStates();
    updateAvailability();
    updatePrices();

    // تتبع ViewContent
    EH.track('ViewContent', {
      value: priceNow(),
      content_ids: [product.id],
      contents: [{ id: product.id, quantity: 1, price: priceNow() }]
    });
  }

  function setQty(n) {
    var st = EH.Product.stockOf(product, sel);
    if (st <= 0) return;
    qty = Math.max(1, Math.min(n, st > 99 ? 99 : st));
    var qInput = document.getElementById('qty-input');
    if (qInput) qInput.value = qty;
    var hint = document.getElementById('stock-hint');
    if (hint) hint.textContent = st < 10 ? 'متبقي ' + st + ' فقط!' : '';
  }

  function updatePrices() {
    var now = document.getElementById('price-now');
    var old = document.getElementById('price-old');
    if (now) now.textContent = EH.fmt(priceNow());
    if (old) { old.textContent = priceOld() ? EH.fmt(priceOld()) : ''; }
    var sku = document.getElementById('pg-sku');
    if (sku) sku.textContent = EH.Product.skuFor(product, sel);
    var sticky = document.getElementById('sticky-price');
    if (sticky) sticky.textContent = EH.fmt(priceNow());
  }

  function refreshOptionStates() {
    // يميّز الخيارات النافدة حسب الاختيار الحالي
    EH.$$('#opt-sizes .opt-btn').forEach(function (b) {
      var st = EH.Product.stockOf(product, { color: sel.color, size: b.getAttribute('data-size') });
      b.classList.toggle('out', st <= 0);
      b.disabled = st <= 0;
    });
    EH.$$('#opt-colors .color-swatch').forEach(function (b) {
      var c = b.getAttribute('data-color');
      var anyAvail = (product.sizes || []).some(function (s2) {
        return EH.Product.stockOf(product, { color: c, size: s2 }) > 0;
      });
      b.classList.toggle('out', !anyAvail);
      b.disabled = !anyAvail;
    });
    EH.$$('#opt-caps .opt-btn').forEach(function (b) {
      var st = EH.Product.stockOf(product, { capacity: b.getAttribute('data-cap') });
      b.classList.toggle('out', st <= 0);
      b.disabled = st <= 0;
    });
  }

  function updateAvailability() {
    var out = EH.Product.isOut(product, sel);
    var add = document.getElementById('add-btn');
    var buy = document.getElementById('buy-btn');
    if (add) add.disabled = out;
    if (buy) buy.disabled = out;
    var hint = document.getElementById('stock-hint');
    var st = EH.Product.stockOf(product, sel);
    if (hint) hint.textContent = (!out && st < 10) ? 'متبقي ' + st + ' فقط!' : '';
    // قصّ الكمية على المخزون المتاح
    if (st > 0 && qty > st) setQty(st);
  }

  function doAdd(buyNow) {
    if (EH.Product.isOut(product, sel)) { EH.toast('هذا المتغير غير متوفر حالياً', 'error'); return; }
    if (!EH.Cart.add(product, sel, qty, { silent: buyNow })) return;
    if (buyNow) {
      setTimeout(function () { window.location.href = 'checkout.html'; }, 350);
    }
  }

  // التكبير
  function openZoom(src) {
    var ov = document.getElementById('zoom-overlay');
    var zi = document.getElementById('zoom-img');
    zi.src = src;
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    zoomScale = 1; zoomX = 0; zoomY = 0;
    zi.style.transform = 'scale(1) translate(0,0)';
  }
  function closeZoom() {
    document.getElementById('zoom-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var ov = document.getElementById('zoom-overlay');
    if (!ov) return;
    var zi = document.getElementById('zoom-img');
    document.getElementById('zoom-close').addEventListener('click', closeZoom);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target === zi) closeZoom(); });
    zi.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      zoomScale = zoomScale > 1 ? 1 : 2.2;
      zi.style.transform = 'scale(' + zoomScale + ') translate(' + zoomX + 'px,' + zoomY + 'px)';
    });
    var sx = 0, sy = 0, tx = 0, ty = 0, dragging = false;
    zi.addEventListener('touchstart', function (e) {
      if (zoomScale > 1) { dragging = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; tx = zoomX; ty = zoomY; }
    }, { passive: true });
    zi.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      e.preventDefault();
      zoomX = tx + (e.touches[0].clientX - sx);
      zoomY = ty + (e.touches[0].clientY - sy);
      zi.style.transform = 'scale(' + zoomScale + ') translate(' + zoomX + 'px,' + zoomY + 'px)';
    }, { passive: false });
    zi.addEventListener('touchend', function () { dragging = false; });
  });

  // المنتجات ذات الصلة
  function renderRelated(d) {
    var rel = document.getElementById('related');
    if (!rel) return;
    var all = (d.products || []).filter(function (p) { return p.active !== false && p.id !== product.id; });
    var ids = product.related || [];
    var list = [];
    ids.forEach(function (id) {
      var p = EH.Product.byId(all, id);
      if (p) list.push(p);
    });
    // إكمال من نفس الفئة ثم من الفئة المقابلة (تجميل متقاطع)
    var missing = 8 - list.length;
    if (missing > 0) {
      var same = all.filter(function (p) { return p.category === product.category && list.indexOf(p) === -1; }).slice(0, missing);
      list = list.concat(same);
    }
    missing = 8 - list.length;
    if (missing > 0) {
      var cross = all.filter(function (p) { return list.indexOf(p) === -1; }).slice(0, missing);
      list = list.concat(cross);
    }
    var wrap = document.createElement('div');
    wrap.className = 'carousel';
    wrap.innerHTML = '<button class="car-btn next" aria-label="التالي">‹</button><button class="car-btn prev" aria-label="السابق">›</button><div class="car-track">' +
      list.map(function (p) {
        return '<article class="p-card">' +
          (p.badge === 'new' ? '<span class="p-badge b-new">جديد</span>' : (EH.Product.hasDiscount(p) ? '<span class="p-badge b-sale">تخفيض</span>' : '')) +
          '<a class="p-img" href="product.html?id=' + encodeURIComponent(p.id) + '"><img src="' + EH.esc(EH.resolveImg(EH.Product.imageFor(p))) + '" alt="' + EH.esc(p.name) + '" loading="lazy" width="600" height="600"></a>' +
          '<div class="p-body"><div class="p-cat">' + (p.category === 'fragrance' ? 'عطور المنزل' : 'الأزياء') + '</div>' +
          '<a class="p-name" href="product.html?id=' + encodeURIComponent(p.id) + '">' + EH.esc(p.name) + '</a>' +
          '<div class="p-price"><span class="now">' + EH.fmt(p.price) + '</span>' +
          (EH.Product.hasDiscount(p) ? '<span class="old">' + EH.fmt(p.oldPrice) + '</span>' : '') + '</div></div></article>';
      }).join('') + '</div>';
    rel.appendChild(wrap);
    var track = wrap.querySelector('.car-track');
    var rtl = (getComputedStyle(track).direction === 'rtl') ? -1 : 1;
    wrap.querySelector('.next').addEventListener('click', function () { track.scrollBy({ left: rtl * -track.clientWidth * 0.7, behavior: 'smooth' }); });
    wrap.querySelector('.prev').addEventListener('click', function () { track.scrollBy({ left: rtl * track.clientWidth * 0.7, behavior: 'smooth' }); });
  }

  EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
    EH.injectCommon();
    EH.initPixels(d.settings);
    EH.refreshCartBadge();

    product = EH.Product.byId(d.products, pid);
    if (!product) {
      document.getElementById('product-root').innerHTML =
        '<div class="empty-state" style="padding:70px 20px"><div class="ic">😕</div>المنتج غير موجود<br><a class="btn" style="margin-top:16px" href="shop.html">تصفح المنتجات</a></div>';
      document.title = 'المنتج غير موجود | Elegance';
      return;
    }
    document.title = product.name + ' | Elegance Home & Style';
    document.querySelector('meta[name="description"]').setAttribute('content', product.desc || '');

    render();

    // قسم المنتجات ذات الصلة
    var root = document.getElementById('product-root');
    var sec = document.createElement('section');
    sec.className = 'section';
    sec.id = 'related-sec';
    sec.innerHTML = '<div class="container"><div class="section-head"><h2>منتجات ذات صلة</h2></div><div id="related"></div></div>';
    root.appendChild(sec);
    renderRelated(d);
  });
})();
