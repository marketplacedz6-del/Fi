/* ===== لوحة التحكم — النواة: الدخول، التنقل، القيادة، الطلبات ===== */
(function () {
  'use strict';

  var S = {}; // حالة الجلسة
  S.section = 'dash';
  S.data = null;
  S.orders = [];
  S.demo = false;

  EH.Admin = {
    state: S,
    toast: function (msg, type) {
      var t = document.getElementById('admin-toast');
      t.textContent = msg;
      t.className = 'toast show ' + (type || '');
      clearTimeout(t._tm);
      t._tm = setTimeout(function () { t.className = 'toast'; }, 2800);
    },
    modal: function (html, wide) {
      var back = document.getElementById('modal-back');
      var box = document.getElementById('modal-box');
      box.innerHTML = html;
      box.style.maxWidth = wide ? '860px' : '720px';
      back.classList.add('open');
      back.onclick = function (e) { if (e.target === back) EH.Admin.closeModal(); };
    },
    closeModal: function () {
      document.getElementById('modal-back').classList.remove('open');
    },
    confirm: function (msg, onYes) {
      if (window.confirm(msg)) onYes();
    },
    isDemo: function () { return S.demo; },
    reload: function () {
      return EH.apiGetData(true).then(function (d) {
        S.data = d;
        S.demo = d.settings.connected !== true;
        var badge = document.getElementById('demo-badge');
        if (badge) badge.classList.toggle('hidden', !S.demo);
        return d;
      });
    },
    persistLocal: function (what, val, cb) {
      EH.localSave(what, val).then(function () {
        EH.Admin.toast('تم الحفظ محلياً (وضع تجريبي) ✓', 'ok');
        EH.Admin.reload().then(function () { if (cb) cb(); EH.Admin.showSection(); });
      });
    },
    go: function (sec) {
      window.location.hash = sec;
    }
  };

  /* ---------- الدخول عبر Firebase Auth ---------- */
  // محفوظ للتوافق فقط — لم يعد يُستخدم للتحقق من الدخول
  EH.Admin.hashPin = function (pin) {
    try { return Promise.resolve(EH.sha256(pin)); } catch (e) { return Promise.resolve(String(pin)); }
  };

  var authMode = 'login';

  function showLogin() {
    document.getElementById('admin-login').classList.remove('hidden');
    document.getElementById('admin-app').classList.add('hidden');
    setTimeout(function () { var i = document.getElementById('login-email'); if (i) i.focus(); }, 50);
  }

  function showApp() {
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    EH.Admin.showSection();
  }

  function setAuthMode(mode) {
    authMode = mode;
    var b = document.getElementById('pin-btn');
    var hint = document.getElementById('auth-hint');
    if (b) b.textContent = mode === 'login' ? 'دخول' : 'إنشاء الحساب';
    if (hint) hint.textContent = mode === 'login'
      ? 'سجّل الدخول بحسابك المسجل في Firebase Authentication.'
      : 'سيُسجَّل هذا البريد وكلمة السر كحساب مدير في Firebase.';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var emailInput = document.getElementById('login-email');
    var passInput = document.getElementById('login-pass');
    var pinBtn = document.getElementById('pin-btn');
    var toggleBtn = document.getElementById('toggle-auth');

    if (toggleBtn) toggleBtn.addEventListener('click', function () {
      setAuthMode(authMode === 'login' ? 'register' : 'login');
    });

    function tryAuth() {
      var email = emailInput.value.trim();
      var pass = passInput.value;
      if (!email || !pass) { EH.Admin.toast('أدخل البريد الإلكتروني وكلمة السر', 'err'); return; }
      if (!window.firebase || !window.firebase.auth) { EH.Admin.toast('تعذر تحميل Firebase — تحقق من اتصالك بالإنترنت', 'err'); return; }
      var fa = window.firebase.auth();
      var p;
      if (authMode === 'register') {
        if (String(pass).length < 6) { EH.Admin.toast('كلمة السر يجب أن تكون 6 أحرف على الأقل', 'err'); return; }
        p = fa.createUserWithEmailAndPassword(email, pass);
      } else {
        p = fa.signInWithEmailAndPassword(email, pass);
      }
      pinBtn.disabled = true;
      pinBtn.textContent = '⏳ جارٍ…';
      p.then(function () {
        try {
          var st = (S.data && S.data.settings) ? JSON.parse(JSON.stringify(S.data.settings)) : {};
          st.adminEmail = email;
          if (!S.demo) EH.saveSettings(st).catch(function () {});
        } catch (e) {}
        EH.Admin.toast('مرحباً بك 👋', 'ok');
        sessionStorage.setItem('eh.admin.sess', '1');
        showApp();
      }).catch(function (err) {
        var code = (err && err.code) || '';
        var msg = (err && err.message) || 'حدث خطأ';
        if (code === 'auth/email-already-in-use') { setAuthMode('login'); msg = 'هذا البريد مسجّل بالفعل — سجّل الدخول.'; }
        else if (code === 'auth/invalid-email') msg = 'البريد الإلكتروني غير صالح';
        else if (code === 'auth/wrong-password' || code === 'auth/user-not-found') msg = 'البريد الإلكتروني أو كلمة السر غير صحيحة';
        else if (code === 'auth/too-many-requests') msg = 'طلبات كثيرة — حاول لاحقاً';
        else if (code === 'auth/weak-password') msg = 'كلمة السر ضعيفة (6 أحرف على الأقل)';
        EH.Admin.toast(msg, 'err');
        passInput.value = '';
        passInput.focus();
      }).finally(function () {
        pinBtn.disabled = false;
        pinBtn.textContent = authMode === 'login' ? 'دخول' : 'إنشاء الحساب';
      });
    }

    pinBtn.addEventListener('click', tryAuth);
    passInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryAuth(); });
    emailInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') passInput.focus(); });
    document.getElementById('logout-btn').addEventListener('click', function () {
      sessionStorage.removeItem('eh.admin.sess');
      if (window.firebase && window.firebase.auth) window.firebase.auth().signOut().catch(function () {});
      setAuthMode('login');
      showLogin();
    });
    window.addEventListener('hashchange', EH.Admin.showSection);
  });

  /* ---------- التنقل ---------- */
  EH.Admin.showSection = function () {
    var sec = (window.location.hash || '#dash').replace('#', '');
    if (['dash', 'orders', 'products', 'shipping', 'coupons', 'settings'].indexOf(sec) === -1) sec = 'dash';
    S.section = sec;
    EH.$$('#admin-nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-sec') === sec);
    });
    var content = document.getElementById('admin-content');
    if (sec === 'dash') renderDash(content);
    else if (sec === 'orders') renderOrders(content);
    else if (sec === 'products') EH.AdminCatalog.render(content);
    else if (sec === 'shipping') EH.AdminConfig.renderShipping(content);
    else if (sec === 'coupons') EH.AdminCatalog.renderCoupons(content);
    else if (sec === 'settings') EH.AdminConfig.renderSettings(content);
  };

  /* ---------- لوحة القيادة ---------- */
  function renderDash(el) {
    el.innerHTML = '<div class="stats-grid">' +
      '<div class="stat"><div class="v" id="st-orders">—</div><div class="k">إجمالي الطلبات</div></div>' +
      '<div class="stat"><div class="v" id="st-rev">—</div><div class="k">إجمالي المبيعات</div></div>' +
      '<div class="stat"><div class="v" id="st-pending">—</div><div class="k">قيد المراجعة</div></div>' +
      '<div class="stat"><div class="v" id="st-today">—</div><div class="k">طلبات اليوم</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px"><h3>📦 أحدث الطلبات</h3><div id="dash-orders"><div class="skeleton" style="height:120px"></div></div></div>';

    EH.getOrders().then(function (res) {
      S.orders = res.orders || [];
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
      var rev = S.orders.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
      var pending = S.orders.filter(function (o) { return (o.status || 'review') === 'review'; }).length;
      var todayCount = S.orders.filter(function (o) { return String(o.createdAt || '').slice(0, 10) === todayStr || String(o.date || '').slice(0, 10) === todayStr; }).length;

      document.getElementById('st-orders').textContent = S.orders.length;
      document.getElementById('st-rev').textContent = EH.fmt(rev);
      document.getElementById('st-pending').textContent = pending;
      document.getElementById('st-today').textContent = todayCount;

      var recent = S.orders.slice(0, 8);
      document.getElementById('dash-orders').innerHTML = recent.length ? ordersTableHTML(recent, true) :
        '<div class="empty-state" style="padding:30px"><div class="ic">📭</div>لا توجد طلبات بعد</div>';
      bindOrdersTable();
    });
  }

  function ordersTableHTML(list, mini) {
    var rows = list.map(function (o) {
      var status = o.status || 'review';
      var badge = '<span class="badge b-' + status + '">' + EH.CONFIG.STATUS_LABEL(status) + '</span>';
      return '<tr>' +
        '<td><b>' + EH.esc(o.id || '—') + '</b><br><small style="color:var(--muted)">' + EH.esc((o.createdAt || '').replace('T', ' ').slice(0, 16)) + '</small></td>' +
        '<td>' + EH.esc((o.customer && o.customer.name) || '') + '<br><small dir="ltr" style="color:var(--muted)">' + EH.esc((o.customer && o.customer.phone) || '') + '</small></td>' +
        '<td>' + EH.esc((o.customer && o.customer.wilaya) || '') + ' / ' + EH.esc((o.customer && o.customer.commune) || '') + '</td>' +
        '<td>' + EH.esc(o.itemsText || '') + '</td>' +
        '<td><b>' + EH.fmt(o.total) + '</b></td>' +
        '<td>' + badge + '</td>' +
        (mini ? '' : '<td class="actions"><button class="btn btn-sm btn-ghost" data-view="' + EH.esc(o.id) + '">عرض</button><button class="btn btn-sm btn-gold" data-export-one="' + EH.esc(o.id) + '">تصدير</button></td>') +
        '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>رقم الطلب / التاريخ</th><th>العميل</th><th>الولاية</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th>' +
      (mini ? '' : '<th>إجراءات</th>') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- الطلبات ---------- */
  function renderOrders(el) {
    el.innerHTML =
      '<div class="card"><h3>📦 إدارة الطلبات <span class="sub">' + S.orders.length + ' طلب</span></h3>' +
      '<div class="filters">' +
      '<select id="f-status"><option value="">كل الحالات</option>' + EH.CONFIG.ORDER_STATUSES.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('') + '</select>' +
      '<select id="f-wilaya"><option value="">كل الولايات</option></select>' +
      '<input type="date" id="f-date" title="تاريخ الطلب">' +
      '<input type="search" id="f-search" placeholder="بحث بالاسم أو الهاتف…" style="min-width:170px">' +
      '</div>' +
      '<div class="filters">' +
      '<button class="btn btn-sm btn-ghost" id="btn-export-all">📄 تصدير Excel/CSV (كامل)</button>' +
      '<button class="btn btn-sm btn-ghost" id="btn-export-delivery">🚚 تصدير بوليصات شركات التوصيل</button>' +
      '<button class="btn btn-sm" id="btn-refresh">🔄 تحديث الطلبات</button>' +
      '</div>' +
      '<div id="orders-list"><div class="skeleton" style="height:120px"></div></div></div>';

    // تعبئة فلاتر الولايات
    var wSel = document.getElementById('f-wilaya');
    var seen = {};
    S.orders.forEach(function (o) {
      var w = o.customer && o.customer.wilaya;
      if (w && !seen[w]) { seen[w] = 1; wSel.appendChild(new Option(w, w)); }
    });

    function filter() {
      var st = document.getElementById('f-status').value;
      var w = document.getElementById('f-wilaya').value;
      var d = document.getElementById('f-date').value;
      var q = document.getElementById('f-search').value.trim().toLowerCase();
      var list = S.orders.filter(function (o) {
        if (st && (o.status || 'review') !== st) return false;
        if (w && (o.customer || {}).wilaya !== w) return false;
        if (d && String(o.createdAt || '').slice(0, 10) !== d && String(o.date || '').slice(0, 10) !== d) return false;
        if (q) {
          var name = ((o.customer || {}).name || '').toLowerCase();
          var phone = ((o.customer || {}).phone || '').toLowerCase();
          if (name.indexOf(q) === -1 && phone.indexOf(q) === -1 && String(o.id).toLowerCase().indexOf(q) === -1) return false;
        }
        return true;
      });
      document.getElementById('orders-list').innerHTML = list.length ? ordersTableHTML(list, false) :
        '<div class="empty-state" style="padding:30px"><div class="ic">📭</div>لا توجد طلبات مطابقة</div>';
      bindOrdersTable();
    }

    document.getElementById('f-status').addEventListener('change', filter);
    document.getElementById('f-wilaya').addEventListener('change', filter);
    document.getElementById('f-date').addEventListener('change', filter);
    document.getElementById('f-search').addEventListener('input', EH.debounce(filter, 250));
    document.getElementById('btn-refresh').addEventListener('click', function () {
      EH.Admin.toast('جارٍ التحديث…');
      EH.Admin.reload().then(function () {
        EH.getOrders().then(function (res) {
          S.orders = res.orders || [];
          EH.Admin.toast('تم التحديث ✓', 'ok');
          renderOrders(el);
        });
      });
    });
    document.getElementById('btn-export-all').addEventListener('click', function () { exportOrders(false); });
    document.getElementById('btn-export-delivery').addEventListener('click', function () { exportOrders(true); });

    filter();
  }

  function bindOrdersTable() {
    EH.$$('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { viewOrder(b.getAttribute('data-view')); });
    });
    EH.$$('[data-export-one]').forEach(function (b) {
      b.addEventListener('click', function () { exportOrders(false, b.getAttribute('data-export-one')); });
    });
  }

  function viewOrder(id) {
    var o = S.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var c = o.customer || {};
    var status = o.status || 'review';
    var statusBtns = EH.CONFIG.ORDER_STATUSES.map(function (s) {
      return '<button class="btn btn-sm ' + (s.id === status ? 'btn-gold' : 'btn-ghost') + '" data-set-status="' + s.id + '">' + s.label + '</button>';
    }).join(' ');
    var items = (o.items || []).map(function (it) {
      return '<div class="os-item"><div class="oi-info"><div class="oi-name">' + EH.esc(it.name) + '</div>' +
        (it.variant ? '<div class="oi-var">' + EH.esc(it.variant) + '</div>' : '') +
        '<div class="oi-var">سكيو: ' + EH.esc(it.sku || '—') + '</div></div>' +
        '<div class="oi-price">' + it.qty + ' × ' + EH.fmt(it.price) + ' = ' + EH.fmt(it.price * it.qty) + '</div></div>';
    }).join('');

    EH.Admin.modal(
      '<div class="modal-head"><h3>طلب ' + EH.esc(o.id || '') + '</h3><button class="modal-close" onclick="EH.Admin.closeModal()">✕</button></div>' +
      '<div class="notice ' + (status === 'review' ? 'warn' : 'ok') + '" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><span>الحالة الحالية: <b>' + EH.CONFIG.STATUS_LABEL(status) + '</b></span><span style="display:flex;gap:4px;flex-wrap:wrap">' + statusBtns + '</span></div>' +
      '<div class="form-grid" style="margin-bottom:10px">' +
      '<div class="field"><label>العميل</label><input value="' + EH.esc(c.name || '') + '" readonly></div>' +
      '<div class="field"><label>الهاتف</label><input dir="ltr" value="' + EH.esc(c.phone || '') + '" readonly></div>' +
      '<div class="field"><label>الولاية / البلدية</label><input value="' + EH.esc((c.wilaya || '') + ' / ' + (c.commune || '')) + '" readonly></div>' +
      '<div class="field"><label>العنوان</label><input value="' + EH.esc(c.address || '—') + '" readonly></div>' +
      '<div class="field full"><label>الملاحظات</label><textarea rows="2" readonly>' + EH.esc(c.notes || '—') + '</textarea></div>' +
      '</div>' +
      '<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px">' + items + '</div>' +
      '<div class="os-total-row"><span>إجمالي المنتجات</span><b>' + EH.fmt(o.productsTotal || 0) + '</b></div>' +
      (o.discount ? '<div class="os-total-row"><span>الخصم (' + EH.esc(o.coupon || '') + ')</span><b style="color:var(--ok)">-' + EH.fmt(o.discount) + '</b></div>' : '') +
      '<div class="os-total-row"><span>الشحن (' + EH.esc(o.shippingKind || '') + ')</span><b>' + EH.fmt(o.shippingCost || 0) + '</b></div>' +
      '<div class="os-total-row grand"><span>الإجمالي</span><b>' + EH.fmt(o.total || 0) + '</b></div>' +
      (S.demo ? '<div class="notice warn" style="margin-top:12px">وضع تجريبي: حالة الطلب تُحفظ محلياً فقط.</div>' : ''),
      true
    );

    EH.$$('[data-set-status]').forEach(function (b) {
      b.addEventListener('click', function () {
        var st = b.getAttribute('data-set-status');
        if (st === status) return;
        var apply = function () {
          EH.Admin.toast('تم تحديث الحالة ✓', 'ok');
          EH.Admin.closeModal();
          EH.Admin.showSection();
        };
        if (S.demo) {
          // وضع تجريبي: تحديث محلي
          var list = (S.orders || []).map(function (x) {
            if (x.id === o.id) x.status = st;
            return x;
          });
          EH.lsSet(EH.CONFIG.LS.orders, list);
          S.orders = list;
          apply();
          return;
        }
        EH.updateOrderStatus(o.id, st).then(function (res) {
          if (res.ok) apply();
          else EH.Admin.toast((res && res.error) || 'فشل التحديث', 'err');
        });
      });
    });
  }

  /* ---------- التصدير ---------- */
  function csvCell(v) {
    v = String(v == null ? '' : v);
    return '"' + v.replace(/"/g, '""') + '"';
  }

  function downloadCSV(filename, headers, rows) {
    var lines = [headers.map(csvCell).join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function exportOrders(deliveryMode, oneId) {
    var list = oneId ? S.orders.filter(function (o) { return o.id === oneId; }) : S.orders;
    if (!list.length) { EH.Admin.toast('لا توجد طلبات للتصدير', 'err'); return; }
    var now = new Date();
    var d = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);

    if (deliveryMode) {
      // مهيأ لشركات التوصيل (البوليصات المجمعة)
      var headers = ['رقم الطلب', 'اسم الزبون', 'رقم الهاتف', 'الولاية', 'البلدية', 'العنوان', 'نوع التوصيل', 'قيمة الطلب', 'قيمة المنتجات', 'تكلفة الشحن', 'الكمية', 'ملاحظات'];
      var rows = list.map(function (o) {
        var c = o.customer || {};
        return [o.id || '', c.name || '', c.phone || '', c.wilaya || '', c.commune || '', c.address || '', o.shippingKind === 'مكتب' ? 'Stop Desk' : 'Home Delivery', o.total || 0, o.productsTotal || 0, o.shippingCost || 0, o.totalQty || 0, c.notes || ''];
      });
      downloadCSV('bolyas-' + d + '.csv', headers, rows);
    } else {
      // تصدير كامل بالأعمدة المطلوبة — صف لكل منتج في الطلب
      var headers2 = EH.CONFIG.ORDER_COLUMNS;
      var rows2 = [];
      list.forEach(function (o) {
        var c = o.customer || {};
        var dt = o.createdAt ? String(o.createdAt).replace('T', ' ') : '';
        var full = c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || '';
        var fname = c.firstName || String(full).split(/\s+/)[0] || '';
        var lname = c.lastName || String(full).split(/\s+/).slice(1).join(' ') || '';
        var items = (o.items && o.items.length) ? o.items : [{ sku: '', name: o.itemsText || '', qty: o.totalQty || 0, price: 0 }];
        items.forEach(function (it) {
          var qty = Number(it.qty) || 1;
          var price = Number(it.price) || 0;
          rows2.push([
            o.id || '', dt, fname, lname,
            c.phone || '', c.phone2 || '', c.wilaya || '', c.commune || '',
            o.shippingKind === 'مكتب' ? 'Desk' : 'Home', c.address || '',
            it.sku || '', it.name || '', qty, price, Math.round(price * qty),
            o.confirmation || EH.CONFIG.STATUS_LABEL(o.status || 'review'), c.notes || ''
          ]);
        });
      });
      downloadCSV('orders-' + d + '.csv', headers2, rows2);
    }
    EH.Admin.toast('تم تصدير الملف ✓', 'ok');
  }

  /* ---------- التشغيل ---------- */
  EH.Admin.reload().then(function () {
    var sess = sessionStorage.getItem('eh.admin.sess') === '1';
    if (window.firebase && window.firebase.auth) {
      window.firebase.auth().onAuthStateChanged(function (user) {
        if (user || sess) showApp();
        else showLogin();
      });
    } else if (sess) {
      showApp();
    } else {
      showLogin();
    }
  }).catch(function () {
    // حتى لو فشل تحميل البيانات، تبقى شاشة الدخول ظاهرة
    showLogin();
  });
})();
