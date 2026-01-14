-- Finance Database Schema (SQLite)
-- Converted from PostgreSQL schema

-- Core time-series data from parsed statements
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    statement_date TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_id TEXT,
    account_holder TEXT,
    period_start TEXT,
    period_end TEXT,
    total_value REAL NOT NULL,
    securities_value REAL,
    fdic_deposits REAL,
    holdings TEXT NOT NULL,  -- JSON string
    income TEXT,             -- JSON string
    retirement TEXT,         -- JSON string
    created_at TEXT DEFAULT (datetime('now')),
    source_file TEXT,
    UNIQUE(statement_date, account_type)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(statement_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_account ON snapshots(account_type, statement_date DESC);

-- Manual holdings (crypto, bank accounts, other)
CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    display_name TEXT,
    quantity REAL,
    balance REAL,
    notes TEXT,
    last_updated TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_holdings_category ON holdings(category);

-- User financial profile (key-value for flexibility)
CREATE TABLE IF NOT EXISTS profile (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,  -- JSON string
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Separate goals table for better tracking
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_type TEXT NOT NULL UNIQUE,
    description TEXT,
    target REAL,
    deadline TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Historical goal snapshots (track progress over time)
CREATE TABLE IF NOT EXISTS goal_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_type TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    current_value REAL,
    progress_pct REAL,
    monthly_required REAL,
    on_track INTEGER,  -- 0/1 for boolean
    UNIQUE(goal_type, recorded_at),
    FOREIGN KEY (goal_type) REFERENCES goals(goal_type)
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON goal_progress(goal_type, recorded_at DESC);

-- Cache for external API data (CoinGecko, yfinance)
CREATE TABLE IF NOT EXISTS market_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,  -- JSON string
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_cache_expiry ON market_cache(expires_at);

-- Audit log for data changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id INTEGER,
    old_value TEXT,  -- JSON string
    new_value TEXT,  -- JSON string
    changed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(changed_at DESC);

-- Projection scenarios for what-if analysis
CREATE TABLE IF NOT EXISTS projection_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_primary INTEGER DEFAULT 0,  -- 0/1 for boolean
    settings TEXT NOT NULL,  -- JSON string
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projection_scenarios_primary ON projection_scenarios(is_primary);
