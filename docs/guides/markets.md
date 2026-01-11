# Markets Guide

Track cryptocurrency and stock prices with daily briefings.

## Quick Start

```bash
markets
```

That's it. Run from anywhere in your terminal.

## Managing Your Watchlist

Edit `~/.config/watchlist.json` (or run `markets --show-config` to see the path):

```json
{
  "cryptocurrencies": [
    {"id": "bitcoin", "symbol": "BTC", "name": "Bitcoin"},
    {"id": "ethereum", "symbol": "ETH", "name": "Ethereum"}
  ],
  "stocks": {
    "index_funds": [
      {"ticker": "VOO", "name": "Vanguard S&P 500 ETF"}
    ],
    "etfs": [
      {"ticker": "IBIT", "name": "iShares Bitcoin Trust ETF"},
      {"ticker": "ETHA", "name": "iShares Ethereum Trust ETF"}
    ],
    "individual": [
      {"ticker": "AAPL", "name": "Apple Inc."},
      {"ticker": "NVDA", "name": "NVIDIA Corporation"}
    ]
  }
}
```

### Stock Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `index_funds` | Broad market index funds | VOO, VTI, SPY |
| `etfs` | Sector/thematic ETFs | IBIT, ETHA, QQQ |
| `individual` | Individual company stocks | AAPL, NVDA, TSLA |

### Adding Cryptocurrencies

Use the CoinGecko ID (not the symbol). Find IDs at:
https://www.coingecko.com/en/all-cryptocurrencies

| Coin | ID to use |
|------|-----------|
| Bitcoin | `bitcoin` |
| Ethereum | `ethereum` |
| Solana | `solana` |
| Cardano | `cardano` |
| Dogecoin | `dogecoin` |
| XRP | `ripple` |

### Adding Stocks

Use standard ticker symbols:

| Company | Ticker |
|---------|--------|
| Apple | `AAPL` |
| Google | `GOOGL` |
| Microsoft | `MSFT` |
| Tesla | `TSLA` |
| Amazon | `AMZN` |
| NVIDIA | `NVDA` |
| Berkshire Hathaway B | `BRK-B` |

## Command Options

```bash
markets                  # Full briefing (crypto + stocks)
markets --crypto-only    # Only cryptocurrencies
markets --stocks-only    # Only stocks
markets --json           # Output as JSON (for scripting)
markets --no-log         # Don't save to log file
markets --show-config    # Show config file locations
```

## Output Explanation

```
============================================================
                    MARKETS - 2025-12-23 10:30:00
============================================================

CRYPTOCURRENCIES
------------------------------------------------------------
Symbol    Price       24h     7d      3mo      1yr
--------  ----------  ------  ------  -------  -------
BTC       $98,234.56  +2.34%  -1.23%  +45.67%  +156.78%

STOCKS - INDEX FUNDS
------------------------------------------------------------
Ticker    Price       24h     7d      3mo      1yr
--------  ----------  ------  ------  -------  -------
VOO       $545.12     +0.45%  +1.23%  +8.45%   +25.67%

STOCKS - ETFS
------------------------------------------------------------
Ticker    Price       24h     7d      3mo      1yr
--------  ----------  ------  ------  -------  -------
IBIT      $56.78      +2.12%  -0.89%  +42.34%  N/A

STOCKS - INDIVIDUAL
------------------------------------------------------------
Ticker    Price       24h     7d      3mo      1yr
--------  ----------  ------  ------  -------  -------
AAPL      $198.45     +1.23%  +2.45%  +12.34%  +45.67%

============================================================
```

| Column | Meaning |
|--------|---------|
| Price | Current price in USD |
| 24h | Change vs 24 hours ago |
| 7d | Change vs 7 days ago |
| 3mo | Change vs 3 months ago |
| 1yr | Change vs 1 year ago |

Colors: Green = gains, Red = losses

## Log Files

Briefings are automatically saved to:
```
~/.data/logs/markets-YYYY-MM-DD.log
```

Use `--no-log` to skip saving.

## Troubleshooting

### "Watchlist not found"
Create the config file:
```bash
mkdir -p ~/claude-agent/.config
cat > ~/claude-agent/.config/watchlist.json << 'EOF'
{
  "cryptocurrencies": [
    {"id": "bitcoin", "symbol": "BTC", "name": "Bitcoin"}
  ],
  "stocks": {
    "index_funds": [],
    "etfs": [],
    "individual": [
      {"ticker": "AAPL", "name": "Apple Inc."}
    ]
  }
}
EOF
```

### "N/A" for some timeframes
The data source may not have enough historical data. This is normal for:
- Recently listed assets
- Some stocks with limited history

### API errors
- CoinGecko has rate limits (~10-50 requests/minute on free tier)
- Wait a minute and try again
- Consider reducing watchlist size if consistently hitting limits

## Data Sources

| Asset Type | Source | API Key |
|------------|--------|---------|
| Crypto | CoinGecko | Not required |
| Stocks | Yahoo Finance | Not required |
