/* ===== السلة + مساعدات المنتجات والمتغيرات ===== */
(function () {
  'use strict';
  var LS = EH.CONFIG.LS;

  /* ---------- مساعدات المتغيرات ---------- */
  EH.Product = {
    byId: function (products, id) {
      return (products || []).filter(function (p) { return p.id === id && p.active !== false; })[0] || null;
    },

    // مفتاح المتغير
    variantKey: function (product, sel) {
      sel = sel || {};
      if (product.variantMode === 'fashion') return (sel.color || '') + '|' + (sel.size || '');
      if (product.variantMode === 'fragrance') return sel.capacity || '';
      return '';
    },

    variantLabel: function (product, sel) {
      if (product.variantMode === 'fashion') {
        var parts = [];
        if (sel.color) parts.push(sel.color);
        if (sel.size) parts.push('مقاس ' + sel.size);
        return parts.join(' — ');
      }
      if (product.variantMode === 'fragrance') return sel.capacity || '';
      return '';
    },

    // سعر المتغير (السعر الأساسي + فرق السعة)
    price: function (product, sel) {
      var base = Number(product.price) || 0;
      if (product.variantMode === 'fragrance' && sel && sel.capacity) {
        var cap = (product.capacities || []).filter(function (c) { return c.label === sel.capacity; })[0];
        if (cap) base += Number(cap.delta) || 0;
      }
      return base;
    },

    oldPrice: function (product, sel) {
      var base = Number(product.oldPrice) || 0;
      if (!base) return 0;
      if (product.variantMode === 'fragrance' && sel && sel.capacity) {
        var cap = (product.capacities || []).filter(function (c) { return c.label === sel.capacity; })[0];
        if (cap) base += Number(cap.delta) || 0;
      }
      return base;
    },

    stockOf: function (product, sel) {
      var key = EH.Product.variantKey(product, sel);
      var st = product.stock || {};
      if (!key) {
        // بدون متغيرات: مخزون موحد
        return (st[''] != null || st.main != null) ? (st[''] != null ? st[''] : st.main) : 999;
      }
      if (Object.keys(st).length === 0) return 999;
      return st[key] != null ? st[key] : 0;
    },

    isOut: function (product, sel) {
      return EH.Product.stockOf(product, sel) <= 0;
    },

    // صورة المنتج حسب اللون المختار
    imageFor: function (product, color) {
      var imgs = product.images || [];
      if (color) {
        var m = imgs.filter(function (i) { return i.color && i.color === color; })[0];
        if (m) return m.src;
        m = imgs.filter(function (i) { return !i.color; })[0];
        if (m) return m.src;
      }
      return imgs.length ? imgs[0].src : 'assets/img/placeholder.webp';
    },

    // سكيو المتغير
    skuFor: function (product, sel) {
      var base = product.sku || product.id;
      var key = EH.Product.variantKey(product, sel);
      if (!key) return base;
      var code = key.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, '-').slice(0, 24);
      return base + '-' + code;
    },

    // كل المتغيرات المتاحة
    options: function (product) {
      var out = [];
      if (product.variantMode === 'fashion') {
        (product.colors || []).forEach(function (c) {
          (product.sizes || []).forEach(function (s) {
            out.push({ color: c.name, size: s });
          });
        });
      } else if (product.variantMode === 'fragrance') {
        (product.capacities || []).forEach(function (c) {
          out.push({ capacity: c.label });
        });
      } else {
        out.push({});
      }
      return out;
    },

    hasDiscount: function (product) {
      return Number(product.oldPrice) > Number(product.price);
    },

    stockTotal: function (product) {
      var st = product.stock || {};
      var keys = Object.keys(st);
      if (!keys.length) return 999;
      return keys.reduce(function (s, k) { return s + (Number(st[k]) || 0); }, 0);
    }
  };

  /* ---------- السلة ---------- */
  EH.Cart = {
    get: function () { return EH.lsGet(LS.cart, []) || []; },
    save: function (items) { EH.lsSet(LS.cart, items); EH.refreshCartBadge(); },

    find: function (product, sel) {
      var key = EH.Product.variantKey(product, sel);
      return EH.Cart.get().filter(function (it) {
        return it.id === product.id && (it.variantKey || '') === key;
      })[0] || null;
    },

    add: function (product, sel, qty, opts) {
      qty = qty || 1;
      var items = EH.Cart.get();
      var key = EH.Product.variantKey(product, sel);
      var it = items.filter(function (x) { return x.id === product.id && (x.variantKey || '') === key; })[0];
      var stock = EH.Product.stockOf(product, sel);
      var price = EH.Product.price(product, sel);
      if (it) {
        if (it.qty + qty > stock) { EH.toast('الكمية المتوفرة محدودة (' + stock + ')', 'error'); return false; }
        it.qty += qty;
      } else {
        if (qty > stock) { EH.toast('الكمية المتوفرة محدودة (' + stock + ')', 'error'); return false; }
        items.push({
          id: product.id, variantKey: key,
          name: product.name,
          variant: EH.Product.variantLabel(product, sel),
          sku: EH.Product.skuFor(product, sel),
          price: price, qty: qty,
          image: EH.Product.imageFor(product, sel && sel.color)
        });
      }
      EH.Cart.save(items);
      if (!opts || !opts.silent) {
        EH.toast('تمت الإضافة إلى السلة ✓', 'ok');
        EH.track('AddToCart', {
          value: price * qty,
          content_ids: [product.id],
          contents: [{ id: product.id, quantity: qty, price: price }]
        });
      }
      return true;
    },

    setQty: function (idx, qty) {
      var items = EH.Cart.get();
      if (qty <= 0) items.splice(idx, 1);
      else items[idx].qty = qty;
      EH.Cart.save(items);
    },

    remove: function (idx) {
      var items = EH.Cart.get();
      items.splice(idx, 1);
      EH.Cart.save(items);
    },

    clear: function () { EH.Cart.save([]); },

    count: function () {
      return EH.Cart.get().reduce(function (s, it) { return s + it.qty; }, 0);
    },

    subtotal: function () {
      return EH.Cart.get().reduce(function (s, it) { return s + (it.price || 0) * it.qty; }, 0);
    }
  };

  /* ---------- الكوبونات ---------- */
  EH.Coupon = {
    // يتحقق من صلاحية الكوبون ويعيد قيمة الخصم
    validate: function (code, subtotal, coupons) {
      code = String(code || '').trim().toUpperCase();
      if (!code) return { ok: false };
      var c = (coupons || []).filter(function (x) { return String(x.code).toUpperCase() === code; })[0];
      if (!c || c.active === false) return { ok: false, error: 'كود الخصم غير صحيح' };
      if (c.expires && new Date(c.expires + 'T23:59:59') < new Date()) return { ok: false, error: 'انتهت صلاحية هذا الكود' };
      if (c.maxUses && (c.used || 0) >= c.maxUses) return { ok: false, error: 'تم استعمال هذا الكود بالكامل' };
      if (c.minOrder && subtotal < c.minOrder) return { ok: false, error: 'الحد الأدنى للطلب مع هذا الكود: ' + EH.fmt(c.minOrder) };
      var discount = c.type === 'percent' ? Math.round(subtotal * (c.value / 100)) : Math.min(c.value, subtotal);
      return { ok: true, coupon: c, discount: discount };
    }
  };
})();
