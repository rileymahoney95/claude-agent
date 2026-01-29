# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a personal automation assistant repository for managing daily tasks and workflows. It serves as a central hub for automation scripts, configuration, and data management.

## Architecture

### Core Components

**`.data/` - Runtime Data Store (gitignored)**

- `context/` - Maintains conversation and task context across automation runs
- `cache/` - Temporary cached data
- `logs/` - Execution logs and debugging information
- Agent preferences: `autoLog: true`, `logLevel: "info"`, `contextRetention: "7days"`

**`.config/` - Configuration (gitignored)**

- `agent-preferences.json` - Agent behavior settings (auto-logging, log level, context retention)
- `mcp-servers.json` - MCP server configurations for filesystem access
- `watchlist.json` - Financial assets watchlist (cryptocurrencies and stocks)

**`links/` - Symlink Hub**

- Provides centralized access to external directories:
  - `links/desktop` → `~/Desktop`
  - `links/documents` → `~/Documents`
  - `links/projects` → `~/Documents/Projects`
- MCP filesystem server is configured to access these symlinks

**`automations/` - Automation Scripts**

- `daily/` - Daily recurring tasks (each script in its own subdirectory)
  - `markets/` - Financial market tracker (Python)
  - `wherewasi/` - Project context restorer (Node.js)
- `tools/` - General-purpose tools
  - `todos/` - Personal task manager (Python)
- `mcp-servers/` - MCP server implementations
  - `todos/` - Task manager MCP server (Python)
  - `midi/` - MIDI file generator (TypeScript)
- `integrations/` - Third-party service integrations
- `workflows/` - Multi-step automation workflows

**`finance/` - Financial Planning & Portfolio Tools**

- `cli/` - Finance CLI tool (Python)
  - `finance.py` - Main CLI for statement parsing and planning
  - `parsers/` - Brokerage statement parsers (SoFi/Apex)
  - `aggregator.py` - Unified portfolio view across accounts
  - `analyzer.py` - Goal/allocation analysis + market context
  - `advisor.py` - Recommendation engine with priority logic
  - `projections.py` - Projection settings, historical data, asset class mapping
  - `session.py` - Advisor session prompt generation for Claude planning
- `api/` - FastAPI REST server for web UI
- `mcp/` - Finance MCP server
- `templates/` - Planning prompt templates
- `finance.sh` - CLI wrapper script
- `finance-api.sh` - API server wrapper script
- `venv/` - Shared virtual environment

## Available Automations

### Markets (`automations/daily/markets/`)

Displays price data for tracked cryptocurrencies and stocks with multiple timeframes.

**Usage:** `markets` (requires PATH setup, see [Script Organization](#script-organization))

**Features:**

- Tracks assets defined in `.config/watchlist.json`
- Stocks organized by category: Index Funds, ETFs, Individual
- Shows current price + 24h/7d/3mo/1yr changes
- Colored terminal output (green=gains, red=losses)
- Saves logs to `.data/logs/markets-YYYY-MM-DD.log`

**CLI Options:**

- `--show-config` - Display config file paths
- `--crypto-only` / `--stocks-only` - Filter output
- `--json` - Output as JSON
- `--no-log` - Skip log file

**Data Sources:**

- Crypto: CoinGecko API (free, no key required)
- Stocks: Yahoo Finance via yfinance

### Where Was I? (`automations/daily/wherewasi/`)

Context restorer CLI that scans all git repos in `~/Documents/Projects` and shows where you left off.

**Usage:** `wherewasi` (requires PATH setup, see [Script Organization](#script-organization))

**Features:**

- Finds all git repos in `links/projects` (→ ~/Documents/Projects)
- Shows uncommitted changes (staged, modified, untracked)
- Shows stash count
- Shows recent commits (last 7 days or 5 commits)
- Finds TODOs (TODO.md files + TODO:/FIXME: comments in source)
- Filters out clean repos with no recent activity (use `--all` to show all)
- Parallel processing for fast execution

**CLI Options:**

- `--all` - Show all repos including inactive clean ones
- `--json` - Output as JSON
- `--path <dir>` - Override default projects path

### TODOs (`automations/tools/todos/`)

Personal task manager with CLI and MCP server interfaces.

**Usage:** `todos` (requires PATH setup, see [Script Organization](#script-organization))

**Features:**

- Add, complete, edit, and delete tasks
- Categories, priorities (low/medium/high), and due dates
- Fuzzy matching for completing tasks by partial text
- Natural language due dates ("tomorrow", "next friday", "in 3 days")
- File locking for safe concurrent access
- JSON output mode for MCP integration

**CLI Commands:**

```bash
todos                              # List pending tasks
todos list --all                   # Include completed tasks
todos list --category work         # Filter by category
todos list --priority high         # Filter by priority
todos list --due today             # Due today or overdue

todos add "Task description"       # Add a task
todos add "Task" -c work -p high   # With category and priority
todos add "Task" -d tomorrow       # With due date

todos done a1b2                    # Complete by ID
todos done groceries               # Complete by text match

todos edit a1b2 --text "New text"  # Edit task
todos edit a1b2 --due "next week"  # Change due date

todos remove a1b2                  # Delete task (with confirmation)
todos rm a1b2 --force              # Delete without confirmation

todos categories                   # List categories
todos categories add finance       # Add category
todos categories remove old        # Remove category

todos archive                      # Archive completed > 30 days old
todos archive --before "2025-01-01" # Archive completed before date
todos archive --all                # Archive ALL completed tasks
```

**Data Files:**

- `.data/todos.json` - Task persistence
- `.data/todos-archive.json` - Archived completed tasks
- `.config/todos-config.json` - User preferences

**MCP Server:** Available via the `todos` MCP server with tools: `get_todos`, `add_todo`, `complete_todo`, `update_todo`, `delete_todo`, `get_categories`, `add_category`, `delete_category`, `archive_todos`

### Finance (`finance/`)

Parses brokerage statements (PDFs) and auto-updates the financial planning template. Stores historical snapshots for tracking portfolio over time. Manages manual holdings (crypto, bank accounts) with live price fetching. Generate populated planning prompts for Claude sessions.

**Usage:** `finance` (requires PATH setup, see [Script Organization](#script-organization))

**Features:**

- Pull all statements from Downloads with one command (batch processing)
- Parses SoFi/Apex Clearing brokerage statements (Roth IRA, Brokerage, Traditional IRA)
- Extracts holdings, income, and retirement account info
- Saves historical snapshots to `.data/finance/snapshots/`
- Auto-updates `finance/templates/FINANCIAL_PLANNING_PROMPT.md` with current values
- Aggregates positions across account types (Cash + On-loan)
- Manual holdings management (crypto, bank accounts, HSA) with live CoinGecko prices
- Unified portfolio view across all accounts with category breakdown (retirement, equities, crypto, cash)
- Goal progress analysis with on-track status and monthly requirements
- Allocation analysis comparing current vs recommended targets with drift detection
- Market context with BTC/ETH/S&P 500 data and opportunity detection
- **Financial advisor** with prioritized recommendations (rebalancing, surplus allocation, opportunities)
- **Portfolio projections** with Coast FIRE calculations, scenario management, and historical data
- Generate populated planning prompts for financial planning sessions
- **Advisor sessions** - Export comprehensive prompts with portfolio, goals, and recommendations for Claude

**CLI Commands:**

```bash
finance pull                        # Pull ALL statements from Downloads (default)
finance pull --latest               # Only pull the most recent statement
finance pull --no-update            # Pull without updating template

finance parse <statement.pdf>       # Parse statement, save snapshot, update template
finance parse <file> --no-update    # Parse without updating template
finance parse <file> --json         # Output as JSON

finance history                     # List all historical snapshots
finance history --account roth_ira  # Filter by account type

finance summary                     # Show current portfolio from latest snapshot
finance summary --json              # Output as JSON

finance portfolio                   # Unified view across all accounts (snapshots + holdings)
finance portfolio --no-prices       # Skip live crypto price fetch
finance portfolio --json            # Output as JSON

finance holdings                    # Display all holdings with live crypto prices
finance holdings --json             # Output as JSON
finance holdings set crypto.BTC 0.5 # Set crypto quantity
finance holdings set crypto.ETH 2.0 --notes "Coinbase"
finance holdings set bank.hysa 12000  # Set bank balance
finance holdings set other.hsa 2000   # Set other account balance
finance holdings check              # Check if holdings data is stale (> 7 days)

finance profile                     # View financial profile
finance profile --edit              # Interactively edit profile
finance profile --json              # Output as JSON

finance plan                        # Save to PLANNING_SESSION.md + copy to clipboard
finance plan --advisor              # Generate advisor session with recommendations
finance plan --no-save              # Only copy to clipboard
finance plan --no-copy              # Only save to file
finance plan --json                 # Output as JSON with prompt text

finance advise                      # Get prioritized financial recommendations
finance advise --focus goals        # Focus on goal-related recommendations
finance advise --focus rebalance    # Focus on allocation/rebalancing
finance advise --focus surplus      # Focus on surplus allocation
finance advise --json               # Output as JSON

finance db status                   # Check database status
finance db migrate                  # Migrate JSON data to SQLite
finance db export                   # Export database to JSON
finance db reset                    # Reset database (delete SQLite file)
```

**Workflow:**

1. Download statement PDFs from SoFi (all accounts)
2. Run `finance pull` to process all statements
3. Statements are moved to `personal/finance/statements/`, parsed, and template updated
4. Update manual holdings with `finance holdings set` (crypto quantities, bank balances)
5. Run `finance plan` for basic planning prompt, or `finance plan --advisor` for comprehensive session with recommendations

**Data Files:**

- `.data/finance/finance.db` - SQLite database (primary storage)
- `.data/finance/snapshots/` - Historical snapshot JSONs (backup)
- `personal/finance/statements/` - Statement PDFs (personal data)
- `finance/templates/FINANCIAL_PLANNING_PROMPT.md` - Planning template (auto-updated)
- `finance/templates/PLANNING_SESSION.md` - Generated planning session output
- `finance/templates/ADVISOR_SESSION.md` - Generated advisor session output
- `.config/finance-profile.json` - User financial profile
- `.config/holdings.json` - Manual holdings (crypto, bank accounts, other)

**Supported Crypto Symbols:** BTC, ETH, SOL, DOGE, ADA, XRP, AVAX, DOT, MATIC, LINK (prices fetched from CoinGecko)

**MCP Server:** Available via the `finance` MCP server with tools: `pull_statement`, `parse_statement`, `get_finance_history`, `get_finance_summary`, `get_portfolio`, `generate_planning_prompt`, `get_holdings`, `set_holding`, `check_holdings_freshness`, `get_financial_advice`

**API Server:** `finance-api` starts FastAPI on port 8000. Endpoints: `/api/v1/portfolio`, `/api/v1/holdings`, `/api/v1/profile`, `/api/v1/advice`, `/api/v1/statements/history`, `/api/v1/projection/*`, `/api/v1/session`. OpenAPI docs at `/docs`.

**Database:** SQLite database at `.data/finance/finance.db` (no Docker required). Run `finance db migrate` to initialize. Set `FINANCE_USE_DATABASE=false` to use only JSON files. See `finance/USAGE.md` for details.

**Development Environment:** `finance-dev` starts API server and web app with one command:

```bash
finance-dev              # Start all services and tail logs
finance-dev --quiet      # Start without tailing logs
finance-dev --logs       # Tail logs from running services
finance-dev --status     # Check what's running
finance-dev --stop       # Stop all services
finance-dev --restart    # Stop then start all services
```

Services started:

- FastAPI server (port 8000, with `--reload` for development)
- Next.js web app (port 3000)
- SQLite database (auto-managed, no separate process)

The script is idempotent - it won't restart services that are already running. Ctrl+C detaches from logs but keeps services running. Use `finance-dev --stop` to fully stop all services.

### MIDI Generator (`automations/mcp-servers/midi/`)

MCP server for generating MIDI files with music theory utilities.

**MCP Tools:**

- `generate_midi` - Creates .mid files from note data (pitch, time, duration, velocity). Accepts note names (C4, D#5) or MIDI numbers. Returns embedded file for download.
- `generate_pattern` - High-level pattern generator. Creates chord progressions, arpeggios, basslines, and drum patterns from simple parameters.
- `get_scale` - Get notes for any scale (major, minor, modes, pentatonic, blues, etc.). Returns note names and MIDI numbers.
- `get_chord` - Get notes for any chord (major, minor, 7ths, sus, dim, aug, etc.). Supports inversions.
- `get_key_info` - Get key signature info (sharps/flats, scale notes, relative key).

**Pattern Types (for generate_pattern):**

- `chord_progression` - Roman numeral progressions (I-IV-V-I, ii-V-I, I-V-vi-IV, etc.)
- `arpeggio` - Styles: up, down, up_down, broken (Alberti bass)
- `bassline` - Styles: root, root_fifth, walking
- `drums` - Styles: rock, jazz, electronic

**Scale Types:** major, natural_minor, harmonic_minor, melodic_minor, pentatonic_major, pentatonic_minor, blues, dorian, phrygian, lydian, mixolydian, locrian, whole_tone, chromatic

**Chord Types:** major, minor, diminished, augmented, sus2, sus4, major7, minor7, dominant7, diminished7, half_diminished7, augmented7, major9, minor9, dominant9, add9, add11, 6, minor6

**Output:** Files saved to `automations/mcp-servers/midi/output/`

**Build:** `npm run build` in the midi directory

**`scripts/` - Utility Scripts**

- `setup/` - Initial setup and installation scripts
- `maintenance/` - Cleanup and maintenance utilities

**`docs/` - Development Documentation**

- `guides/` - How-to documentation (e.g., building MCP servers)
- `templates/` - Reusable code and config templates

**`personal/` - Personal Life Content**

- `finance/statements/` - Brokerage statement PDFs (personal data)

## Key Patterns

### Script Organization

Each automation script lives in its own subdirectory with a wrapper script at the parent level:

```
automations/daily/
├── markets.sh              # wrapper script
├── wherewasi.sh            # wrapper script
├── markets/
│   ├── markets.py          # actual script
│   ├── requirements.txt
│   └── venv/
└── wherewasi/
    └── wherewasi.js        # actual script
```

**Wrapper scripts** handle environment setup (venv activation, correct paths) so you can run from anywhere.

**CLI Setup** - Add the `bin/` directory to PATH (add to `~/.zshrc` or `~/.bashrc`):

```bash
export PATH="$HOME/Documents/Projects/claude-agent/bin:$PATH"
```

The `bin/` directory contains symlinks to all CLI tools:

```
bin/
├── markets → ../automations/daily/markets.sh
├── wherewasi → ../automations/daily/wherewasi.sh
├── todos → ../automations/tools/todos.sh
├── finance → ../finance/finance.sh
├── finance-api → ../finance/finance-api.sh
└── finance-dev → ../finance/finance-dev.sh
```

After updating PATH, reload your shell: `source ~/.zshrc`

### Data Persistence

- All runtime data goes in `.data/` (gitignored)
- Configuration files go in `.config/` (gitignored)
- Context is maintained across sessions in `.data/context/`
- Logs are automatically written to `.data/logs/` when autoLog is enabled

### File Access

- Use symlinks in `links/` to access external directories
- The MCP filesystem server is configured to access `~/claude-agent/links`
- Never hardcode paths to Desktop, Documents, or Projects - use the symlinks instead

### Security

- Sensitive files (.env, .key, .pem) are gitignored
- Configuration files containing credentials stay in `.config/`
- Keep the `.data/**` pattern in .gitignore to prevent data leaks
