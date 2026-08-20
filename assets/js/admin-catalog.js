/* ===== لوحة التحكم — المنتجات والكوبونات ===== */
(function () {
  'use strict';
  var S;
  var editingId = null;

  function init() { S = EH.Admin.state; }
  EH.AdminCatalog = { render: render, renderCoupons: renderCoupons };

  /* ================= المنتجات ================= */
  function render(el) {
    init();
    var products = (S.data.products || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
    el.innerHTML =
      '<div class="card"><h3>🛍️ المنتجات <span class="sub">' + products.length + ' منتج</span></h3>' +
      '<div class="filters"><button class="btn btn-gold" id="btn-new-product">+ منتج جديد</button>' +
      (S.demo ? '' : '<button class="btn btn-ghost" id="btn-seed" title="استيراد المنتجات التجريبية (14 منتجاً) إلى Firebase">📥 استيراد منتجات تجريبية</button>') +
      '<select id="p-filter"><option value="all">كل المنتجات</option><option value="fragrance">عطور المنزل</option><option value="fashion">الأزياء</option><option value="out">نفد من المخزون</option></select></div>' +
      '<div id="products-list"></div></div>';

    document.getElementById('btn-new-product').addEventListener('click', function () { editProduct(null); });
    document.getElementById('p-filter').addEventListener('change', function () { renderList(products); });

    var seedBtn = document.getElementById('btn-seed');
    if (seedBtn) seedBtn.addEventListener('click', function () {
      EH.Admin.confirm('سيتم إضافة 14 منتجاً تجريبياً (عطور منزلية وأزياء) إلى قاعدة بيانات Firebase إن لم تكن موجودة. متابعة؟', function () {
        seedBtn.disabled = true;
        seedBtn.textContent = '⏳ جارٍ الاستيراد…';
        fetch('assets/data/seed.json', { cache: 'no-cache' })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var prods = j.products || [];
            var jobs = prods.map(function (p) { return EH.saveProduct(p); });
            return Promise.all(jobs);
          })
          .then(function () {
            EH.Admin.toast('تم استيراد المنتجات ✓', 'ok');
            EH.Admin.reload().then(function () { render(document.getElementById('admin-content')); });
          })
          .catch(function (e) { EH.Admin.toast('فشل الاستيراد', 'err'); seedBtn.disabled = false; seedBtn.textContent = '📥 استيراد منتجات تجريبية'; });
      });
    });

    renderList(products);
  }

  function renderList(products) {
    var f = document.getElementById('p-filter').value;
    var list = products.filter(function (p) {
      if (f === 'fragrance') return p.category === 'fragrance';
      if (f === 'fashion') return p.category === 'fashion';
      if (f === 'out') return EH.Product.stockTotal(p) <= 0;
      return true;
    });
    document.getElementById('products-list').innerHTML = list.length ?
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المنتج</th><th>القسم</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
      list.map(function (p) {
        var stock = EH.Product.stockTotal(p);
        return '<tr><td><div class="prod-row"><img src="' + EH.esc(EH.resolveImg(EH.Product.imageFor(p))) + '" loading="lazy" alt=""><div><div class="n">' + EH.esc(p.name) + '</div><div class="s">سكيو: ' + EH.esc(p.sku || p.id) + '</div></div></div></td>' +
          '<td>' + (p.category === 'fragrance' ? 'عطور المنزل' : 'الأزياء') + '</td>' +
          '<td><b>' + EH.fmt(p.price) + '</b>' + (EH.Product.hasDiscount(p) ? '<br><small style="color:var(--muted);text-decoration:line-through">' + EH.fmt(p.oldPrice) + '</small>' : '') + '</td>' +
          '<td>' + (stock > 0 ? '<span class="badge b-ok">' + stock + '</span>' : '<span class="badge b-off">نفد</span>') + '</td>' +
          '<td>' + (p.active === false ? '<span class="badge b-off">مخفي</span>' : '<span class="badge b-ok">منشور</span>') + '</td>' +
          '<td class="actions"><button class="btn btn-sm btn-ghost" data-edit="' + EH.esc(p.id) + '">تعديل</button>' +
          '<button class="btn btn-sm btn-danger" data-delp="' + EH.esc(p.id) + '">حذف</button></td></tr>';
      }).join('') + '</tbody></table></div>' :
      '<div class="empty-state" style="padding:30px"><div class="ic">📦</div>لا توجد منتجات</div>';

    EH.$$('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editProduct(b.getAttribute('data-edit')); });
    });
    EH.$$('[data-delp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-delp');
        EH.Admin.confirm('هل تريد حذف هذا المنتج نهائياً؟', function () {
          if (S.demo) {
            var list2 = (S.data.products || []).filter(function (p) { return p.id !== id; });
            EH.Admin.persistLocal('products', list2, function () { render(document.getElementById('admin-content')); });
          } else {
            EH.deleteProduct(id).then(function (res) {
              if (res.ok) { EH.Admin.toast('تم الحذف ✓', 'ok'); EH.Admin.reload().then(render); }
              else EH.Admin.toast((res && res.error) || 'فشل الحذف', 'err');
            });
          }
        });
      });
    });
  }

  /* ---------- محرر المنتج ---------- */
  function editProduct(id) {
    init();
    var p = id ? (S.data.products || []).filter(function (x) { return x.id === id; })[0] : null;
    editingId = id;
    var isNew = !p;
    p = p ? JSON.parse(JSON.stringify(p)) : {
      id: 'p' + Date.now(), sku: '', name: '', category: 'fragrance', variantMode: 'fragrance',
      desc: '', price: 0, oldPrice: 0, badge: '', featured: false, active: true,
      createdAt: new Date().toISOString().slice(0, 10), sales: 0,
      images: [], video: '', colors: [], sizes: [], capacities: [], stock: {}, related: [], type: 'product'
    };
    if (isNew && p.variantMode === 'fragrance' && !p.capacities.length) p.capacities = [{ label: '', delta: 0 }];

    var imgsHTML = '<div class="img-upload-grid" id="img-grid">' +
      (p.images || []).map(function (im, i) {
        return '<div class="img-upload-item" data-i="' + i + '"><img src="' + EH.esc(EH.resolveImg(im.src)) + '" alt=""><button class="del" data-imgdel="' + i + '">✕</button>' +
          '<input type="text" value="' + EH.esc(im.color || '') + '" placeholder="لون الصورة" data-imgcolor="' + i + '" style="width:100%;font-size:10px;padding:2px;border:1px solid var(--line);border-radius:4px;margin-top:2px"></div>';
      }).join('') +
      '<label class="img-upload-add" id="img-add">＋<input type="file" accept="image/*" multiple hidden></label></div>';

    var colorsHTML = '<div id="colors-box">' + (p.colors || []).map(function (c, i) {
      return '<div style="display:flex;gap:6px;margin-bottom:6px"><input type="color" value="' + EH.esc(c.hex || '#cccccc') + '" data-chex="' + i + '" style="width:44px;padding:2px"><input type="text" value="' + EH.esc(c.name) + '" data-cname="' + i + '" placeholder="اسم اللون"><button class="btn btn-sm btn-danger" data-cdel="' + i + '">✕</button></div>';
    }).join('') + '</div><button class="btn btn-sm btn-ghost" id="color-add">+ إضافة لون</button>';

    var sizesHTML = '<div id="sizes-box">' + (p.sizes || []).map(function (s, i) {
      return '<span style="display:inline-flex;gap:4px;margin:2px"><input type="text" value="' + EH.esc(s) + '" data-sname="' + i + '" style="width:70px;padding:6px;border-radius:8px;border:1.5px solid var(--line)"><button class="btn btn-sm btn-danger" data-sdel="' + i + '">✕</button></span>';
    }).join('') + '</div><button class="btn btn-sm btn-ghost" id="size-add">+ إضافة مقاس</button>';

    var capsHTML = '<div id="caps-box">' + (p.capacities || []).map(function (c, i) {
      return '<div style="display:flex;gap:6px;margin-bottom:6px"><input type="text" value="' + EH.esc(c.label) + '" data-clabel="' + i + '" placeholder="مثال: 100 مل" style="flex:1"><input type="number" value="' + (c.delta || 0) + '" data-cdelta="' + i + '" placeholder="فرق السعر" style="width:110px"><button class="btn btn-sm btn-danger" data-capdel="' + i + '">✕</button></div>';
    }).join('') + '</div><button class="btn btn-sm btn-ghost" id="cap-add">+ إضافة سعة</button>';

    var relatedHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px;max-height:180px;overflow-y:auto;border:1px solid var(--line);border-radius:10px;padding:10px">' +
      (S.data.products || []).filter(function (x) { return x.id !== p.id; }).map(function (x) {
        return '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;width:48%"><input type="checkbox" value="' + EH.esc(x.id) + '" ' + ((p.related || []).indexOf(x.id) !== -1 ? 'checked' : '') + '> ' + EH.esc(x.name) + '</label>';
      }).join('') + '</div>';

    var modeSel = '<select id="f-variantmode"><option value="fragrance" ' + (p.variantMode === 'fragrance' ? 'selected' : '') + '>سعات (عطور المنزل)</option><option value="fashion" ' + (p.variantMode === 'fashion' ? 'selected' : '') + '>لون + مقاس (أزياء)</option><option value="none" ' + (p.variantMode === 'none' ? 'selected' : '') + '>بدون متغيرات</option></select>';

    EH.Admin.modal(
      '<div class="modal-head"><h3>' + (isNew ? 'منتج جديد' : 'تعديل: ' + EH.esc(p.name)) + '</h3><button class="modal-close" onclick="EH.Admin.closeModal()">✕</button></div>' +
      '<div class="form-grid">' +
      '<div class="field full"><label>اسم المنتج *</label><input id="f-name" value="' + EH.esc(p.name) + '" placeholder="مثال: شمعة فانيلا وعنبر"></div>' +
      '<div class="field"><label>القسم</label><select id="f-category"><option value="fragrance" ' + (p.category === 'fragrance' ? 'selected' : '') + '>عطور المنزل</option><option value="fashion" ' + (p.category === 'fashion' ? 'selected' : '') + '>الأزياء</option></select></div>' +
      '<div class="field"><label>نظام المتغيرات</label>' + modeSel + '</div>' +
      '<div class="field"><label>السعر (دج) *</label><input id="f-price" type="number" min="0" value="' + (p.price || 0) + '"></div>' +
      '<div class="field"><label>السعر القديم (قبل التخفيض)</label><input id="f-oldprice" type="number" min="0" value="' + (p.oldPrice || 0) + '"></div>' +
      '<div class="field"><label>سكيو الأساسي</label><input id="f-sku" value="' + EH.esc(p.sku || '') + '" placeholder="مثال: EH-FR-001"></div>' +
      '<div class="field"><label>الشارة</label><select id="f-badge"><option value="">بدون</option><option value="new" ' + (p.badge === 'new' ? 'selected' : '') + '>جديد</option><option value="best" ' + (p.badge === 'best' ? 'selected' : '') + '>الأكثر مبيعاً</option><option value="sale" ' + (p.badge === 'sale' ? 'selected' : '') + '>تخفيض</option></select></div>' +
      '<div class="field"><label>تاريخ الإضافة</label><input id="f-created" type="date" value="' + EH.esc((p.createdAt || '').slice(0, 10)) + '"></div>' +
      '<div class="field"><label>عدد المبيعات</label><input id="f-sales" type="number" min="0" value="' + (p.sales || 0) + '"></div>' +
      '<div class="field"><label>الوصف</label><textarea id="f-desc" rows="4" placeholder="وصف المنتج…">' + EH.esc(p.desc || '') + '</textarea></div>' +
      '<div class="field"><label>فيديو قصير (رابط mp4)</label><input id="f-video" value="' + EH.esc(p.video || '') + '" placeholder="https://…/video.mp4"></div>' +
      '<div class="field full"><label>صور المنتج (تُضغط تلقائياً إلى WebP عند الرفع)</label>' + imgsHTML + '<div class="hint">يمكن تحديد لون لكل صورة ليتغير العرض عند اختيار اللون</div></div>' +
      '<div class="field" id="colors-field" style="' + (p.variantMode === 'fashion' ? '' : 'display:none') + '"><label>الألوان</label>' + colorsHTML + '</div>' +
      '<div class="field" id="sizes-field" style="' + (p.variantMode === 'fashion' ? '' : 'display:none') + '"><label>المقاسات</label>' + sizesHTML + '</div>' +
      '<div class="field" id="caps-field" style="' + (p.variantMode === 'fragrance' ? '' : 'display:none') + '"><label>السعات (الحجم + فرق السعر)</label>' + capsHTML + '</div>' +
      '<div class="field full"><label>المخزون (لكل متغير)</label><div id="stock-matrix"></div></div>' +
      '<div class="field full"><label>منتجات ذات صلة (اقتراحات متقاطعة)</label>' + relatedHTML + '</div>' +
      '<div class="field"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="f-featured" ' + (p.featured ? 'checked' : '') + '> مميز في الصفحة الرئيسية</label></div>' +
      '<div class="field"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="f-active" ' + (p.active !== false ? 'checked' : '') + '> منشور (ظاهر في المتجر)</label></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-gold" id="save-product">💾 حفظ المنتج</button><button class="btn btn-ghost" onclick="EH.Admin.closeModal()">إلغاء</button></div>',
      true
    );

    // تبديل حقول المتغيرات
    document.getElementById('f-variantmode').addEventListener('change', function () {
      var v = this.value;
      document.getElementById('colors-field').style.display = v === 'fashion' ? '' : 'none';
      document.getElementById('sizes-field').style.display = v === 'fashion' ? '' : 'none';
      document.getElementById('caps-field').style.display = v === 'fragrance' ? '' : 'none';
      renderStockMatrix();
    });
    document.getElementById('f-category').addEventListener('change', function () {
      var v = this.value;
      if (v === 'fashion') document.getElementById('f-variantmode').value = 'fashion';
      else document.getElementById('f-variantmode').value = 'fragrance';
      document.getElementById('f-variantmode').dispatchEvent(new Event('change'));
    });

    // إضافة/حذف ألوان ومقاسات وسعات
    document.getElementById('color-add').addEventListener('click', function () {
      var box = document.getElementById('colors-box');
      var i = box.children.length;
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
      div.innerHTML = '<input type="color" value="#cccccc" data-chex="' + i + '" style="width:44px;padding:2px"><input type="text" data-cname="' + i + '" placeholder="اسم اللون"><button class="btn btn-sm btn-danger" data-cdel="' + i + '">✕</button>';
      box.appendChild(div);
      bindColorDel(div);
    });
    EH.$$('#colors-box [data-cdel]').forEach(function (b) { bindColorDel(b.closest('div')); });
    function bindColorDel(div) { div.querySelector('[data-cdel]').addEventListener('click', function () { div.remove(); }); }

    document.getElementById('size-add').addEventListener('click', function () {
      var box = document.getElementById('sizes-box');
      var i = box.children.length;
      var span = document.createElement('span');
      span.style.cssText = 'display:inline-flex;gap:4px;margin:2px';
      span.innerHTML = '<input type="text" data-sname="' + i + '" style="width:70px;padding:6px;border-radius:8px;border:1.5px solid var(--line)"><button class="btn btn-sm btn-danger" data-sdel="' + i + '">✕</button>';
      box.appendChild(span);
      span.querySelector('[data-sdel]').addEventListener('click', function () { span.remove(); });
    });
    EH.$$('#sizes-box [data-sdel]').forEach(function (b) { b.addEventListener('click', function () { b.closest('span').remove(); }); });

    document.getElementById('cap-add').addEventListener('click', function () {
      var box = document.getElementById('caps-box');
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
      div.innerHTML = '<input type="text" data-clabel placeholder="مثال: 100 مل" style="flex:1"><input type="number" data-cdelta placeholder="فرق السعر" style="width:110px"><button class="btn btn-sm btn-danger" data-capdel>✕</button>';
      box.appendChild(div);
      div.querySelector('[data-capdel]').addEventListener('click', function () { div.remove(); });
    });
    EH.$$('#caps-box [data-capdel]').forEach(function (b) { b.addEventListener('click', function () { b.closest('div').remove(); }); });

    // مصفوفة المخزون
    function readVariantParts() {
      var colors = EH.$$('#colors-box [data-cname]').map(function (i) { return { name: i.value.trim(), hex: i.closest('div').querySelector('[data-chex]').value }; }).filter(function (c) { return c.name; });
      var sizes = EH.$$('#sizes-box [data-sname]').map(function (i) { return i.value.trim(); }).filter(Boolean);
      var caps = EH.$$('#caps-box [data-clabel]').map(function (i) { return { label: i.value.trim(), delta: Number(i.closest('div').querySelector('[data-cdelta]').value) || 0 }; }).filter(function (c) { return c.label; });
      return { colors: colors, sizes: sizes, caps: caps };
    }

    function renderStockMatrix() {
      var mode = document.getElementById('f-variantmode').value;
      var box = document.getElementById('stock-matrix');
      var parts = readVariantParts();
      var cur = p.stock || {};
      if (mode === 'fashion') {
        if (!parts.colors.length || !parts.sizes.length) { box.innerHTML = '<div class="hint">أضف الألوان والمقاسات أعلاه لعرض مصفوفة المخزون</div>'; return; }
        var html = '<div class="stock-matrix"><table><thead><tr><th>اللون \\ المقاس</th>' + parts.sizes.map(function (s) { return '<th>' + EH.esc(s) + '</th>'; }).join('') + '</tr></thead><tbody>';
        parts.colors.forEach(function (c) {
          html += '<tr><th>' + EH.esc(c.name) + '</th>';
          parts.sizes.forEach(function (s) {
            var v = cur[c.name + '|' + s] != null ? cur[c.name + '|' + s] : '';
            html += '<td><input type="number" min="0" class="stock-in" data-k="' + EH.esc(c.name + '|' + s) + '" value="' + v + '"></td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        box.innerHTML = html;
      } else if (mode === 'fragrance') {
        if (!parts.caps.length) { box.innerHTML = '<div class="hint">أضف السعات أعلاه لعرض المخزون</div>'; return; }
        box.innerHTML = '<div class="stock-matrix"><table><thead><tr><th>السعة</th><th>الكمية</th></tr></thead><tbody>' +
          parts.caps.map(function (c) {
            var v = cur[c.label] != null ? cur[c.label] : '';
            return '<tr><th>' + EH.esc(c.label) + '</th><td><input type="number" min="0" class="stock-in" data-k="' + EH.esc(c.label) + '" value="' + v + '"></td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        var v0 = cur[''] != null ? cur[''] : (cur.main != null ? cur.main : '');
        box.innerHTML = '<div class="stock-matrix"><table><tr><th>الكمية الإجمالية</th></tr><tr><td><input type="number" min="0" class="stock-in" data-k="main" value="' + v0 + '"></td></tr></table></div>';
      }
    }

    // رفع الصور → WebP تلقائياً
    var fileInput = EH.$('#img-add input');
    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      files.forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            var canvas = document.createElement('canvas');
            var scale = Math.min(1, 1000 / img.width);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function (blob) {
              if (!blob) { EH.Admin.toast('تعذر ضغط الصورة', 'err'); return; }
              var fr = new FileReader();
              fr.onload = function (ev) {
                var dataUrl = ev.target.result;
                var grid = document.getElementById('img-grid');
                var idx = grid.querySelectorAll('.img-upload-item').length;
                var div = document.createElement('div');
                div.className = 'img-upload-item';
                div.setAttribute('data-i', idx);
                div.innerHTML = '<img src="' + dataUrl + '" alt=""><button class="del" data-imgdel="' + idx + '">✕</button>' +
                  '<input type="text" data-imgcolor="' + idx + '" placeholder="لون الصورة" style="width:100%;font-size:10px;padding:2px;border:1px solid var(--line);border-radius:4px;margin-top:2px">';
                grid.insertBefore(div, document.getElementById('img-add'));
                grid.querySelector('[data-imgdel="' + idx + '"]').addEventListener('click', function () { div.remove(); });
              };
              fr.readAsDataURL(blob);
            }, 'image/webp', 0.78);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = '';
    });
    EH.$$('#img-grid [data-imgdel]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('.img-upload-item').remove(); });
    });

    // تحديث مصفوفة المخزون عند تغيير الألوان/المقاسات
    ['colors-box', 'sizes-box', 'caps-box'].forEach(function (id) {
      var box = document.getElementById(id);
      box.addEventListener('input', EH.debounce(renderStockMatrix, 400));
    });

    renderStockMatrix();

    // الحفظ
    document.getElementById('save-product').addEventListener('click', function () {
      var name = document.getElementById('f-name').value.trim();
      var price = parseFloat(document.getElementById('f-price').value) || 0;
      if (!name) { EH.Admin.toast('أدخل اسم المنتج', 'err'); return; }
      if (price <= 0) { EH.Admin.toast('أدخل سعراً صحيحاً', 'err'); return; }

      var parts = readVariantParts();
      var mode = document.getElementById('f-variantmode').value;
      var stock = {};
      EH.$$('.stock-in').forEach(function (inp) {
        var v = parseInt(inp.value, 10);
        stock[inp.getAttribute('data-k')] = isNaN(v) ? 0 : v;
      });
      if (mode === 'none' && stock.main != null) { stock[''] = stock.main; delete stock.main; }

      var images = [];
      EH.$$('#img-grid .img-upload-item').forEach(function (div) {
        var src = div.querySelector('img').src;
        var color = (div.querySelector('[data-imgcolor]') || {}).value || '';
        images.push({ src: src, color: color.trim() });
      });

      var prod = {
        id: p.id || ('p' + Date.now()),
        sku: document.getElementById('f-sku').value.trim() || (p.sku || ''),
        name: name,
        category: document.getElementById('f-category').value,
        variantMode: mode,
        desc: document.getElementById('f-desc').value.trim(),
        price: price,
        oldPrice: parseFloat(document.getElementById('f-oldprice').value) || 0,
        badge: document.getElementById('f-badge').value,
        createdAt: document.getElementById('f-created').value || new Date().toISOString().slice(0, 10),
        sales: parseInt(document.getElementById('f-sales').value, 10) || 0,
        images: images,
        video: document.getElementById('f-video').value.trim(),
        colors: parts.colors, sizes: parts.sizes, capacities: parts.caps,
        stock: stock,
        related: EH.$$('#modal-box input[type="checkbox"][value]').filter(function (c) { return c.checked; }).map(function (c) { return c.value; }),
        featured: document.getElementById('f-featured').checked,
        active: document.getElementById('f-active').checked
      };

      if (S.demo) {
        var list = (S.data.products || []).filter(function (x) { return x.id !== prod.id; });
        list.push(prod);
        EH.Admin.persistLocal('products', list, function () { render(document.getElementById('admin-content')); });
      } else {
        EH.saveProduct(prod).then(function (res) {
          if (res.ok) {
            EH.Admin.toast('تم حفظ المنتج ✓', 'ok');
            EH.Admin.closeModal();
            EH.Admin.reload().then(function () { render(document.getElementById('admin-content')); });
          } else EH.Admin.toast((res && res.error) || 'فشل الحفظ', 'err');
        });
      }
    });
  }

  /* ================= الكوبونات ================= */
  function renderCoupons(el) {
    init();
    var coupons = S.data.coupons || [];
    el.innerHTML =
      '<div class="card"><h3>🎟️ كوبونات الخصم <span class="sub">' + coupons.length + ' كوبون</span></h3>' +
      '<div class="filters"><button class="btn btn-gold" id="btn-new-coupon">+ كوبون جديد</button></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الكود</th><th>النوع</th><th>القيمة</th><th>الحد الأدنى</th><th>الانتهاء</th><th>الاستعمال</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
      coupons.map(function (c) {
        return '<tr><td><b>' + EH.esc(c.code) + '</b></td>' +
          '<td>' + (c.type === 'percent' ? 'نسبة %' : 'مبلغ ثابت') + '</td>' +
          '<td>' + (c.type === 'percent' ? c.value + '%' : EH.fmt(c.value)) + '</td>' +
          '<td>' + (c.minOrder ? EH.fmt(c.minOrder) : '—') + '</td>' +
          '<td>' + (c.expires ? EH.esc(c.expires) : '—') + '</td>' +
          '<td>' + (c.used || 0) + ' / ' + (c.maxUses || '∞') + '</td>' +
          '<td>' + (c.active === false ? '<span class="badge b-off">موقوف</span>' : '<span class="badge b-ok">مفعّل</span>') + '</td>' +
          '<td class="actions"><button class="btn btn-sm btn-ghost" data-editc="' + EH.esc(c.id) + '">تعديل</button>' +
          '<button class="btn btn-sm btn-danger" data-delc="' + EH.esc(c.id) + '">حذف</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    document.getElementById('btn-new-coupon').addEventListener('click', function () { editCoupon(null); });
    EH.$$('[data-editc]').forEach(function (b) { b.addEventListener('click', function () { editCoupon(b.getAttribute('data-editc')); }); });
    EH.$$('[data-delc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-delc');
        EH.Admin.confirm('حذف هذا الكوبون؟', function () {
          if (S.demo) {
            var list2 = (S.data.coupons || []).filter(function (x) { return x.id !== id; });
            EH.Admin.persistLocal('coupons', list2, function () { renderCoupons(document.getElementById('admin-content')); });
          } else {
            EH.deleteCoupon(id).then(function (res) {
              if (res.ok) { EH.Admin.toast('تم الحذف ✓', 'ok'); EH.Admin.reload().then(function () { renderCoupons(document.getElementById('admin-content')); }); }
              else EH.Admin.toast((res && res.error) || 'فشل الحذف', 'err');
            });
          }
        });
      });
    });
  }

  function editCoupon(id) {
    init();
    var c = id ? (S.data.coupons || []).filter(function (x) { return x.id === id; })[0] : null;
    c = c ? JSON.parse(JSON.stringify(c)) : { id: 'c' + Date.now(), code: '', type: 'percent', value: 10, minOrder: 0, expires: '', maxUses: 100, used: 0, active: true };

    EH.Admin.modal(
      '<div class="modal-head"><h3>' + (id ? 'تعديل كوبون' : 'كوبون جديد') + '</h3><button class="modal-close" onclick="EH.Admin.closeModal()">✕</button></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>الكود *</label><input id="c-code" value="' + EH.esc(c.code) + '" placeholder="مثال: SALE20" style="text-transform:uppercase"></div>' +
      '<div class="field"><label>النوع</label><select id="c-type"><option value="percent" ' + (c.type === 'percent' ? 'selected' : '') + '>نسبة مئوية %</option><option value="fixed" ' + (c.type === 'fixed' ? 'selected' : '') + '>مبلغ ثابت (دج)</option></select></div>' +
      '<div class="field"><label>القيمة</label><input id="c-value" type="number" min="0" value="' + (c.value || 0) + '"></div>' +
      '<div class="field"><label>الحد الأدنى للطلب (دج)</label><input id="c-min" type="number" min="0" value="' + (c.minOrder || 0) + '"></div>' +
      '<div class="field"><label>تاريخ الانتهاء</label><input id="c-expires" type="date" value="' + EH.esc(c.expires || '') + '"></div>' +
      '<div class="field"><label>الحد الأقصى للاستعمال</label><input id="c-max" type="number" min="1" value="' + (c.maxUses || 100) + '"></div>' +
      '<div class="field"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="c-active" ' + (c.active !== false ? 'checked' : '') + '> مفعّل</label></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-gold" id="c-save">💾 حفظ</button><button class="btn btn-ghost" onclick="EH.Admin.closeModal()">إلغاء</button></div>'
    );

    document.getElementById('c-save').addEventListener('click', function () {
      var code = document.getElementById('c-code').value.trim().toUpperCase();
      if (!code) { EH.Admin.toast('أدخل الكود', 'err'); return; }
      var coupon = {
        id: c.id,
        code: code,
        type: document.getElementById('c-type').value,
        value: parseFloat(document.getElementById('c-value').value) || 0,
        minOrder: parseFloat(document.getElementById('c-min').value) || 0,
        expires: document.getElementById('c-expires').value,
        maxUses: parseInt(document.getElementById('c-max').value, 10) || 0,
        used: c.used || 0,
        active: document.getElementById('c-active').checked
      };
      if (S.demo) {
        var list = (S.data.coupons || []).filter(function (x) { return x.id !== coupon.id; });
        list.push(coupon);
        EH.Admin.persistLocal('coupons', list, function () { renderCoupons(document.getElementById('admin-content')); });
      } else {
        EH.saveCoupon(coupon).then(function (res) {
          if (res.ok) { EH.Admin.toast('تم الحفظ ✓', 'ok'); EH.Admin.closeModal(); EH.Admin.reload().then(function () { renderCoupons(document.getElementById('admin-content')); }); }
          else EH.Admin.toast((res && res.error) || 'فشل الحفظ', 'err');
        });
      }
    });
  }
})();
