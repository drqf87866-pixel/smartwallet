import type { FC } from 'hono/jsx';
import { Layout } from './layout';

export type MemberInfo = { id: number; name: string; monthly_contribution: number };

type SettingsProps = {
  userName: string;
  userEmail: string;
  householdName: string;
  inviteCode: string;
  members: MemberInfo[];
  myContribution: number;
  startBalance: number;
};

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (n: number) => eur.format(n);

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const script = `
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

document.getElementById('copy-invite').addEventListener('click', function () {
  var code = document.getElementById('invite-code').textContent.trim();
  navigator.clipboard.writeText(code).then(function () {
    showToast('Einladungscode kopiert: ' + code, 'ok');
  }, function () {
    showToast('Code: ' + code, 'info');
  });
});

document.getElementById('contribution-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var amount = parseFloat(document.getElementById('contribution-amount').value.replace(',', '.'));
  if (isNaN(amount) || amount < 0) {
    showToast('Bitte einen gültigen Betrag eingeben', 'error');
    return;
  }
  try {
    await postJson('/api/me/contribution', { amount: amount }, 'PUT');
    showToast('Monatsbeitrag gespeichert: ' + amount.toFixed(2).replace('.', ',') + ' €', 'ok');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('settings-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var start = parseFloat(document.getElementById('set-start').value.replace(',', '.'));
  if (isNaN(start) || start < 0) {
    showToast('Bitte einen gültigen Startstand eingeben', 'error');
    return;
  }
  try {
    await postJson('/api/settings', { joint_start_balance: start }, 'PUT');
    showToast('Startstand gespeichert', 'ok');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('password-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var next = document.getElementById('pw-new').value;
  if (next.length < 8) {
    showToast('Das neue Passwort muss mindestens 8 Zeichen haben', 'error');
    return;
  }
  if (next !== document.getElementById('pw-confirm').value) {
    showToast('Die neuen Passwörter stimmen nicht überein', 'error');
    return;
  }
  try {
    await postJson('/api/me/password', {
      current_password: document.getElementById('pw-current').value,
      new_password: next,
    }, 'PUT');
    showToast('Passwort geändert', 'ok');
    document.getElementById('password-form').reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
});
`;

const SECTION_CLASS = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200';

export const SettingsView: FC<SettingsProps> = ({
  userName,
  userEmail,
  householdName,
  inviteCode,
  members,
  myContribution,
  startBalance,
}) => (
  <Layout title="Einstellungen">
    <div
      id="toast"
      class="fixed bottom-6 left-1/2 z-50 hidden -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg"
    ></div>

    <main class="mx-auto max-w-2xl p-4 sm:p-8">
      <header class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a
            href="/dashboard"
            class="flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            ← Dashboard
          </a>
        </div>
        <button
          id="logout-btn"
          class="flex min-h-[44px] items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Abmelden
        </button>
      </header>

      <div class="mb-6 flex items-center gap-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{userName}</h1>
          <p class="text-sm text-slate-500">{userEmail}</p>
        </div>
      </div>

      <section class={`${SECTION_CLASS} mb-4`}>
        <h2 class="text-sm font-medium text-slate-500">👥 Haushalt „{householdName}“</h2>
        <ul class="mt-3 space-y-1.5 text-sm">
          {members.map((m) => (
            <li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span class="text-slate-700">
                {m.name}
                {m.name === userName ? <span class="text-slate-400"> (du)</span> : null}
              </span>
              <span class="text-xs text-slate-500">Beitrag: {fmt(m.monthly_contribution)}</span>
            </li>
          ))}
        </ul>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
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
      </section>

      <section class={`${SECTION_CLASS} mb-4`}>
        <h2 class="text-sm font-medium text-slate-500">💰 Mein Monatsbeitrag</h2>
        <p class="mt-1 text-xs text-slate-400">
          Wird per Klick auf „Beitrag buchen“ vom Privatkonto aufs Gemeinschaftskonto überwiesen.
          Jedes Mitglied setzt seinen eigenen Betrag.
        </p>
        <form id="contribution-form" class="mt-3 flex items-end gap-3">
          <div class="flex-1">
            <label for="contribution-amount" class="mb-1 block text-xs text-slate-500">
              Betrag pro Monat (€)
            </label>
            <input
              id="contribution-amount"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              value={myContribution}
              class={INPUT_CLASS}
            />
          </div>
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Speichern
          </button>
        </form>
      </section>

      <section class={`${SECTION_CLASS} mb-4`}>
        <h2 class="text-sm font-medium text-slate-500">🏦 Gemeinschaftskonto</h2>
        <form id="settings-form" class="mt-3 flex items-end gap-3">
          <div class="flex-1">
            <label for="set-start" class="mb-1 block text-xs text-slate-500">
              Startstand (€)
            </label>
            <input
              id="set-start"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              value={startBalance}
              class={INPUT_CLASS}
            />
          </div>
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Speichern
          </button>
        </form>
      </section>

      <section class={SECTION_CLASS}>
        <h2 class="text-sm font-medium text-slate-500">🔒 Passwort ändern</h2>
        <form id="password-form" class="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label for="pw-current" class="mb-1 block text-xs text-slate-500">
              Aktuelles Passwort
            </label>
            <input id="pw-current" type="password" required autocomplete="current-password" class={INPUT_CLASS} />
          </div>
          <div>
            <label for="pw-new" class="mb-1 block text-xs text-slate-500">
              Neues Passwort
            </label>
            <input id="pw-new" type="password" required minlength={8} autocomplete="new-password" class={INPUT_CLASS} />
          </div>
          <div>
            <label for="pw-confirm" class="mb-1 block text-xs text-slate-500">
              Wiederholen
            </label>
            <input id="pw-confirm" type="password" required minlength={8} autocomplete="new-password" class={INPUT_CLASS} />
          </div>
          <button
            type="submit"
            class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 sm:col-span-3"
          >
            Passwort ändern
          </button>
        </form>
      </section>
    </main>

    <script dangerouslySetInnerHTML={{ __html: script }} />
  </Layout>
);
