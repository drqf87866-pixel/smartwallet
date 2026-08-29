import type { FC } from 'hono/jsx';
import { Layout } from './layout';

export type CategorySlice = { category: string; spent: number };
export type HistoryMonth = { ym: string; income: number; expense: number };
export type TopExpense = {
  description: string;
  category: string;
  amount: number;
  date: string;
  created_by: string;
};

export type StatsProps = {
  userName: string;
  householdName: string;
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  categories: CategorySlice[];
  categoryTotal: number;
  history: HistoryMonth[];
  topExpenses: TopExpense[];
};

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (n: number) => eur.format(n);
const dayFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
const monthShortFmt = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' });
const fmtMonthShort = (ym: string) => monthShortFmt.format(new Date(`${ym}-01T00:00:00Z`));

const DONUT_RADIUS = 45;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const PALETTE = [
  '#4f46e5', '#059669', '#d97706', '#e11d48', '#0284c7', '#7c3aed',
  '#0d9488', '#ea580c', '#64748b', '#65a30d', '#db2777', '#2563eb',
];

const CARD_CLASS = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200';

/** Kategorien-Donut: Segmente per stroke-dasharray, Legende mit Anteilen. */
const CategoryDonut: FC<{ slices: CategorySlice[]; total: number }> = ({ slices, total }) => {
  if (total <= 0) {
    return <p class="py-8 text-center text-sm text-slate-400">Keine Ausgaben in diesem Monat.</p>;
  }
  let offset = 0;
  const segments = slices.map((slice, index) => {
    const dash = (slice.spent / total) * DONUT_CIRCUMFERENCE;
    const segment = { ...slice, dash, offset, color: PALETTE[index % PALETTE.length] };
    offset += dash;
    return segment;
  });

  return (
    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <svg viewBox="0 0 120 120" class="h-44 w-44 shrink-0" role="img" aria-label="Ausgaben nach Kategorie">
        <g transform="rotate(-90 60 60)">
          {segments.map((segment) => (
            <circle
              cx="60"
              cy="60"
              r={DONUT_RADIUS}
              fill="none"
              stroke={segment.color}
              stroke-width="16"
              stroke-dasharray={`${Math.max(segment.dash - 0.6, 0)} ${DONUT_CIRCUMFERENCE - Math.max(segment.dash - 0.6, 0)}`}
              stroke-dashoffset={-segment.offset}
            >
              <title>{`${segment.category}: ${fmt(segment.spent)}`}</title>
            </circle>
          ))}
        </g>
        <text x="60" y="57" text-anchor="middle" class="fill-slate-400" style="font-size:7px">Ausgaben</text>
        <text x="60" y="68" text-anchor="middle" class="fill-slate-700" style="font-size:10px;font-weight:700">
          {fmt(total)}
        </text>
      </svg>
      <ul class="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {segments.map((segment) => (
          <li class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={'background:' + segment.color}></span>
              <span class="truncate text-slate-600">{segment.category}</span>
            </span>
            <span class="whitespace-nowrap text-slate-500">
              {fmt(segment.spent)} · {Math.round((segment.spent / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 12-Monats-Verlauf: gruppierte Balken (Einnahmen/Ausgaben) als SVG. */
const HistoryBars: FC<{ history: HistoryMonth[] }> = ({ history }) => {
  const max = Math.max(1, ...history.map((row) => Math.max(row.income, row.expense)));
  const plotHeight = 110;
  const baseline = 126;
  const columnWidth = 360 / history.length;

  return (
    <div class="overflow-x-auto">
      <svg viewBox="0 0 360 140" class="w-full min-w-[320px]" role="img" aria-label="Verlauf der letzten 12 Monate">
        <line x1="0" y1={baseline} x2="360" y2={baseline} stroke="#e2e8f0" stroke-width="1" />
        {history.map((row, index) => {
          const incomeHeight = (row.income / max) * plotHeight;
          const expenseHeight = (row.expense / max) * plotHeight;
          const x = index * columnWidth + columnWidth / 2;
          return (
            <g>
              <title>
                {`${fmtMonthShort(row.ym)}: Einnahmen ${fmt(row.income)} · Ausgaben ${fmt(row.expense)}`}
              </title>
              <rect
                x={x - 8}
                y={baseline - incomeHeight}
                width="7"
                height={incomeHeight}
                rx="1.5"
                fill="#059669"
              />
              <rect
                x={x + 1}
                y={baseline - expenseHeight}
                width="7"
                height={expenseHeight}
                rx="1.5"
                fill="#e11d48"
              />
              <text x={x} y={baseline + 12} text-anchor="middle" class="fill-slate-400" style="font-size:8px">
                {fmtMonthShort(row.ym)}
              </text>
            </g>
          );
        })}
      </svg>
      <p class="mt-1 flex items-center justify-center gap-4 text-xs text-slate-500">
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-600"></span> Einnahmen
        </span>
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-rose-600"></span> Ausgaben
        </span>
      </p>
    </div>
  );
};

export const StatsView: FC<StatsProps> = ({
  userName,
  householdName,
  month,
  monthLabel,
  prevMonth,
  nextMonth,
  categories,
  categoryTotal,
  history,
  topExpenses,
}) => {
  const incomeTotal = history.find((row) => row.ym === month)?.income ?? 0;
  const balance = incomeTotal - categoryTotal;

  return (
    <Layout title="Statistik">
      <main class="mx-auto max-w-6xl p-4 pb-28 sm:p-8 md:pb-8">
        <header class="mb-8 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold tracking-tight sm:text-2xl">📊 Statistik</h1>
            <p class="hidden text-sm text-slate-500 sm:block">
              Hallo {userName}, hier ist die Analyse für „{householdName}“.
            </p>
          </div>
          <a
            href={'/dashboard?month=' + month}
            title="Zurück zum Dashboard"
            class="flex items-center gap-2 rounded-full bg-white py-1 pl-3 pr-1 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <span class="hidden text-sm font-medium text-slate-700 sm:inline">Dashboard</span>
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
          </a>
        </header>

        {/* Monatsnavigation + Monatsbilanz */}
        <section class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav class="flex items-center gap-2 text-sm">
            <a
              href={'/stats?month=' + prevMonth}
              title="Voriger Monat"
              class="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-lg text-slate-600 hover:bg-slate-50"
            >
              ‹
            </a>
            <span class="min-w-[9rem] text-center text-sm font-medium text-slate-600">{monthLabel}</span>
            <a
              href={'/stats?month=' + nextMonth}
              title="Nächster Monat"
              class="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-lg text-slate-600 hover:bg-slate-50"
            >
              ›
            </a>
          </nav>
          <p class="text-sm text-slate-500">
            Bilanz:{' '}
            <span class={'font-bold ' + (balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {balance >= 0 ? '+' : '−'}
              {fmt(Math.abs(balance))}
            </span>
            <span class="ml-2 text-xs text-slate-400">
              ({fmt(incomeTotal)} − {fmt(categoryTotal)})
            </span>
          </p>
        </section>

        <section class={CARD_CLASS + ' mb-4'}>
          <h2 class="mb-4 text-sm font-medium text-slate-500">Ausgaben nach Kategorie · {monthLabel}</h2>
          <CategoryDonut slices={categories} total={categoryTotal} />
        </section>

        <section class={CARD_CLASS + ' mb-4'}>
          <h2 class="mb-4 text-sm font-medium text-slate-500">Verlauf der letzten 12 Monate</h2>
          <HistoryBars history={history} />
        </section>

        <section class={CARD_CLASS + ' mb-4'}>
          <h2 class="mb-2 text-sm font-medium text-slate-500">Top-Ausgaben · {monthLabel}</h2>
          {topExpenses.length === 0 ? (
            <p class="py-6 text-center text-sm text-slate-400">Keine Ausgaben in diesem Monat.</p>
          ) : (
            <ol class="divide-y divide-slate-100">
              {topExpenses.map((expense, index) => (
                <li class="flex items-center justify-between gap-3 py-2.5">
                  <span class="flex min-w-0 items-center gap-3">
                    <span class="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-medium text-slate-700">
                        {expense.description || expense.category}
                      </span>
                      <span class="block text-xs text-slate-400">
                        {fmtDay(expense.date)} · {expense.category} · {expense.created_by}
                      </span>
                    </span>
                  </span>
                  <span class="whitespace-nowrap text-sm font-semibold text-red-500">−{fmt(expense.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      {/* Mobile Bottom-Navigation */}
      <nav
        class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style="padding-bottom: env(safe-area-inset-bottom)"
      >
        <div class="grid grid-cols-2">
          <a href={'/dashboard?month=' + month} class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-600">
            <span class="text-lg leading-none">🏠</span>
            Dashboard
          </a>
          <span class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-indigo-600">
            <span class="text-lg leading-none">📊</span>
            Statistik
          </span>
        </div>
      </nav>
    </Layout>
  );
};
