/* ===== حقن أكواد التتبع (Meta / TikTok / Google) ===== */
(function () {
  'use strict';

  // يضيف أكواد <script> المنسوخة كما هي (تدعم <script src> والكود الداخلي)
  function injectSnippet(html) {
    if (!html || !String(html).trim()) return;
    var s = String(html);
    var re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    var m, found = false;
    while ((m = re.exec(s)) !== null) {
      found = true;
      var attrs = m[1] || '';
      var body = m[2] || '';
      var srcM = attrs.match(/src=["']([^"']+)["']/i);
      var sc = document.createElement('script');
      if (srcM) {
        sc.src = srcM[1];
        sc.async = true;
      } else if (body.trim()) {
        sc.text = body;
      } else { continue; }
      document.head.appendChild(sc);
    }
    if (!found) {
      // ربما الكود منسوخ بدون وسم <script>
      var sc2 = document.createElement('script');
      sc2.text = s;
      document.head.appendChild(sc2);
    }
  }

  EH.initPixels = function (settings) {
    if (!settings || EH.__pixelsDone) return;
    EH.__pixelsDone = true;
    var p = settings.pixels || {};
    if (p.meta) injectSnippet(p.meta);
    if (p.tiktok) injectSnippet(p.tiktok);
    if (p.gtag) {
      injectSnippet(p.gtag);
      // التأكد من وجود gtag الأساسي (مرة واحدة فقط)
      if (p.gtag.indexOf('gtag/js') !== -1 && !window.gtag && !document.querySelector('script[src*="gtag/js"]')) {
        var m = p.gtag.match(/id=([A-Za-z0-9-_]+)/);
        if (m) {
          var sc = document.createElement('script');
          sc.async = true;
          sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + m[1];
          document.head.appendChild(sc);
        }
      }
    }
  };
})();
