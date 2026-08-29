import type { FC } from 'hono/jsx';
import type { TransactionAccount, TransactionScope, TransactionType } from '../types';
import { Layout } from './layout';
import { BottomNav, CategorySelect, INPUT_CLASS, LABEL_CLASS, MagicSheet, UserChip } from './shared';
import { fmt, fmtDay, fmtTime } from '../lib/format';

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
  recurring_id: number | null;
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
  /** Anzahl wiederkehrender Regeln – Label des Einstiegs-Buttons auf die /recurring-Seite. */
  recurringCount: number;
};

const BADGE_STYLES = {
  joint: 'bg-indigo-50 text-indigo-600',
  advance: 'bg-amber-50 text-amber-700',
  personal: 'bg-slate-100 text-slate-500',
  transfer: 'bg-emerald-50 text-emerald-700',
  settlement: 'bg-amber-50 text-amber-700',
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
  t.type === 'income' ? 'text-emerald-700' : t.type === 'expense' ? 'text-red-600' : 'text-slate-500';
const amountSign = (t: DashboardTx) =>
  t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↗ ';
const isEditable = (t: DashboardTx) => t.type !== 'settlement' && t.category !== 'Beitrag';

/** Schulden-Zeilen inkl. begleichen-Button – von Mobile- und Desktop-Ansicht geteilt. */
const DebtRows: FC<{ debts: DebtRow[] }> = ({ debts }) => (
  <>
    {debts.map((d) => (
      <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
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
            class="min-h-[36px] rounded border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
          >
            begleichen
          </button>
        </span>
      </li>
    ))}
  </>
);

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
}) => {
  return (
    <>
      {/* Mobile: eine kompakte Karte, 3 Werte nebeneinander */}
      <section class="mb-4 md:hidden">
        <article class="card">
          <div class="grid grid-cols-3 divide-x divide-slate-200 text-center">
            <div class="px-1">
              <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Privat</p>
              <p
                class={
                  'mt-1 text-lg font-bold tabular-nums ' +
                  (privateBalance >= 0 ? 'text-emerald-700' : 'text-red-600')
                }
              >
                {fmt(privateBalance)}
              </p>
            </div>
            <div class="px-1">
              <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Gemeinsam</p>
              <p
                class={
                  'mt-1 text-lg font-bold tabular-nums ' +
                  (jointPot.saldo >= 0 ? 'text-indigo-600' : 'text-red-600')
                }
              >
                {fmt(jointPot.saldo)}
              </p>
            </div>
            <div class="px-1">
              <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Ausgaben</p>
              <p class="mt-1 text-lg font-bold tabular-nums text-indigo-600">{fmt(sharedMonth.total)}</p>
            </div>
          </div>
          <p class="mt-2 text-center text-[11px] leading-tight text-slate-500">
            Start {fmt(jointPot.start)} · eingezahlt {fmt(jointPot.transfers)} ·{' '}
            {fmt(sharedMonth.advanced)} vorgestreckt · {monthLabel}
          </p>

          {members.length < 2 ? (
            <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
              Du bist solo im Haushalt. Einladungscode: oben rechts auf dein Profilbild → Einstellungen.
            </p>
          ) : debts.length === 0 ? (
            <p class="mt-3 text-center text-xs font-medium text-emerald-700">
              Alles ausgeglichen <span aria-hidden="true">🎉</span>
            </p>
          ) : (
            <details class="group mt-3 border-t border-slate-100 pt-1">
              <summary class="flex min-h-[44px] cursor-pointer select-none list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span class="text-xs font-medium text-slate-500">Offene Positionen ({debts.length})</span>
                <span class="text-slate-500 transition group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <ul class="space-y-1.5 pb-1 text-xs">
                <DebtRows debts={debts} />
              </ul>
              <p class="mt-1 text-[10px] text-slate-500">
                laufend: private Vorschüsse 1/{members.length} umgelegt − Ausgleiche
              </p>
            </details>
          )}
        </article>
      </section>

      {/* Desktop: Kachel-Grid */}
      <section class="mb-8 hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        <article class="card">
          <h2 class="text-sm font-medium text-slate-500">Mein privater Saldo</h2>
          <p class={'mt-2 text-2xl font-bold tabular-nums sm:text-3xl ' + (privateBalance >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            {fmt(privateBalance)}
          </p>
          <p class="mt-1 text-xs text-slate-500">inkl. Beiträge & Ausgleichen</p>
        </article>

        <article class="card">
          <h2 class="text-sm font-medium text-slate-500">Gemeinschaftskonto</h2>
          <p class={'mt-2 text-2xl font-bold tabular-nums sm:text-3xl ' + (jointPot.saldo >= 0 ? 'text-indigo-600' : 'text-red-600')}>
            {fmt(jointPot.saldo)}
          </p>
          <p class="mt-1 text-xs text-slate-500">
            Startstand {fmt(jointPot.start)} · Einzahlungen {fmt(jointPot.transfers)}
          </p>
        </article>

        <article class="card">
          <h2 class="text-sm font-medium text-slate-500">Gemeinsame Ausgaben</h2>
          <p class="mt-2 text-2xl font-bold tabular-nums text-indigo-600 sm:text-3xl">{fmt(sharedMonth.total)}</p>
          <p class="mt-1 text-xs text-slate-500">
            davon {fmt(sharedMonth.advanced)} privat vorgestreckt · {monthLabel}
          </p>
        </article>

        <article class="card">
          <h2 class="text-sm font-medium text-slate-500">Wer schuldet wem?</h2>
          {members.length < 2 ? (
            <p class="mt-2 text-xs text-slate-500">
              Du bist derzeit solo im Haushalt. Teile den Einladungscode (oben rechts unter deinem Namen → Einstellungen),
              um die gemeinsame Abrechnung zu starten.
            </p>
          ) : debts.length === 0 ? (
            <>
              <p class="mt-2 text-2xl font-bold tabular-nums text-emerald-700 sm:text-3xl">{fmt(0)}</p>
              <p class="mt-1 text-xs text-slate-500">
                Alles ausgeglichen <span aria-hidden="true">🎉</span>
              </p>
            </>
          ) : (
            <ul class="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
              <DebtRows debts={debts} />
            </ul>
          )}
          <p class="mt-2 text-[10px] text-slate-500">
            laufend: private Vorschüsse 1/{members.length} umgelegt − Ausgleiche
          </p>
        </article>
      </section>

      <section class="mb-4 flex flex-wrap items-center gap-3">
        {myContribution > 0 && !contributionBooked ? (
          <button
            type="button"
            data-action="contribution"
            class="btn-primary bg-emerald-600 hover:bg-emerald-700"
          >
            <span aria-hidden="true">💰</span> Beitrag buchen ({fmt(myContribution)})
          </button>
        ) : null}
        <button type="button" data-action="open-settle" class="btn-secondary">
          <span aria-hidden="true">🤝</span> Ausgleichszahlung erfassen
        </button>
      </section>
    </>
  );
};

const TxRow: FC<{ t: DashboardTx }> = ({ t }) => {
  const badge = accountBadge(t);
  const editable = isEditable(t);
  return (
    <tr class="border-b border-slate-100 last:border-0">
      <td class="whitespace-nowrap py-2.5 pr-3 text-slate-500">
        {fmtDay(t.date)}
        <span class="block text-xs text-slate-500">{fmtTime(t.date)}</span>
      </td>
      <td class="py-2.5 pr-3">
        <span class="font-medium text-slate-700">{t.description || t.category}</span>
        <span class="ml-2 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {t.category}
        </span>
        {t.recurring_id ? (
          <span
            class="ml-1 whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600"
            title="Wiederkehrende Zahlung"
          >
            <span aria-hidden="true">🔁</span>
            <span class="sr-only">Wiederkehrende Zahlung</span>
          </span>
        ) : null}
      </td>
      <td class="py-2.5 pr-3 text-slate-500">{t.created_by}</td>
      <td class="py-2.5 pr-3">
        <span class={'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ' + badge.style}>
          {badge.label}
        </span>
      </td>
      <td class={'whitespace-nowrap py-2.5 text-right font-semibold tabular-nums ' + amountColor(t)}>
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
              aria-label="Transaktion bearbeiten"
              class="h-8 w-8 rounded border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
            >
              <span aria-hidden="true">✏️</span>
            </button>
            <button
              type="button"
              data-delete={t.id}
              title="Löschen"
              aria-label="Transaktion löschen"
              class="ml-1.5 h-8 w-8 rounded border border-red-200 bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              <span aria-hidden="true">🗑</span>
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
        <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>
            {fmtDay(t.date)} · {fmtTime(t.date)} · {t.created_by}
          </span>
          <span class={'rounded-full px-2 py-0.5 font-medium ' + badge.style}>{badge.label}</span>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{t.category}</span>
          {t.recurring_id ? (
            <span
              class="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-600"
              title="Wiederkehrende Zahlung"
            >
              <span aria-hidden="true">🔁</span>
              <span class="sr-only">Wiederkehrende Zahlung</span>
            </span>
          ) : null}
        </p>
      </div>
      <div class="flex flex-col items-end gap-1.5">
        <span class={'whitespace-nowrap font-semibold tabular-nums ' + amountColor(t)}>
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
              aria-label="Transaktion bearbeiten"
              class="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-600"
            >
              <span aria-hidden="true">✏️</span>
            </button>
            <button
              type="button"
              data-delete={t.id}
              title="Löschen"
              aria-label="Transaktion löschen"
              class="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-600"
            >
              <span aria-hidden="true">🗑</span>
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
  <section class="card">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-medium text-slate-500">Transaktionen · {monthLabel}</h2>
      <nav class="flex items-center gap-2 text-sm" aria-label="Monatsnavigation">
        <a
          href={'/dashboard?month=' + prevMonth}
          title="Voriger Monat"
          aria-label="Voriger Monat"
          class="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span aria-hidden="true">‹</span>
        </a>
        <a
          href={'/dashboard?month=' + nextMonth}
          title="Nächster Monat"
          aria-label="Nächster Monat"
          class="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span aria-hidden="true">›</span>
        </a>
      </nav>
    </div>

    <details class="mb-4">
      <summary class="min-h-[44px] cursor-pointer select-none list-none py-2 text-sm font-medium text-indigo-600 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">➕</span> Eintrag manuell hinzufügen
      </summary>
      <form id="manual-form" class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <label class="block">
          <span class={LABEL_CLASS}>Betrag</span>
          <input id="m-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Beschreibung</span>
          <input id="m-description" type="text" maxlength={200} placeholder="Beschreibung" autocomplete="off" class={INPUT_CLASS} />
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Art</span>
          <select id="m-type" class={INPUT_CLASS}>
            <option value="expense" selected>Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Bereich</span>
          <select id="m-scope" class={INPUT_CLASS}>
            <option value="shared" selected>Gemeinsam</option>
            <option value="personal">Persönlich</option>
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Konto</span>
          <select id="m-paid-from" class={INPUT_CLASS}>
            <option value="joint" selected>Gemeinschaftskonto</option>
            <option value="private">Privatkonto</option>
          </select>
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Kategorie</span>
          <CategorySelect id="m-category" />
        </label>
        <label class="block">
          <span class={LABEL_CLASS}>Datum</span>
          <input id="m-date" type="date" value={today} autocomplete="off" class={INPUT_CLASS} />
        </label>
        <button type="submit" class="btn-primary self-end sm:col-span-3 lg:col-span-4">
          Speichern
        </button>
      </form>
    </details>

    {transactions.length === 0 ? (
      <p class="py-8 text-center text-sm text-slate-500">Noch keine Transaktionen in diesem Monat.</p>
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
              <caption class="sr-only">Transaktionen im {monthLabel}</caption>
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" class="py-2 pr-3 font-medium">Datum</th>
                  <th scope="col" class="py-2 pr-3 font-medium">Beschreibung</th>
                  <th scope="col" class="py-2 pr-3 font-medium">Von</th>
                  <th scope="col" class="py-2 pr-3 font-medium">Konto</th>
                  <th scope="col" class="py-2 text-right font-medium">Betrag</th>
                  <th scope="col" class="py-2 pl-3 text-right font-medium">Aktionen</th>
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
/* (geteilte Helfer: /assets/app.js)                                   */
/* ------------------------------------------------------------------ */

const script = `
// app.js wird mit defer geladen; Init-Logik daher in die __swInit-Queue
window.__swInit = window.__swInit || [];
window.__swInit.push(function () {
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
  syncCategoryOptions('e-', tx.category);
  $('e-description').value = tx.description;
  $('e-date').value = String(tx.date).slice(0, 10);
  openSheet('edit-overlay');
  setTimeout(function () { $('e-amount').focus(); }, 150);
}

// --- Kategorie-Dropdowns initial befüllen (nach Fragment-Swaps erneut) ---
function syncAllCategoryOptions() {
  ['m-', 'e-'].forEach(function (prefix) {
    syncCategoryOptions(prefix, '');
  });
}

// Zentrale change-Delegation: Art-Wechsel baut Kategorie-Optionen neu auf,
// Zahlungsänderung baut Empfängerliste neu auf.
document.addEventListener('change', function (e) {
  if (!e.target) return;
  if (e.target.id === 's-from') rebuildRecipientOptions();
  if (/^(m|e)-type$/.test(e.target.id)) {
    var prefix = e.target.id.slice(0, e.target.id.indexOf('type'));
    syncCategoryOptions(prefix, '');
  }
});

syncAllCategoryOptions();

// --- Partial Updates: nach Aktionen nur die betroffenen Bereiche tauschen ---
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
  syncAllCategoryOptions();
  return true;
}

// Magic-Sheet (shared.tsx) nutzt denselben Refresh-Pfad ohne Reload
window.__afterMutation = function () {
  return afterMutation(refreshDashboard);
};

// --- Klick-Delegation (funktioniert auch nach Fragment-Swap) ---
document.addEventListener('click', async function (e) {
  var action = e.target.closest('[data-action]');
  if (action) {
    var name = action.getAttribute('data-action');
    if (name === 'open-settle') {
      openSheet('settlement-overlay');
      setTimeout(function () { $('s-amount').focus(); }, 150);
      return;
    }
    if (name === 'contribution') {
      var unbusy = busy(action);
      try {
        await postJson('/api/contribution', {});
        await afterMutation(refreshDashboard);
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
      await afterMutation(refreshDashboard);
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

  if (form.id === 'manual-form') {
    e.preventDefault();
    var amount = validAmount($('m-amount'));
    if (!amount) return;
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
      await afterMutation(refreshDashboard);
    } catch (err) {
      showToast(err.message, 'error');
      unbusy();
    }
    return;
  }

  if (form.id === 'settlement-form') {
    e.preventDefault();
    var amount = validAmount($('s-amount'));
    if (!amount) return;
    var unbusy = busy(btn);
    try {
      await postJson('/api/settlements', {
        amount: amount,
        from: $('s-from').value,
        to: $('s-to').value,
      });
      closeSheet('settlement-overlay');
      await afterMutation(refreshDashboard);
    } catch (err) {
      showToast(err.message, 'error');
      unbusy();
    }
    return;
  }

  if (form.id === 'edit-form') {
    e.preventDefault();
    if (!EDITING_ID) return;
    var amount = validAmount($('e-amount'));
    if (!amount) return;
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
      await afterMutation(refreshDashboard);
    } catch (err) {
      showToast(err.message, 'error');
      unbusy();
    }
    return;
  }
});
});
`;

/* ------------------------------------------------------------------ */
/* View                                                                */
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
  recurringCount,
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
      <main class="mx-auto max-w-6xl p-4 pb-28 sm:p-8 md:pb-8">
        <header class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold tracking-tight sm:text-2xl">
              <span aria-hidden="true">💳</span> SmartWallet
            </h1>
            <p class="hidden text-sm text-slate-500 sm:block">
              Hallo {userName}, hier ist der Überblick für „{householdName}“.
            </p>
          </div>
          <div class="flex items-center gap-3">
            <nav class="hidden items-center gap-1 text-sm md:flex" aria-label="Hauptnavigation">
              <a href="/dashboard" aria-current="page" class="rounded-full px-3 py-1.5 font-medium text-slate-600 hover:bg-white/70">Dashboard</a>
              <a href={'/stats?month=' + month} class="rounded-full px-3 py-1.5 font-medium text-slate-600 hover:bg-white/70">Statistik</a>
              <a
                href="/recurring"
                title="Wiederkehrende Zahlungen verwalten"
                class="rounded-full bg-indigo-50 px-3 py-1.5 font-medium text-indigo-600 transition hover:bg-indigo-100"
              >
                <span aria-hidden="true">🔁</span> Wiederkehrend ({recurringCount})
              </a>
            </nav>
            <UserChip userName={userName} />
          </div>
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

        <MagicSheet />

        <div id="settlement-overlay" class="fixed inset-0 z-50 hidden">
          <div class="absolute inset-0 bg-slate-900/40" data-close="settlement-overlay"></div>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-title"
            class="safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[36rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          >
            <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true"></div>
            <div class="mb-3 flex items-start justify-between">
              <h2 id="settlement-title" class="text-sm font-medium text-slate-500">
                <span aria-hidden="true">🤝</span> Ausgleichszahlung
              </h2>
              <button
                type="button"
                data-close="settlement-overlay"
                aria-label="Ausgleichszahlung schließen"
                class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <span aria-hidden="true">✕</span>
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
              <button type="submit" class="btn-primary">
                Ausgleich buchen
              </button>
            </form>
          </div>
        </div>

        <div id="edit-overlay" class="fixed inset-0 z-50 hidden">
          <div class="absolute inset-0 bg-slate-900/40" data-close="edit-overlay"></div>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            class="safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[42rem] sm:max-w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          >
            <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true"></div>
            <div class="mb-3 flex items-start justify-between">
              <h2 id="edit-title" class="text-sm font-medium text-slate-500">
                <span aria-hidden="true">✏️</span> Transaktion bearbeiten
              </h2>
              <button
                type="button"
                data-close="edit-overlay"
                aria-label="Bearbeiten abbrechen"
                class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <form id="edit-form" class="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <label class="block">
                <span class={LABEL_CLASS}>Betrag</span>
                <input id="e-amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Beschreibung</span>
                <input id="e-description" type="text" maxlength={200} placeholder="Beschreibung" autocomplete="off" class={INPUT_CLASS} />
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Art</span>
                <select id="e-type" class={INPUT_CLASS}>
                  <option value="expense">Ausgabe</option>
                  <option value="income">Einnahme</option>
                  <option value="transfer">Überweisung</option>
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Bereich</span>
                <select id="e-scope" class={INPUT_CLASS}>
                  <option value="shared">Gemeinsam</option>
                  <option value="personal">Persönlich</option>
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Konto</span>
                <select id="e-paid-from" class={INPUT_CLASS}>
                  <option value="joint">Gemeinschaftskonto</option>
                  <option value="private">Privatkonto</option>
                </select>
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Kategorie</span>
                <CategorySelect id="e-category" />
              </label>
              <label class="block">
                <span class={LABEL_CLASS}>Datum</span>
                <input id="e-date" type="date" autocomplete="off" class={INPUT_CLASS} />
              </label>
              <div class="flex gap-2 sm:col-span-3 lg:col-span-4">
                <button type="submit" class="btn-primary">
                  Änderungen speichern
                </button>
                <button type="button" data-close="edit-overlay" class="btn-secondary">
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

      {/* Mobile Bottom-Navigation – „Hinzufügen“ öffnet das Magic-Sheet */}
      <BottomNav page="dashboard" month={month} />

      <script dangerouslySetInnerHTML={{ __html: 'window.__MONTH = "' + month + '";' }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </Layout>
  );
};
