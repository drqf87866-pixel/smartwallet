/*
 * SmartWallet – gemeinsame Client-Helfer.
 * Wird als statisches Asset von Cloudflare ausgeliefert und gecacht;
 * die SSR-Views binden es im <head> ein, bevor ihre seitenspezifischen
 * Inline-Scripts laufen.
 */
(function () {
  'use strict';

  window.$ = function (id) {
    return document.getElementById(id);
  };

  /* ------------------------------------------------------------------ */
  /* Toast                                                                */
  /* ------------------------------------------------------------------ */

  var TOAST_BG = { ok: 'bg-emerald-600', info: 'bg-amber-600', error: 'bg-red-600' };

  window.showToast = function (message, kind) {
    var toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    Object.keys(TOAST_BG).forEach(function (k) {
      toast.classList.toggle(TOAST_BG[k], k === kind);
    });
    // Fehler hart ankündigen, Erfolg/Meldungen freundlich
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.classList.remove('hidden');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () {
      toast.classList.add('hidden');
    }, 4000);
  };

  /* ------------------------------------------------------------------ */
  /* HTTP-Helfer                                                          */
  /* ------------------------------------------------------------------ */

  window.postJson = async function (url, body, method) {
    var res = await fetch(url, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Sitzung abgelaufen');
    }
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error(data.error || 'Unbekannter Fehler');
    }
    return data;
  };

  // Partial Updates: Fragmente (HTML-Teilstücke) laden
  window.fetchFragment = async function (url) {
    var res = await fetch(url, { headers: { 'X-Fragments': '1' } });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Sitzung abgelaufen');
    }
    if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen');
    return res.text();
  };

  /* ------------------------------------------------------------------ */
  /* Button-Busy-Zustand (inkl. Spinner)                                  */
  /* ------------------------------------------------------------------ */

  window.busy = function (btn, text) {
    if (!btn) return function () {};
    var orig = btn.textContent;
    btn.disabled = true;
    if (text) btn.textContent = text;
    var spin = document.createElement('span');
    spin.className =
      'mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]';
    btn.insertBefore(spin, btn.firstChild);
    return function () {
      btn.disabled = false;
      btn.textContent = orig;
    };
  };

  /* ------------------------------------------------------------------ */
  /* Formular-Validierung: Feld markieren + fokussieren                   */
  /* ------------------------------------------------------------------ */

  window.markInvalid = function (el) {
    if (!el) return;
    el.setAttribute('aria-invalid', 'true');
    el.focus();
    el.addEventListener(
      'input',
      function () {
        el.removeAttribute('aria-invalid');
      },
      { once: true }
    );
  };

  /* ------------------------------------------------------------------ */
  /* Sheets/Overlays: Fokus-Trap, Scroll-Lock, Fokus-Restore, Escape      */
  /* ------------------------------------------------------------------ */

  var openOverlays = [];
  var lastFocused = null;

  function focusables(container) {
    return container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  window.openSheet = function (id) {
    var overlay = $(id);
    if (!overlay) return;
    lastFocused = document.activeElement;
    overlay.classList.remove('hidden');
    openOverlays.push(overlay);
    document.documentElement.classList.add('overflow-hidden');
    var f = focusables(overlay);
    if (f.length) f[0].focus();
  };

  window.closeSheet = function (id) {
    var overlay = $(id);
    if (!overlay) return;
    overlay.classList.add('hidden');
    openOverlays = openOverlays.filter(function (o) {
      return o !== overlay;
    });
    if (openOverlays.length === 0) {
      document.documentElement.classList.remove('overflow-hidden');
    }
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
      lastFocused = null;
    }
  };

  document.addEventListener('keydown', function (e) {
    if (openOverlays.length === 0) return;
    var top = openOverlays[openOverlays.length - 1];
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSheet(top.id);
      return;
    }
    if (e.key === 'Tab') {
      var f = focusables(top);
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ------------------------------------------------------------------ */
  /* Kategorie-Dropdowns je nach Art (Ausgabe/Einnahme/Überweisung)       */
  /* ------------------------------------------------------------------ */

  window.syncCategoryOptions = function (prefix, keepValue) {
    var typeSel = $(prefix + 'type');
    var catSel = $(prefix + 'category');
    if (!typeSel || !catSel) return;
    var desired = (keepValue === undefined ? catSel.value : keepValue) || '';
    var isTransfer = typeSel.value === 'transfer';
    var isIncome = typeSel.value === 'income';
    if (isTransfer) desired = 'Überweisung';
    var cats = JSON.parse(catSel.getAttribute(isIncome || isTransfer ? 'data-income-cats' : 'data-expense-cats'));
    if (isTransfer) cats = ['Überweisung'];
    catSel.disabled = isTransfer;
    catSel.innerHTML = '';
    if (desired && cats.indexOf(desired) === -1) {
      var extra = document.createElement('option');
      extra.value = desired;
      extra.textContent = desired;
      catSel.appendChild(extra);
    }
    cats.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSel.appendChild(opt);
    });
    if (desired) {
      catSel.value = desired;
    } else {
      var fallback = cats.indexOf('Sonstiges') !== -1 ? 'Sonstiges' : cats[0] || '';
      if (fallback) catSel.value = fallback;
    }
  };
})();
