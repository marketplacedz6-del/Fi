/*******************************************************************
 *  Elegance Home & Style — الخلفية (Backend)
 *  ربط متجر GitHub Pages بجداول Google Sheets عبر Apps Script
 *
 *  طريقة النشر:
 *  1) أنشئ جدول Google Sheets فارغاً
 *  2) الامتدادات ← Apps Script ← الصق هذا الكود
 *  3) Deploy ← New deployment ← Web app
 *     (تنفيذ بصفتي: أنا — الوصول: أي شخص) وانسخ الرابط
 *  4) افتح:  <الرابط>?action=init  ← ينشئ الجداول ويعطيك الرمز السري
 *  5) ضع الرابط + الرمز في: لوحة التحكم ← الإعدادات ← Google Sheets
 *******************************************************************/

var SS = SpreadsheetApp.getActiveSpreadsheet();
var SHEET_ORDERS   = 'Orders';
var SHEET_PRODUCTS = 'Products';
var SHEET_SHIPPING = 'Shipping';
var SHEET_COUPONS  = 'Coupons';
var SHEET_SETTINGS = 'Settings';

var ORDER_HEADERS = [
  'تاريخ الطلب', 'توقيت الطلب', 'رقم الطلب', 'اسم العميل', 'رقم الهاتف',
  'الولاية', 'البلدية', 'المنتجات المطلوبة', 'الكمية',
  'إجمالي مبلغ المنتجات', 'تكلفة الشحن', 'نوع الشحن', 'المبلغ الإجمالي', 'حالة الطلب',
  'العنوان', 'ملاحظات', 'كود الخصم', 'قيمة الخصم'
];

var ORDER_STATUSES = ['قيد المراجعة', 'تم التأكيد', 'تم الشحن', 'تم التسليم', 'ملغى', 'مرتجع'];

/* ---------- أدوات مساعدة ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name, create, headers) {
  var sh = SS.getSheetByName(name);
  if (!sh && create) {
    sh = SS.insertSheet(name);
    if (headers) {
      sh.appendRow(headers);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold')
        .setBackground('#f5ead2').setFontColor('#7a5c22');
    }
  }
  return sh;
}

function getSettings_() {
  var sh = getSheet_(SHEET_SETTINGS, true);
  var data = sh.getDataRange().getValues();
  var out = {};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) {
      var k = String(data[i][0]);
      var v = data[i][1];
      // فك JSON للمفاتيح المعروفة
      if (['hero', 'pixels', 'shippingDefaults', 'freeShipping'].indexOf(k) !== -1 && v) {
        try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
      } else out[k] = v;
    }
  }
  return out;
}

function setSetting_(key, value) {
  var sh = getSheet_(SHEET_SETTINGS, true);
  var data = sh.getDataRange().getValues();
  var val = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(val);
      return;
    }
  }
  sh.appendRow([key, val]);
}

function getToken_() {
  var t = String(getSettings_().apiToken || '');
  if (!t) {
    t = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    setSetting_('apiToken', t);
  }
  return t;
}

function tokenOk_(token) {
  return token && String(token) === String(getToken_());
}

/* ---------- نقاط الوصول ---------- */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'init') return initSheets_();
  if (action === 'getData') {
    var token = (e && e.parameter && e.parameter.token) || '';
    return json_(getPublicData_(tokenOk_(token)));
  }
  if (action === 'getOrders') {
    var token2 = (e && e.parameter && e.parameter.token) || '';
    if (!tokenOk_(token2)) return json_({ ok: false, error: 'رمز غير صالح' });
    return json_({ ok: true, orders: readOrders_() });
  }
  if (action === 'verifyToken') {
    var token3 = (e && e.parameter && e.parameter.token) || '';
    return json_({ ok: tokenOk_(token3) });
  }
  return json_({ ok: false, error: 'إجراء غير معروف' });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  var action = (e && e.parameter && e.parameter.action) || body.action || '';
  var token = body.token || '';

  switch (action) {
    case 'createOrder':
      return json_(createOrder_(body.order || {}));
    case 'saveProduct':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(saveProduct_(body.product || {}));
    case 'deleteProduct':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(deleteRowById_(SHEET_PRODUCTS, body.id));
    case 'saveShipping':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(saveShipping_(body.shipping || {}, body.shippingDefaults, body.freeShipping));
    case 'saveCoupon':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(saveCoupon_(body.coupon || {}));
    case 'deleteCoupon':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(deleteRowById_(SHEET_COUPONS, body.id));
    case 'saveSettings':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(saveSettings_(body.settings || {}));
    case 'updateOrderStatus':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(updateOrderStatus_(body.orderId, body.status));
    case 'deleteOrder':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(deleteOrder_(body.orderId));
    case 'uploadImage':
      if (!tokenOk_(token)) return json_({ ok: false, error: 'رمز غير صالح' });
      return json_(uploadImage_(body.data, body.name));
  }
  return json_({ ok: false, error: 'إجراء غير معروف' });
}

/* ---------- التهيئة ---------- */
function initSheets_() {
  getSheet_(SHEET_ORDERS, true, ORDER_HEADERS);
  getSheet_(SHEET_PRODUCTS, true, ['id', 'name', 'json']);
  getSheet_(SHEET_COUPONS, true, ['id', 'code', 'json']);

  var shipSh = getSheet_(SHEET_SHIPPING, true, ['wilaya_id', 'home', 'desk', 'free', 'freeOver']);
  if (shipSh.getLastRow() < 2) {
    var rows = [];
    for (var i = 1; i <= 58; i++) rows.push([i, '', '', '', '']);
    shipSh.getRange(2, 1, 58, 5).setValues(rows);
  }

  if (!getSettings_().createdAt) setSetting_('createdAt', new Date().toISOString());
  var token = getToken_();

  var tpl = HtmlService.createTemplate(
    '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Tahoma,Arial;background:#f7f3ea;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}'
    + '.card{background:#fff;border-radius:16px;padding:34px;max-width:560px;box-shadow:0 10px 40px rgba(0,0,0,.12);margin:20px}'
    + 'h1{color:#a8853a;font-size:22px;margin:0 0 6px}.ok{background:#e8f8f0;color:#0d8a5f;padding:12px 16px;border-radius:10px;font-weight:bold;margin:14px 0}'
    + '.tok{background:#221a12;color:#f3e9d4;padding:16px;border-radius:10px;font-family:monospace;font-size:18px;letter-spacing:2px;text-align:center;margin:10px 0;direction:ltr}'
    + 'code{background:#f3eee5;padding:3px 8px;border-radius:6px;direction:ltr;display:inline-block}'
    + 'li{margin:8px 0;line-height:1.7}.warn{background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:10px;font-size:13px;margin-top:14px}'
    + '</style></head><body><div class="card">'
    + '<h1>✅ تمت تهيئة المتجر بنجاح</h1>'
    + '<p style="color:#8d8274">تم إنشاء الجداول التالية في جدول البيانات: <b>Orders</b> (الطلبات)، <b>Products</b> (المنتجات)، <b>Shipping</b> (الشحن)، <b>Coupons</b> (الكوبونات)، <b>Settings</b> (الإعدادات).</p>'
    + '<div class="ok">الرمز السري الخاص بلوحة التحكم:</div>'
    + '<div class="tok">' + token + '</div>'
    + '<ol><li>ارجع إلى لوحة تحكم المتجر: <code>admin.html</code></li>'
    + '<li>الإعدادات ← Google Sheets</li>'
    + '<li>الصق <b>رابط تطبيق الويب</b> (هذا الرابط) والرمز السري أعلاه ثم احفظ.</li></ol>'
    + '<div class="warn">⚠️ احتفظ بالرمز السري في مكان آمن — أي شخص يملكه يتحكم في المتجر. يمكنك إعادة توليده بحذف السطر apiToken من جدول Settings.</div>'
    + '</div></body></html>');
  return tpl.evaluate().setTitle('تهيئة المتجر — نجاح').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- البيانات العامة ---------- */
function getPublicData_(full) {
  var s = getSettings_();
  // أزل الأسرار من البيانات العامة
  var pub = {};
  var keys = Object.keys(s);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === 'apiToken' || k === 'pinHash') continue;
    pub[k] = s[k];
  }
  pub.connected = !!(s.apiUrl && s.apiToken);

  var cache = CacheService.getScriptCache();
  if (!full) {
    var cached = cache.get('pubdata');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
  }

  var out = {
    ok: true,
    settings: pub,
    products: readProducts_(),
    shipping: readShipping_().matrix,
    shippingDefaults: s.shippingDefaults || { home: 600, desk: 400 },
    freeShipping: s.freeShipping || { enabled: true, minAmount: 8000 },
    coupons: readCoupons_()
  };
  if (!full) cache.put('pubdata', JSON.stringify(out), 60);
  return out;
}

function readProducts_() {
  var sh = getSheet_(SHEET_PRODUCTS, true);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    try { out.push(JSON.parse(data[i][2])); } catch (e) {}
  }
  return out;
}

function readShipping_() {
  var sh = getSheet_(SHEET_SHIPPING, true);
  var data = sh.getDataRange().getValues();
  var matrix = {};
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var row = {};
    if (data[i][1] !== '' && data[i][1] != null) row.home = Number(data[i][1]);
    if (data[i][2] !== '' && data[i][2] != null) row.desk = Number(data[i][2]);
    if (String(data[i][3]) === 'TRUE' || data[i][3] === true) row.free = true;
    if (data[i][4] !== '' && data[i][4] != null) row.freeOver = Number(data[i][4]);
    matrix[String(data[i][0])] = row;
  }
  return { matrix: matrix };
}

function readCoupons_() {
  var sh = getSheet_(SHEET_COUPONS, true);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    try { out.push(JSON.parse(data[i][2])); } catch (e) {}
  }
  return out;
}

function readOrders_() {
  var sh = getSheet_(SHEET_ORDERS, true);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2]) continue; // بدون رقم طلب
    out.push({
      id: String(r[2]),
      createdAt: String(r[0]) + 'T' + String(r[1]),
      customer: {
        name: String(r[3]),
        phone: String(r[4]),
        wilaya: String(r[5]),
        commune: String(r[6]),
        address: String(r[14]),
        notes: String(r[15])
      },
      itemsText: String(r[7]),
      totalQty: Number(r[8]) || 0,
      productsTotal: Number(r[9]) || 0,
      shippingCost: Number(r[10]) || 0,
      shippingKind: String(r[11]),
      total: Number(r[12]) || 0,
      status: mapStatusToId_(String(r[13])),
      coupon: String(r[16]),
      discount: Number(r[17]) || 0
    });
  }
  return out;
}

function mapStatusToId_(label) {
  var map = { 'قيد المراجعة': 'review', 'تم التأكيد': 'confirmed', 'تم الشحن': 'shipped', 'تم التسليم': 'delivered', 'ملغى': 'cancelled', 'مرتجع': 'returned' };
  return map[label] || 'review';
}
function mapStatusToLabel_(id) {
  var map = { review: 'قيد المراجعة', confirmed: 'تم التأكيد', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغى', returned: 'مرتجع' };
  return map[id] || 'قيد المراجعة';
}

/* ---------- إنشاء طلب ---------- */
function createOrder_(o) {
  var c = o.customer || {};
  // تحقق أساسي
  if (!c.name || String(c.name).trim().length < 3) return { ok: false, error: 'الاسم غير صالح' };
  if (!/^0[567]\d{8}$/.test(String(c.phone).replace(/[\s-]/g, ''))) return { ok: false, error: 'رقم الهاتف غير صالح' };
  if (!c.wilaya || !c.commune) return { ok: false, error: 'الولاية والبلدية مطلوبتان' };
  if (!o.items || !o.items.length) return { ok: false, error: 'السلة فارغة' };

  // حماية بسيطة من السبام: 5 طلبات كحد أقصى لكل هاتف في الدقيقة
  var cache = CacheService.getScriptCache();
  var key = 'order_' + String(c.phone);
  var n = Number(cache.get(key) || 0);
  if (n >= 5) return { ok: false, error: 'طلبات كثيرة، حاول لاحقاً' };
  cache.put(key, n + 1, 60);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, error: 'الخادم مشغول، حاول مجدداً' }; }

  try {
    var seq = Number(getSettings_().seq || 0) + 1;
    setSetting_('seq', seq);
    var d = new Date();
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var orderId = 'EH-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + ('000' + seq).slice(-4);

    var row = [
      Utilities.formatDate(d, 'Africa/Algiers', 'yyyy-MM-dd'),
      Utilities.formatDate(d, 'Africa/Algiers', 'HH:mm:ss'),
      orderId,
      String(c.name).trim(),
      String(c.phone).trim(),
      c.wilaya,
      c.commune,
      String(o.itemsText || ''),
      Number(o.totalQty) || 0,
      Number(o.productsTotal) || 0,
      Number(o.shippingCost) || 0,
      o.shippingKind === 'مكتب' ? 'مكتب' : 'منزل',
      Number(o.total) || 0,
      'قيد المراجعة',
      String(c.address || ''),
      String(c.notes || ''),
      String(o.coupon || ''),
      Number(o.discount) || 0
    ];
    getSheet_(SHEET_ORDERS, true, ORDER_HEADERS).appendRow(row);
    return { ok: true, orderId: orderId };
  } catch (e) {
    return { ok: false, error: 'خطأ في حفظ الطلب: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- إدارة الطلبات ---------- */
function updateOrderStatus_(orderId, status) {
  var label = mapStatusToLabel_(status);
  var sh = getSheet_(SHEET_ORDERS, true);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) === String(orderId)) {
      sh.getRange(i + 1, 14).setValue(label);
      return { ok: true };
    }
  }
  return { ok: false, error: 'الطلب غير موجود' };
}

function deleteOrder_(orderId) {
  var sh = getSheet_(SHEET_ORDERS, true);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) === String(orderId)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'الطلب غير موجود' };
}

/* ---------- إدارة المنتجات ---------- */
function clearPubCache_() {
  try { CacheService.getScriptCache().remove('pubdata'); } catch (e) {}
}

function saveProduct_(p) {
  if (!p || !p.id || !p.name) return { ok: false, error: 'بيانات المنتج ناقصة' };
  clearPubCache_();
  var sh = getSheet_(SHEET_PRODUCTS, true);
  var data = sh.getDataRange().getValues();
  var json = JSON.stringify(p);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id)) {
      sh.getRange(i + 1, 2).setValue(p.name);
      sh.getRange(i + 1, 3).setValue(json);
      return { ok: true };
    }
  }
  sh.appendRow([p.id, p.name, json]);
  return { ok: true };
}

function deleteRowById_(sheetName, id) {
  clearPubCache_();
  var sh = getSheet_(sheetName, true);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: true };
}

/* ---------- مصفوفة الشحن ---------- */
function saveShipping_(matrix, defaults, freeShipping) {
  clearPubCache_();
  var sh = getSheet_(SHEET_SHIPPING, true);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
  var rows = [];
  for (var i = 1; i <= 58; i++) {
    var r = matrix[String(i)] || {};
    rows.push([i, r.home != null ? r.home : '', r.desk != null ? r.desk : '', r.free ? true : '', r.freeOver != null ? r.freeOver : '']);
  }
  if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows);
  if (defaults) setSetting_('shippingDefaults', defaults);
  if (freeShipping) setSetting_('freeShipping', freeShipping);
  return { ok: true };
}

/* ---------- الكوبونات ---------- */
function saveCoupon_(c) {
  if (!c || !c.id || !c.code) return { ok: false, error: 'بيانات الكوبون ناقصة' };
  clearPubCache_();
  var sh = getSheet_(SHEET_COUPONS, true);
  var data = sh.getDataRange().getValues();
  var json = JSON.stringify(c);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(c.id)) {
      sh.getRange(i + 1, 2).setValue(c.code);
      sh.getRange(i + 1, 3).setValue(json);
      return { ok: true };
    }
  }
  sh.appendRow([c.id, c.code, json]);
  return { ok: true };
}

/* ---------- الإعدادات ---------- */
function saveSettings_(s) {
  if (!s) return { ok: false, error: 'لا توجد إعدادات' };
  var keys = Object.keys(s);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'seq') continue;
    setSetting_(keys[i], s[keys[i]]);
  }
  setSetting_('connected', !!(s.apiUrl && s.apiToken));
  clearPubCache_();
  return { ok: true };
}

/* ---------- رفع الصور إلى Google Drive ---------- */
function uploadImage_(dataUrl, name) {
  try {
    if (!dataUrl || String(dataUrl).indexOf('base64,') === -1) return { ok: false, error: 'صورة غير صالحة' };
    var parts = String(dataUrl).split('base64,');
    var bytes = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(bytes, 'image/webp', name || 'image.webp');
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return { ok: true, url: url };
  } catch (e) {
    return { ok: false, error: 'فشل الرفع إلى Drive: ' + e.message };
  }
}

/* ---------- فحص سريع ---------- */
function testConnection_() {
  return { ok: true, time: new Date().toISOString() };
}
