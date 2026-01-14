# Finance API Usage

REST API for the finance CLI. Runs on `http://localhost:8000`.

## Quick Start

```bash
finance-api           # Start server
finance-api --reload  # Dev mode with auto-reload
finance-api --port 3001  # Custom port
```

## Endpoints

All endpoints prefixed with `/api/v1`.

### Portfolio

```bash
# Get unified portfolio (all accounts + holdings)
curl http://localhost:8000/api/v1/portfolio

# Skip live crypto prices (faster)
curl "http://localhost:8000/api/v1/portfolio?no_prices=true"
```

### Holdings

```bash
# Get all holdings with live prices
curl http://localhost:8000/api/v1/holdings

# Check if data is stale
curl http://localhost:8000/api/v1/holdings/freshness

# Update a holding
curl -X PUT http://localhost:8000/api/v1/holdings/crypto/BTC \
  -H "Content-Type: application/json" \
  -d '{"value": 0.5, "notes": "Coinbase"}'

# Delete a holding
curl -X DELETE http://localhost:8000/api/v1/holdings/crypto/DOGE
```

### Profile

```bash
# Get profile
curl http://localhost:8000/api/v1/profile

# Update a section
curl -X PATCH http://localhost:8000/api/v1/profile/monthly_cash_flow \
  -H "Content-Type: application/json" \
  -d '{"gross_income": 12000}'
```

### Advice

```bash
# Get all recommendations
curl http://localhost:8000/api/v1/advice

# Filter by focus
curl "http://localhost:8000/api/v1/advice?focus=goals"
curl "http://localhost:8000/api/v1/advice?focus=rebalance"
curl "http://localhost:8000/api/v1/advice?focus=surplus"
```

### Statements

```bash
# Get snapshot history
curl http://localhost:8000/api/v1/statements/history

# Filter by account
curl "http://localhost:8000/api/v1/statements/history?account=roth_ira"

# Pull new statements from Downloads
curl -X POST http://localhost:8000/api/v1/statements/pull

# Pull latest only
curl -X POST "http://localhost:8000/api/v1/statements/pull?latest=true"
```

## Interactive Docs

Swagger UI: http://localhost:8000/docs
