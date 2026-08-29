import type { FC } from 'hono/jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories';

/** Geteilte Klassen-Konstanten (Implementierung in src/styles/app.css, @layer components). */
export const INPUT_CLASS = 'input';
export const LABEL_CLASS = 'label-text';

/** Kategorie-Dropdown – Optionen werden per JS je nach Art (Ausgabe/Einnahme) befüllt. */
export const CategorySelect: FC<{ id: string }> = ({ id }) => (
  <select
    id={id}
    class={INPUT_CLASS}
    data-expense-cats={JSON.stringify(EXPENSE_CATEGORIES)}
    data-income-cats={JSON.stringify(INCOME_CATEGORIES)}
  />
);

/** Avatar-Chip oben rechts – auf allen Hauptseiten identisch und führt zu /settings. */
export const UserChip: FC<{ userName: string }> = ({ userName }) => (
  <a
    href="/settings"
    title="Einstellungen"
    aria-label="Einstellungen"
    class="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
  >
    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
      {userName.charAt(0).toUpperCase()}
    </span>
    <span class="hidden text-sm font-medium text-slate-700 sm:inline">{userName}</span>
  </a>
);

type BottomNavPage = 'dashboard' | 'stats' | 'recurring';

type BottomNavProps = {
  /** Aktive Seite – erhält aria-current="page". */
  page: BottomNavPage;
  /** Optionaler Monatskontext für Dashboard-/Statistik-Links. */
  month?: string;
};

const NAV_ITEMS: { page: BottomNavPage; href: (month?: string) => string; icon: string; label: string }[] = [
  { page: 'dashboard', href: (m) => (m ? '/dashboard?month=' + m : '/dashboard'), icon: '🏠', label: 'Dashboard' },
  { page: 'stats', href: (m) => (m ? '/stats?month=' + m : '/stats'), icon: '📊', label: 'Statistik' },
  { page: 'recurring', href: () => '/recurring', icon: '🔁', label: 'Wiederkehrend' },
];

/**
 * Mobile Bottom-Navigation – auf allen Hauptseiten identisch
 * (3 Links plus Aktion „Hinzufügen“, immer 4 Spalten).
 */
export const BottomNav: FC<BottomNavProps> = ({ page, month }) => (
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="grid grid-cols-4">
      {NAV_ITEMS.map((item) => {
        const active = item.page === page;
        // Dashboard-Selbstlink ohne Monatskontext: kehrt immer zum aktuellen Monat zurück
        const href = item.page === 'dashboard' ? '/dashboard' : item.href(month);
        return (
          <a
            href={href}
            aria-current={active ? 'page' : undefined}
            class={
              'flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition ' +
              (active ? 'text-indigo-600' : 'text-slate-600 hover:bg-slate-50')
            }
          >
            <span class="text-lg leading-none" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </a>
        );
      })}
      <button
        type="button"
        data-action="open-magic"
        class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <span class="text-lg leading-none" aria-hidden="true">✨</span>
        Hinzufügen
      </button>
    </div>
  </nav>
);

/* ------------------------------------------------------------------ */
/* Magic Input – unten fixiertes Eingabe-Sheet (< 768 px),             */
/* auf Desktop normale Card im Seitenfluss                             */
/* ------------------------------------------------------------------ */

const PILL_ACTIVE = 'rounded-full px-3 py-2 text-xs font-medium bg-indigo-600 text-white';
const PILL_IDLE = 'rounded-full px-3 py-2 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200';

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

/* app.js wird mit defer geladen; die Handler laufen erst bei Events. */
const magicScript = `
(function () {
var MAGIC_PAID_FROM = 'auto';
var PILL_ACTIVE = ${JSON.stringify(PILL_ACTIVE)};
var PILL_IDLE = ${JSON.stringify(PILL_IDLE)};

function openMagic() {
  document.body.classList.add('magic-open');
  $('magic-backdrop').classList.remove('hidden');
  setTimeout(function () { $('magic-text').focus(); }, 150);
}
function closeMagic() {
  document.body.classList.remove('magic-open');
  $('magic-backdrop').classList.add('hidden');
}

document.addEventListener('click', function (e) {
  var pill = e.target.closest('[data-paid-from]');
  if (pill) {
    MAGIC_PAID_FROM = pill.getAttribute('data-paid-from');
    document.querySelectorAll('[data-paid-from]').forEach(function (p) {
      var active = p === pill;
      p.className = active ? PILL_ACTIVE : PILL_IDLE;
    });
    return;
  }

  var action = e.target.closest('[data-action]');
  if (action) {
    var name = action.getAttribute('data-action');
    if (name === 'open-magic') { openMagic(); return; }
    if (name === 'close-magic') { closeMagic(); return; }
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMagic();
});

document.addEventListener('submit', async function (e) {
  if (e.target.id !== 'magic-form') return;
  e.preventDefault();
  var btn = e.target.querySelector('button[type="submit"]');
  var input = $('magic-text');
  var text = input.value.trim();
  if (!text) return;
  var unbusy = busy(btn, 'Denkt nach …');
  try {
    await postJson('/api/magic-entry', { text: text, paid_from: MAGIC_PAID_FROM });
    input.value = '';
    closeMagic();
    // Dashboard definiert __afterMutation (Fragment-Refresh), sonst Reload
    if (window.__afterMutation) await window.__afterMutation();
    else window.location.reload();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    unbusy();
  }
});
})();
`;

/** Magic-Input-Sheet: Backdrop, Section, CSS und Client-Script als eine Einheit. */
export const MagicSheet: FC = () => (
  <>
    <div id="magic-backdrop" data-action="close-magic" class="fixed inset-0 z-40 hidden bg-slate-900/40 md:hidden"></div>

    <section id="magic-section" class="safe-bottom card mb-4">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-medium text-slate-500">
            <span aria-hidden="true">✨</span> Magic Input
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            Einfach eintippen, was ausgegeben wurde – die KI erkennt Betrag, Kategorie, ob es gemeinsam war und mit welchem Konto bezahlt wurde.
          </p>
        </div>
        <button
          type="button"
          data-action="close-magic"
          aria-label="Magic Input schließen"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 md:hidden"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <form id="magic-form" class="flex flex-col gap-2 sm:flex-row">
        <input
          id="magic-text"
          type="text"
          maxlength={500}
          autocomplete="off"
          placeholder='z. B. "Ich war für 45 Euro tanken" oder "Wir waren für 60 Euro essen"'
          aria-label="Magic Input – Ausgabe in natürlicher Sprache beschreiben"
          class={'flex-1 ' + INPUT_CLASS}
        />
        <button id="magic-btn" type="submit" class="btn-primary">
          <span aria-hidden="true">✨</span> Hinzufügen
        </button>
      </form>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-xs text-slate-500">Konto:</span>
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

    <style dangerouslySetInnerHTML={{ __html: magicSheetCss }} />
    <script dangerouslySetInnerHTML={{ __html: magicScript }} />
  </>
);
