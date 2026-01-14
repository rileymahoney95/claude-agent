-- Finance Database Schema
-- PostgreSQL 16+

-- Core time-series data from parsed statements
CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    statement_date DATE NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    account_id VARCHAR(50),
    account_holder VARCHAR(100),
    period_start DATE,
    period_end DATE,
    total_value DECIMAL(12,2) NOT NULL,
    securities_value DECIMAL(12,2),
    fdic_deposits DECIMAL(12,2),
    holdings JSONB NOT NULL,
    income JSONB,
    retirement JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source_file VARCHAR(255),

    UNIQUE(statement_date, account_type)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(statement_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_account ON snapshots(account_type, statement_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_holdings ON snapshots USING GIN(holdings);

-- Manual holdings (crypto, bank accounts, other)
CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(20) NOT NULL,
    key VARCHAR(20) NOT NULL,
    display_name VARCHAR(100),
    quantity DECIMAL(18,8),
    balance DECIMAL(12,2),
    notes TEXT,
    last_updated DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_holdings_category ON holdings(category);

-- User financial profile (key-value for flexibility)
CREATE TABLE IF NOT EXISTS profile (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Separate goals table for better tracking
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    goal_type VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    target DECIMAL(12,2),
    deadline VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical goal snapshots (track progress over time)
CREATE TABLE IF NOT EXISTS goal_progress (
    id SERIAL PRIMARY KEY,
    goal_type VARCHAR(20) NOT NULL REFERENCES goals(goal_type),
    recorded_at DATE NOT NULL,
    current_value DECIMAL(12,2),
    progress_pct DECIMAL(5,2),
    monthly_required DECIMAL(10,2),
    on_track BOOLEAN,

    UNIQUE(goal_type, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON goal_progress(goal_type, recorded_at DESC);

-- Cache for external API data (CoinGecko, yfinance)
CREATE TABLE IF NOT EXISTS market_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(50) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_cache_expiry ON market_cache(expires_at);

-- Audit log for data changes
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    record_id INTEGER,
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(changed_at DESC);
