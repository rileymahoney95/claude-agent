# Finance CLI Usage

## Quick Start

```bash
# Monthly workflow
finance pull                    # Import statements from Downloads
finance holdings set crypto.BTC 0.5   # Update crypto quantities
finance holdings set bank.hysa 15000  # Update bank balances
finance portfolio               # View unified portfolio
finance advise                  # Get recommendations
```

## Commands

### Statement Management

```bash
finance pull                    # Pull all statements from ~/Downloads
finance pull --latest           # Only the most recent statement
finance parse <file.pdf>        # Parse a single statement
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
finance holdings set bank.hysa 12000  # Set bank balance
finance holdings set other.hsa 2000   # Set other account
finance holdings set crypto.DOGE 0    # Set to 0 to effectively remove
finance holdings check          # Check if data is stale (>7 days)
```

### Profile & Planning

```bash
finance profile                 # View financial profile
finance profile --edit          # Edit interactively
finance plan                    # Generate planning prompt (clipboard + file)
finance advise                  # Get recommendations
finance advise --focus goals    # Focus: goals, rebalance, surplus
```

### Database (Optional)

```bash
finance db start                # Start PostgreSQL container
finance db status               # Check connection
finance db migrate              # Import JSON data to database
finance db stop                 # Stop container
finance db export               # Export to JSON
finance db reset                # Clear all data (danger!)

# API with database
finance-api --db                # Start API with PostgreSQL backend

# CLI with database
export FINANCE_USE_DATABASE=true
finance portfolio               # Now reads from database
```

## Data Files

| File | Purpose |
|------|---------|
| `.data/finance/snapshots/` | Historical statement snapshots |
| `.config/finance-profile.json` | Your financial profile |
| `.config/holdings.json` | Manual holdings (crypto, bank, other) |
| `personal/finance/statements/` | Archived statement PDFs |

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
