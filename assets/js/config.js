/* ===== إعدادات عامة ===== */
window.EH = window.EH || {};

EH.CONFIG = {
  VERSION: '1.0.0',
  LS_PREFIX: 'eh.v1.',
  // مفاتيح التخزين المحلي
  LS: {
    cart: 'eh.v1.cart',
    products: 'eh.v1.products',
    shipping: 'eh.v1.shipping',
    shippingDefaults: 'eh.v1.shippingDefaults',
    freeShipping: 'eh.v1.freeShipping',
    coupons: 'eh.v1.coupons',
    settings: 'eh.v1.settings',
    orders: 'eh.v1.orders',
    cache: 'eh.v1.apiCache',
    media: 'eh.v1.mediaCache',
    seq: 'eh.v1.seq'
  },
  // حالات الطلب
  ORDER_STATUSES: [
    { id: 'review', label: 'قيد المراجعة', color: '#f59e0b' },
    { id: 'confirmed', label: 'تم التأكيد', color: '#3b82f6' },
    { id: 'shipped', label: 'تم الشحن', color: '#8b5cf6' },
    { id: 'delivered', label: 'تم التسليم', color: '#10b981' },
    { id: 'cancelled', label: 'ملغى', color: '#ef4444' },
    { id: 'returned', label: 'مرتجع', color: '#64748b' }
  ],
  STATUS_LABEL: function (id) {
    var s = (EH.CONFIG.ORDER_STATUSES || []).filter(function (x) { return x.id === id; })[0];
    return s ? s.label : id;
  },
  // أعمدة جدول الطلبات في Google Sheets (بالترتيب المطلوب)
  ORDER_COLUMNS: [
    'تاريخ الطلب', 'توقيت الطلب', 'رقم الطلب', 'اسم العميل', 'رقم الهاتف',
    'الولاية', 'البلدية', 'المنتجات المطلوبة', 'الكمية',
    'إجمالي مبلغ المنتجات', 'تكلفة الشحن', 'نوع الشحن', 'المبلغ الإجمالي', 'حالة الطلب',
    'العنوان', 'ملاحظات', 'كود الخصم', 'قيمة الخصم'
  ]
};

// تنسيق السعر
EH.fmt = function (n) {
  n = Number(n) || 0;
  return n.toLocaleString('en-US').replace(/,/g, ',') + ' دج';
};
EH.fmtNum = function (n) {
  return (Number(n) || 0).toLocaleString('en-US');
};
