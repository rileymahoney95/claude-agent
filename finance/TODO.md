# Finance App - Commercial Release TODO

**Goal:** Package and sell as a personal desktop finance app

---

## 🔴 Critical for Commercial Release

### 1. Authentication & Multi-User Support
- [ ] Implement user authentication (OAuth, email/password, or local machine auth)
- [ ] Add user data isolation (per-user database schemas or tenant IDs)
- [ ] Session management and secure token handling
- [ ] Password hashing and rate limiting
- [ ] Currently no auth - hardcoded `localhost:3000` CORS origin

### 2. Desktop Packaging (Tauri v2)
- [ ] Set up Tauri wrapper for Next.js frontend + bundled API
- [ ] Create single binary distribution bundling:
  - [ ] Python runtime + CLI dependencies
  - [ ] SQLite database (switch from PostgreSQL)
  - [ ] Node.js runtime for web UI
- [ ] Implement auto-update mechanism
- [ ] Code signing for macOS/Windows distribution

### 3. Broader Brokerage Support
Currently only SoFi/Apex statements work (`cli/parsers/sofi_apex.py`)

- [ ] Create parser abstraction layer (`parsers/base.py` with interface)
- [ ] Fidelity parser
- [ ] Schwab parser
- [ ] Vanguard parser
- [ ] TD Ameritrade parser
- [ ] Generic CSV import (many brokerages export CSV)
- [ ] Plaid integration for automated account linking
- [ ] Manual account entry for unsupported brokerages

### 4. Data Security & Encryption
- [ ] At-rest encryption for database and JSON files
- [ ] Secure credential storage (macOS Keychain, Windows Credential Manager)
- [ ] Data export/backup with encryption
- [ ] Local data wipe functionality

---

## 🟡 Important for User Trust & Polish

### 5. Testing Suite
Currently only have `api/test_smoke.sh`

- [ ] Unit tests for parsers (critical for financial accuracy)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for web UI flows
- [ ] Parser validation against sample statements from each brokerage

### 6. Error Handling & Data Validation
- [ ] Graceful PDF parsing failure recovery
- [ ] Input validation for holdings (negative values, invalid symbols)
- [ ] Transaction rollback for failed database operations
- [ ] User-friendly error messages (not stack traces)

### 7. Onboarding & Documentation
- [ ] First-run setup wizard
- [ ] Tutorial/walkthrough for key features
- [ ] In-app help and tooltips
- [ ] User manual / help docs

### 8. Offline Mode & Data Sync
- [ ] Handle network failures gracefully (CoinGecko API, yfinance)
- [ ] Cache market data locally
- [ ] Queue failed API calls for retry

---

## 🟢 Nice-to-Have for Launch

### 9. Mobile/Tablet Responsiveness
- [ ] Tablet support (mobile less critical for desktop app)
- [ ] Already have `components/layout/mobile-header.tsx`

### 10. Data Export Features
- [ ] Export to CSV/Excel
- [ ] PDF report generation
- [ ] Tax document preparation (1099 summaries)

### 11. Historical Charts
Database already supports this (`database.py:get_portfolio_history()`)

- [ ] Expose portfolio history in API
- [ ] Net worth over time chart in dashboard
- [ ] Goal progress over time visualization

### 12. Backup & Restore
- [ ] Automated backups
- [ ] Import from backup
- [ ] Data migration between devices

---

## Technical Debt

| Issue | Location | Fix |
|-------|----------|-----|
| Hardcoded paths | `cli/config.py` | Use relative paths, env vars |
| No input sanitization | PDF parser | Validate/sanitize inputs |
| Single brokerage | `parsers/sofi_apex.py` | Parser abstraction layer |
| No rate limiting | API routes | Add rate limiting middleware |
| Credentials in docker-compose | `docker-compose.yml` | Use secrets management |

---

## Recommended Tech Stack Changes

| Current | Recommended | Reason |
|---------|-------------|--------|
| PostgreSQL (Docker) | SQLite | No Docker dependency, single-file DB, easier packaging |
| Separate Next.js + FastAPI | Bundled with Tauri | Single distributable binary |
| JSON config files | Encrypted config store | Security for financial data |
| CoinGecko/yfinance only | Plus Plaid API | Automated account linking |

---

## Estimated Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| 1. Auth + Multi-user | Authentication, data isolation | 2-3 weeks |
| 2. Desktop packaging | Tauri setup, bundling, auto-update | 2-3 weeks |
| 3. Additional parsers | 4-5 major brokerages | 2-4 weeks |
| 4. Testing | Unit, integration, E2E | 2 weeks |
| 5. Security hardening | Encryption, validation | 1-2 weeks |
| 6. Onboarding + docs | Wizard, help, docs | 1 week |
| 7. Polish + QA | Bug fixes, edge cases | 2 weeks |

**Total: ~12-17 weeks** for commercial-ready desktop app

---

## Immediate Next Steps

1. [ ] Switch from PostgreSQL to SQLite - removes Docker dependency
2. [ ] Add authentication - even simple local auth
3. [ ] Create parser abstraction layer - `parsers/base.py`
4. [ ] Set up Tauri - get basic desktop build working early
5. [ ] Add unit tests for parser - financial accuracy is critical
