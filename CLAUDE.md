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
  - `finance/` - Brokerage statement parser and financial planning (Python)
- `mcp-servers/` - MCP server implementations
  - `todos/` - Task manager MCP server (Python)
  - `midi/` - MIDI file generator (TypeScript)
  - `finance/` - Financial statement parser MCP server (Python)
- `integrations/` - Third-party service integrations
- `workflows/` - Multi-step automation workflows

## Available Automations

### Markets (`automations/daily/markets/`)

Displays price data for tracked cryptocurrencies and stocks with multiple timeframes.

**Usage:** `markets` (after setting up alias, see [Script Organization](#script-organization))

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

**Usage:** `wherewasi` (after setting up alias, see [Script Organization](#script-organization))

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

**Usage:** `todos` (after setting up alias, see [Script Organization](#script-organization))

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

### Finance (`automations/tools/finance/`)

Parses brokerage statements (PDFs) and auto-updates the financial planning template. Stores historical snapshots for tracking portfolio over time.

**Usage:** `finance` (after setting up alias, see [Script Organization](#script-organization))

**Features:**

- Parses SoFi/Apex Clearing brokerage statements
- Extracts holdings, income, and retirement account info
- Saves historical snapshots to `.data/finance/snapshots/`
- Auto-updates `personal/finance/FINANCIAL_PLANNING_PROMPT.md` with current values
- Aggregates positions across account types (Cash + On-loan)

**CLI Commands:**

```bash
finance parse <statement.pdf>       # Parse statement, save snapshot, update template
finance parse <file> --no-update    # Parse without updating template
finance parse <file> --json         # Output as JSON

finance history                     # List all historical snapshots
finance history --account roth_ira  # Filter by account type

finance summary                     # Show current portfolio from latest snapshot
finance summary --json              # Output as JSON
```

**Workflow:**

1. Download statement PDF from SoFi
2. Place in `personal/finance/statements/`
3. Run `finance parse <filename>`
4. Template is auto-updated with new Roth IRA value

**Data Files:**

- `.data/finance/snapshots/` - Historical snapshot JSONs (one per statement)
- `personal/finance/statements/` - Statement PDFs
- `personal/finance/FINANCIAL_PLANNING_PROMPT.md` - Planning template (auto-updated)

**MCP Server:** Available via the `finance` MCP server with tools: `parse_statement`, `get_finance_history`, `get_finance_summary`

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

- `finance/` - Financial planning prompts and resources

## Key Patterns

### Script Organization

Each automation script lives in its own subdirectory with a wrapper script at the parent level:

```
automations/daily/
├── markets.sh              # wrapper script (invoke this)
├── wherewasi.sh            # wrapper script (invoke this)
├── markets/
│   ├── markets.py          # actual script
│   ├── requirements.txt
│   └── venv/
└── wherewasi/
    └── wherewasi.js        # actual script
```

**Wrapper scripts** handle environment setup (venv activation, correct paths) so you can run from anywhere.

**Shell aliases** (add to `~/.zshrc` or `~/.bashrc`):

```bash
alias markets="~/claude-agent/automations/daily/markets.sh"
alias wherewasi="~/claude-agent/automations/daily/wherewasi.sh"
alias todos="~/claude-agent/automations/tools/todos.sh"
alias finance="~/claude-agent/automations/tools/finance.sh"
```

After adding aliases, reload your shell: `source ~/.zshrc`

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
