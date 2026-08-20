/* ===== صفحة شكراً — إطلاق حدث Purchase ===== */
(function () {
  'use strict';
  // رسم الهيدر والفوتر فوراً — لا تبقى الصفحة فارغة أبداً
  try { EH.injectCommon(); EH.refreshCartBadge(); } catch (e) {}

  EH.apiGetData().catch(function (e) { try { EH.toast('تعذر تحميل البيانات', 'error'); } catch (x) {} }).then(function (d) {
    EH.injectCommon();
    EH.initPixels(d.settings);
    EH.refreshCartBadge();

    var order = EH.qs('order');
    var total = parseFloat(EH.qs('total')) || 0;
    var items = parseInt(EH.qs('items'), 10) || 0;
    var shipRaw = EH.qs('ship') || '';
    var shipParts = shipRaw.split('|');
    var shipTxt = shipParts[0] ? (shipParts[0] === 'مكتب' ? '🏢 مكتب / نقطة استلام' : '🏠 باب المنزل') : '—';

    document.getElementById('t-order').textContent = order || '—';
    document.getElementById('t-total').textContent = EH.fmt(total);
    document.getElementById('t-ship').textContent = shipTxt;

    if (total > 0) {
      EH.track('Purchase', { value: total, content_ids: [], contents: [{ id: order || '', quantity: items, price: total }] });
    }
  });
})();
