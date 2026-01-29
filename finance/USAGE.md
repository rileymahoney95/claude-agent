# Finance CLI Usage

## Quick Start

### Setup

1. **Install dependencies:**
   ```bash
   cd finance
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   ```

2. **Set up Claude API key (for AI expense categorization):**
   
   Option A: Create a `.env` file in the repo root:
   ```bash
   # In the finance repo root
   ANTHROPIC_API_KEY=your-api-key-here
   ```
   
   Option B: Set environment variable in your shell:
   ```bash
   export ANTHROPIC_API_KEY=your-api-key-here
   ```
   
   Get your API key from: https://console.anthropic.com/
   
   Note: AI features (categorization, spending insights) are optional. Use `--no-categorize` to skip categorization.

```bash
# Monthly workflow
finance pull                    # Import statements from Downloads
finance holdings set crypto.BTC 0.5   # Update crypto quantities
finance holdings set bank.hysa 15000  # Update bank balances
finance portfolio               # View unified portfolio
finance advise                  # Get recommendations
finance expenses insights       # AI spending insights
```

## Commands

### Statement Management

```bash
finance pull                    # Pull all statements from ~/Downloads
finance pull --latest           # Only the most recent statement
finance pull --no-update        # Pull without updating template
finance parse <file.pdf>        # Parse a single statement
finance parse <file> --no-update # Parse without updating template
finance history                 # List all snapshots
finance history --account roth_ira    # Filter by account
```

### Portfolio & Holdings

```bash
finance portfolio               # Unified view across all accounts
finance portfolio --no-prices   # Skip live crypto prices
finance summary                 # Latest brokerage snapshot only

finance holdings                # View holdings with live prices
finance holdings set crypto.BTC 0.5   # Set crypto quantity
finance holdings set crypto.BTC 0.5 --notes "Coinbase"  # With notes (crypto only)
finance holdings set bank.hysa 12000  # Set bank balance
finance holdings set other.hsa 2000   # Set other account
finance holdings set crypto.DOGE 0    # Set to 0 to effectively remove
finance holdings check          # Check if data is stale (>7 days)
```

### Profile & Planning

```bash
finance profile                 # View financial profile
finance profile --edit          # Edit interactively
finance profile --reset         # Clear and re-enter all values
finance plan                    # Generate planning prompt (clipboard + file)
finance plan --no-save          # Only copy to clipboard
finance plan --no-copy          # Only save to file
finance advise                  # Get recommendations
finance advise --focus goals    # Focus: goals, rebalance, surplus, opportunities
finance advise --focus all      # All recommendations (default)

finance expenses insights              # AI spending insights (cached)
finance expenses insights --months 3   # Analyze last 3 months (default)
finance expenses insights --refresh    # Regenerate insights
```

### Database (SQLite)

SQLite is the default storage backend - no setup required.

```bash
finance db status               # Check database status and table counts
finance db migrate              # Import JSON data to SQLite
finance db export               # Export database to JSON
finance db reset                # Delete database file (danger!)
```

Database mode is enabled by default. To use only JSON files:

```bash
export FINANCE_USE_DATABASE=false
finance portfolio               # Now reads from JSON files only
```

## Data Files

| File                           | Purpose                               |
| ------------------------------ | ------------------------------------- |
| `.data/finance.db`             | SQLite database (primary storage)     |
| `.data/snapshots/`             | Historical statement snapshots (backup)|
| `.config/profile.json`         | Your financial profile                |
| `.config/holdings.json`        | Manual holdings (crypto, bank, other) |
| `personal/statements/`         | Archived statement PDFs               |
| `.env`                         | Environment variables (gitignored)    |

## Options

All commands support `--json` for programmatic use (outputs JSON instead of formatted text).

## Crypto Symbols

BTC, ETH, SOL, DOGE, ADA, XRP, AVAX, DOT, MATIC, LINK

Prices fetched from CoinGecko (free API).

## Typical Monthly Workflow

1. Download statements from SoFi to ~/Downloads
2. `finance pull` - imports and parses all statements
3. `finance holdings set crypto.BTC <qty>` - update crypto
4. `finance holdings set bank.hysa <balance>` - update bank
5. `finance portfolio` - review unified view
6. `finance advise` - get recommendations
7. `finance plan` - generate Claude planning prompt

## Development Environment

Start API server and web app with one command:

```bash
finance-dev              # Start all services and tail logs
finance-dev --quiet      # Start without tailing logs
finance-dev --logs       # Tail logs from running services
finance-dev --status     # Check what's running
finance-dev --stop       # Stop all services
finance-dev --restart    # Stop then start all services
```

This starts:
- **API**: FastAPI on port 8000 with auto-reload
- **Web**: Next.js on port 3000
- **Database**: SQLite (auto-managed, no separate process)

URLs when running:
- Web App: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

Ctrl+C detaches from logs but keeps services running. Use `finance-dev --stop` to fully stop.

## Other Interfaces

- **API Server**: `finance-api` starts REST API on port 8000. See `api/USAGE.md`
- **Web UI**: Next.js app in `web/` (run `npm run dev` in that directory)
- **MCP Server**: Available via `finance` MCP server (see CLAUDE.md for tools)
