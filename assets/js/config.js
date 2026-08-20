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
    'Order ID', 'Date', 'First Name', 'Last Name', 'Phone 1', 'Phone 2',
    'Wilaya', 'Commune', 'Delivery Type', 'Address', 'Product SKU', 'Product Name',
    'Quantity', 'Unit Price (DZD)', 'Total Amount (DZD)', 'Confirmation', 'Notes'
  ]
};

// ===== إعدادات Firebase (قاعدة البيانات) =====
EH.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDFLGuXce7yrneT0ci5mXXat36C67FzIwk",
  authDomain: "marketplace-dz-f2732.firebaseapp.com",
  projectId: "marketplace-dz-f2732",
  storageBucket: "marketplace-dz-f2732.firebasestorage.app",
  messagingSenderId: "495030664220",
  appId: "1:495030664220:web:fa65a9504baa442616b3d9",
  measurementId: "G-VMC957MRJ3"
};

// تنسيق السعر
EH.fmt = function (n) {
  n = Number(n) || 0;
  return n.toLocaleString('en-US').replace(/,/g, ',') + ' دج';
};
EH.fmtNum = function (n) {
  return (Number(n) || 0).toLocaleString('en-US');
};
