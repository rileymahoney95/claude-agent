# Finance API Usage

REST API for the finance CLI. Runs on `http://localhost:8000`.

## Quick Start

```bash
# Recommended: Start full dev environment (API + Web)
finance-dev

# Or start just the API
finance-api           # Start server
finance-api --reload  # Dev mode with auto-reload
finance-api --port 3001  # Custom port
```

Database: Uses SQLite at `.data/finance.db` (no setup required).

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

### Projections

```bash
# Get historical portfolio data (for projection chart)
curl http://localhost:8000/api/v1/projection/history
curl "http://localhost:8000/api/v1/projection/history?months=24"

# Get projection settings
curl http://localhost:8000/api/v1/projection/settings

# Update projection settings
curl -X PATCH http://localhost:8000/api/v1/projection/settings \
  -H "Content-Type: application/json" \
  -d '{"current_age": 33, "target_retirement_age": 60}'

# Update expected returns
curl -X PATCH http://localhost:8000/api/v1/projection/settings \
  -H "Content-Type: application/json" \
  -d '{"expected_returns": {"equities": 8.0, "crypto": 15.0}}'

# List scenarios
curl http://localhost:8000/api/v1/projection/scenarios

# Create a scenario
curl -X POST http://localhost:8000/api/v1/projection/scenarios \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conservative",
    "settings": {
      "allocation_overrides": {"equities": 60, "bonds": 30, "crypto": 5, "cash": 5},
      "return_overrides": {"equities": 6.0, "bonds": 3.5, "crypto": 8.0, "cash": 4.0},
      "projection_months": 360
    },
    "is_primary": true
  }'

# Update a scenario
curl -X PATCH http://localhost:8000/api/v1/projection/scenarios/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Very Conservative"}'

# Delete a scenario (cannot delete primary)
curl -X DELETE http://localhost:8000/api/v1/projection/scenarios/2
```

## Interactive Docs

Swagger UI: http://localhost:8000/docs
