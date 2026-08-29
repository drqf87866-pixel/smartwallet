import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';

const me = new Hono<Env>();

me.use('/api/me/*', requireAuth);

/**
 * Eigener Monatsbeitrag des angemeldeten Mitglieds – ersetzt den
 * früheren haushaltsweiten Fixbetrag. Wird per „Beitrag buchen“ als
 * Transfer aufs Gemeinschaftskonto gebucht.
 */
me.put('/api/me/contribution', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const raw = body?.amount;
  const amount =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string'
        ? Number.parseFloat(raw.replace(',', '.'))
        : NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    return c.json({ error: 'amount muss eine Zahl ≥ 0 sein' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET monthly_contribution = ?1 WHERE id = ?2')
    .bind(Math.round(amount * 100) / 100, c.get('userId'))
    .run();

  return c.json({ ok: true, amount: Math.round(amount * 100) / 100 });
});

/**
 * Passwort ändern: aktuelles Passwort verifizieren, dann neu hashen.
 * Die laufende Sitzung bleibt gültig (JWT hängt nicht am Passwort).
 */
me.put('/api/me/password', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const current = typeof body?.current_password === 'string' ? body.current_password : '';
  const next = typeof body?.new_password === 'string' ? body.new_password : '';
  if (!current || !next) {
    return c.json({ error: 'Bitte aktuelles und neues Passwort angeben' }, 400);
  }
  if (next.length < 8) {
    return c.json({ error: 'Das neue Passwort muss mindestens 8 Zeichen haben' }, 400);
  }

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1')
    .bind(c.get('userId'))
    .first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return c.json({ error: 'Das aktuelle Passwort ist nicht korrekt' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET password_hash = ?1 WHERE id = ?2')
    .bind(await hashPassword(next), c.get('userId'))
    .run();

  return c.json({ ok: true });
});

export default me;
