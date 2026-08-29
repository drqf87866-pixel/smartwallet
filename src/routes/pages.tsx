import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import type { Env } from '../types';
import { COOKIE_NAME } from '../lib/auth';
import { LoginView } from '../views/login';
import { RegisterView } from '../views/register';
import { DashboardView, type DebtRow, type DashboardTx } from '../views/dashboard';
import { SettingsView } from '../views/settings';

const pages = new Hono<Env>();

type AuthInfo = { uid: number; hid: number; name: string; email: string };

/** Cookie-basierte Auth-Prüfung für Seiten: bei Misserfolg wird redirectet statt 401 JSON. */
async function getAuth(c: Context<Env>): Promise<AuthInfo | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    if (
      typeof payload.uid !== 'number' ||
      typeof payload.hid !== 'number' ||
      typeof payload.name !== 'string'
    ) {
      return null;
    }
    return {
      uid: payload.uid,
      hid: payload.hid,
      name: payload.name,
      email: String(payload.email ?? ''),
    };
  } catch {
    return null;
  }
}

function monthParam(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: 1 | -1): string {
  const [year, m] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

const toNumber = (value: string | undefined, fallback = 0): number => {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

pages.get('/', async (c) => c.redirect((await getAuth(c)) ? '/dashboard' : '/login'));

pages.get('/login', async (c) => {
  if (await getAuth(c)) return c.redirect('/dashboard');
  return c.html(<LoginView />);
});

pages.get('/register', async (c) => {
  if (await getAuth(c)) return c.redirect('/dashboard');
  const code = c.req.query('code') ?? '';
  return c.html(<RegisterView initialCode={code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()} />);
});

pages.get('/settings', async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.redirect('/login');

  const hid = auth.hid;
  const household = await c.env.DB
    .prepare('SELECT name, invite_code FROM households WHERE id = ?1')
    .bind(hid)
    .first<{ name: string; invite_code: string }>();
  const { results: members } = await c.env.DB
    .prepare('SELECT id, name, monthly_contribution FROM users WHERE household_id = ?1 ORDER BY id')
    .bind(hid)
    .all<{ id: number; name: string; monthly_contribution: number }>();
  const { results: settingRows } = await c.env.DB
    .prepare("SELECT value FROM settings WHERE household_id = ?1 AND key = 'joint_start_balance'")
    .bind(hid)
    .all<{ value: string }>();
  const me = members.find((m) => m.id === auth.uid);

  return c.html(
    <SettingsView
      userName={auth.name}
      userEmail={auth.email}
      householdName={household?.name ?? 'Haushalt'}
      inviteCode={household?.invite_code ?? ''}
      members={members}
      myContribution={me?.monthly_contribution ?? 0}
      startBalance={toNumber(settingRows[0]?.value)}
    />,
  );
});

pages.get('/dashboard', async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.redirect('/login');

  const hid = auth.hid;
  const uid = auth.uid;
  const month = monthParam(c.req.query('month'));
  const prefix = `${month}%`;
  const currentPrefix = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}%`;

  // Haushalt & Mitglieder
  const household = await c.env.DB
    .prepare('SELECT name, invite_code FROM households WHERE id = ?1')
    .bind(hid)
    .first<{ name: string; invite_code: string }>();
  const { results: members } = await c.env.DB
    .prepare('SELECT id, name FROM users WHERE household_id = ?1 ORDER BY id')
    .bind(hid)
    .all<{ id: number; name: string }>();
  const memberCount = members.length;

  // Einstellungen (pro Haushalt) + eigener Monatsbeitrag
  const { results: settingRows } = await c.env.DB
    .prepare('SELECT key, value FROM settings WHERE household_id = ?1')
    .bind(hid)
    .all<{ key: string; value: string }>();
  const settingsMap = new Map(settingRows.map((row) => [row.key, row.value]));
  const settings = {
    start: toNumber(settingsMap.get('joint_start_balance')),
  };
  const myContribution =
    (
      await c.env.DB.prepare('SELECT monthly_contribution FROM users WHERE id = ?1')
        .bind(uid)
        .first<{ monthly_contribution: number }>()
    )?.monthly_contribution ?? 0;

  // Karte 1: privater Saldo – private Einnahmen/Ausgaben, meine Beiträge, Ausgleiche
  const privateBalance =
    (
      await c.env.DB.prepare(
        `SELECT COALESCE(SUM(v), 0) AS bal FROM (
           SELECT CASE WHEN type = 'income' THEN amount ELSE -amount END AS v
           FROM transactions
           WHERE user_id = ?1 AND paid_from = 'private' AND type IN ('income', 'expense')
           UNION ALL
           SELECT -amount AS v FROM transactions WHERE user_id = ?1 AND type = 'transfer'
           UNION ALL
           SELECT CASE WHEN user_id = ?1 THEN -amount ELSE amount END AS v
           FROM transactions
           WHERE type = 'settlement' AND (user_id = ?1 OR counterpart_id = ?1)
         )`,
      )
        .bind(uid)
        .first<{ bal: number }>()
    )?.bal ?? 0;

  // Karte 2: Gemeinschaftskonto – Startstand + Beiträge − gemeinsame Ausgaben vom Konto
  const pot = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END), 0) AS transfers,
       COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.paid_from = 'joint' THEN t.amount ELSE 0 END), 0) AS joint_expenses
     FROM transactions t
     WHERE t.user_id IN (SELECT id FROM users WHERE household_id = ?1)`,
  )
    .bind(hid)
    .first<{ transfers: number; joint_expenses: number }>();
  const jointPot = {
    saldo: Math.round((settings.start + (pot?.transfers ?? 0) - (pot?.joint_expenses ?? 0)) * 100) / 100,
    start: settings.start,
    transfers: pot?.transfers ?? 0,
  };

  // Karte 3: gemeinsame Ausgaben im Monat, aufgeteilt nach Bezahltkonto
  const sharedMonthRow = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN paid_from = 'joint' THEN amount ELSE 0 END), 0) AS from_joint,
       COALESCE(SUM(CASE WHEN paid_from = 'private' THEN amount ELSE 0 END), 0) AS advanced
     FROM transactions
     WHERE scope = 'shared' AND type = 'expense' AND date LIKE ?2
       AND user_id IN (SELECT id FROM users WHERE household_id = ?1)`,
  )
    .bind(hid, prefix)
    .first<{ from_joint: number; advanced: number }>();
  const sharedMonth = {
    total: Math.round(((sharedMonthRow?.from_joint ?? 0) + (sharedMonthRow?.advanced ?? 0)) * 100) / 100,
    advanced: sharedMonthRow?.advanced ?? 0,
  };

  // Karte 4: paarweise Schulden – private Vorschüsse gleicheilig 1/N umgelegt,
  // reduziert um Ausgleichszahlungen zwischen dem Paar
  const { results: advanceRows } = await c.env.DB
    .prepare(
      `SELECT u.id, u.name, COALESCE(SUM(t.amount), 0) AS adv
       FROM users u
       LEFT JOIN transactions t
         ON t.user_id = u.id AND t.scope = 'shared' AND t.type = 'expense' AND t.paid_from = 'private'
       WHERE u.household_id = ?1
       GROUP BY u.id, u.name`,
    )
    .bind(hid)
    .all<{ id: number; name: string; adv: number }>();
  const advByMember = new Map(advanceRows.map((row) => [row.id, row.adv]));
  const myAdvances = advByMember.get(uid) ?? 0;

  const { results: mySettlements } = await c.env.DB
    .prepare(
      'SELECT user_id, counterpart_id, amount FROM transactions WHERE type = \'settlement\' AND (user_id = ?1 OR counterpart_id = ?1)',
    )
    .bind(uid)
    .all<{ user_id: number; counterpart_id: number | null; amount: number }>();
  const settledByMe = new Map<number, number>(); // ich habe an X gezahlt
  const settledToMe = new Map<number, number>(); // X hat an mich gezahlt
  for (const row of mySettlements) {
    if (row.user_id === uid && row.counterpart_id !== null) {
      settledByMe.set(row.counterpart_id, (settledByMe.get(row.counterpart_id) ?? 0) + row.amount);
    } else if (row.counterpart_id === uid) {
      settledToMe.set(row.user_id, (settledToMe.get(row.user_id) ?? 0) + row.amount);
    }
  }

  const debts: DebtRow[] = [];
  for (const member of members) {
    if (member.id === uid) continue;
    const net =
      ((advByMember.get(member.id) ?? 0) - myAdvances) / memberCount -
      (settledByMe.get(member.id) ?? 0) +
      (settledToMe.get(member.id) ?? 0);
    const rounded = Math.round(net * 100) / 100;
    if (Math.abs(rounded) < 0.01) continue;
    debts.push({
      otherId: member.id,
      other: member.name,
      kind: rounded > 0 ? 'you-owe' : 'owed-to-you',
      amount: Math.abs(rounded),
    });
  }
  debts.sort((a, b) => b.amount - a.amount);

  // Schnellbutton: eigener Beitrag für den aktuellen Monat schon gebucht?
  const contributionBooked =
    myContribution > 0 &&
    (
      await c.env.DB.prepare(
        "SELECT COUNT(*) AS n FROM transactions WHERE type = 'transfer' AND category = 'Beitrag' AND user_id = ?1 AND date LIKE ?2",
      )
        .bind(uid, currentPrefix)
        .first<{ n: number }>()
    )?.n! > 0;

  // Historie des Haushalts im gewählten Monat
  const { results: transactions } = await c.env.DB.prepare(
    `SELECT t.id, u.name AS created_by, t.amount, t.type, t.category, t.description, t.date, t.scope, t.paid_from
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE u.household_id = ?1 AND t.date LIKE ?2
     ORDER BY t.date DESC, t.id DESC
     LIMIT 100`,
  )
    .bind(hid, prefix)
    .all<DashboardTx>();

  const monthLabel = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));

  return c.html(
    <DashboardView
      userName={auth.name}
      householdName={household?.name ?? 'Haushalt'}
      members={members}
      monthLabel={monthLabel}
      prevMonth={shiftMonth(month, -1)}
      nextMonth={shiftMonth(month, 1)}
      privateBalance={privateBalance}
      jointPot={jointPot}
      sharedMonth={sharedMonth}
      debts={debts}
      settings={settings}
      myContribution={myContribution}
      contributionBooked={contributionBooked}
      transactions={transactions}
      today={new Date().toISOString().slice(0, 10)}
    />,
  );
});

export default pages;
