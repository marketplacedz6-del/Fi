/* =====================================================================
 *  طبقة البيانات — Firebase (Firestore + Storage + Auth)
 *  المتجر يعمل على استضافة GitHub Pages المجانية، وقاعدة بياناته هي
 *  Firebase: المنتجات/الطلبات/الشحن/الكوبونات/الإعدادات في Firestore،
 *  الصور تُرفع إلى Firebase Storage، والدخول للوحة التحكم عبر Firebase Auth.
 *  كما تُصدَّر الطلبات (best-effort) إلى Google Sheets عبر Apps Script
 *  بالأعمدة المطلوبة إذا أُدخل رابط التطبيق في الإعدادات.
 * ===================================================================== */
(function () {
  'use strict';

  var LS = EH.CONFIG.LS;
  var _seed = null;
  var _data = null;        // البيانات الحالية {settings, products, shipping, shippingDefaults, freeShipping, coupons}
  var _notified = false;
  var _firebaseReady = false;
  var _mediaCache = {};

  /* ---------- تهيئة Firebase ---------- */
  function initFirebase() {
    if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
      _firebaseReady = true;
      return;
    }
    try {
      if (window.firebase && window.firebase.initializeApp) {
        window.firebase.initializeApp(EH.FIREBASE_CONFIG);
        _firebaseReady = true;
      }
    } catch (e) { _firebaseReady = false; }
    return _firebaseReady;
  }
  EH.firebaseReady = function () { return _firebaseReady; };

  function db() { return window.firebase ? window.firebase.firestore() : null; }
  function auth() { return window.firebase ? window.firebase.auth() : null; }
  function storage() { return window.firebase ? window.firebase.storage() : null; }
  function currentUser() {
    var a = auth();
    return (a && a.currentUser) ? a.currentUser : null;
  }

  /* ---------- خطة احتياطية: بيانات دنيا حتى لا تبقى الصفحات فارغة ---------- */
  var _seedFailed = false;
  function fallbackSeed() {
    return {
      products: [], shipping: {}, coupons: [],
      shippingDefaults: { home: 600, desk: 400 },
      freeShipping: { enabled: true, minAmount: 8000 },
      settings: {
        storeName: 'Elegance Home & Style', storeNameAr: 'إليغانس هوم أند ستايل',
        tagline: 'عطور منزلية وأزياء راقية', phone: '', whatsapp: '', currency: 'دج',
        logo: 'assets/img/brand/logo-trans.webp', footerText: '',
        hero: { kind: 'image', src: 'assets/img/brand/hero.webp', title: 'أناقة تعبق بالعطر', subtitle: '', ctaText: 'تسوّق الآن', ctaUrl: 'shop.html' },
        pixels: { meta: '', tiktok: '', gtag: '' }, facebook: '', instagram: '', tiktokUrl: '',
        adminEmail: '', adminPassHash: '', apiUrl: '', apiToken: '', connected: false
      }
    };
  }

  function loadSeed() {
    if (_seed) return Promise.resolve(_seed);
    return fetch('assets/data/seed.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('seed'); return r.json(); })
      .then(function (j) { _seed = j; return j; })
      .catch(function () {
        _seedFailed = true;
        _seed = fallbackSeed();
        return _seed;
      });
  }
  EH.seedFailed = function () { return _seedFailed; };

  function deepMerge(base, over) {
    if (!over) return base;
    var out = JSON.parse(JSON.stringify(base || {}));
    Object.keys(over).forEach(function (k) {
      var v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], v);
      } else { out[k] = v; }
    });
    return out;
  }

  function readLocalOverrides() {
    return {
      products: EH.lsGet(LS.products, null),
      shipping: EH.lsGet(LS.shipping, null),
      shippingDefaults: EH.lsGet(LS.shippingDefaults, null),
      freeShipping: EH.lsGet(LS.freeShipping, null),
      coupons: EH.lsGet(LS.coupons, null),
      settings: EH.lsGet(LS.settings, null)
    };
  }

  /* ---------- قراءة البيانات من Firestore ---------- */
  function fbDoc(col, id) { return db().collection(col).doc(id).get(); }
  function fbCol(col) { return db().collection(col).get(); }

  function readSettingsFB() {
    return fbDoc('settings', 'store').then(function (snap) {
      return snap.exists ? snap.data() : null;
    });
  }

  function readProductsFB() {
    return fbCol('products').then(function (snap) {
      return snap.docs.map(function (d) { return d.data(); });
    });
  }

  function readShippingFB() {
    return fbCol('shipping').then(function (snap) {
      var matrix = {};
      snap.docs.forEach(function (d) {
        var r = d.data() || {};
        var row = {};
        if (r.home != null) row.home = Number(r.home);
        if (r.desk != null) row.desk = Number(r.desk);
        if (r.free) row.free = true;
        if (r.freeOver != null) row.freeOver = Number(r.freeOver);
        matrix[d.id] = row;
      });
      return matrix;
    });
  }

  function readCouponsFB() {
    return fbCol('coupons').then(function (snap) {
      return snap.docs.map(function (d) { return d.data(); });
    });
  }

  // إعدادات عامة افتراضية
  function defaultSettings() {
    return {
      storeName: 'Elegance Home & Style', storeNameAr: 'إليغانس هوم أند ستايل',
      tagline: 'عطور منزلية وأزياء راقية', phone: '', whatsapp: '', currency: 'دج',
      logo: 'assets/img/brand/logo-trans.webp', footerText: '',
      hero: { kind: 'image', src: 'assets/img/brand/hero.webp', title: 'أناقة تعبق بالعطر', subtitle: '', ctaText: 'تسوّق الآن', ctaUrl: 'shop.html' },
      pixels: { meta: '', tiktok: '', gtag: '' }, facebook: '', instagram: '', tiktokUrl: '',
      adminEmail: '', adminPassHash: '', apiUrl: '', apiToken: '', connected: true
    };
  }

  // البيانات العامة (المتجر) — تُقرأ من Firestore، مع احتياط محلي
  EH.apiGetData = function (force) {
    return loadSeed().then(function (seed) {
      var locals = readLocalOverrides();
      var localSettings = deepMerge(seed.settings, locals.settings);

      if (!initFirebase() || !db()) {
        // Firebase غير متاح → وضع محلي
        _data = {
          settings: deepMerge(localSettings, { connected: false }),
          products: locals.products || seed.products,
          shipping: locals.shipping || {},
          shippingDefaults: locals.shippingDefaults || seed.shippingDefaults,
          freeShipping: locals.freeShipping || seed.freeShipping,
          coupons: locals.coupons || seed.coupons
        };
        return _data;
      }

      // Firebase متاح → نقرأ البيانات الحقيقية
      var cacheKey = LS.cache;
      if (!force) {
        var c = EH.lsGet(cacheKey, null);
        if (c && c.t && (Date.now() - c.t) < 60 * 1000 && c.d && c.d.__fb) { _data = c.d; return _data; }
      }

      return Promise.all([
        readSettingsFB().catch(function () { return null; }),
        readProductsFB().catch(function () { return null; }),
        readShippingFB().catch(function () { return null; }),
        readCouponsFB().catch(function () { return null; })
      ]).then(function (res) {
        var fbSettings = res[0] || {};
        var products = res[1];
        var shipping = res[2];
        var coupons = res[3];

        // إذا فشل كل شيء → نستخدم البيانات المحلية
        if (!products) {
          _data = {
            settings: deepMerge(localSettings, { connected: false }),
            products: locals.products || seed.products,
            shipping: locals.shipping || {},
            shippingDefaults: locals.shippingDefaults || seed.shippingDefaults,
            freeShipping: locals.freeShipping || seed.freeShipping,
            coupons: locals.coupons || seed.coupons
          };
          if (_seedFailed && !_notified) {
            _notified = true;
            try { EH.toast('تعذر تحميل بيانات المتجر — تحقق من اتصالك بالإنترنت', 'error'); } catch (e) {}
          }
          return _data;
        }

        // الإعدادات: نبدأ من القيم الافتراضية ثم نطبّق إعدادات Firebase
        var mergedSettings = deepMerge(deepMerge(defaultSettings(), localSettings), fbSettings);
        mergedSettings.connected = true;

        // دمج منتجات Firebase فوق المنتجات التجريبية (بالرقم id) — لا تُفقد أي منتج
        function overlayById(baseList, fbList) {
          var out = baseList.slice();
          var byId = {};
          (fbList || []).forEach(function (x) { byId[x.id] = x; });
          for (var i = 0; i < out.length; i++) {
            if (byId[out[i].id]) { out[i] = byId[out[i].id]; delete byId[out[i].id]; }
          }
          Object.keys(byId).forEach(function (id) { out.push(byId[id]); });
          return out;
        }

        _data = {
          settings: mergedSettings,
          products: overlayById(seed.products, products),
          shipping: shipping || seed.shipping || {},
          shippingDefaults: mergedSettings.shippingDefaults || seed.shippingDefaults,
          freeShipping: mergedSettings.freeShipping || seed.freeShipping,
          coupons: overlayById(seed.coupons || [], coupons),
          __fb: true
        };
        try { EH.lsSet(cacheKey, { t: Date.now(), d: _data }); } catch (e) {}
        return _data;
      });
    });
  };

  EH.getSettings = function () { return _data ? _data.settings : null; };

  // إبطال الكاش بعد تعديلات الإدارة
  EH.invalidateCache = function () {
    EH.lsDel(LS.cache);
    try { EH.lsDel('eh.v1.__fbSeed'); } catch (e) {}
  };

  /* ---------- إنشاء طلب جديد (Firestore + تصدير إلى Google Sheets) ---------- */
  function genOrderId(seq) {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'EH-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + ('000' + seq).slice(-4);
  }

  EH.createOrder = function (order) {
    var settings = _data ? _data.settings : (EH.lsGet(LS.settings, null) || {});
    var seq = (EH.lsGet(LS.seq, 0) || 0) + 1;
    EH.lsSet(LS.seq, seq);
    var orderId = order.id || genOrderId(seq);

    var c = order.customer || {};
    var fullName = c.name || [c.firstName, c.lastName].filter(Boolean).join(' ').trim();

    var doc = JSON.parse(JSON.stringify(order));
    doc.id = orderId;
    doc.createdAt = new Date().toISOString();
    doc.status = 'review';
    doc.confirmation = 'قيد المراجعة';
    doc.customer = JSON.parse(JSON.stringify(c));
    doc.customer.name = fullName;
    if (!doc.customer.phone2) doc.customer.phone2 = '';

    var persist = function () {
      if (initFirebase() && db()) {
        return db().collection('orders').doc(orderId).set(doc)
          .then(function () { return { ok: true, orderId: orderId, fb: true }; })
          .catch(function (err) { return { ok: false, error: 'تعذر حفظ الطلب: ' + (err.message || 'خطأ') }; });
      }
      // وضع محلي
      var orders = EH.lsGet(LS.orders, []);
      orders.unshift(doc);
      EH.lsSet(LS.orders, orders);
      return { ok: true, orderId: orderId, demo: true };
    };

    return persist().then(function (res) {
      if (res.ok) {
        // تصدير (best-effort) إلى Google Sheets إن كان مُعداً
        try {
          if (settings.apiUrl) {
            var payload = { order: doc };
            fetch(String(settings.apiUrl).replace(/\/+$/, '') + '?action=createOrder', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload)
            }).catch(function () {});
          }
        } catch (e) {}
      }
      return res;
    });
  };

  /* ---------- عمليات الإدارة (تتطلب تسجيل الدخول عبر Firebase) ---------- */
  function requireAuth() {
    return currentUser();
  }
  function guard() {
    if (!initFirebase() || !db()) return { ok: false, error: 'Firebase غير مُفعّل — تحقق من اتصالك بالإنترنت' };
    if (!currentUser()) return { ok: false, error: 'تحتاج إلى تسجيل الدخول أولاً' };
    return true;
  }

  EH.getOrders = function () {
    if (!initFirebase() || !db()) {
      return Promise.resolve({ ok: true, orders: EH.lsGet(LS.orders, []), demo: true });
    }
    if (!currentUser()) return Promise.resolve({ ok: true, orders: [], demo: true });
    return db().collection('orders').orderBy('createdAt', 'desc').get()
      .then(function (snap) {
        var orders = snap.docs.map(function (d) {
          var o = d.data();
          o.id = d.id;
          return o;
        });
        return { ok: true, orders: orders, demo: false };
      })
      .catch(function (err) {
        return { ok: false, error: (err && err.message) || 'تعذر جلب الطلبات' };
      });
  };

  EH.saveProduct = function (product) {
    if (guard() !== true) return Promise.resolve(guard());
    var id = product.id;
    return db().collection('products').doc(id).set(product).then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحفظ' }; });
  };

  EH.deleteProduct = function (id) {
    if (guard() !== true) return Promise.resolve(guard());
    return db().collection('products').doc(id).delete().then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحذف' }; });
  };

  EH.saveShipping = function (matrix, defaults, freeShipping) {
    if (guard() !== true) return Promise.resolve(guard());
    var writes = [];
    Object.keys(matrix).forEach(function (wid) {
      var row = matrix[wid] || {};
      writes.push(db().collection('shipping').doc(String(wid)).set({
        home: row.home != null ? row.home : null,
        desk: row.desk != null ? row.desk : null,
        free: !!row.free,
        freeOver: row.freeOver != null ? row.freeOver : null
      }));
    });
    // إعدادات الشحن العامة في وثيقة الإعدادات
    writes.push(db().collection('settings').doc('store').set(
      { shippingDefaults: defaults || {}, freeShipping: freeShipping || {} },
      { merge: true }
    ));
    return Promise.all(writes).then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحفظ' }; });
  };

  EH.saveCoupon = function (coupon) {
    if (guard() !== true) return Promise.resolve(guard());
    return db().collection('coupons').doc(coupon.id).set(coupon).then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحفظ' }; });
  };

  EH.deleteCoupon = function (id) {
    if (guard() !== true) return Promise.resolve(guard());
    return db().collection('coupons').doc(id).delete().then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحذف' }; });
  };

  EH.saveSettings = function (settings) {
    if (guard() !== true) return Promise.resolve(guard());
    var s = JSON.parse(JSON.stringify(settings || {}));
    delete s.seq;
    return db().collection('settings').doc('store').set(s, { merge: true }).then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحفظ' }; });
  };

  EH.updateOrderStatus = function (orderId, status) {
    if (guard() !== true) return Promise.resolve(guard());
    var label = EH.CONFIG.STATUS_LABEL(status);
    return db().collection('orders').doc(orderId).set(
      { status: status, confirmation: label }, { merge: true }
    ).then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل التحديث' }; });
  };

  EH.deleteOrder = function (orderId) {
    if (guard() !== true) return Promise.resolve(guard());
    return db().collection('orders').doc(orderId).delete().then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الحذف' }; });
  };

  EH.verifyToken = function () {
    return Promise.resolve({ ok: !!currentUser(), demo: !initFirebase() });
  };

  /* ---------- رفع الصور إلى Firebase Storage ---------- */
  EH.uploadImage = function (dataUrl, name) {
    if (guard() !== true) return Promise.resolve(guard());
    if (!storage()) return Promise.resolve({ ok: false, error: 'التخزين غير متاح' });
    var n = (name || 'image.webp').replace(/[^\w.\-]+/g, '_');
    var ref = storage().ref('product-images/' + Date.now() + '-' + n);
    return ref.putString(dataUrl, 'data_url', { contentType: 'image/webp' })
      .then(function (snap) { return snap.ref.getDownloadURL(); })
      .then(function (url) { return { ok: true, url: url }; })
      .catch(function (err) { return { ok: false, error: (err && err.message) || 'فشل الرفع' }; });
  };

  /* ---------- حفظ محلي (احتياط) ---------- */
  EH.localSave = function (what, val) {
    if (what === 'products') EH.lsSet(LS.products, val);
    if (what === 'shipping') EH.lsSet(LS.shipping, val);
    if (what === 'shippingDefaults') EH.lsSet(LS.shippingDefaults, val);
    if (what === 'freeShipping') EH.lsSet(LS.freeShipping, val);
    if (what === 'coupons') EH.lsSet(LS.coupons, val);
    if (what === 'settings') EH.lsSet(LS.settings, val);
    EH.invalidateCache();
    return Promise.resolve({ ok: true, demo: true });
  };

  EH.getShippingMatrix = function () {
    return EH.apiGetData().then(function (d) { return d; });
  };

  // سعر الشحن لولاية معينة (يعيد {price, free, freeOver})
  EH.shippingFor = function (wilayaId, kind, data, subtotal) {
    data = data || _data || {};
    var row = (data.shipping || {})[String(wilayaId)] || {};
    var defs = data.shippingDefaults || { home: 600, desk: 400 };
    var fs = data.freeShipping || {};
    if (row.free) return { price: 0, free: true, freeOver: 0 };
    var price = kind === 'desk' ? (row.desk != null ? row.desk : defs.desk) : (row.home != null ? row.home : defs.home);
    var freeOver = (fs.enabled && (row.freeOver || fs.minAmount)) ? (row.freeOver || fs.minAmount) : 0;
    if (freeOver && (subtotal || 0) >= freeOver) return { price: 0, free: true, freeOver: freeOver };
    return { price: price, free: false, freeOver: freeOver };
  };

  // صور المنتجات: كلها روابط (URL)
  EH.resolveImg = function (src) {
    return src || 'assets/img/placeholder.webp';
  };
})();
