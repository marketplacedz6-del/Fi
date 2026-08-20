/* ===== صفحة قائمة المنتجات ===== */
(function () {
  'use strict';
  // رسم الهيدر والفوتر فوراً — لا تبقى الصفحة فارغة أبداً
  try { EH.injectCommon(); EH.refreshCartBadge(); } catch (e) {}

  var state = {
    cat: EH.qs('cat') || 'all',
    q: EH.qs('q') || '',
    sort: 'default'
  };

  function cardHTML(p) {
    var badge = '';
    if (p.badge === 'new') badge = '<span class="p-badge b-new">جديد</span>';
    else if (p.badge === 'best') badge = '<span class="p-badge">الأكثر مبيعاً</span>';
    else if (EH.Product.hasDiscount(p)) badge = '<span class="p-badge b-sale">تخفيض</span>';
    var stock = EH.Product.stockTotal(p);
    var addBtn = stock <= 0
      ? '<div class="p-out">نفد من المخزون</div>'
      : '<button class="p-add" data-add="' + EH.esc(p.id) + '">🛒 أضف إلى السلة</button>';
    return '<article class="p-card">' + badge +
      '<a class="p-img" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
      '<img src="' + EH.esc(EH.resolveImg(EH.Product.imageFor(p))) + '" alt="' + EH.esc(p.name) + '" loading="lazy" width="600" height="600"></a>' +
      '<div class="p-body"><div class="p-cat">' + (p.category === 'fragrance' ? 'عطور المنزل' : 'الأزياء') + '</div>' +
      '<a class="p-name" href="product.html?id=' + encodeURIComponent(p.id) + '">' + EH.esc(p.name) + '</a>' +
      '<div class="p-price"><span class="now">' + EH.fmt(p.price) + '</span>' +
      (EH.Product.hasDiscount(p) ? '<span class="old">' + EH.fmt(p.oldPrice) + '</span>' : '') + '</div>' + addBtn +
      '</div></article>';
  }

  function apply() {
    var grid = document.getElementById('grid');
    var empty = document.getElementById('empty');
    EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
      var products = (d.products || []).filter(function (p) { return p.active !== false; });

      if (state.cat === 'fragrance') products = products.filter(function (p) { return p.category === 'fragrance'; });
      else if (state.cat === 'fashion') products = products.filter(function (p) { return p.category === 'fashion'; });
      else if (state.cat === 'sale') products = products.filter(EH.Product.hasDiscount);

      if (state.q) {
        var q = state.q.toLowerCase();
        products = products.filter(function (p) {
          return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.desc || '').toLowerCase().indexOf(q) !== -1;
        });
      }

      if (state.sort === 'new') products.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
      else if (state.sort === 'price-asc') products.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === 'price-desc') products.sort(function (a, b) { return b.price - a.price; });
      else if (state.sort === 'best') products.sort(function (a, b) { return (b.sales || 0) - (a.sales || 0); });

      grid.innerHTML = products.map(cardHTML).join('');
      empty.classList.toggle('hidden', products.length > 0);

      var t = document.getElementById('pg-title');
      var c = document.getElementById('pg-crumb');
      if (state.cat === 'fragrance') { t.textContent = 'عطور المنزل'; c.textContent = 'عطور المنزل'; }
      else if (state.cat === 'fashion') { t.textContent = 'الأزياء'; c.textContent = 'الأزياء'; }
      else if (state.cat === 'sale') { t.textContent = 'التخفيضات 🔥'; c.textContent = 'التخفيضات'; }
      else { t.textContent = 'كل المنتجات'; c.textContent = 'كل المنتجات'; }
    });
  }

  EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
    EH.injectCommon();
    EH.initPixels(d.settings);
    EH.refreshCartBadge();
    apply();

    // الفلاتر
    EH.$$('#filter-bar .chip').forEach(function (ch) {
      if (ch.getAttribute('data-cat') === state.cat) ch.classList.add('active');
      ch.addEventListener('click', function () {
        state.cat = ch.getAttribute('data-cat');
        EH.$$('#filter-bar .chip').forEach(function (x) { x.classList.remove('active'); });
        ch.classList.add('active');
        apply();
      });
    });
    var sortSel = document.getElementById('sort-select');
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; apply(); });
  });

  // إضافة سريعة
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    EH.apiGetData().then(function (d) {
      var p = EH.Product.byId(d.products, btn.getAttribute('data-add'));
      if (!p) return;
      var sel = {};
      if (p.variantMode === 'fragrance' && p.capacities && p.capacities.length) sel.capacity = p.capacities[0].label;
      if (p.variantMode === 'fashion') {
        var c0 = (p.colors || [])[0], s0 = (p.sizes || [])[0];
        if (c0) sel.color = c0.name;
        if (s0) sel.size = s0;
      }
      EH.Cart.add(p, sel, 1);
    });
  });
})();
