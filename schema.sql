-- SmartWallet – D1 Schema
-- Anwenden mit: npm run db:init   (lokal)
--           bzw: npm run db:init:remote   (produktive D1)
-- Kompletter Reset (lokal, löscht Daten!): npm run db:reset
-- Migration bestehender Instanzen: migrations/002_households.sql

-- Haushalte: Registrierung erstellt einen neuen Haushalt oder tritt per
-- Einladungscode einem bestehenden bei (beliebig viele Mitglieder).
CREATE TABLE IF NOT EXISTS households (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- type:      income    = Geld geht auf das Konto in paid_from
--            expense   = Geld verlässt das Konto in paid_from
--            transfer  = Monatsbeitrag: verlässt das Privatkonto von user_id,
--                        landet auf dem Gemeinschaftskonto
--            settlement = Ausgleichszahlung: von user_id an counterpart_id
--                        (beide Privatkonto)
-- paid_from: Konto, über das abgewickelt wurde ('private' | 'joint')
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id  INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0 -- Haushaltsgründer
);

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        REAL    NOT NULL CHECK (amount > 0),
  type          TEXT    NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'settlement')),
  category      TEXT    NOT NULL DEFAULT 'Sonstiges',
  description   TEXT    NOT NULL DEFAULT '',
  date          TEXT    NOT NULL, -- ISO 8601 (UTC), z. B. '2026-08-29T14:30:00.000Z'
  scope         TEXT    NOT NULL CHECK (scope IN ('personal', 'shared')),
  paid_from     TEXT    NOT NULL DEFAULT 'joint' CHECK (paid_from IN ('private', 'joint')),
  counterpart_id INTEGER REFERENCES users(id) -- nur type='settlement': Empfänger
);

CREATE INDEX IF NOT EXISTS idx_transactions_user  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date  ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope);

-- Schlüssel-Werte-Speicher pro Haushalt:
--   joint_start_balance = Startstand des Gemeinschaftskontos (Zahl als TEXT)
--   joint_contribution  = Fixbetrag pro Person/Monat (Zahl als TEXT)
CREATE TABLE IF NOT EXISTS settings (
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  PRIMARY KEY (household_id, key)
);
