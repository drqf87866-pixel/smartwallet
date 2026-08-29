import type { FC, PropsWithChildren } from 'hono/jsx';
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

type BottomNavPage = 'dashboard' | 'stats' | 'recurring';

type BottomNavProps = PropsWithChildren<{
  /** Aktive Seite – erhält aria-current="page". */
  page: BottomNavPage;
  /** Optionaler Monatskontext für Dashboard-/Statistik-Links. */
  month?: string;
}>;

const NAV_ITEMS: { page: BottomNavPage; href: (month?: string) => string; icon: string; label: string }[] = [
  { page: 'dashboard', href: (m) => (m ? '/dashboard?month=' + m : '/dashboard'), icon: '🏠', label: 'Dashboard' },
  { page: 'stats', href: (m) => (m ? '/stats?month=' + m : '/stats'), icon: '📊', label: 'Statistik' },
  { page: 'recurring', href: () => '/recurring', icon: '🔁', label: 'Wiederkehrend' },
];

/**
 * Mobile Bottom-Navigation – auf allen Hauptseiten identisch (3 Links plus
 * optionaler Slot für die Dashboard-Aktion „Hinzufügen“).
 */
export const BottomNav: FC<BottomNavProps> = ({ page, month, children }) => (
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class={children ? 'grid grid-cols-4' : 'grid grid-cols-3'}>
      {NAV_ITEMS.map((item) => {
        const active = item.page === page;
        return (
          <a
            href={item.href(month)}
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
      {children}
    </div>
  </nav>
);
