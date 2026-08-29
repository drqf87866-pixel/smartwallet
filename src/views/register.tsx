import type { FC } from 'hono/jsx';
import { Layout } from './layout';

type RegisterProps = {
  /** Über /register?code=XYZ vorbelegter Einladungscode */
  initialCode?: string;
};

const MODE_SCRIPT = `
var TAB_ACTIVE = ['bg-indigo-600', 'text-white'];
var TAB_IDLE = ['bg-slate-100', 'text-slate-500', 'hover:bg-slate-200'];

function setMode(next) {
  mode = next;
  [['tab-create', next === 'create'], ['tab-join', next === 'join']].forEach(function (pair) {
    var tab = document.getElementById(pair[0]);
    tab.setAttribute('aria-pressed', String(pair[1]));
    TAB_ACTIVE.forEach(function (cls) { tab.classList.toggle(cls, pair[1]); });
    TAB_IDLE.forEach(function (cls) { tab.classList.toggle(cls, !pair[1]); });
  });
  document.getElementById('field-create').classList.toggle('hidden', next !== 'create');
  document.getElementById('field-join').classList.toggle('hidden', next !== 'join');
}

var initial = document.getElementById('register-form').dataset.initialCode || '';
if (initial) {
  document.getElementById('invite_code').value = initial;
  setMode('join');
} else {
  setMode('create');
}

document.getElementById('tab-create').addEventListener('click', function () { setMode('create'); });
document.getElementById('tab-join').addEventListener('click', function () { setMode('join'); });

document.getElementById('register-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var errorBox = document.getElementById('register-error');
  errorBox.classList.add('hidden');
  var btn = document.getElementById('register-btn');
  var password = document.getElementById('password').value;
  var confirm = document.getElementById('password-confirm').value;
  if (password !== confirm) {
    errorBox.textContent = 'Die Passwörter stimmen nicht überein';
    errorBox.classList.remove('hidden');
    document.getElementById('password-confirm').focus();
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Konto wird erstellt …';
  var payload = {
    mode: mode,
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    password: password,
    website: document.getElementById('website').value, // Honeypot – muss leer sein
  };
  if (mode === 'create') {
    payload.household_name = document.getElementById('household_name').value;
  } else {
    payload.invite_code = document.getElementById('invite_code').value;
  }
  try {
    var res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      window.location.href = '/dashboard';
      return;
    }
    var data = await res.json().catch(function () { return {}; });
    errorBox.textContent = data.error || 'Registrierung fehlgeschlagen';
    errorBox.classList.remove('hidden');
  } catch (err) {
    errorBox.textContent = 'Netzwerkfehler – bitte erneut versuchen';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Konto erstellen';
  }
});
`;

export const RegisterView: FC<RegisterProps> = ({ initialCode = '' }) => (
  <Layout title="Registrieren">
    <main class="flex min-h-screen items-center justify-center p-6">
      <div class="w-full max-w-md">
        <div class="mb-6 text-center">
          <div class="text-4xl" aria-hidden="true">💳</div>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">SmartWallet</h1>
          <p class="mt-1 text-sm text-slate-500">
            Erstelle deinen Haushalt oder tritt mit einem Einladungscode bei.
          </p>
        </div>

        <form
          id="register-form"
          novalidate
          data-initial-code={initialCode}
          class="space-y-4 rounded-2xl bg-white p-6 shadow-xl shadow-indigo-100"
        >
          <div id="register-error" role="alert" class="hidden rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"></div>

          <div class="flex gap-2" role="group" aria-label="Registrierungsart">
            <button
              type="button"
              id="tab-create"
              aria-pressed="true"
              class="min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition"
            >
              Neuen Haushalt erstellen
            </button>
            <button
              type="button"
              id="tab-join"
              aria-pressed="false"
              class="min-h-[44px] flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-200"
            >
              Einladungscode einlösen
            </button>
          </div>

          <div id="field-create">
            <label for="household_name" class="mb-1 block text-sm font-medium text-slate-700">
              Name eures Haushalts
            </label>
            <input
              id="household_name"
              type="text"
              maxlength={60}
              required
              autocomplete="organization"
              placeholder="z. B. Familie Musterhoff"
              class="input"
            />
          </div>

          <div id="field-join" class="hidden">
            <label for="invite_code" class="mb-1 block text-sm font-medium text-slate-700">
              Einladungscode
            </label>
            <input
              id="invite_code"
              type="text"
              maxlength={8}
              required
              autocomplete="off"
              placeholder="z. B. K7M4QX2T"
              class="input uppercase tracking-widest"
            />
          </div>

          <div>
            <label for="name" class="mb-1 block text-sm font-medium text-slate-700">Dein Name</label>
            <input id="name" type="text" maxlength={50} required autocomplete="name" placeholder="Vorname" class="input" />
          </div>

          <div>
            <label for="email" class="mb-1 block text-sm font-medium text-slate-700">E-Mail</label>
            <input
              id="email"
              type="email"
              required
              autocomplete="email"
              placeholder="du@beispiel.de"
              class="input"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="password" class="mb-1 block text-sm font-medium text-slate-700">Passwort</label>
              <input
                id="password"
                type="password"
                required
                minlength={8}
                autocomplete="new-password"
                class="input"
              />
            </div>
            <div>
              <label for="password-confirm" class="mb-1 block text-sm font-medium text-slate-700">
                Wiederholen
              </label>
              <input
                id="password-confirm"
                type="password"
                required
                minlength={8}
                autocomplete="new-password"
                class="input"
              />
            </div>
          </div>

          {/* Honeypot gegen Bots – für Menschen unsichtbar */}
          <input
            id="website"
            type="text"
            tabindex={-1}
            autocomplete="off"
            aria-hidden="true"
            class="hidden"
          />

          <button
            id="register-btn"
            type="submit"
            class="min-h-[44px] w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            Konto erstellen
          </button>
        </form>

        <p class="mt-4 text-center text-sm text-slate-500">
          Schon dabei?{' '}
          <a href="/login" class="font-medium text-indigo-600 hover:underline">
            Zum Login
          </a>
        </p>
      </div>

      <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
    </main>
  </Layout>
);
