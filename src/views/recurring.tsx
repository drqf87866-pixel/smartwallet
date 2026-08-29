import type { FC } from 'hono/jsx';
import { frequencyLabel } from '../lib/recurring';
import type { TransactionAccount, TransactionScope } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories';
import { Layout } from './layout';

/** Regel inkl. berechnetem nächsten Fälligkeitsdatum (null = inaktiv/keine mehr). */
export type RecurringRuleView = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  scope: TransactionScope;
  paid_from: TransactionAccount;
  frequency: 'weekly' | 'monthly' | 'yearly';
  day: number;
  month: number | null;
  start_date: string;
  end_date: string | null;
  active: number;
  next_due: string | null;
};

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (n: number) => eur.format(n);
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const fmtDate = (dateOnly: string) => dateFmt.format(new Date(dateOnly + 'T12:00:00Z'));

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const LABEL_CLASS = 'mb-1 block text-xs text-slate-500';

/** Kategorie-Dropdown – Optionen werden per JS je nach Art (Ausgabe/Einnahme) befüllt. */
const CategorySelect: FC<{ id: string }> = ({ id }) => (
  <select
    id={id}
    class={INPUT_CLASS}
    data-expense-cats={JSON.stringify(EXPENSE_CATEGORIES)}
    data-income-cats={JSON.stringify(INCOME_CATEGORIES)}
  />
);

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monatlich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'yearly', label: 'Jährlich' },
] as const;

/** Regel-Liste – eigenes Fragment (id recurring-frag). */
export const RecurringList: FC<{ rules: RecurringRuleView[] }> = ({ rules }) => {
  if (rules.length === 0) {
    return (
      <p class="py-2 text-sm text-slate-400">
        Noch keine Regeln – lege z. B. Miete, Abos oder Gehalt unten an und sie werden automatisch gebucht.
      </p>
    );
  }
  return (
    <ul class="divide-y divide-slate-100">
      {rules.map((rule) => (
        <li class="flex items-start justify-between gap-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-700">
              {rule.description || rule.category}
              {rule.active ? null : (
                <span class="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">pausiert</span>
              )}
            </p>
            <p class="mt-0.5 text-xs text-slate-400">
              {frequencyLabel(rule)} · {rule.category}
              {rule.next_due ? <> · fällig am {fmtDate(rule.next_due)}</> : null}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <span class={'whitespace-nowrap text-sm font-semibold ' + (rule.type === 'income' ? 'text-emerald-600' : 'text-red-500')}>
              {rule.type === 'income' ? '+' : '−'}
              {fmt(rule.amount)}
            </span>
            {rule.active && rule.next_due ? (
              <button
                type="button"
                data-rec-book={rule.id}
                data-due-label={fmtDate(rule.next_due)}
                title="Nächste Fälligkeit jetzt buchen"
                class="flex h-8 w-8 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-sm text-emerald-600 hover:bg-emerald-100"
              >
                ⚡
              </button>
            ) : null}
            <button
              type="button"
              data-rec-toggle={rule.id}
              data-active={rule.active ? '1' : '0'}
              title={rule.active ? 'Pausieren' : 'Aktivieren'}
              class="flex h-8 w-8 items-center justify-center rounded border border-amber-200 bg-amber-50 text-sm text-amber-600 hover:bg-amber-100"
            >
              {rule.active ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              data-rec-edit={JSON.stringify(rule)}
              title="Bearbeiten"
              class="flex h-8 w-8 items-center justify-center rounded border border-indigo-200 bg-indigo-50 text-sm text-indigo-600 hover:bg-indigo-100"
            >
              ✏️
            </button>
            <button
              type="button"
              data-rec-delete={rule.id}
              title="Regel löschen"
              class="flex h-8 w-8 items-center justify-center rounded border border-red-200 bg-red-50 text-sm text-red-600 hover:bg-red-100"
            >
              🗑
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Overlay zum Bearbeiten einer Regel (nur Zukunft – bestehende Buchungen bleiben). */
const RecurringEditOverlay: FC = () => (
  <div id="recurring-edit-overlay" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-slate-900/40" data-close="recurring-edit-overlay"></div>
    <div
      class="safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[42rem] sm:max-w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
    >
      <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden"></div>
      <div class="mb-3 flex items-start justify-between">
        <div>
          <h2 class="text-sm font-medium text-slate-500">🔁 Wiederkehrende Zahlung bearbeiten</h2>
          <p class="mt-1 text-xs text-slate-400">Änderungen wirken ab jetzt – bereits erzeugte Buchungen bleiben unverändert.</p>
        </div>
        <button
          type="button"
          data-close="recurring-edit-overlay"
          aria-label="Schließen"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
        >
          ✕
        </button>
      </div>
      <form id="recurring-edit-form" class="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <label class="block">
          <span class={LABEL_CLASS}>Betrag</span>
          <input id="re-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Art</span>
          <select id="re-type" class={INPUT_CLASS}>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Bereich</span>
          <select id="re-scope" class={INPUT_CLASS}>
            <option value="shared">Gemeinsam</option>
            <option value="personal">Persönlich</option>
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Konto</span>
          <select id="re-paid-from" class={INPUT_CLASS}>
            <option value="joint">Gemeinschaftskonto</option>
            <option value="private">Privatkonto</option>
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Kategorie</span>
          <CategorySelect id="re-category" />
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Beschreibung</span>
          <input id="re-description" type="text" maxlength={200} placeholder="Beschreibung" class={INPUT_CLASS} />
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Rhythmus</span>
          <select id="re-frequency" class={INPUT_CLASS}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Fällig am</span>
          <input id="re-due" type="date" required class={INPUT_CLASS} />
        </label>
        <div class="flex gap-2 sm:col-span-3 lg:col-span-4">
          <button type="submit" class="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
            Änderungen speichern
          </button>
          <button
            type="button"
            data-close="recurring-edit-overlay"
            class="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  </div>
);

export type RecurringViewProps = {
  userName: string;
  householdName: string;
  rules: RecurringRuleView[];
  today: string;
};

/** Eigene Seite „Wiederkehrende Zahlungen“ (inkl. Anlegen-Formular + Edit-Overlay). */
export const RecurringView: FC<RecurringViewProps> = ({ userName, householdName, rules, today }) => {
  const script = `
var MAGIC_PAID_FROM = 'auto';

function $(id) { return document.getElementById(id); }

function showToast(message, kind) {
  var toast = $('toast');
  toast.textContent = message;
  toast.style.background = kind === 'ok' ? '#059669' : kind === 'info' ? '#d97706' : '#dc2626';
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 4000);
}

function busy(btn, text) {
  if (!btn) return function () {};
  var orig = btn.textContent;
  btn.disabled = true;
  if (text) btn.textContent = text;
  return function () { btn.disabled = false; btn.textContent = orig; };
}

async function postJson(url, body, method) {
  var res = await fetch(url, {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Sitzung abgelaufen');
  }
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    throw new Error(data.error || 'Unbekannter Fehler');
  }
  return data;
}

// Partial Updates: nach Aktionen nur die Regel-Liste tauschen
async function fetchFragment(url) {
  var res = await fetch(url, { headers: { 'X-Fragments': '1' } });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Sitzung abgelaufen');
  }
  if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen');
  return res.text();
}

async function refreshRecurring() {
  if (!$('recurring-frag')) return false;
  $('recurring-frag').innerHTML = await fetchFragment('/recurring/fragments/list');
  syncAllCategoryOptions();
  return true;
}

async function afterMutation() {
  try {
    await refreshRecurring();
  } catch (err) {
    window.location.reload();
  }
}

// --- Sheets: unten (mobil) bzw. mittig (Desktop) ---
function openSheet(id) {
  $(id).classList.remove('hidden');
}
function closeSheet(id) {
  $(id).classList.add('hidden');
}

// --- Kategorie-Dropdowns: Optionen je nach Art (Ausgabe/Einnahme) ---
function syncCategoryOptions(prefix, keepValue) {
  var typeSel = $(prefix + 'type');
  var catSel = $(prefix + 'category');
  if (!typeSel || !catSel) return;
  var desired = (keepValue === undefined ? catSel.value : keepValue) || '';
  var isIncome = typeSel.value === 'income';
  var cats = JSON.parse(catSel.getAttribute(isIncome ? 'data-income-cats' : 'data-expense-cats'));
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
    var fallback = cats.indexOf('Sonstiges') !== -1 ? 'Sonstiges' : (cats[0] || '');
    if (fallback) catSel.value = fallback;
  }
}

function syncAllCategoryOptions() {
  ['r-', 're-'].forEach(function (prefix) {
    syncCategoryOptions(prefix, '');
  });
}

// Wiederkehrende Zahlung bearbeiten: Regel ins Overlay-Formular füllen
var REC_EDITING_ID = null;

function fillRecurringForm(prefix, rule) {
  $(prefix + 'amount').value = rule.amount;
  $(prefix + 'type').value = rule.type;
  $(prefix + 'scope').value = rule.scope;
  $(prefix + 'paid-from').value = rule.paid_from;
  syncCategoryOptions(prefix, rule.category);
  $(prefix + 'description').value = rule.description;
  $(prefix + 'frequency').value = rule.frequency;
  $(prefix + 'due').value = rule.start_date;
}

// Art-Wechsel: Kategorie-Optionen neu befüllen (Ausgabe ↔ Einnahme)
document.addEventListener('change', function (e) {
  if (e.target && /^(r|re)-type$/.test(e.target.id)) {
    var prefix = e.target.id.slice(0, e.target.id.indexOf('type'));
    syncCategoryOptions(prefix, '');
  }
});

// Initial befüllen (nach Fragment-Swaps ruft refreshRecurring syncAllCategoryOptions erneut auf)
syncAllCategoryOptions();

document.addEventListener('click', async function (e) {
  var closer = e.target.closest('[data-close]');
  if (closer) { closeSheet(closer.getAttribute('data-close')); return; }

  // --- Sofortbuchen: nächste offene Fälligkeit vorzeitig buchen ---
  var recBook = e.target.closest('[data-rec-book]');
  if (recBook) {
    var dueLabel = recBook.getAttribute('data-due-label');
    if (!confirm('Die nächste Fälligkeit (' + dueLabel + ') jetzt sofort buchen? Sie wird dann am Fälligkeitstag nicht erneut gebucht.')) return;
    var unbusyBook = busy(recBook);
    try {
      await postJson('/api/recurring/' + recBook.getAttribute('data-rec-book') + '/book', {});
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      unbusyBook();
    }
    return;
  }

  // --- Wiederkehrende Zahlungen: Pausieren / Bearbeiten / Löschen ---
  var recToggle = e.target.closest('[data-rec-toggle]');
  if (recToggle) {
    var nextActive = recToggle.getAttribute('data-active') !== '1';
    var unbusyToggle = busy(recToggle);
    try {
      await postJson('/api/recurring/' + recToggle.getAttribute('data-rec-toggle'), { active: nextActive }, 'PUT');
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      unbusyToggle();
    }
    return;
  }

  var recEdit = e.target.closest('[data-rec-edit]');
  if (recEdit) {
    var rule = JSON.parse(recEdit.getAttribute('data-rec-edit'));
    REC_EDITING_ID = rule.id;
    fillRecurringForm('re-', rule);
    openSheet('recurring-edit-overlay');
    setTimeout(function () { $('re-amount').focus(); }, 150);
    return;
  }

  var recDelete = e.target.closest('[data-rec-delete]');
  if (recDelete) {
    if (!confirm('Diese Regel wirklich löschen? Bereits erzeugte Buchungen bleiben bestehen.')) return;
    try {
      await postJson('/api/recurring/' + recDelete.getAttribute('data-rec-delete'), {}, 'DELETE');
      REC_EDITING_ID = null;
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
    }
    return;
  }
});

// --- Submit-Delegation für alle Formulare ---
document.addEventListener('submit', async function (e) {
  var form = e.target;
  var btn = form.querySelector('button[type="submit"]');

  if (form.id === 'recurring-form') {
    e.preventDefault();
    var rAmount = parseFloat($('r-amount').value);
    if (!rAmount || rAmount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben', 'error');
      return;
    }
    var rBody = {
      amount: rAmount,
      type: $('r-type').value,
      scope: $('r-scope').value,
      paid_from: $('r-paid-from').value,
      category: $('r-category').value,
      description: $('r-description').value,
      frequency: $('r-frequency').value,
      start_date: $('r-due').value,
    };
    var rUnbusy = busy(btn);
    try {
      await postJson('/api/recurring', rBody);
      $('r-amount').value = '';
      $('r-description').value = '';
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      rUnbusy();
    }
    return;
  }

  if (form.id === 'recurring-edit-form') {
    e.preventDefault();
    if (!REC_EDITING_ID) return;
    var reAmount = parseFloat($('re-amount').value);
    if (!reAmount || reAmount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben', 'error');
      return;
    }
    var reBody = {
      amount: reAmount,
      type: $('re-type').value,
      scope: $('re-scope').value,
      paid_from: $('re-paid-from').value,
      category: $('re-category').value,
      description: $('re-description').value,
      frequency: $('re-frequency').value,
      start_date: $('re-due').value,
    };
    var reUnbusy = busy(btn);
    try {
      await postJson('/api/recurring/' + REC_EDITING_ID, reBody, 'PUT');
      REC_EDITING_ID = null;
      closeSheet('recurring-edit-overlay');
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      reUnbusy();
    }
    return;
  }
});
`;

  return (
    <Layout title="Wiederkehrende Zahlungen">
      <div
        id="toast"
        class="fixed bottom-24 left-1/2 z-[60] hidden -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg md:bottom-6"
      ></div>

      <main class="mx-auto max-w-6xl p-4 pb-28 sm:p-8 md:pb-8">
        <header class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold tracking-tight sm:text-2xl">🔁 Wiederkehrende Zahlungen</h1>
            <p class="hidden text-sm text-slate-500 sm:block">
              Hallo {userName}, hier sind die Regeln für „{householdName}“ – sie werden automatisch zum Fälligkeitsdatum gebucht.
            </p>
          </div>
          <a
            href="/dashboard"
            title="Zurück zum Dashboard"
            class="flex items-center gap-2 rounded-full bg-white py-1 pl-3 pr-1 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <span class="hidden text-sm font-medium text-slate-700 sm:inline">Dashboard</span>
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
          </a>
        </header>

        <section class="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div id="recurring-frag">
            <RecurringList rules={rules} />
          </div>

          <details class="mt-3 border-t border-slate-100 pt-2">
            <summary class="min-h-[40px] cursor-pointer select-none py-2 text-sm font-medium text-indigo-600">
              ➕ Wiederkehrende Zahlung anlegen
            </summary>
            <form id="recurring-form" class="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <label class="block">
                <span class={LABEL_CLASS}>Betrag</span>
                <input id="r-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Art</span>
                <select id="r-type" class={INPUT_CLASS}>
                  <option value="expense" selected>Ausgabe</option>
                  <option value="income">Einnahme</option>
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Bereich</span>
                <select id="r-scope" class={INPUT_CLASS}>
                  <option value="shared" selected>Gemeinsam</option>
                  <option value="personal">Persönlich</option>
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Konto</span>
                <select id="r-paid-from" class={INPUT_CLASS}>
                  <option value="joint" selected>Gemeinschaftskonto</option>
                  <option value="private">Privatkonto</option>
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Kategorie</span>
                <CategorySelect id="r-category" />
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Beschreibung</span>
                <input id="r-description" type="text" maxlength={200} placeholder="Beschreibung" class={INPUT_CLASS} />
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Rhythmus</span>
                <select id="r-frequency" class={INPUT_CLASS}>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option value={opt.value} selected={opt.value === 'monthly'}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Fällig am</span>
                <input id="r-due" type="date" value={today} required class={INPUT_CLASS} />
              </label>
              <button
                type="submit"
                class="min-h-[44px] self-end rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 sm:col-span-3 lg:col-span-4"
              >
                Regel speichern
              </button>
            </form>
          </details>
        </section>

        <RecurringEditOverlay />
      </main>

      {/* Mobile Bottom-Navigation */}
      <nav
        class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style="padding-bottom: env(safe-area-inset-bottom)"
      >
        <div class="grid grid-cols-3">
          <a href="/dashboard" class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-indigo-600">
            <span class="text-lg leading-none">🏠</span>
            Dashboard
          </a>
          <a href="/stats" class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-600">
            <span class="text-lg leading-none">📊</span>
            Statistik
          </a>
          <span class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-600">
            <span class="text-lg leading-none">🔁</span>
            Wiederkehrend
          </span>
        </div>
      </nav>

      <script dangerouslySetInnerHTML={{ __html: script }} />
    </Layout>
  );
};
