/* ===== صفحة إتمام الطلب (صفحة واحدة — بدون حساب) ===== */
(function () {
  'use strict';
  // رسم الهيدر والفوتر فوراً — لا تبقى الصفحة فارغة أبداً
  try { EH.injectCommon(); EH.refreshCartBadge(); } catch (e) {}

  var data = null;
  var wilayas = [];
  var communes = null;      // {w: id, n: name}
  var sel = { wilaya: '', commune: '', delivery: 'home' };
  var couponApplied = null;
  var submitting = false;

  function loadWilayas() {
    if (wilayas.length) return Promise.resolve(wilayas);
    return fetch('assets/data/wilayas.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) { wilayas = j; return j; })
      .catch(function () { wilayas = []; return []; });
  }

  function loadCommunes(wid) {
    if (communes) return Promise.resolve(communes.filter(function (c) { return c.w === wid; }));
    return fetch('assets/data/communes.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        communes = j;
        return j.filter(function (c) { return c.w === wid; });
      })
      .catch(function () { return []; });
  }

  // حساب الشحن
  function shippingFor(wilayaId, kind) {
    var row = (data.shipping || {})[String(wilayaId)] || {};
    var defs = data.shippingDefaults || { home: 600, desk: 400 };
    var fs = data.freeShipping || {};
    if (row.free) return { price: 0, free: true };
    var price = kind === 'desk' ? (row.desk != null ? row.desk : defs.desk) : (row.home != null ? row.home : defs.home);
    var subtotal = subtotalCalc();
    var freeOver = (fs.enabled && (row.freeOver || fs.minAmount)) ? (row.freeOver || fs.minAmount) : 0;
    if (freeOver && subtotal >= freeOver) return { price: 0, free: true, freeOver: freeOver };
    return { price: price, freeOver: freeOver };
  }

  function subtotalCalc() {
    return EH.Cart.get().reduce(function (s, it) { return s + (it.price || 0) * it.qty; }, 0);
  }

  function discountCalc(sub) {
    return couponApplied ? couponApplied.discount : 0;
  }

  function totals() {
    var sub = subtotalCalc();
    var disc = discountCalc(sub);
    var ship = sel.wilaya ? shippingFor(sel.wilaya, sel.delivery) : { price: 0 };
    return { sub: sub, disc: disc, shipping: ship.price, total: sub - disc + ship.price, shipInfo: ship };
  }

  function render() {
    var root = document.getElementById('checkout-root');
    var items = EH.Cart.get();

    if (!items.length) {
      root.innerHTML = '<div class="empty-state"><div class="ic">🛒</div>سلتك فارغة<br><a class="btn" style="margin-top:18px" href="shop.html">تصفح المنتجات</a></div>';
      document.body.classList.remove('has-sticky');
      var csticky = document.getElementById('checkout-sticky');
      if (csticky) csticky.classList.add('hidden');
      return;
    }
    document.body.classList.add('has-sticky');
    var csticky2 = document.getElementById('checkout-sticky');
    if (csticky2) csticky2.classList.remove('hidden');

    var t = totals();

    root.innerHTML =
      '<div class="pg-grid">' +
      /* ---------- النموذج ---------- */
      '<div><div class="card" style="background:var(--surface);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);margin-bottom:16px">' +
      '<div class="section-title" style="margin-top:0">👤 بيانات العميل</div>' +
      '<div class="field"><label>الاسم <span class="req">*</span></label><input id="f-first" type="text" placeholder="مثال: أمينة" autocomplete="given-name"></div>' +
      '<div class="field"><label>اللقب <span class="req">*</span></label><input id="f-last" type="text" placeholder="مثال: بن علي" autocomplete="family-name"></div>' +
      '<div class="field"><label>رقم الهاتف 1 <span class="req">*</span></label><input id="f-phone" type="tel" inputmode="numeric" placeholder="05XXXXXXXX" autocomplete="tel" dir="ltr" style="text-align:right">' +
      '<div class="hint">مثال: 0550123456 — سنتصل بك لتأكيد الطلب</div></div>' +
      '<div class="field"><label>رقم الهاتف 2 (احتياطي — اختياري)</label><input id="f-phone2" type="tel" inputmode="numeric" placeholder="05XXXXXXXX" dir="ltr" style="text-align:right"></div>' +
      '<div class="field"><label>الولاية <span class="req">*</span></label><select id="f-wilaya"><option value="">— اختر الولاية —</option></select></div>' +
      '<div class="field"><label>البلدية <span class="req">*</span></label><select id="f-commune" disabled><option value="">اختر الولاية أولاً</option></select></div>' +
      '<div class="field"><label>العنوان (اختياري)</label><input id="f-address" type="text" placeholder="الحي، الشارع، رقم المنزل…"></div>' +
      '<div class="field"><label>ملاحظات (اختياري)</label><textarea id="f-notes" rows="2" placeholder="أي تفاصيل إضافية…"></textarea></div>' +
      '</div>' +

      '<div class="card" style="background:var(--surface);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);margin-bottom:16px">' +
      '<div class="section-title" style="margin-top:0">🚚 طريقة التوصيل</div>' +
      '<div class="delivery-opts" id="delivery-opts">' +
      '<div class="hint" id="delivery-hint" style="margin-bottom:6px">اختر الولاية لعرض أسعار التوصيل</div>' +
      '<div class="delivery-opt active" data-kind="home">' +
      '<span class="radio"></span><span class="d-info"><span class="d-name">🏠 توصيل لباب المنزل</span><div class="d-sub">يصل الطلب حتى باب منزلك</div></span>' +
      '<span class="d-price" id="d-home">—</span></div>' +
      '<div class="delivery-opt" data-kind="desk">' +
      '<span class="radio"></span><span class="d-info"><span class="d-name">🏢 توصيل للمكتب / نقطة الاستلام</span><div class="d-sub">استلام من أقرب مكتب توصيل</div></span>' +
      '<span class="d-price" id="d-desk">—</span></div>' +
      '</div></div>' +

      '<div class="card" style="background:var(--surface);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow)">' +
      '<div class="section-title" style="margin-top:0">💵 الدفع</div>' +
      '<div class="delivery-opt active" style="cursor:default"><span class="radio" style="border-color:var(--gold)"></span>' +
      '<span class="d-info"><span class="d-name">الدفع عند الاستلام (COD)</span><div class="d-sub">ادفعي نقداً عند وصول طلبك</div></span>' +
      '<span class="d-price" style="color:var(--ok)">آمن 100%</span></div>' +
      '<div class="hint" style="margin-top:10px">🔒 لا حاجة لإنشاء حساب — بياناتك تُستخدم فقط لإيصال طلبك.</div>' +
      '</div></div>' +

      /* ---------- الملخص ---------- */
      '<div><div class="order-summary">' +
      '<div class="os-title">ملخص الطلب</div>' +
      '<div id="os-items"></div>' +
      '<div class="coupon-row"><input id="coupon-input" placeholder="كود الخصم" maxlength="30"><button class="btn btn-sm" id="coupon-btn">تطبيق</button></div>' +
      '<div id="coupon-msg"></div>' +
      '<div class="os-total-row"><span>إجمالي المنتجات</span><b id="t-sub">' + EH.fmt(t.sub) + '</b></div>' +
      '<div class="os-total-row" id="t-disc-row"><span>الخصم</span><b class="free" id="t-disc">-' + EH.fmt(t.disc) + '</b></div>' +
      '<div class="os-total-row"><span>التوصيل</span><b id="t-ship">' + EH.fmt(t.shipping) + '</b></div>' +
      '<div class="os-total-row grand"><span>الإجمالي</span><span id="t-total">' + EH.fmt(t.total) + '</span></div>' +
      '<button class="btn btn-block btn-dark" id="submit-btn" style="margin-top:14px;padding:15px">✅ تأكيد الطلب — ' + EH.fmt(t.total) + '</button>' +
      '<div class="hint" style="margin-top:8px;text-align:center">بعد التأكيد سنتصل بك هاتفياً لتأكيد الطلب</div>' +
      '</div></div>' +
      '</div>';

    renderItems();
    bindEvents();
    refreshTotals();
  }

  function renderItems() {
    var box = document.getElementById('os-items');
    if (!box) return;
    box.innerHTML = EH.Cart.get().map(function (it, i) {
      return '<div class="os-item">' +
        '<img src="' + EH.esc(EH.resolveImg(it.image)) + '" alt="' + EH.esc(it.name) + '" loading="lazy">' +
        '<div class="oi-info"><div class="oi-name">' + EH.esc(it.name) + '</div>' +
        (it.variant ? '<div class="oi-var">' + EH.esc(it.variant) + '</div>' : '') +
        '<div class="oi-qty"><button data-dec="' + i + '">−</button><span>' + it.qty + '</span><button data-inc="' + i + '">+</button></div></div>' +
        '<div class="oi-price">' + EH.fmt(it.price * it.qty) + '</div>' +
        '<button class="oi-del" data-del="' + i + '" title="حذف">✕</button></div>';
    }).join('');
  }

  function bindEvents() {
    var fFirst = document.getElementById('f-first');
    var fLast = document.getElementById('f-last');
    var fPhone = document.getElementById('f-phone');
    var fWilaya = document.getElementById('f-wilaya');
    var fCommune = document.getElementById('f-commune');

    // تعبئة الولايات
    wilayas.forEach(function (w) {
      var o = document.createElement('option');
      o.value = w.id;
      o.textContent = w.id + ' — ' + w.ar;
      fWilaya.appendChild(o);
    });

    fWilaya.addEventListener('change', function () {
      sel.wilaya = fWilaya.value;
      sel.commune = '';
      fCommune.disabled = !sel.wilaya;
      fCommune.innerHTML = '<option value="">' + (sel.wilaya ? 'جارٍ تحميل البلديات…' : 'اختر الولاية أولاً') + '</option>';
      updateDeliveryUI();
      if (sel.wilaya) {
        loadCommunes(Number(sel.wilaya)).then(function (list) {
          fCommune.innerHTML = '<option value="">— اختر البلدية —</option>' +
            list.map(function (c) { return '<option value="' + EH.esc(c.n) + '">' + EH.esc(c.n) + '</option>'; }).join('');
          fCommune.disabled = false;
        });
      }
      refreshTotals();
    });

    fCommune.addEventListener('change', function () { sel.commune = fCommune.value; });
    fPhone.addEventListener('input', function () {
      fPhone.parentElement.classList.toggle('invalid', fPhone.value.trim() !== '' && !EH.validPhone(fPhone.value));
    });
    fFirst.addEventListener('input', function () {
      fFirst.parentElement.classList.toggle('invalid', fFirst.value.trim() !== '' && fFirst.value.trim().length < 2);
    });
    fLast.addEventListener('input', function () {
      fLast.parentElement.classList.toggle('invalid', fLast.value.trim() !== '' && fLast.value.trim().length < 2);
    });

    // خيارات التوصيل
    EH.$$('#delivery-opts .delivery-opt').forEach(function (o) {
      o.addEventListener('click', function () {
        sel.delivery = o.getAttribute('data-kind');
        EH.$$('#delivery-opts .delivery-opt').forEach(function (x) { x.classList.remove('active'); });
        o.classList.add('active');
        refreshTotals();
      });
    });

    // الكمية في الملخص (مع حد المخزون)
    document.getElementById('os-items').addEventListener('click', function (e) {
      var inc = e.target.closest('[data-inc]');
      var dec = e.target.closest('[data-dec]');
      var del = e.target.closest('[data-del]');
      var idx;
      if (inc) {
        idx = Number(inc.getAttribute('data-inc'));
        var it = EH.Cart.get()[idx];
        var maxStock = stockOfItem(it);
        if (it.qty + 1 > maxStock) { EH.toast('الكمية المتوفرة محدودة (' + maxStock + ')', 'error'); return; }
        EH.Cart.setQty(idx, it.qty + 1);
      }
      else if (dec) { idx = Number(dec.getAttribute('data-dec')); EH.Cart.setQty(idx, EH.Cart.get()[idx].qty - 1); }
      else if (del) { idx = Number(del.getAttribute('data-del')); EH.Cart.remove(idx); }
      if (inc || dec || del) {
        if (!EH.Cart.get().length) { render(); return; }
        renderItems();
        refreshTotals();
        EH.refreshCartBadge();
      }
    });

    // المخزون المتاح لعنصر في السلة (حسب المتغير)
    function stockOfItem(item) {
      var p = EH.Product.byId(data.products, item.id);
      if (!p) return 99;
      var sel = {};
      if (p.variantMode === 'fashion') {
        var parts = String(item.variantKey || '').split('|');
        sel.color = parts[0] || '';
        sel.size = parts[1] || '';
      } else if (p.variantMode === 'fragrance') {
        sel.capacity = item.variantKey || '';
      }
      return EH.Product.stockOf(p, sel);
    }

    // الكوبون
    document.getElementById('coupon-btn').addEventListener('click', function () {
      var code = document.getElementById('coupon-input').value;
      var res = EH.Coupon.validate(code, subtotalCalc(), data.coupons);
      var msg = document.getElementById('coupon-msg');
      if (res.ok) {
        couponApplied = res;
        msg.innerHTML = '<div class="coupon-applied"><span>🎟️ كود "' + EH.esc(code.toUpperCase()) + '" — خصم ' + EH.fmt(res.discount) + '</span><button style="color:var(--err);font-weight:900" id="coupon-remove">✕</button></div>';
        document.getElementById('coupon-btn').disabled = true;
        EH.toast('تم تطبيق الكود بنجاح 🎉', 'ok');
      } else {
        msg.innerHTML = '<div class="notice err" style="margin-top:8px">' + EH.esc(res.error || 'كود غير صالح') + '</div>';
      }
      refreshTotals();
    });
    document.getElementById('coupon-msg').addEventListener('click', function (e) {
      if (e.target.id === 'coupon-remove') {
        couponApplied = null;
        document.getElementById('coupon-msg').innerHTML = '';
        document.getElementById('coupon-btn').disabled = false;
        document.getElementById('coupon-input').value = '';
        refreshTotals();
      }
    });

    // إرسال الطلب (الزر الرئيسي + الزر الثابت أسفل الشاشة)
    document.getElementById('submit-btn').addEventListener('click', submitOrder);
    var stickySubmit = document.getElementById('sticky-submit');
    if (stickySubmit) stickySubmit.addEventListener('click', submitOrder);
  }

  function updateDeliveryUI() {
    var hint = document.getElementById('delivery-hint');
    var homeEl = document.getElementById('d-home');
    var deskEl = document.getElementById('d-desk');
    if (!sel.wilaya) {
      hint.textContent = 'اختر الولاية لعرض أسعار التوصيل';
      homeEl.textContent = '—';
      deskEl.textContent = '—';
      return;
    }
    var sub = subtotalCalc();
    var home = shippingFor(sel.wilaya, 'home');
    var desk = shippingFor(sel.wilaya, 'desk');
    var freeTxt = function (info) {
      if (info.free) return 'مجاني 🎉';
      if (info.freeOver) return sub < info.freeOver ? EH.fmt(info.price) : 'مجاني 🎉';
      return EH.fmt(info.price);
    };
    homeEl.textContent = freeTxt(home);
    homeEl.className = 'd-price' + (home.free || (home.freeOver && sub >= home.freeOver) ? ' free' : '');
    deskEl.textContent = freeTxt(desk);
    deskEl.className = 'd-price' + (desk.free || (desk.freeOver && sub >= desk.freeOver) ? ' free' : '');
    hint.textContent = 'اختر طريقة التوصيل المناسبة لك:';
  }

  function refreshTotals() {
    updateDeliveryUI();
    var t = totals();
    document.getElementById('t-sub').textContent = EH.fmt(t.sub);
    document.getElementById('t-disc').textContent = '-' + EH.fmt(t.disc);
    document.getElementById('t-disc-row').style.display = t.disc ? 'flex' : 'none';
    var shipEl = document.getElementById('t-ship');
    shipEl.textContent = t.shipInfo.free ? 'مجاني 🎉' : EH.fmt(t.shipping);
    shipEl.className = t.shipInfo.free ? 'free' : '';
    document.getElementById('t-total').textContent = EH.fmt(t.total);
    document.getElementById('submit-btn').innerHTML = '✅ تأكيد الطلب — ' + EH.fmt(t.total);
    var stickyTotal = document.getElementById('sticky-total');
    if (stickyTotal) stickyTotal.textContent = EH.fmt(t.total);
  }

  function validate() {
    var ok = true;
    var fFirst = document.getElementById('f-first');
    var fLast = document.getElementById('f-last');
    var fPhone = document.getElementById('f-phone');
    var fWilaya = document.getElementById('f-wilaya');
    var fCommune = document.getElementById('f-commune');

    var setInvalid = function (el, bad) { el.parentElement.classList.toggle('invalid', bad); };

    if (fFirst.value.trim().length < 2) { setInvalid(fFirst, true); ok = false; } else setInvalid(fFirst, false);
    if (fLast.value.trim().length < 2) { setInvalid(fLast, true); ok = false; } else setInvalid(fLast, false);
    if (!EH.validPhone(fPhone.value)) { setInvalid(fPhone, true); ok = false; } else setInvalid(fPhone, false);
    if (!sel.wilaya) { setInvalid(fWilaya, true); ok = false; } else setInvalid(fWilaya, false);
    if (!sel.commune) { setInvalid(fCommune, true); ok = false; } else setInvalid(fCommune, false);

    if (!ok) {
      EH.toast('يرجى تصحيح الحقول المطلوبة', 'error');
      var firstBad = EH.$('.field.invalid');
      if (firstBad && firstBad.scrollIntoView) {
        try { firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
    }
    return ok;
  }

  function submitOrder() {
    if (submitting) return;
    if (!validate()) return;

    var t = totals();
    var items = EH.Cart.get();
    var productsText = items.map(function (it) {
      return it.name + (it.variant ? ' (' + it.variant + ')' : '') + ' ×' + it.qty;
    }).join('، ');
    var totalQty = items.reduce(function (s, it) { return s + it.qty; }, 0);
    var wilayaName = (wilayas.filter(function (w) { return String(w.id) === String(sel.wilaya); })[0] || {}).ar || '';

    var order = {
      id: '',
      customer: {
        firstName: document.getElementById('f-first').value.trim(),
        lastName: document.getElementById('f-last').value.trim(),
        name: (document.getElementById('f-first').value.trim() + ' ' + document.getElementById('f-last').value.trim()).trim(),
        phone: EH.normalizePhone(document.getElementById('f-phone').value),
        phone2: EH.normalizePhone(document.getElementById('f-phone2').value),
        wilayaId: sel.wilaya,
        wilaya: wilayaName,
        commune: sel.commune,
        address: document.getElementById('f-address').value.trim(),
        notes: document.getElementById('f-notes').value.trim()
      },
      items: items.map(function (it) { return { id: it.id, name: it.name, variant: it.variant || '', sku: it.sku || '', price: it.price, qty: it.qty }; }),
      itemsText: productsText,
      totalQty: totalQty,
      productsTotal: t.sub,
      discount: t.disc,
      coupon: couponApplied ? couponApplied.coupon.code : '',
      shippingCost: t.shipping,
      shippingKind: sel.delivery === 'desk' ? 'مكتب' : 'منزل',
      total: t.total
    };

    submitting = true;
    var btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '⏳ جارٍ إرسال الطلب…';
    var sbtn = document.getElementById('sticky-submit');
    if (sbtn) { sbtn.disabled = true; sbtn.textContent = '⏳ جارٍ الإرسال…'; }

    EH.createOrder(order).then(function (res) {
      if (res.ok) {
        // إحصاء استخدام الكوبون محلياً
        if (couponApplied) {
          try {
            var cps = EH.lsGet(EH.CONFIG.LS.coupons, data.coupons);
            var c = cps.filter(function (x) { return String(x.code).toUpperCase() === couponApplied.coupon.code.toUpperCase(); })[0];
            if (c) { c.used = (c.used || 0) + 1; EH.lsSet(EH.CONFIG.LS.coupons, cps); }
          } catch (e) {}
        }
        EH.Cart.clear();
        var params = new URLSearchParams({
          order: res.orderId,
          total: order.total,
          items: totalQty,
          ship: order.shippingKind + '|' + order.shippingCost
        });
        window.location.href = 'thank-you.html?' + params.toString();
      } else {
        submitting = false;
        btn.disabled = false;
        btn.innerHTML = '✅ تأكيد الطلب — ' + EH.fmt(t.total);
        var sbtn2 = document.getElementById('sticky-submit');
        if (sbtn2) { sbtn2.disabled = false; sbtn2.textContent = '✅ تأكيد الطلب'; }
        EH.toast(res.error || 'حدث خطأ، حاول مجدداً', 'error');
      }
    });
  }

  // تشغيل
  EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
    data = d;
    EH.injectCommon();
    EH.initPixels(d.settings);
    EH.refreshCartBadge();
    loadWilayas().then(render);
  });
})();
