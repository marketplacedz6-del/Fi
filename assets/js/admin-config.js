/* ===== لوحة التحكم — الشحن والإعدادات ===== */
(function () {
  'use strict';
  var S;
  var wilayas = [];

  function init() { S = EH.Admin.state; }
  EH.AdminConfig = { renderShipping: renderShipping, renderSettings: renderSettings };

  function loadWilayas() {
    if (wilayas.length) return Promise.resolve(wilayas);
    return fetch('assets/data/wilayas.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) { wilayas = j; return j; })
      .catch(function () { return []; });
  }

  /* ================= مصفوفة الشحن ================= */
  function renderShipping(el) {
    init();
    loadWilayas().then(function (w) {
      wilayas = w;
      var matrix = S.data.shipping || {};
      var defs = S.data.shippingDefaults || { home: 600, desk: 400 };
      var fs = S.data.freeShipping || { enabled: true, minAmount: 8000 };

      el.innerHTML =
        '<div class="card"><h3>🚚 مصفوفة الشحن <span class="sub">58 ولاية</span></h3>' +
        '<div class="notice warn" style="margin-bottom:14px">💡 أدخل سعر التوصيل لباب المنزل وسعر التوصيل للمكتب لكل ولاية. اترك الحقل فارغاً لاستعمال القيمة الافتراضية.</div>' +
        '<div class="form-grid" style="margin-bottom:14px">' +
        '<div class="field"><label>السعر الافتراضي — توصيل للمنزل (دج)</label><input type="number" id="d-home" min="0" value="' + (defs.home || 0) + '"></div>' +
        '<div class="field"><label>السعر الافتراضي — توصيل للمكتب (دج)</label><input type="number" id="d-desk" min="0" value="' + (defs.desk || 0) + '"></div>' +
        '<div class="field"><label>شحن مجاني فوق مبلغ (دج)</label><input type="number" id="d-freeover" min="0" value="' + (fs.minAmount || 0) + '"></div>' +
        '<div class="field"><label style="display:flex;align-items:center;gap:8px;margin-top:26px"><input type="checkbox" id="d-freeen" ' + (fs.enabled ? 'checked' : '') + '> تفعيل الشحن المجاني فوق المبلغ</label></div>' +
        '</div>' +
        '<div class="filters">' +
        '<button class="btn btn-gold" id="ship-save">💾 حفظ مصفوفة الشحن</button>' +
        '<button class="btn btn-ghost" id="ship-defaults">تعبئة الكل بالقيم الافتراضية</button>' +
        '</div>' +
        '<div class="tbl-wrap" style="max-height:62vh;overflow-y:auto"><table class="tbl" id="ship-table"><thead><tr><th>الولاية</th><th>باب المنزل (دج)</th><th>المكتب (دج)</th><th>شحن مجاني</th><th>مجاني فوق (دج)</th></tr></thead><tbody>' +
        wilayas.map(function (w) {
          var row = matrix[String(w.id)] || {};
          return '<tr data-w="' + w.id + '">' +
            '<td><b>' + w.id + ' — ' + EH.esc(w.ar) + '</b><br><small style="color:var(--muted)">' + EH.esc(w.fr) + '</small></td>' +
            '<td><input type="number" min="0" class="s-home" value="' + (row.home != null ? row.home : '') + '" placeholder="' + (defs.home || 0) + '" style="width:90px"></td>' +
            '<td><input type="number" min="0" class="s-desk" value="' + (row.desk != null ? row.desk : '') + '" placeholder="' + (defs.desk || 0) + '" style="width:90px"></td>' +
            '<td><input type="checkbox" class="s-free" ' + (row.free ? 'checked' : '') + '></td>' +
            '<td><input type="number" min="0" class="s-freeover" value="' + (row.freeOver || '') + '" placeholder="' + (fs.minAmount || 0) + '" style="width:110px"></td></tr>';
        }).join('') +
        '</tbody></table></div></div>';

      document.getElementById('ship-defaults').addEventListener('click', function () {
        EH.$$('#ship-table .s-home').forEach(function (i) { i.value = ''; });
        EH.$$('#ship-table .s-desk').forEach(function (i) { i.value = ''; });
        EH.$$('#ship-table .s-free').forEach(function (i) { i.checked = false; });
        EH.$$('#ship-table .s-freeover').forEach(function (i) { i.value = ''; });
        EH.Admin.toast('تم التعبئة — احفظ الآن ✓');
      });

      document.getElementById('ship-save').addEventListener('click', function () {
        var matrix2 = {};
        EH.$$('#ship-table tr[data-w]').forEach(function (tr) {
          var wid = tr.getAttribute('data-w');
          var home = tr.querySelector('.s-home').value;
          var desk = tr.querySelector('.s-desk').value;
          var free = tr.querySelector('.s-free').checked;
          var freeOver = tr.querySelector('.s-freeover').value;
          var row = {};
          if (home !== '') row.home = parseFloat(home) || 0;
          if (desk !== '') row.desk = parseFloat(desk) || 0;
          if (free) row.free = true;
          if (freeOver !== '') row.freeOver = parseFloat(freeOver) || 0;
          matrix2[wid] = row;
        });
        var defs2 = {
          home: parseFloat(document.getElementById('d-home').value) || 0,
          desk: parseFloat(document.getElementById('d-desk').value) || 0
        };
        var fs2 = {
          enabled: document.getElementById('d-freeen').checked,
          minAmount: parseFloat(document.getElementById('d-freeover').value) || 0
        };
        if (S.demo) {
          EH.localSave('shipping', matrix2);
          EH.localSave('shippingDefaults', defs2);
          EH.localSave('freeShipping', fs2);
          EH.Admin.toast('تم الحفظ محلياً ✓', 'ok');
          EH.Admin.reload().then(function () { renderShipping(el); });
        } else {
          EH.saveShipping(matrix2, defs2, fs2).then(function (res) {
            if (res.ok) { EH.Admin.toast('تم حفظ مصفوفة الشحن ✓', 'ok'); EH.Admin.reload().then(function () { renderShipping(el); }); }
            else EH.Admin.toast((res && res.error) || 'فشل الحفظ', 'err');
          });
        }
      });
    });
  }

  /* ================= الإعدادات ================= */
  function renderSettings(el) {
    init();
    var s = S.data.settings;
    var remote = !!(s.apiUrl && s.apiToken);
    var hero = s.hero || {};

    el.innerHTML =
      '<div class="card"><h3>⚙️ إعدادات المتجر</h3>' +
      '<div class="tabs-row">' +
      '<button class="tab active" data-tab="general">المتجر</button>' +
      '<button class="tab" data-tab="hero">الشريط الإعلاني</button>' +
      '<button class="tab" data-tab="pixels">أكواد التتبع</button>' +
      '<button class="tab" data-tab="connect">Google Sheets</button>' +
      '<button class="tab" data-tab="security">الأمان</button>' +
      '</div>' +

      /* ----- عام ----- */
      '<div class="tab-panel2" id="panel-general">' +
      '<div class="form-grid">' +
      '<div class="field"><label>اسم المتجر (إنجليزي)</label><input id="s-name" value="' + EH.esc(s.storeName || '') + '"></div>' +
      '<div class="field"><label>اسم المتجر (عربي)</label><input id="s-namear" value="' + EH.esc(s.storeNameAr || '') + '"></div>' +
      '<div class="field"><label>الشعار (رابط صورة)</label><input id="s-logo" value="' + EH.esc(s.logo || '') + '" placeholder="https://…/logo.webp"></div>' +
      '<div class="field"><label>رقم الهاتف</label><input id="s-phone" dir="ltr" value="' + EH.esc(s.phone || '') + '" placeholder="05XXXXXXXX"></div>' +
      '<div class="field"><label>واتساب</label><input id="s-whatsapp" dir="ltr" value="' + EH.esc(s.whatsapp || '') + '"></div>' +
      '<div class="field"><label>فيسبوك</label><input id="s-fb" dir="ltr" value="' + EH.esc(s.facebook || '') + '"></div>' +
      '<div class="field"><label>انستغرام</label><input id="s-ig" dir="ltr" value="' + EH.esc(s.instagram || '') + '"></div>' +
      '<div class="field"><label>تيك توك</label><input id="s-tt" dir="ltr" value="' + EH.esc(s.tiktokUrl || '') + '"></div>' +
      '<div class="field full"><label>نص الفوتر</label><textarea id="s-footer" rows="2">' + EH.esc(s.footerText || '') + '</textarea></div>' +
      '</div></div>' +

      /* ----- الهيرو ----- */
      '<div class="tab-panel2 hidden" id="panel-hero">' +
      '<div class="form-grid">' +
      '<div class="field"><label>نوع الشريط</label><select id="h-kind"><option value="image" ' + (hero.kind !== 'video' ? 'selected' : '') + '>صورة</option><option value="video" ' + (hero.kind === 'video' ? 'selected' : '') + '>فيديو</option></select></div>' +
      '<div class="field"><label>رابط الصورة / الفيديو</label><input id="h-src" value="' + EH.esc(hero.src || '') + '" placeholder="https://…"><div class="hint" id="h-src-hint">أو ارفع صورة:</div><input type="file" id="h-upload" accept="image/*" style="margin-top:6px"></div>' +
      '<div class="field full"><label>العنوان الرئيسي</label><input id="h-title" value="' + EH.esc(hero.title || '') + '"></div>' +
      '<div class="field full"><label>النص الفرعي</label><textarea id="h-sub" rows="2">' + EH.esc(hero.subtitle || '') + '</textarea></div>' +
      '<div class="field"><label>نص الزر</label><input id="h-cta" value="' + EH.esc(hero.ctaText || '') + '"></div>' +
      '<div class="field"><label>رابط الزر</label><input id="h-ctaurl" value="' + EH.esc(hero.ctaUrl || 'shop.html') + '"></div>' +
      '</div></div>' +

      /* ----- البكسلز ----- */
      '<div class="tab-panel2 hidden" id="panel-pixels">' +
      '<div class="notice warn">انسخ كود Meta Pixel كاملاً (من Meta Events Manager) والصقه هنا، وكذلك TikTok Pixel و Google Analytics. تُحقن الأكواد تلقائياً في كل صفحات الموقع، مع تتبع الأحداث: مشاهدة المنتج، إضافة للسلة، والشراء (Purchase) عند صفحة الشكر.</div>' +
      '<div class="field"><label>Meta Pixel (كود كامل)</label><textarea id="p-meta" rows="5" dir="ltr" style="direction:ltr;text-align:left;font-family:monospace;font-size:12px">' + EH.esc(s.pixels.meta || '') + '</textarea></div>' +
      '<div class="field"><label>TikTok Pixel (كود كامل)</label><textarea id="p-tiktok" rows="5" dir="ltr" style="direction:ltr;text-align:left;font-family:monospace;font-size:12px">' + EH.esc(s.pixels.tiktok || '') + '</textarea></div>' +
      '<div class="field"><label>Google Analytics (كود كامل)</label><textarea id="p-gtag" rows="5" dir="ltr" style="direction:ltr;text-align:left;font-family:monospace;font-size:12px">' + EH.esc(s.pixels.gtag || '') + '</textarea></div>' +
      '</div>' +

      /* ----- الربط ----- */
      '<div class="tab-panel2 hidden" id="panel-connect">' +
      (remote ? '<div class="notice ok">✅ المتجر مرتبط بـ Google Sheets — الطلبات تُرسل لحظياً والمنتجات تُقرأ من الجدول.</div>' :
        '<div class="notice warn">⚠️ وضع تجريبي: البيانات والطلبات تُحفظ في متصفحك فقط. اربط Google Sheets لتفعيل العمل الحقيقي.</div>') +
      '<div class="form-grid">' +
      '<div class="field full"><label>رابط تطبيق Google Apps Script (Web App URL)</label><input id="api-url" dir="ltr" value="' + EH.esc(s.apiUrl || '') + '" placeholder="https://script.google.com/macros/s/…/exec"></div>' +
      '<div class="field full"><label>الرمز السري (Access Token)</label><input id="api-token" dir="ltr" value="' + EH.esc(s.apiToken || '') + '" placeholder="من صفحة التهيئة: ?action=init"></div>' +
      '</div>' +
      '<div class="filters" style="margin-top:10px">' +
      '<button class="btn btn-gold" id="api-test">🔌 اختبار الاتصال</button>' +
      '<button class="btn btn-ghost" id="api-clear">فصل الربط (رجوع للوضع التجريبي)</button>' +
      '</div>' +
      '<div class="notice ok" style="margin-top:14px">📖 <b>طريقة الربط خطوة بخطوة:</b><br>1) أنشئ جدول Google Sheets جديد (أو استعمل جدولاً فارغاً).<br>2) من القائمة: الامتدادات ← Apps Script، واحذف الكود الموجود والصق كود <b>Code.gs</b> الموجود في مجلد <code>google-apps-script</code> بالمشروع.<br>3) انشر: Deploy ← New deployment ← Web app (تنفيذ بصفتك: أنا — الوصول: أي شخص). انسخ رابط الـ URL.<br>4) افتح الرابط وأضف <code>?action=init</code> في النهاية — ستظهر صفحة بها الرمز السري.<br>5) الصق الرابط والرمز في الحقلين أعلاه واحفظ.</div>' +
      '</div>' +

      /* ----- الأمان ----- */
      '<div class="tab-panel2 hidden" id="panel-security">' +
      '<div class="form-grid">' +
      '<div class="field"><label>كلمة السر الحالية <span style="color:var(--err)">*</span></label><input type="password" id="pin-old" placeholder="••••••" autocomplete="current-password"></div>' +
      '<div class="field"><label>كلمة السر الجديدة (اتركها فارغة للإبقاء على نفسها)</label><input type="password" id="pin-new" placeholder="••••••" autocomplete="new-password"></div>' +
      '<div class="field"><label>البريد الإلكتروني للدخول</label><input type="email" id="new-email" value="' + EH.esc(s.adminEmail || 'walid@gmail.com') + '" placeholder="walid@gmail.com"></div>' +
      '<div class="field full"><button class="btn btn-gold" id="pin-change">🔒 حفظ بيانات الدخول</button></div>' +
      '</div>' +
      '<div class="notice warn" style="margin-top:10px">يُحفظ البريد وكلمة السر داخل المتصفح (طبيعة الاستضافة المجانية) — اختر كلمة سر قوية.</div>' +
      (S.demo ? '<div class="notice warn" style="margin-top:10px">🧹 وضع تجريبي: يمكنك مسح جميع البيانات المحلية (المنتجات والطلبات والإعدادات) والعودة للأصلية:</div>' +
        '<button class="btn btn-danger" id="reset-local">🗑️ مسح البيانات التجريبية المحلية</button>' : '') +
      '</div>' +

      '<div style="display:flex;gap:8px;margin-top:18px"><button class="btn btn-gold" id="settings-save">💾 حفظ كل الإعدادات</button></div>' +
      '</div>';

    // تبويبات الإعدادات
    EH.$$('.tabs-row .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        EH.$$('.tabs-row .tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        EH.$$('.tab-panel2').forEach(function (p) { p.classList.add('hidden'); });
        document.getElementById('panel-' + t.getAttribute('data-tab')).classList.remove('hidden');
      });
    });

    // رفع صورة الهيرو → WebP
    document.getElementById('h-upload').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var scale = Math.min(1, 1600 / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            var fr = new FileReader();
            fr.onload = function (ev) {
              var dataUrl = ev.target.result;
              if (S.demo) {
                document.getElementById('h-src').value = dataUrl;
                EH.Admin.toast('تم ضغط الصورة إلى WebP ✓');
              } else {
                EH.uploadImage(dataUrl, 'hero.webp').then(function (res) {
                  if (res.ok) { document.getElementById('h-src').value = res.url; EH.Admin.toast('تم الرفع إلى Drive ✓', 'ok'); }
                  else EH.Admin.toast((res && res.error) || 'فشل الرفع', 'err');
                });
              }
            };
            fr.readAsDataURL(blob);
          }, 'image/webp', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    // اختبار الاتصال
    document.getElementById('api-test').addEventListener('click', function () {
      var url = document.getElementById('api-url').value.trim();
      var token = document.getElementById('api-token').value.trim();
      if (!url) { EH.Admin.toast('أدخل رابط التطبيق أولاً', 'err'); return; }
      EH.Admin.toast('جارٍ اختبار الاتصال…');
      // حفظ مؤقت ثم اختبار
      var st = JSON.parse(JSON.stringify(S.data.settings));
      st.apiUrl = url;
      st.apiToken = token || ' ';
      EH.apiGetData(true).then(function () {});
      fetch(String(url).replace(/\/+$/, '') + '?action=getData').then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok === false) { EH.Admin.toast('⚠️ الرابط يعمل لكن يلزم التهيئة: ?action=init', 'err'); return; }
        EH.Admin.toast('✅ الاتصال ناجح — اضغط حفظ', 'ok');
      }).catch(function () { EH.Admin.toast('تعذر الوصول للرابط', 'err'); });
    });
    document.getElementById('api-clear').addEventListener('click', function () {
      document.getElementById('api-url').value = '';
      document.getElementById('api-token').value = '';
    });

    // تغيير بيانات الدخول
    document.getElementById('pin-change').addEventListener('click', function () {
      var old = document.getElementById('pin-old').value;
      var nw = document.getElementById('pin-new').value;
      var email = document.getElementById('new-email').value.trim();
      if (!old) { EH.Admin.toast('أدخل كلمة السر الحالية', 'err'); return; }
      if (!email || email.indexOf('@') === -1) { EH.Admin.toast('أدخل بريداً إلكترونياً صحيحاً', 'err'); return; }
      EH.Admin.hashPin(old).then(function (hOld) {
        var st = S.data.settings;
        var wantHash = String(st.adminPassHash || '');
        var valid = !wantHash ? EH.Admin.hashPin('2009').then(function (d) { return hOld === d; }) : Promise.resolve(hOld === wantHash);
        valid.then(function (ok) {
          if (!ok) { EH.Admin.toast('كلمة السر الحالية غير صحيحة', 'err'); return; }
          st.adminEmail = email;
          if (nw) {
            if (String(nw).length < 4) { EH.Admin.toast('كلمة السر الجديدة قصيرة جداً (4 أحرف على الأقل)', 'err'); return; }
            EH.Admin.hashPin(nw).then(function (hNew) {
              st.adminPassHash = hNew;
              finishSave();
            });
          } else {
            finishSave();
          }
          function finishSave() {
            if (S.demo) EH.localSave('settings', st).then(function () { EH.Admin.toast('تم تحديث بيانات الدخول ✓', 'ok'); });
            else EH.saveSettings(st).then(function (res) {
              if (res.ok) EH.Admin.toast('تم تحديث بيانات الدخول ✓', 'ok');
              else EH.Admin.toast((res && res.error) || 'فشل الحفظ', 'err');
            });
          }
        });
      });
    });

    // مسح البيانات التجريبية
    var resetBtn = document.getElementById('reset-local');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      EH.Admin.confirm('سيتم مسح كل التعديلات المحلية (منتجات، طلبات، إعدادات). متابعة؟', function () {
        EH.CONFIG.LS_PREFIX && Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf('eh.v1.') === 0 && k !== EH.CONFIG.LS.cart) localStorage.removeItem(k);
        });
        location.reload();
      });
    });

    // الحفظ الكلي
    document.getElementById('settings-save').addEventListener('click', function () {
      var st = JSON.parse(JSON.stringify(S.data.settings));
      st.storeName = document.getElementById('s-name').value.trim();
      st.storeNameAr = document.getElementById('s-namear').value.trim();
      st.logo = document.getElementById('s-logo').value.trim();
      st.phone = document.getElementById('s-phone').value.trim();
      st.whatsapp = document.getElementById('s-whatsapp').value.trim();
      st.facebook = document.getElementById('s-fb').value.trim();
      st.instagram = document.getElementById('s-ig').value.trim();
      st.tiktokUrl = document.getElementById('s-tt').value.trim();
      st.footerText = document.getElementById('s-footer').value.trim();
      st.hero = {
        kind: document.getElementById('h-kind').value,
        src: document.getElementById('h-src').value.trim(),
        title: document.getElementById('h-title').value.trim(),
        subtitle: document.getElementById('h-sub').value.trim(),
        ctaText: document.getElementById('h-cta').value.trim(),
        ctaUrl: document.getElementById('h-ctaurl').value.trim() || 'shop.html'
      };
      st.pixels = {
        meta: document.getElementById('p-meta').value,
        tiktok: document.getElementById('p-tiktok').value,
        gtag: document.getElementById('p-gtag').value
      };
      st.apiUrl = document.getElementById('api-url').value.trim();
      st.apiToken = document.getElementById('api-token').value.trim();
      st.connected = !!(st.apiUrl && st.apiToken);

      if (S.demo) {
        EH.localSave('settings', st).then(function () {
          EH.Admin.toast('تم حفظ الإعدادات ✓', 'ok');
          EH.Admin.reload().then(function () { renderSettings(el); });
        });
      } else {
        EH.saveSettings(st).then(function (res) {
          if (res.ok) { EH.Admin.toast('تم حفظ الإعدادات ✓', 'ok'); EH.Admin.reload().then(function () { renderSettings(el); }); }
          else EH.Admin.toast((res && res.error) || 'فشل الحفظ', 'err');
        });
      }
    });

  }
})();
