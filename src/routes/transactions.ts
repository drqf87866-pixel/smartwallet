import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../lib/auth';
import { validateTransactionInput } from '../lib/validate';
import {
  nextDueDate,
  occurrenceDates,
  todayBerlin,
  validateRecurringInput,
  withRecurringLabel,
} from '../lib/recurring';

const transactions = new Hono<Env>();

transactions.use('/api/transactions', requireAuth);
transactions.use('/api/transactions/:id', requireAuth);
transactions.use('/api/transactions/:id/recurring', requireAuth);

type TransactionsRow = {
  id: number;
  user_id: number;
  created_by: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  date: string;
  scope: string;
  paid_from: string;
  recurring_id: number | null;
  frequency: string | null;
  day: number | null;
  month: number | null;
};

transactions.get('/api/transactions', async (c) => {
  const month = c.req.query('month'); // optional: "YYYY-MM"
  const householdId = c.get('householdId');
  const binds: (string | number)[] = [householdId];

  let sql = `
    SELECT t.id, t.user_id, u.name AS created_by, t.amount, t.type, t.category,
           t.description, t.date, t.scope, t.paid_from, t.recurring_id,
           rr.frequency, rr.day, rr.month
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN recurring_rules rr ON rr.id = t.recurring_id
    WHERE u.household_id = ?1
  `;
  if (month !== undefined) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return c.json({ error: 'month muss im Format YYYY-MM sein' }, 400);
    }
    // ISO-Strings sortieren lexikographisch → Monatsfilter per Präfix-Match
    sql += ' AND t.date LIKE ?2';
    binds.push(`${month}%`);
  }
  sql += ' ORDER BY t.date DESC LIMIT 200';

  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<TransactionsRow>();
  return c.json({ transactions: results.map(withRecurringLabel) });
});

transactions.post('/api/transactions', async (c) => {
  const body = await c.req.json().catch(() => null);
  const checked = validateTransactionInput(body);
  if ('error' in checked) {
    return c.json({ error: checked.error }, 400);
  }

  const userId = c.get('userId');
  const t = checked.input;
  const created = await c.env.DB.prepare(
    'INSERT INTO transactions (user_id, amount, type, category, description, date, scope, paid_from) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id',
  )
    .bind(userId, t.amount, t.type, t.category, t.description, t.date, t.scope, t.paid_from)
    .first<{ id: number }>();

  return c.json(
    {
      transaction: {
        id: created?.id,
        user_id: userId,
        created_by: c.get('userName'),
        ...t,
      },
    },
    201,
  );
});

/**
 * Lädt eine Transaktion, sofern sie zum Haushalt des Aufrufers gehört
 * und nicht schreibgeschützt ist (settlement/Beitrag).
 */
async function loadEditableTransaction(
  db: Env['Bindings']['DB'],
  id: number,
  householdId: number,
): Promise<{ row: Record<string, unknown> } | { error: string; status: number }> {
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'Ungültige Transaktions-ID', status: 400 };
  }
  const { results } = await db
    .prepare(
      `SELECT t.id, t.user_id, t.amount, t.type, t.category, t.description,
              t.date, t.scope, t.paid_from, t.recurring_id
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = ?1 AND u.household_id = ?2
       LIMIT 1`,
    )
    .bind(id, householdId)
    .all();
  const row = results[0];
  if (!row) {
    return { error: 'Transaktion nicht gefunden', status: 404 };
  }
  if (row.type === 'settlement' || row.category === 'Beitrag') {
    return { error: 'Ausgleiche und Beiträge können nicht bearbeitet werden', status: 403 };
  }
  return { row };
}

transactions.put('/api/transactions/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const found = await loadEditableTransaction(c.env.DB, id, c.get('householdId'));
  if ('error' in found) {
    return c.json({ error: found.error }, found.status as 400 | 403 | 404);
  }

  const body = await c.req.json().catch(() => null);
  const checked = validateTransactionInput(body);
  if ('error' in checked) {
    return c.json({ error: checked.error }, 400);
  }

  const t = checked.input;
  await c.env.DB.prepare(
    'UPDATE transactions SET amount = ?1, type = ?2, category = ?3, description = ?4, date = ?5, scope = ?6, paid_from = ?7 WHERE id = ?8',
  )
    .bind(t.amount, t.type, t.category, t.description, t.date, t.scope, t.paid_from, id)
    .run();

  // Datum einer wiederkehrenden Occurrence verschoben? Dann den ursprünglichen
  // Fälligkeitstermin merken, damit die Materialization sie nicht neu anlegt.
  const oldRecurringId = found.row.recurring_id;
  const oldDueDate = String(found.row.date).slice(0, 10);
  if (oldRecurringId != null && t.date.slice(0, 10) !== oldDueDate) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO recurring_skips (recurring_id, due_date) VALUES (?1, ?2)',
    )
      .bind(oldRecurringId, oldDueDate)
      .run();
  }

  // Optional direkt als wiederkehrend markieren (ein Request statt PUT + POST)
  const recurringFrequency = (body as Record<string, unknown> | null)?.recurring_frequency;
  if (recurringFrequency !== undefined) {
    const fresh = await loadEditableTransaction(c.env.DB, id, c.get('householdId'));
    if (!('error' in fresh)) {
      const marked = await markTransactionRecurring(
        c.env.DB,
        c.get('householdId'),
        id,
        fresh.row,
        recurringFrequency,
      );
      if ('error' in marked) {
        return c.json({ error: marked.error }, marked.status);
      }
      return c.json(marked);
    }
  }

  return c.json({
    transaction: {
      id,
      user_id: found.row.user_id,
      created_by: c.get('userName'),
      ...t,
    },
  });
});

type MarkRecurringResult =
  | { rule: Record<string, unknown>; next_due: string | null }
  | { error: string; status: 400 | 409 | 500 };

/** Zeilen pro Skip-Insert-Statement (D1-Limit: 100 gebundene Parameter). */
const SKIP_ROWS = 40;

/**
 * Markiert eine Transaktion als wiederkehrend: legt die Regel aus den
 * Transaktionsdaten an, verknüpft die Transaktion als erste Occurrence und
 * skippt alle Occurrence-Daten bis zum Transaktionstermin, damit nichts doppelt
 * gebucht wird.
 *
 * Die Regel startet ab heute (der Tag/Wochentag stammt vom Transaktionsdatum) –
 * dadurch erzeugt das Markieren einer älteren Transaktion keine rückwirkenden
 * Buchungen. Der bedingte UPDATE (recurring_id IS NULL) verhindert
 * Doppel-Regeln bei parallelen Requests; schlägt die Verknüpfung fehl, wird die
 * frische Regel sofort wieder verworfen.
 */
async function markTransactionRecurring(
  db: Env['Bindings']['DB'],
  householdId: number,
  txId: number,
  row: Record<string, unknown>,
  rawFrequency: unknown,
): Promise<MarkRecurringResult> {
  if (row.recurring_id != null) {
    return { error: 'Transaktion gehört bereits einer wiederkehrenden Regel an', status: 409 };
  }
  if (row.type !== 'income' && row.type !== 'expense') {
    return { error: 'Nur Einnahmen und Ausgaben können als wiederkehrend markiert werden', status: 400 };
  }
  if (rawFrequency !== 'weekly' && rawFrequency !== 'monthly' && rawFrequency !== 'yearly') {
    return { error: 'frequency muss "weekly", "monthly" oder "yearly" sein', status: 400 };
  }

  const startDate = String(row.date).slice(0, 10);
  const today = todayBerlin();
  const checked = validateRecurringInput({
    amount: row.amount,
    type: row.type,
    scope: row.scope,
    paid_from: row.paid_from,
    category: row.category,
    description: row.description,
    frequency: rawFrequency,
    start_date: startDate,
  });
  if ('error' in checked) {
    return { error: checked.error, status: 400 };
  }
  const r = checked.input;
  // Regel erst ab heute laufen lassen; die Transaktion selbst ist die erste
  // Occurrence. Alle Regel-Termine bis zum Transaktionsdatum werden geskippt.
  r.start_date = today;
  const skipDates = occurrenceDates(r, today, startDate > today ? startDate : today);

  // user_id der Transaktion (nicht des Bearbeiters) – künftige Occurrences
  // sollen beim ursprünglichen Ersteller landen
  const ruleId = await db
    .prepare(
      `INSERT INTO recurring_rules
         (household_id, user_id, amount, type, category, description, scope, paid_from,
          frequency, day, month, start_date, end_date)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
       RETURNING id`,
    )
    .bind(
      householdId, row.user_id, r.amount, r.type, r.category, r.description,
      r.scope, r.paid_from, r.frequency, r.day, r.month, r.start_date, r.end_date,
    )
    .first<{ id: number }>();
  if (!ruleId) {
    return { error: 'Regel konnte nicht angelegt werden', status: 500 };
  }

  const discardRule = () =>
    db.prepare('DELETE FROM recurring_rules WHERE id = ?1').bind(ruleId.id).run();

  let changes: number;
  try {
    const results = await db.batch([
      db
        .prepare(
          'UPDATE transactions SET recurring_id = ?1 WHERE id = ?2 AND recurring_id IS NULL',
        )
        .bind(ruleId.id, txId),
      ...chunkedSkipInserts(db, ruleId.id, skipDates),
    ]);
    changes = results[0].meta?.changes ?? 0;
  } catch {
    // Verknüpfung fehlgeschlagen → frische Regel verwerfen (recurring_skips
    // hängt per ON DELETE CASCADE an recurring_rules)
    await discardRule();
    return { error: 'Regel konnte nicht verknüpft werden', status: 500 };
  }
  if (changes === 0) {
    // Zwischenzeitlich von einem anderen Request verknüpft → Regel verwerfen
    await discardRule();
    return { error: 'Transaktion gehört bereits einer wiederkehrenden Regel an', status: 409 };
  }

  const rule = {
    id: ruleId.id,
    household_id: householdId,
    user_id: row.user_id as number,
    ...r,
    active: 1,
  };
  return { rule, next_due: nextDueDate(rule, today, new Set(skipDates)) };
}

/** Skip-Inserts mit fester recurring_id, gechunkt wegen des D1-Parameter-Limits. */
function chunkedSkipInserts(
  db: Env['Bindings']['DB'],
  ruleId: number,
  dates: string[],
): D1PreparedStatement[] {
  const inserts: D1PreparedStatement[] = [];
  for (let i = 0; i < dates.length; i += SKIP_ROWS) {
    const chunk = dates.slice(i, i + SKIP_ROWS);
    inserts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO recurring_skips (recurring_id, due_date) VALUES ${chunk
            .map((_, j) => `(?${2 * j + 1}, ?${2 * j + 2})`)
            .join(', ')}`,
        )
        .bind(...chunk.flatMap((d) => [ruleId, d])),
    );
  }
  return inserts;
}

/**
 * Markiert eine bestehende Transaktion als wiederkehrend: es wird eine Regel
 * aus den Transaktionsdaten erzeugt und die Transaktion als erste Occurrence
 * verknüpft (recurring_id).
 */
transactions.post('/api/transactions/:id/recurring', async (c) => {
  const id = Number(c.req.param('id'));
  const found = await loadEditableTransaction(c.env.DB, id, c.get('householdId'));
  if ('error' in found) {
    return c.json({ error: found.error }, found.status as 400 | 403 | 404);
  }

  const body = await c.req.json().catch(() => null);
  const marked = await markTransactionRecurring(
    c.env.DB,
    c.get('householdId'),
    id,
    found.row,
    (body as Record<string, unknown> | null)?.frequency,
  );
  if ('error' in marked) {
    return c.json({ error: marked.error }, marked.status as 400 | 409 | 500);
  }
  return c.json(marked, 201);
});

transactions.delete('/api/transactions/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const found = await loadEditableTransaction(c.env.DB, id, c.get('householdId'));
  if ('error' in found) {
    return c.json({ error: found.error }, found.status as 400 | 403 | 404);
  }

  // Gelöschte Occurrence merken, damit die Materialization sie nicht neu anlegt
  if (found.row.recurring_id != null) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO recurring_skips (recurring_id, due_date) VALUES (?1, ?2)',
    )
      .bind(found.row.recurring_id, String(found.row.date).slice(0, 10))
      .run();
  }

  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?1').bind(id).run();
  return c.json({ ok: true });
});

export default transactions;
