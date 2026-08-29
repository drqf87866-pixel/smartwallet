import type { FC } from 'hono/jsx';
import type { TransactionAccount, TransactionScope, TransactionType } from '../types';
import { Layout } from './layout';

export type DashboardTx = {
  id: number;
  created_by: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
  scope: TransactionScope;
  paid_from: TransactionAccount;
};

export type DebtRow = {
  otherId: number;
  other: string;
  kind: 'you-owe' | 'owed-to-you';
  amount: number;
};

type MemberInfo = { id: number; name: string };

/** Kopf-Karten + Aktions-Buttons – wird auch als Fragment ausgeliefert. */
export type SummaryCardsProps = {
  members: MemberInfo[];
  monthLabel: string;
  privateBalance: number;
  jointPot: { saldo: number; start: number; transfers: number };
  sharedMonth: { total: number; advanced: number };
  debts: DebtRow[];
  myContribution: number;
  contributionBooked: boolean;
};

/** Transaktionssektion (inkl. Monatsnavi & manuellem Formular) – Fragment. */
export type TxListProps = {
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  transactions: DashboardTx[];
  today: string;
};

export type DashboardProps = SummaryCardsProps & TxListProps & {
  userName: string;
  householdName: string;
  month: string;
};

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (n: number) => eur.format(n);
const dayFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
const fmtTime = (iso: string) => timeFmt.format(new Date(iso));

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const BADGE_STYLES = {
  joint: 'bg-indigo-50 text-indigo-600',
  advance: 'bg-amber-50 text-amber-600',
  personal: 'bg-slate-100 text-slate-500',
  transfer: 'bg-emerald-50 text-emerald-600',
  settlement: 'bg-amber-50 text-amber-600',
} as const;

function accountBadge(t: DashboardTx): { label: string; style: string } {
  if (t.type === 'transfer') {
    return t.category === 'Beitrag'
      ? { label: 'Beitrag', style: BADGE_STYLES.transfer }
      : { label: 'Überweisung', style: BADGE_STYLES.transfer };
  }
  if (t.type === 'settlement') return { label: 'Ausgleich', style: BADGE_STYLES.settlement };
  if (t.scope === 'personal') return { label: 'Privat', style: BADGE_STYLES.personal };
  if (t.paid_from === 'private') return { label: 'Vorschuss', style: BADGE_STYLES.advance };
  return { label: 'Gemeinschaft', style: BADGE_STYLES.joint };
}

const amountColor = (t: DashboardTx) =>
  t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-red-500' : 'text-slate-500';
const amountSign = (t: DashboardTx) =>
  t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↗ ';
const isEditable = (t: DashboardTx) => t.type !== 'settlement' && t.category !== 'Beitrag';

/* ------------------------------------------------------------------ */
/* Fragmente: SummaryCards + TxList                                    */
/* ------------------------------------------------------------------ */

export const SummaryCards: FC<SummaryCardsProps> = ({
  members,
  monthLabel,
  privateBalance,
  jointPot,
  sharedMonth,
  debts,
  myContribution,
  contributionBooked,
}) => (
  <>
    <section class="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-sm font-medium text-slate-500">Mein privater Saldo</h2>
        <p class={'mt-2 text-2xl font-bold sm:text-3xl ' + (privateBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {fmt(privateBalance)}
        </p>
        <p class="mt-1 text-xs text-slate-400">inkl. Beiträge & Ausgleichen</p>
      </article>

      <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-sm font-medium text-slate-500">Gemeinschaftskonto</h2>
        <p class={'mt-2 text-2xl font-bold sm:text-3xl ' + (jointPot.saldo >= 0 ? 'text-indigo-600' : 'text-red-600')}>
          {fmt(jointPot.saldo)}
        </p>
        <p class="mt-1 text-xs text-slate-400">
          Startstand {fmt(jointPot.start)} · Einzahlungen {fmt(jointPot.transfers)}
        </p>
      </article>

      <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-sm font-medium text-slate-500">Gemeinsame Ausgaben</h2>
        <p class="mt-2 text-2xl font-bold text-indigo-600 sm:text-3xl">{fmt(sharedMonth.total)}</p>
        <p class="mt-1 text-xs text-slate-400">
          davon {fmt(sharedMonth.advanced)} privat vorgestreckt · {monthLabel}
        </p>
      </article>

      <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-sm font-medium text-slate-500">Wer schuldet wem?</h2>
        {members.length < 2 ? (
          <p class="mt-2 text-xs text-slate-500">
            Du bist derzeit solo im Haushalt. Teile den Einladungscode (oben rechts unter deinem Namen → Einstellungen),
            um die gemeinsame Abrechnung zu starten.
          </p>
        ) : debts.length === 0 ? (
          <>
            <p class="mt-2 text-2xl font-bold text-emerald-600 sm:text-3xl">{fmt(0)}</p>
            <p class="mt-1 text-xs text-slate-400">Alles ausgeglichen 🎉</p>
          </>
        ) : (
          <ul class="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {debts.map((d) => (
              <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-2">
                <span class={d.kind === 'owed-to-you' ? 'text-emerald-700' : 'text-amber-700'}>
                  {d.kind === 'owed-to-you' ? `${d.other} → du` : `du → ${d.other}`}
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="font-semibold">{fmt(d.amount)}</span>
                  <button
                    type="button"
                    data-quick-settle
                    data-amount={d.amount.toFixed(2)}
                    data-from={d.kind === 'you-owe' ? 'me' : d.otherId}
                    data-to={d.kind === 'you-owe' ? d.otherId : 'me'}
                    class="min-h-[28px] rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"
                  >
                    begleichen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p class="mt-2 text-[10px] text-slate-400">
          laufend: private Vorschüsse 1/{members.length} umgelegt − Ausgleiche
        </p>
      </article>
    </section>

    <section class="mb-4 flex flex-wrap items-center gap-3">
      {myContribution > 0 && !contributionBooked ? (
        <button
          type="button"
          data-action="contribution"
          class="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          💰 Beitrag buchen ({fmt(myContribution)})
        </button>
      ) : null}
      <button
        type="button"
        data-action="open-settle"
        class="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        🤝 Ausgleichszahlung erfassen
      </button>
    </section>
  </>
);

const TxRow: FC<{ t: DashboardTx }> = ({ t }) => {
  const badge = accountBadge(t);
  const editable = isEditable(t);
  return (
    <tr class="border-b border-slate-100 last:border-0">
      <td class="whitespace-nowrap py-2.5 pr-3 text-slate-500">
        {fmtDay(t.date)}
        <span class="block text-xs text-slate-400">{fmtTime(t.date)}</span>
      </td>
      <td class="py-2.5 pr-3">
        <span class="font-medium text-slate-700">{t.description || t.category}</span>
        <span class="ml-2 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {t.category}
        </span>
      </td>
      <td class="py-2.5 pr-3 text-slate-500">{t.created_by}</td>
      <td class="py-2.5 pr-3">
        <span class={'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ' + badge.style}>
          {badge.label}
        </span>
      </td>
      <td class={'whitespace-nowrap py-2.5 text-right font-semibold ' + amountColor(t)}>
        {amountSign(t)}
        {fmt(t.amount)}
      </td>
      <td class="whitespace-nowrap py-2.5 pl-3 text-right">
        {editable ? (
          <>
            <button
              type="button"
              data-edit
              data-tx={JSON.stringify(t)}
              title="Bearbeiten"
              class="h-8 w-8 rounded border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
            >
              ✏️
            </button>
            <button
              type="button"
              data-delete={t.id}
              title="Löschen"
              class="ml-1.5 h-8 w-8 rounded border border-red-200 bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              🗑
            </button>
          </>
        ) : null}
      </td>
    </tr>
  );
};

const TxCard: FC<{ t: DashboardTx }> = ({ t }) => {
  const badge = accountBadge(t);
  const editable = isEditable(t);
  return (
    <li class="flex items-start justify-between gap-3 py-3">
      <div class="min-w-0">
        <p class="truncate font-medium text-slate-700">{t.description || t.category}</p>
        <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span>
            {fmtDay(t.date)} · {fmtTime(t.date)} · {t.created_by}
          </span>
          <span class={'rounded-full px-2 py-0.5 font-medium ' + badge.style}>{badge.label}</span>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{t.category}</span>
        </p>
      </div>
      <div class="flex flex-col items-end gap-1.5">
        <span class={'whitespace-nowrap font-semibold ' + amountColor(t)}>
          {amountSign(t)}
          {fmt(t.amount)}
        </span>
        {editable ? (
          <span class="flex gap-1.5">
            <button
              type="button"
              data-edit
              data-tx={JSON.stringify(t)}
              title="Bearbeiten"
              aria-label="Bearbeiten"
              class="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-600"
            >
              ✏️
            </button>
            <button
              type="button"
              data-delete={t.id}
              title="Löschen"
              aria-label="Löschen"
              class="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-600"
            >
              🗑
            </button>
          </span>
        ) : null}
      </div>
    </li>
  );
};

/**
 * Transaktionssektion. `layout` steuert, welche Repräsentation gerendert
 * wird: undefined (ganzseitige Ansicht) rendert beide (CSS-gesteuert),
 * 'mobile'/'desktop' nur eine – für das List-Fragment, das der Client mit
 * passendem Layout-Parameter anfordert.
 */
export const TxList: FC<TxListProps & { layout?: 'mobile' | 'desktop' }> = ({
  monthLabel,
  prevMonth,
  nextMonth,
  transactions,
  today,
  layout,
}) => (
  <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-medium text-slate-500">Transaktionen · {monthLabel}</h2>
      <nav class="flex items-center gap-2 text-sm">
        <a
          href={'/dashboard?month=' + prevMonth}
          title="Voriger Monat"
          class="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-lg text-slate-600 hover:bg-slate-50"
        >
          ‹
        </a>
        <a
          href={'/dashboard?month=' + nextMonth}
          title="Nächster Monat"
          class="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-lg text-slate-600 hover:bg-slate-50"
        >
          ›
        </a>
      </nav>
    </div>

    <details class="mb-4">
      <summary class="min-h-[44px] cursor-pointer select-none py-2 text-sm font-medium text-indigo-600">
        ➕ Eintrag manuell hinzufügen
      </summary>
      <form id="manual-form" class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <input id="m-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
        <select id="m-type" class={INPUT_CLASS}>
          <option value="expense" selected>Ausgabe</option>
          <option value="income">Einnahme</option>
        </select>
        <select id="m-scope" class={INPUT_CLASS}>
          <option value="shared" selected>Gemeinsam</option>
          <option value="personal">Persönlich</option>
        </select>
        <select id="m-paid-from" class={INPUT_CLASS}>
          <option value="joint" selected>Gemeinschaftskonto</option>
          <option value="private">Privatkonto</option>
        </select>
        <input id="m-category" type="text" maxlength={50} placeholder="Kategorie" class={INPUT_CLASS} />
        <input id="m-description" type="text" maxlength={200} placeholder="Beschreibung" class={INPUT_CLASS} />
        <input id="m-date" type="date" value={today} class={INPUT_CLASS} />
        <button
          type="submit"
          class="min-h-[44px] rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 sm:col-span-3 lg:col-span-7"
        >
          Speichern
        </button>
      </form>
    </details>

    {transactions.length === 0 ? (
      <p class="py-8 text-center text-sm text-slate-400">Noch keine Transaktionen in diesem Monat.</p>
    ) : (
      <>
        {/* Mobile: Kartenliste */}
        {layout !== 'desktop' ? (
          <ul class="divide-y divide-slate-100 md:hidden">
            {transactions.map((t) => (
              <TxCard t={t} />
            ))}
          </ul>
        ) : null}
        {/* Desktop: Tabelle */}
        {layout !== 'mobile' ? (
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th class="py-2 pr-3 font-medium">Datum</th>
                  <th class="py-2 pr-3 font-medium">Beschreibung</th>
                  <th class="py-2 pr-3 font-medium">Von</th>
                  <th class="py-2 pr-3 font-medium">Konto</th>
                  <th class="py-2 text-right font-medium">Betrag</th>
                  <th class="py-2 pl-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <TxRow t={t} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </>
    )}
  </section>
);

/* ------------------------------------------------------------------ */
/* Client-Script: Event-Delegation + Fragment-Refresh                  */
/* ------------------------------------------------------------------ */

const PILL_ACTIVE = 'rounded-full px-3 py-2 text-xs font-medium bg-indigo-600 text-white';
const PILL_IDLE = 'rounded-full px-3 py-2 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200';

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

// Partial Updates: nach Aktionen nur die betroffenen Bereiche tauschen
async function fetchFragment(url) {
  var res = await fetch(url, { headers: { 'X-Fragments': '1' } });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Sitzung abgelaufen');
  }
  if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen');
  return res.text();
}

async function refreshDashboard() {
  var month = window.__MONTH;
  if (!month || !$('summary-frag') || !$('tx-frag')) return false;
  var parts = await Promise.all([
    fetchFragment('/dashboard/fragments/summary?month=' + month),
    fetchFragment('/dashboard/fragments/list?month=' + month +
      '&layout=' + (window.matchMedia('(min-width: 768px)').matches ? 'desktop' : 'mobile')),
  ]);
  $('summary-frag').innerHTML = parts[0];
  $('tx-frag').innerHTML = parts[1];
  return true;
}

async function afterMutation() {
  try {
    await refreshDashboard();
  } catch (err) {
    window.location.reload();
  }
}

function busy(btn, text) {
  if (!btn) return function () {};
  var orig = btn.textContent;
  btn.disabled = true;
  if (text) btn.textContent = text;
  return function () { btn.disabled = false; btn.textContent = orig; };
}

// --- Sheets: unten (mobil) bzw. mittig (Desktop) ---
function openSheet(id) {
  $(id).classList.remove('hidden');
}
function closeSheet(id) {
  $(id).classList.add('hidden');
}
function openMagic() {
  document.body.classList.add('magic-open');
  $('magic-backdrop').classList.remove('hidden');
  setTimeout(function () { $('magic-text').focus(); }, 150);
}
function closeMagic() {
  document.body.classList.remove('magic-open');
  $('magic-backdrop').classList.add('hidden');
}

// --- Ausgleichsformular: Empfänger-Auswahl ohne den Zahlenden ---
function rebuildRecipientOptions() {
  var from = $('s-from').value;
  var to = $('s-to');
  var current = to.value;
  to.innerHTML = '';
  var options = JSON.parse(to.getAttribute('data-members'));
  options.forEach(function (m) {
    if (String(m.id) === from) return;
    var opt = document.createElement('option');
    opt.value = String(m.id) === 'me' ? 'me' : m.id;
    opt.textContent = m.name;
    to.appendChild(opt);
  });
  var stillThere = Array.prototype.some.call(to.options, function (o) { return o.value === current; });
  if (stillThere) to.value = current;
}
rebuildRecipientOptions();

// --- Transaktion bearbeiten ---
var EDITING_ID = null;
var EDITING_TIME = '';

function openEditModal(tx) {
  EDITING_ID = tx.id;
  EDITING_TIME = String(tx.date).slice(10); // Uhrzeit erhalten, nur Datum ist editierbar
  $('e-amount').value = tx.amount;
  $('e-type').value = tx.type;
  $('e-scope').value = tx.scope;
  $('e-paid-from').value = tx.paid_from;
  $('e-category').value = tx.category;
  $('e-description').value = tx.description;
  $('e-date').value = String(tx.date).slice(0, 10);
  openSheet('edit-overlay');
  setTimeout(function () { $('e-amount').focus(); }, 150);
}

// --- Klick-Delegation (funktioniert auch nach Fragment-Swap) ---
document.addEventListener('click', async function (e) {
  var pill = e.target.closest('[data-paid-from]');
  if (pill) {
    MAGIC_PAID_FROM = pill.getAttribute('data-paid-from');
    document.querySelectorAll('[data-paid-from]').forEach(function (p) {
      var active = p === pill;
      p.className = active
        ? ${JSON.stringify(PILL_ACTIVE)}
        : ${JSON.stringify(PILL_IDLE)};
    });
    return;
  }

  var action = e.target.closest('[data-action]');
  if (action) {
    var name = action.getAttribute('data-action');
    if (name === 'open-magic') { openMagic(); return; }
    if (name === 'close-magic') { closeMagic(); return; }
    if (name === 'open-settle') {
      openSheet('settlement-overlay');
      setTimeout(function () { $('s-amount').focus(); }, 150);
      return;
    }
    if (name === 'contribution') {
      var unbusy = busy(action);
      try {
        await postJson('/api/contribution', {});
        await afterMutation();
      } catch (err) {
        showToast(err.message, 'info');
        unbusy();
      }
      return;
    }
  }

  var closer = e.target.closest('[data-close]');
  if (closer) { closeSheet(closer.getAttribute('data-close')); return; }

  var quick = e.target.closest('[data-quick-settle]');
  if (quick) {
    $('s-amount').value = quick.getAttribute('data-amount');
    $('s-from').value = quick.getAttribute('data-from');
rebuildRecipientOptions();

// --- Delegation: Zahlungsänderung baut Empfängerliste neu auf ---
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 's-from') rebuildRecipientOptions();
});
    $('s-to').value = quick.getAttribute('data-to');
    openSheet('settlement-overlay');
    setTimeout(function () { $('s-amount').focus(); }, 150);
    return;
  }

  var editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    openEditModal(JSON.parse(editBtn.getAttribute('data-tx')));
    return;
  }

  var delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    if (!confirm('Diese Transaktion wirklich löschen?')) return;
    try {
      await postJson('/api/transactions/' + delBtn.getAttribute('data-delete'), {}, 'DELETE');
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeSheet('settlement-overlay');
    closeSheet('edit-overlay');
    closeMagic();
  }
});

// --- Submit-Delegation für alle Formulare ---
document.addEventListener('submit', async function (e) {
  var form = e.target;
  var btn = form.querySelector('button[type="submit"]');

  if (form.id === 'magic-form') {
    e.preventDefault();
    var input = $('magic-text');
    var text = input.value.trim();
    if (!text) return;
    var unbusy = busy(btn, 'Denkt nach …');
    try {
      await postJson('/api/magic-entry', { text: text, paid_from: MAGIC_PAID_FROM });
      input.value = '';
      closeMagic();
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      unbusy();
    }
    return;
  }

  if (form.id === 'manual-form') {
    e.preventDefault();
    var amount = parseFloat($('m-amount').value);
    if (!amount || amount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben', 'error');
      return;
    }
    var body = {
      amount: amount,
      type: $('m-type').value,
      scope: $('m-scope').value,
      paid_from: $('m-paid-from').value,
      category: $('m-category').value,
      description: $('m-description').value,
    };
    var date = $('m-date').value;
    if (date) body.date = date;
    var unbusy = busy(btn);
    try {
      await postJson('/api/transactions', body);
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      unbusy();
    }
    return;
  }

  if (form.id === 'settlement-form') {
    e.preventDefault();
    var amount = parseFloat($('s-amount').value);
    if (!amount || amount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben', 'error');
      return;
    }
    var unbusy = busy(btn);
    try {
      await postJson('/api/settlements', {
        amount: amount,
        from: $('s-from').value,
        to: $('s-to').value,
      });
      closeSheet('settlement-overlay');
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      unbusy();
    }
    return;
  }

  if (form.id === 'edit-form') {
    e.preventDefault();
    if (!EDITING_ID) return;
    var amount = parseFloat($('e-amount').value);
    if (!amount || amount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben', 'error');
      return;
    }
    var body = {
      amount: amount,
      type: $('e-type').value,
      scope: $('e-scope').value,
      paid_from: $('e-paid-from').value,
      category: $('e-category').value,
      description: $('e-description').value,
    };
    var date = $('e-date').value;
    if (date) body.date = date + EDITING_TIME;
    var unbusy = busy(btn);
    try {
      await postJson('/api/transactions/' + EDITING_ID, body, 'PUT');
      EDITING_ID = null;
      closeSheet('edit-overlay');
      await afterMutation();
    } catch (err) {
      showToast(err.message, 'error');
      unbusy();
    }
    return;
  }
});
`;

const magicSheetCss = `
@media (max-width: 767px) {
  #magic-section {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    margin: 0;
    transform: translateY(110%);
    transition: transform 0.22s ease-out;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 -8px 30px rgba(15, 23, 42, 0.25);
  }
  body.magic-open #magic-section {
    transform: translateY(0);
  }
}
`;

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export const DashboardView: FC<DashboardProps> = ({
  userName,
  householdName,
  members,
  month,
  monthLabel,
  prevMonth,
  nextMonth,
  privateBalance,
  jointPot,
  sharedMonth,
  debts,
  myContribution,
  contributionBooked,
  transactions,
  today,
}) => {
  const others = members.filter((m) => m.name !== userName);
  const recipientOptions: { id: number | 'me' | 'joint'; name: string }[] = [
    { id: 'me', name: `${userName} (du)` },
    ...others,
    { id: 'joint', name: '🏦 Gemeinschaftskonto' },
  ];
  const payerOptions: { id: number | 'me'; name: string }[] = [{ id: 'me', name: 'Ich' }, ...others];

  return (
    <Layout title="Dashboard">
      <div
        id="toast"
        class="fixed bottom-24 left-1/2 z-[60] hidden -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg md:bottom-6"
      ></div>

      <main class="mx-auto max-w-6xl p-4 pb-28 sm:p-8 md:pb-8">
        <header class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold tracking-tight sm:text-2xl">💳 SmartWallet</h1>
            <p class="hidden text-sm text-slate-500 sm:block">
              Hallo {userName}, hier ist der Überblick für „{householdName}“.
            </p>
          </div>
          <a
            href="/settings"
            title="Einstellungen"
            class="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span class="hidden text-sm font-medium text-slate-700 sm:inline">{userName}</span>
          </a>
        </header>

        <div id="summary-frag">
          <SummaryCards
            members={members}
            monthLabel={monthLabel}
            privateBalance={privateBalance}
            jointPot={jointPot}
            sharedMonth={sharedMonth}
            debts={debts}
            myContribution={myContribution}
            contributionBooked={contributionBooked}
          />
        </div>

        <div id="magic-backdrop" data-action="close-magic" class="fixed inset-0 z-40 hidden bg-slate-900/40 md:hidden"></div>

        <section id="magic-section" class="safe-bottom mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-medium text-slate-500">✨ Magic Input</h2>
              <p class="mt-1 text-xs text-slate-400">
                Einfach eintippen, was ausgegeben wurde – die KI erkennt Betrag, Kategorie, ob es gemeinsam war und mit welchem Konto bezahlt wurde.
              </p>
            </div>
            <button
              type="button"
              data-action="close-magic"
              aria-label="Schließen"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 md:hidden"
            >
              ✕
            </button>
          </div>
          <form id="magic-form" class="flex flex-col gap-2 sm:flex-row">
            <input
              id="magic-text"
              type="text"
              maxlength={500}
              placeholder='z. B. "Ich war für 45 Euro tanken" oder "Wir waren für 60 Euro essen"'
              class={'flex-1 ' + INPUT_CLASS}
            />
            <button
              id="magic-btn"
              type="submit"
              class="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              ✨ Hinzufügen
            </button>
          </form>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-xs text-slate-400">Konto:</span>
            <button type="button" data-paid-from="auto" class={PILL_ACTIVE}>
              Automatisch (KI)
            </button>
            <button type="button" data-paid-from="joint" class={PILL_IDLE}>
              Gemeinschaftskarte
            </button>
            <button type="button" data-paid-from="private" class={PILL_IDLE}>
              Meine Karte / Bar
            </button>
          </div>
        </section>

        <div id="settlement-overlay" class="fixed inset-0 z-50 hidden">
          <div class="absolute inset-0 bg-slate-900/40" data-close="settlement-overlay"></div>
          <div
            class="safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[36rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          >
            <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden"></div>
            <div class="mb-3 flex items-start justify-between">
              <h2 class="text-sm font-medium text-slate-500">🤝 Ausgleichszahlung</h2>
              <button
                type="button"
                data-close="settlement-overlay"
                aria-label="Schließen"
                class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                ✕
              </button>
            </div>
            <form id="settlement-form" class="grid items-end gap-3 sm:grid-cols-4">
              <div>
                <label for="s-from" class="mb-1 block text-xs text-slate-500">Zahlender</label>
                <select
                  id="s-from"
                  class={INPUT_CLASS}
                  data-members={JSON.stringify(payerOptions)}
                >
                  {payerOptions.map((m) => (
                    <option value={m.id === 'me' ? 'me' : m.id} selected={m.id === 'me'}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label for="s-to" class="mb-1 block text-xs text-slate-500">Empfänger</label>
                <select
                  id="s-to"
                  class={INPUT_CLASS}
                  data-members={JSON.stringify(recipientOptions)}
                ></select>
              </div>
              <div>
                <label for="s-amount" class="mb-1 block text-xs text-slate-500">Betrag (€)</label>
                <input id="s-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="z. B. 30" class={INPUT_CLASS} />
              </div>
              <button type="submit" class="min-h-[44px] rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900">
                Ausgleich buchen
              </button>
            </form>
          </div>
        </div>

        <div id="edit-overlay" class="fixed inset-0 z-50 hidden">
          <div class="absolute inset-0 bg-slate-900/40" data-close="edit-overlay"></div>
          <div
            class="safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[42rem] sm:max-w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          >
            <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden"></div>
            <div class="mb-3 flex items-start justify-between">
              <h2 class="text-sm font-medium text-slate-500">✏️ Transaktion bearbeiten</h2>
              <button
                type="button"
                data-close="edit-overlay"
                aria-label="Schließen"
                class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                ✕
              </button>
            </div>
            <form id="edit-form" class="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <input id="e-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
              <select id="e-type" class={INPUT_CLASS}>
                <option value="expense">Ausgabe</option>
                <option value="income">Einnahme</option>
                <option value="transfer">Überweisung</option>
              </select>
              <select id="e-scope" class={INPUT_CLASS}>
                <option value="shared">Gemeinsam</option>
                <option value="personal">Persönlich</option>
              </select>
              <select id="e-paid-from" class={INPUT_CLASS}>
                <option value="joint">Gemeinschaftskonto</option>
                <option value="private">Privatkonto</option>
              </select>
              <input id="e-category" type="text" maxlength={50} placeholder="Kategorie" class={INPUT_CLASS} />
              <input id="e-description" type="text" maxlength={200} placeholder="Beschreibung" class={INPUT_CLASS} />
              <input id="e-date" type="date" class={INPUT_CLASS} />
              <div class="flex gap-2 sm:col-span-3 lg:col-span-7">
                <button type="submit" class="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                  Änderungen speichern
                </button>
                <button
                  type="button"
                  data-close="edit-overlay"
                  class="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>

        <div id="tx-frag">
          <TxList monthLabel={monthLabel} prevMonth={prevMonth} nextMonth={nextMonth} transactions={transactions} today={today} />
        </div>

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
          <button
            type="button"
            data-action="open-magic"
            class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-600"
          >
            <span class="text-lg leading-none">✨</span>
            Hinzufügen
          </button>
          <a href="/settings" class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-600">
            <span class="text-lg leading-none">⚙️</span>
            Einstellungen
          </a>
        </div>
      </nav>

      <script dangerouslySetInnerHTML={{ __html: 'window.__MONTH = "' + month + '";' }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <style dangerouslySetInnerHTML={{ __html: magicSheetCss }} />
    </Layout>
  );
};
