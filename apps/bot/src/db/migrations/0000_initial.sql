CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  wallet_address TEXT,
  privy_user_id TEXT,
  risk_appetite TEXT DEFAULT 'balanced' NOT NULL,
  monitoring_frequency TEXT DEFAULT '4h' NOT NULL,
  daily_summary_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  large_moves_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  position_changes_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  token TEXT NOT NULL,
  threshold DECIMAL(18, 8) NOT NULL,
  direction TEXT DEFAULT 'above' NOT NULL,
  triggered BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tx_signature TEXT UNIQUE,
  type TEXT NOT NULL,
  details JSONB,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
