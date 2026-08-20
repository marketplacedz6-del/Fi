/* ===== طبقة البيانات: Google Sheets (Apps Script) + وضع تجريبي محلي ===== */
(function () {
  'use strict';

  var LS = EH.CONFIG.LS;
  var _seed = null;
  var _data = null;       // البيانات الحالية {settings, products, shipping, shippingDefaults, freeShipping, coupons}
  var _mediaCache = {};
  var _notified = false;

  // خطة احتياطية: بيانات دنيا حتى لا تبقى الصفحات فارغة عند فشل التحميل
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
        adminEmail: 'walid@gmail.com', adminPassHash: '', apiUrl: '', apiToken: '', connected: false
      }
    };
  }

  function loadSeed() {
    if (_seed) return Promise.resolve(_seed);
    return fetch('assets/data/seed.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('seed');
        return r.json();
      })
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

  function isRemoteConfigured(settings) {
    return !!(settings && settings.connected === true && settings.apiUrl);
  }

  // طلب عام إلى Google Apps Script
  function callScript(url, payload) {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    };
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'استجابة غير صالحة من الخادم' }; });
    });
  }

  function buildApiUrl(base) {
    return String(base).replace(/\/+$/, '');
  }

  /* ---------- البيانات العامة (المتجر) ---------- */
  EH.apiGetData = function (force) {
    return loadSeed().then(function (seed) {
      var locals = readLocalOverrides();
      var settings = deepMerge(seed.settings, locals.settings);

      if (isRemoteConfigured(settings)) {
        // وضع الربط مع Google Sheets
        var cacheKey = LS.cache;
        if (!force) {
          var c = EH.lsGet(cacheKey, null);
          if (c && c.t && (Date.now() - c.t) < 60 * 1000) { _data = c.d; return _data; }
        }
        var url = buildApiUrl(settings.apiUrl) + '?action=getData';
        return fetch(url).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || res.ok === false) throw new Error(res && res.error ? res.error : 'فشل الاتصال');
          _data = {
            // ندمج الإعدادات المحلية أولاً (تحتفظ بالرمز السري) ثم نطبق إعدادات الخادم
            settings: deepMerge(deepMerge(seed.settings, locals.settings || {}), res.settings || {}),
            products: (res.products != null) ? res.products : seed.products,
            shipping: res.shipping || {},
            shippingDefaults: res.shippingDefaults || seed.shippingDefaults,
            freeShipping: res.freeShipping || seed.freeShipping,
            coupons: res.coupons || seed.coupons
          };
          EH.lsSet(cacheKey, { t: Date.now(), d: _data });
          return _data;
        }).catch(function (err) {
          // فشل الاتصال -> بيانات محلية (الوضع التجريبي)
          _data = {
            settings: settings,
            products: locals.products || seed.products,
            shipping: locals.shipping || {},
            shippingDefaults: locals.shippingDefaults || seed.shippingDefaults,
            freeShipping: locals.freeShipping || seed.freeShipping,
            coupons: locals.coupons || seed.coupons
          };
          return _data;
        });
      }
      // الوضع التجريبي المحلي
      _data = {
        settings: settings,
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
    });
  };

  EH.getSettings = function () { return _data ? _data.settings : null; };

  // إبطال الكاش (بعد تعديلات الإدارة)
  EH.invalidateCache = function () { EH.lsDel(LS.cache); };

  /* ---------- إنشاء طلب جديد ---------- */
  EH.createOrder = function (order) {
    var settings = _data ? _data.settings : null;
    if (settings && isRemoteConfigured(settings)) {
      return callScript(buildApiUrl(settings.apiUrl) + '?action=createOrder', { order: order })
        .then(function (res) {
          if (res && res.ok) return { ok: true, orderId: res.orderId };
          return { ok: false, error: (res && res.error) || 'تعذر إرسال الطلب' };
        });
    }
    // وضع تجريبي: حفظ محلياً
    return loadSeed().then(function () {
      var seq = (EH.lsGet(LS.seq, 0) || 0) + 1;
      EH.lsSet(LS.seq, seq);
      var d = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var orderId = 'EH-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + ('000' + seq).slice(-4);
      order.id = orderId;
      order.createdAt = d.toISOString();
      var orders = EH.lsGet(LS.orders, []);
      orders.unshift(order);
      EH.lsSet(LS.orders, orders);
      return { ok: true, orderId: orderId, demo: true };
    });
  };

  /* ---------- عمليات الإدارة ---------- */
  function adminCall(action, payload) {
    var settings = EH.getSettings() || {};
    if (!isRemoteConfigured(settings)) {
      return Promise.resolve({ ok: false, error: 'الربط مع Google Sheets غير مُفعّل', demo: true });
    }
    payload.token = settings.apiToken;
    return callScript(buildApiUrl(settings.apiUrl) + '?action=' + action, payload);
  }

  EH.getOrders = function () {
    var settings = EH.getSettings() || {};
    if (isRemoteConfigured(settings)) {
      return adminCall('getOrders', {}).then(function (res) {
        if (res.ok) return { ok: true, orders: res.orders || [] };
        return res;
      });
    }
    return Promise.resolve({ ok: true, orders: EH.lsGet(LS.orders, []), demo: true });
  };

  EH.saveProduct = function (product) { return adminCall('saveProduct', { product: product }); };
  EH.deleteProduct = function (id) { return adminCall('deleteProduct', { id: id }); };
  EH.saveShipping = function (matrix, defaults, freeShipping) {
    return adminCall('saveShipping', { shipping: matrix, shippingDefaults: defaults, freeShipping: freeShipping });
  };
  EH.saveCoupon = function (coupon) { return adminCall('saveCoupon', { coupon: coupon }); };
  EH.deleteCoupon = function (id) { return adminCall('deleteCoupon', { id: id }); };
  EH.saveSettings = function (settings) { return adminCall('saveSettings', { settings: settings }); };
  EH.updateOrderStatus = function (orderId, status) { return adminCall('updateOrderStatus', { orderId: orderId, status: status }); };
  EH.deleteOrder = function (orderId) { return adminCall('deleteOrder', { orderId: orderId }); };
  EH.verifyToken = function (token) {
    var settings = EH.getSettings() || {};
    if (!isRemoteConfigured(settings)) return Promise.resolve({ ok: false, error: 'لم يتم ضبط الرابط بعد' });
    return callScript(buildApiUrl(settings.apiUrl) + '?action=verifyToken', { token: token });
  };
  EH.uploadImage = function (dataUrl, name) {
    return adminCall('uploadImage', { data: dataUrl, name: name || 'image.webp' });
  };

  // حفظ محلي (وضع تجريبي)
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
