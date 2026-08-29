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

type DashboardProps = {
  userName: string;
  householdName: string;
  inviteCode: string;
  members: MemberInfo[];
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  privateBalance: number;
  jointPot: { saldo: number; start: number; transfers: number };
  sharedMonth: { total: number; advanced: number };
  debts: DebtRow[];
  settings: { start: number; contribution: number };
  contributionBooked: boolean;
  transactions: DashboardTx[];
  today: string;
};

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (n: number) => eur.format(n);
const dayFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
const fmtTime = (iso: string) => timeFmt.format(new Date(iso));

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

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

const script = `
var MAGIC_PAID_FROM = 'auto';

function showToast(message, kind) {
  var toast = document.getElementById('toast');
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

document.getElementById('logout-btn').addEventListener('click', async function () {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// Magic-Input: Konto-Pills (Radio-Verhalten)
document.querySelectorAll('[data-paid-from]').forEach(function (pill) {
  pill.addEventListener('click', function () {
    MAGIC_PAID_FROM = pill.getAttribute('data-paid-from');
    document.querySelectorAll('[data-paid-from]').forEach(function (p) {
      var active = p === pill;
      p.className = active
        ? 'rounded-full px-3 py-1 text-xs font-medium bg-indigo-600 text-white'
        : 'rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200';
    });
  });
});

document.getElementById('magic-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var input = document.getElementById('magic-text');
  var btn = document.getElementById('magic-btn');
  var text = input.value.trim();
  if (!text) return;
  btn.disabled = true;
  btn.textContent = 'Denkt nach …';
  try {
    await postJson('/api/magic-entry', { text: text, paid_from: MAGIC_PAID_FROM });
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = '✨ Hinzufügen';
  }
});

document.getElementById('copy-invite').addEventListener('click', function () {
  var code = document.getElementById('invite-code').textContent.trim();
  navigator.clipboard.writeText(code).then(function () {
    showToast('Einladungscode kopiert: ' + code, 'ok');
  }, function () {
    showToast('Code: ' + code, 'info');
  });
});

var contributionBtn = document.getElementById('contribution-btn');
if (contributionBtn) {
  contributionBtn.addEventListener('click', async function () {
    contributionBtn.disabled = true;
    try {
      await postJson('/api/contribution', {});
      window.location.reload();
    } catch (err) {
      showToast(err.message, 'info');
      contributionBtn.disabled = false;
    }
  });
}

// Ausgleichsformular: Empfänger-Auswahl ohne den Zahlenden
function rebuildRecipientOptions() {
  var from = document.getElementById('s-from').value;
  var to = document.getElementById('s-to');
  var me = to.getAttribute('data-me-id');
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

document.getElementById('s-from').addEventListener('change', rebuildRecipientOptions);
rebuildRecipientOptions();

var settleToggle = document.getElementById('settle-toggle');
if (settleToggle) {
  settleToggle.addEventListener('click', function () {
    var box = document.getElementById('settlement-box');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
      document.getElementById('s-amount').focus();
    }
  });
}

// "Begleichen" aus der Schulden-Liste: Formular vorbelegen und öffnen
document.querySelectorAll('[data-quick-settle]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.getElementById('s-amount').value = btn.getAttribute('data-amount');
    document.getElementById('s-from').value = btn.getAttribute('data-from');
    rebuildRecipientOptions();
    document.getElementById('s-to').value = btn.getAttribute('data-to');
    var box = document.getElementById('settlement-box');
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('s-amount').focus();
  });
});

document.getElementById('settlement-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var amount = parseFloat(document.getElementById('s-amount').value);
  if (!amount || amount <= 0) {
    showToast('Bitte einen gültigen Betrag eingeben', 'error');
    return;
  }
  try {
    await postJson('/api/settlements', {
      amount: amount,
      from: document.getElementById('s-from').value,
      to: document.getElementById('s-to').value,
    });
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('manual-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var amount = parseFloat(document.getElementById('m-amount').value);
  if (!amount || amount <= 0) {
    showToast('Bitte einen gültigen Betrag eingeben', 'error');
    return;
  }
  var body = {
    amount: amount,
    type: document.getElementById('m-type').value,
    scope: document.getElementById('m-scope').value,
    paid_from: document.getElementById('m-paid-from').value,
    category: document.getElementById('m-category').value,
    description: document.getElementById('m-description').value,
  };
  var date = document.getElementById('m-date').value;
  if (date) body.date = date;
  try {
    await postJson('/api/transactions', body);
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Transaktion bearbeiten: Modal öffnen und vorbelegen
var EDITING_ID = null;
var EDITING_TIME = '';

function openEditModal(tx) {
  EDITING_ID = tx.id;
  EDITING_TIME = String(tx.date).slice(10); // Uhrzeit erhalten, nur Datum ist editierbar
  document.getElementById('e-amount').value = tx.amount;
  document.getElementById('e-type').value = tx.type;
  document.getElementById('e-scope').value = tx.scope;
  document.getElementById('e-paid-from').value = tx.paid_from;
  document.getElementById('e-category').value = tx.category;
  document.getElementById('e-description').value = tx.description;
  document.getElementById('e-date').value = String(tx.date).slice(0, 10);
  var box = document.getElementById('edit-box');
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('e-amount').focus();
}

document.getElementById('e-cancel').addEventListener('click', function () {
  document.getElementById('edit-box').classList.add('hidden');
  EDITING_ID = null;
});

document.getElementById('edit-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!EDITING_ID) return;
  var amount = parseFloat(document.getElementById('e-amount').value);
  if (!amount || amount <= 0) {
    showToast('Bitte einen gültigen Betrag eingeben', 'error');
    return;
  }
  var body = {
    amount: amount,
    type: document.getElementById('e-type').value,
    scope: document.getElementById('e-scope').value,
    paid_from: document.getElementById('e-paid-from').value,
    category: document.getElementById('e-category').value,
    description: document.getElementById('e-description').value,
  };
  var date = document.getElementById('e-date').value;
  if (date) body.date = date + EDITING_TIME;
  try {
    await postJson('/api/transactions/' + EDITING_ID, body, 'PUT');
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.querySelectorAll('[data-edit]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    openEditModal(JSON.parse(btn.getAttribute('data-tx')));
  });
});

document.querySelectorAll('[data-delete]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    if (!confirm('Diese Transaktion wirklich löschen?')) return;
    try {
      await postJson('/api/transactions/' + btn.getAttribute('data-delete'), {}, 'DELETE');
      window.location.reload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});

document.getElementById('settings-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    await postJson('/api/settings', {
      joint_start_balance: parseFloat(document.getElementById('set-start').value.replace(',', '.')) || 0,
      joint_contribution: parseFloat(document.getElementById('set-contribution').value.replace(',', '.')) || 0,
    }, 'PUT');
    window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  }
});
`;

export const DashboardView: FC<DashboardProps> = ({
  userName,
  householdName,
  inviteCode,
  members,
  monthLabel,
  prevMonth,
  nextMonth,
  privateBalance,
  jointPot,
  sharedMonth,
  debts,
  settings,
  contributionBooked,
  transactions,
  today,
}) => {
  const me = members.find((m) => m.name === userName);
  const others = members.filter((m) => m.name !== userName);
  const meId = me?.id ?? 0;
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
        class="fixed bottom-6 left-1/2 z-50 hidden -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg"
      ></div>

      <main class="mx-auto max-w-6xl p-4 sm:p-8">
        <header class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">💳 SmartWallet</h1>
            <p class="text-sm text-slate-500">
              Hallo {userName}, hier ist der Überblick für „{householdName}“.
            </p>
          </div>
          <button
            id="logout-btn"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Abmelden
          </button>
        </header>

        <section class="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-sm font-medium text-slate-500">Mein privater Saldo</h2>
            <p class={'mt-2 text-3xl font-bold ' + (privateBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {fmt(privateBalance)}
            </p>
            <p class="mt-1 text-xs text-slate-400">inkl. Beiträge & Ausgleichen</p>
          </article>

          <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-sm font-medium text-slate-500">Gemeinschaftskonto</h2>
            <p class={'mt-2 text-3xl font-bold ' + (jointPot.saldo >= 0 ? 'text-indigo-600' : 'text-red-600')}>
              {fmt(jointPot.saldo)}
            </p>
            <p class="mt-1 text-xs text-slate-400">
              Startstand {fmt(jointPot.start)} · Einzahlungen {fmt(jointPot.transfers)}
            </p>
          </article>

          <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-sm font-medium text-slate-500">Gemeinsame Ausgaben</h2>
            <p class="mt-2 text-3xl font-bold text-indigo-600">{fmt(sharedMonth.total)}</p>
            <p class="mt-1 text-xs text-slate-400">
              davon {fmt(sharedMonth.advanced)} privat vorgestreckt · {monthLabel}
            </p>
          </article>

          <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-sm font-medium text-slate-500">Wer schuldet wem?</h2>
            {members.length < 2 ? (
              <p class="mt-2 text-xs text-slate-500">
                Du bist derzeit solo im Haushalt. Teile den Einladungscode (unter ⚙ Einstellungen),
                um die gemeinsame Abrechnung zu starten.
              </p>
            ) : debts.length === 0 ? (
              <>
                <p class="mt-2 text-3xl font-bold text-emerald-600">{fmt(0)}</p>
                <p class="mt-1 text-xs text-slate-400">Alles ausgeglichen 🎉</p>
              </>
            ) : (
              <ul class="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
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
                        class="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"
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

        <section class="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 class="text-sm font-medium text-slate-500">✨ Magic Input</h2>
          <p class="mb-3 text-xs text-slate-400">
            Einfach eintippen, was ausgegeben wurde – die KI erkennt Betrag, Kategorie, ob es gemeinsam war und mit welchem Konto bezahlt wurde.
          </p>
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
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              ✨ Hinzufügen
            </button>
          </form>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-xs text-slate-400">Konto:</span>
            <button type="button" data-paid-from="auto" class="rounded-full px-3 py-1 text-xs font-medium bg-indigo-600 text-white">
              Automatisch (KI)
            </button>
            <button type="button" data-paid-from="joint" class="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200">
              Gemeinschaftskarte
            </button>
            <button type="button" data-paid-from="private" class="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200">
              Meine Karte / Bar
            </button>
          </div>
        </section>

        <section class="mb-4 flex flex-wrap items-center gap-3">
          {settings.contribution > 0 && !contributionBooked ? (
            <button
              id="contribution-btn"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              💰 Beitrag buchen ({fmt(settings.contribution)})
            </button>
          ) : null}
          <button
            id="settle-toggle"
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            🤝 Ausgleichszahlung erfassen
          </button>
        </section>

        <div id="settlement-box" class="mb-4 hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 class="mb-3 text-sm font-medium text-slate-500">🤝 Ausgleichszahlung</h2>
          <form id="settlement-form" class="grid items-end gap-3 sm:grid-cols-4">
            <div>
              <label for="s-from" class="mb-1 block text-xs text-slate-500">Zahlender</label>
              <select
                id="s-from"
                class={INPUT_CLASS}
                data-me-id={String(meId)}
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
                data-me-id={String(meId)}
                data-members={JSON.stringify(recipientOptions)}
              ></select>
            </div>
            <div>
              <label for="s-amount" class="mb-1 block text-xs text-slate-500">Betrag (€)</label>
              <input id="s-amount" type="number" step="0.01" min="0.01" required placeholder="z. B. 30" class={INPUT_CLASS} />
            </div>
            <button type="submit" class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900">
              Ausgleich buchen
            </button>
          </form>
        </div>

        <div id="edit-box" class="mb-4 hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 class="mb-3 text-sm font-medium text-slate-500">✏️ Transaktion bearbeiten</h2>
          <form id="edit-form" class="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <input id="e-amount" type="number" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
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
              <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
                Änderungen speichern
              </button>
              <button
                id="e-cancel"
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-medium text-slate-500">Transaktionen · {monthLabel}</h2>
            <nav class="flex items-center gap-2 text-sm">
              <a
                href={'/dashboard?month=' + prevMonth}
                class="rounded-md border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                title="Voriger Monat"
              >
                ‹
              </a>
              <a
                href={'/dashboard?month=' + nextMonth}
                class="rounded-md border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                title="Nächster Monat"
              >
                ›
              </a>
            </nav>
          </div>

          <details class="mb-4">
            <summary class="cursor-pointer select-none text-sm font-medium text-indigo-600">
              ➕ Eintrag manuell hinzufügen
            </summary>
            <form id="manual-form" class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <input id="m-amount" type="number" step="0.01" min="0.01" required placeholder="Betrag" class={INPUT_CLASS} />
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
                class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 sm:col-span-3 lg:col-span-7"
              >
                Speichern
              </button>
            </form>
          </details>

          {transactions.length === 0 ? (
            <p class="py-8 text-center text-sm text-slate-400">Noch keine Transaktionen in diesem Monat.</p>
          ) : (
            <div class="overflow-x-auto">
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
                  {transactions.map((t) => {
                    const badge = accountBadge(t);
                    const editable = t.type !== 'settlement' && t.category !== 'Beitrag';
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
                        <td
                          class={
                            'whitespace-nowrap py-2.5 text-right font-semibold ' +
                            (t.type === 'income'
                              ? 'text-emerald-600'
                              : t.type === 'expense'
                                ? 'text-red-500'
                                : 'text-slate-500')
                          }
                        >
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↗ '}
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
                                class="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                data-delete={t.id}
                                title="Löschen"
                                class="ml-1.5 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100"
                              >
                                🗑
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <details class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <summary class="cursor-pointer select-none text-sm font-medium text-slate-500">
            ⚙ Einstellungen
          </summary>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 class="text-sm font-medium text-slate-500">👥 Haushalt „{householdName}“</h2>
              <p class="mt-1 text-xs text-slate-400">
                {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}:{' '}
                {members.map((m) => (m.name === userName ? `${m.name} (du)` : m.name)).join(' · ')}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-400">Einladungscode:</span>
              <code
                id="invite-code"
                class="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-slate-700"
              >
                {inviteCode}
              </code>
              <button
                id="copy-invite"
                type="button"
                class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                📋 Kopieren
              </button>
              <a
                href={'/register?code=' + inviteCode}
                class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
              >
                Link zum Einladen
              </a>
            </div>
          </div>
          <form id="settings-form" class="mt-4 grid items-end gap-3 sm:grid-cols-3">
            <div>
              <label for="set-start" class="mb-1 block text-xs text-slate-500">Startstand Gemeinschaftskonto (€)</label>
              <input id="set-start" type="number" step="0.01" min="0" value={settings.start} class={INPUT_CLASS} />
            </div>
            <div>
              <label for="set-contribution" class="mb-1 block text-xs text-slate-500">Fixbetrag pro Person/Monat (€)</label>
              <input id="set-contribution" type="number" step="0.01" min="0" value={settings.contribution} class={INPUT_CLASS} />
            </div>
            <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
              Speichern
            </button>
          </form>
        </details>
      </main>

      <script dangerouslySetInnerHTML={{ __html: script }} />
    </Layout>
  );
};
