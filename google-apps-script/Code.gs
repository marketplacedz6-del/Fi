/*******************************************************************
 *  Elegance Home & Style — تصدير الطلبات إلى Google Sheets
 *
 *  قاعدة بيانات المتجر هي Firebase (Firestore). هذه الخلفية مسؤولة
 *  فقط عن استقبال الطلبات وكتابتها في جدول Google Sheets بالأعمدة
 *  المطلوبة: Order ID | Date | First Name | Last Name | Phone 1 |
 *  Phone 2 | Wilaya | Commune | Delivery Type | Address | Product SKU |
 *  Product Name | Quantity | Unit Price (DZD) | Total Amount (DZD) |
 *  Confirmation | Notes
 *
 *  طريقة النشر:
 *  1) أنشئ جدول Google Sheets فارغاً
 *  2) الامتدادات ← Apps Script ← الصق هذا الكود
 *  3) Deploy ← New deployment ← Web app
 *     (تنفيذ بصفتي: أنا — الوصول: أي شخص) وانسخ الرابط
 *  4) افتح:  <الرابط>?action=init  ← يُنشئ جدول Orders بالعناوين
 *  5) ضع الرابط في: لوحة التحكم ← الإعدادات ← Google Sheets
 *******************************************************************/

var SS = SpreadsheetApp.getActiveSpreadsheet();
var SHEET_ORDERS = 'Orders';

var ORDER_HEADERS = [
  'Order ID', 'Date', 'First Name', 'Last Name', 'Phone 1', 'Phone 2',
  'Wilaya', 'Commune', 'Delivery Type', 'Address', 'Product SKU', 'Product Name',
  'Quantity', 'Unit Price (DZD)', 'Total Amount (DZD)', 'Confirmation', 'Notes'
];

/* ---------- أدوات مساعدة ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrdersSheet_() {
  var sh = SS.getSheetByName(SHEET_ORDERS);
  if (!sh) {
    sh = SS.insertSheet(SHEET_ORDERS);
    sh.appendRow(ORDER_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, ORDER_HEADERS.length).setFontWeight('bold')
      .setBackground('#f5ead2').setFontColor('#7a5c22');
  }
  return sh;
}

/* ---------- نقاط الوصول ---------- */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'init') return initSheet_();
  if (action === 'test') return json_({ ok: true, time: new Date().toISOString() });
  return json_({ ok: false, error: 'إجراء غير معروف' });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  var action = (e && e.parameter && e.parameter.action) || body.action || '';
  if (action === 'createOrder') return json_(createOrder_(body.order || {}));
  return json_({ ok: false, error: 'إجراء غير معروف' });
}

/* ---------- التهيئة ---------- */
function initSheet_() {
  var sh = getOrdersSheet_();
  var tpl = HtmlService.createTemplate(
    '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Tahoma,Arial;background:#f7f3ea;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}'
    + '.card{background:#fff;border-radius:16px;padding:34px;max-width:600px;box-shadow:0 10px 40px rgba(0,0,0,.12);margin:20px}'
    + 'h1{color:#a8853a;font-size:22px;margin:0 0 6px}.ok{background:#e8f8f0;color:#0d8a5f;padding:12px 16px;border-radius:10px;font-weight:bold;margin:14px 0}'
    + 'code{background:#f3eee5;padding:3px 8px;border-radius:6px;direction:ltr;display:inline-block}'
    + 'li{margin:8px 0;line-height:1.7}'
    + '</style></head><body><div class="card">'
    + '<h1>✅ تم تهيئة تصدير الطلبات بنجاح</h1>'
    + '<p style="color:#8d8274">أُنشئ جدول <b>Orders</b> في جدول البيانات مع الأعمدة التالية:</p>'
    + '<div class="ok" dir="ltr" style="font-size:13px;line-height:2">Order ID — Date — First Name — Last Name — Phone 1 — Phone 2<br>Wilaya — Commune — Delivery Type — Address — Product SKU<br>Product Name — Quantity — Unit Price (DZD) — Total Amount (DZD)<br>Confirmation — Notes</div>'
    + '<ol><li>انسخ <b>رابط تطبيق الويب</b> (Web App URL) من صفحة النشر.</li>'
    + '<li>في لوحة التحكم: الإعدادات ← Google Sheets، الصق الرابط ثم احفظ.</li>'
    + '<li>الطلبات الجديدة ستصل تلقائياً في الجدول.</li></ol>'
    + '</div></body></html>');
  return tpl.evaluate().setTitle('تهيئة التصدير — نجاح')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- إنشاء طلب (صف لكل منتج) ---------- */
function createOrder_(o) {
  var c = o.customer || {};
  var items = o.items || [];

  // تحقق أساسي
  if (!c.firstName && !c.lastName && !c.name) return { ok: false, error: 'الاسم غير صالح' };
  if (!/^0[567]\d{8}$/.test(String(c.phone).replace(/[\s-]/g, ''))) return { ok: false, error: 'رقم الهاتف غير صالح' };
  if (!c.wilaya || !c.commune) return { ok: false, error: 'الولاية والبلدية مطلوبتان' };
  if (!items.length) return { ok: false, error: 'السلة فارغة' };

  // حماية بسيطة من السبام: 5 طلبات كحد أقصى لكل هاتف في الدقيقة
  var cache = CacheService.getScriptCache();
  var key = 'order_' + String(c.phone);
  var n = Number(cache.get(key) || 0);
  if (n >= 5) return { ok: false, error: 'طلبات كثيرة، حاول لاحقاً' };
  cache.put(key, n + 1, 60);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, error: 'الخادم مشغول، حاول مجدداً' }; }

  try {
    var seq = Number(getSetting_('seq') || 0) + 1;
    setSetting_('seq', seq);
    var d = new Date();
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var orderId = 'EH-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + ('000' + seq).slice(-4);

    var dateStr = Utilities.formatDate(d, 'Africa/Algiers', 'yyyy-MM-dd HH:mm');
    var firstName = String(c.firstName || '').trim() || String((c.name || '').split(/\s+/)[0] || '');
    var lastName = String(c.lastName || '').trim() || String((c.name || '').split(/\s+/).slice(1).join(' ') || '');
    var phone1 = String(c.phone || '').trim();
    var phone2 = String(c.phone2 || '').trim();
    var deliveryType = (o.shippingKind === 'مكتب') ? 'Desk' : 'Home';
    var address = String(c.address || '').trim();
    var notes = String(c.notes || '').trim();
    var confirmation = 'قيد المراجعة';

    var sh = getOrdersSheet_();
    var rows = items.map(function (it) {
      var qty = Number(it.qty) || 1;
      var price = Number(it.price) || 0;
      return [
        orderId, dateStr, firstName, lastName, phone1, phone2,
        String(c.wilaya || ''), String(c.commune || ''), deliveryType, address,
        String(it.sku || ''), String(it.name || ''), qty, price, Math.round(price * qty),
        confirmation, notes
      ];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ORDER_HEADERS.length).setValues(rows);
    return { ok: true, orderId: orderId };
  } catch (e) {
    return { ok: false, error: 'خطأ في حفظ الطلب: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- إعدادات عامة صغيرة (الرقم التسلسلي) ---------- */
function getSetting_(key) {
  var sh = SS.getSheetByName('Settings');
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) return data[i][1];
  }
  return null;
}

function setSetting_(key, value) {
  var sh = SS.getSheetByName('Settings');
  if (!sh) {
    sh = SS.insertSheet('Settings');
    sh.appendRow(['key', 'value']);
  }
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(String(value));
      return;
    }
  }
  sh.appendRow([key, String(value)]);
}
