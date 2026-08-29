import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import type { Env } from '../types';

export const COOKIE_NAME = 'sw_token';
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 Tage

export type JwtPayload = {
  uid: number;
  hid: number; // Haushalt
  name: string;
  email: string;
  exp: number;
};

/**
 * Geschützte Routen: liest das HTTP-only-Cookie, verifiziert das JWT
 * und legt userId/userName/userEmail/householdId in den Hono-Kontext.
 */
export async function requireAuth(c: Context<Env>, next: Next) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: 'Nicht eingeloggt' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, c.env.JWT_SECRET, 'HS256');
  } catch {
    return c.json({ error: 'Sitzung ungültig oder abgelaufen – bitte neu einloggen' }, 401);
  }

  const { uid, hid, name, email } = payload;
  if (
    typeof uid !== 'number' ||
    typeof hid !== 'number' ||
    typeof name !== 'string' ||
    typeof email !== 'string'
  ) {
    return c.json({ error: 'Token-Payload ungültig – bitte neu einloggen' }, 401);
  }

  c.set('userId', uid);
  c.set('householdId', hid);
  c.set('userName', name);
  c.set('userEmail', email);
  await next();
}
