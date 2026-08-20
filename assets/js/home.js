/* ===== الصفحة الرئيسية ===== */
(function () {
  'use strict';
  // رسم الهيدر والفوتر فوراً — لا تبقى الصفحة فارغة أبداً
  try { EH.injectCommon(); EH.refreshCartBadge(); } catch (e) {}

  function cardHTML(p) {
    var badge = '';
    if (p.badge === 'new') badge = '<span class="p-badge b-new">جديد</span>';
    else if (p.badge === 'best') badge = '<span class="p-badge">الأكثر مبيعاً</span>';
    else if (EH.Product.hasDiscount(p)) badge = '<span class="p-badge b-sale">تخفيض</span>';
    var price = '<div class="p-price"><span class="now">' + EH.fmt(p.price) + '</span>' +
      (EH.Product.hasDiscount(p) ? '<span class="old">' + EH.fmt(p.oldPrice) + '</span>' : '') + '</div>';
    var stock = EH.Product.stockTotal(p);
    var addBtn;
    if (stock <= 0) addBtn = '<div class="p-out">نفد من المخزون</div>';
    else addBtn = '<button class="p-add" data-add="' + EH.esc(p.id) + '">🛒 أضف إلى السلة</button>';
    return '<article class="p-card">' + badge +
      '<a class="p-img" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
      '<img src="' + EH.esc(EH.resolveImg(EH.Product.imageFor(p))) + '" alt="' + EH.esc(p.name) + '" loading="lazy" width="600" height="600"></a>' +
      '<div class="p-body"><div class="p-cat">' + (p.category === 'fragrance' ? 'عطور المنزل' : 'الأزياء') + '</div>' +
      '<a class="p-name" href="product.html?id=' + encodeURIComponent(p.id) + '">' + EH.esc(p.name) + '</a>' + price + addBtn + '</div></article>';
  }

  function renderTrack(el, list) {
    if (!list.length) { el.parentElement.style.display = 'none'; return; }
    el.innerHTML = list.map(cardHTML).join('');
  }

  function initCarousel(track) {
    var wrap = track.closest('.carousel');
    var next = wrap.querySelector('.car-btn.next');
    var prev = wrap.querySelector('.car-btn.prev');
    if (!next || !prev) return;
    // في RTL قيمة scrollLeft سالبة — نعكس الاتجاه تلقائياً
    var rtl = (getComputedStyle(track).direction === 'rtl') ? -1 : 1;
    next.addEventListener('click', function () { track.scrollBy({ left: rtl * -track.clientWidth * 0.7, behavior: 'smooth' }); });
    prev.addEventListener('click', function () { track.scrollBy({ left: rtl * track.clientWidth * 0.7, behavior: 'smooth' }); });
  }

  // إضافة سريعة للسلة
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    var id = btn.getAttribute('data-add');
    EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
      var p = EH.Product.byId(d.products, id);
      if (!p) return;
      var sel = {};
      if (p.variantMode === 'fragrance' && p.capacities && p.capacities.length) sel.capacity = p.capacities[0].label;
      if (p.variantMode === 'fashion') {
        var firstColor = (p.colors || [])[0];
        var firstSize = (p.sizes || [])[0];
        if (firstColor) sel.color = firstColor.name;
        if (firstSize) sel.size = firstSize;
      }
      EH.Cart.add(p, sel, 1);
    });
  });

  EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
    var s = d.settings;

    // الهيرو
    var hero = document.getElementById('eh-hero');
    var h = s.hero || {};
    if (hero) {
      var media = h.kind === 'video' && h.src
        ? '<video class="hero-media" autoplay muted loop playsinline poster="' + EH.esc(EH.resolveImg(h.poster || '')) + '"><source src="' + EH.esc(h.src) + '" type="video/mp4"></video>'
        : '<img class="hero-media" src="' + EH.esc(EH.resolveImg(h.src || 'assets/img/brand/hero.webp')) + '" alt="' + EH.esc(s.storeName || '') + '" fetchpriority="high">';
      hero.innerHTML = media +
        '<div class="hero-overlay"><div class="container"><div class="hero-content">' +
        '<div class="kicker">✨ ' + EH.esc(s.tagline || '') + '</div>' +
        '<h1>' + EH.esc(h.title || '') + '</h1>' +
        '<p>' + EH.esc(h.subtitle || '') + '</p>' +
        '<a class="btn" href="' + EH.esc(h.ctaUrl || 'shop.html') + '">' + EH.esc(h.ctaText || 'تسوق الآن') + ' ←</a>' +
        '</div></div></div>';
    }

    // ترويسة/فوتر + بكسلز
    EH.injectCommon();
    EH.initPixels(s);
    EH.refreshCartBadge();

    var products = (d.products || []).filter(function (p) { return p.active !== false; });

    // وصل حديثاً
    var newest = products.slice().sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); }).slice(0, 10);
    // الأكثر مبيعاً
    var best = products.slice().sort(function (a, b) { return (b.sales || 0) - (a.sales || 0); }).slice(0, 10);
    // عروض خاصة
    var sale = products.filter(EH.Product.hasDiscount).slice(0, 10);

    renderTrack(document.getElementById('car-new'), newest);
    renderTrack(document.getElementById('car-best'), best);
    renderTrack(document.getElementById('car-sale'), sale);

    EH.$$('.car-track').forEach(initCarousel);
  });
})();
