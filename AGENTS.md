# AGENTS.md — Rules for AI agents

## Project
FARMEC SA scraper for peviitor.ro (Node.js, ESM, Jest)

## 🌱 This Repo Is a Derived Scraper
This repo is derived from the [EPAM template](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper).

**All company-specific identity lives in `scraper/config/company.json`** (id, company, brand, status, location, website, career, scraperFile). Read from `scraper/config/company.js` in Node code, or via `jq` in workflows.

The scraping logic in `scraper/index.js` fetches job listings from two sources:
- `https://www.farmec.ro/compania/cariere/` (HTML, parsed with regex in `extractJobs`)
- `https://www.ejobs.ro/company/farmec/176855` (Nuxt `__NUXT_DATA__` JSON, parsed with `extractEJobs`/`resolveNuxtRef`)

All Solr operations go through the peviitor API (`scraper/api.js` — `https://api.peviitor.ro/v1`). **No direct Solr access, no `SOLR_AUTH`.**

## Critical Rules

### 0. Background tasks — always pass `--repo` explicitly to `gh`

When polling a workflow run, always specify the repo explicitly:
```bash
gh run view <RUN_ID> --repo peviitor-scrapers/farmec-sa-nodejs-scraper --json status -q .status
```

### 1. Temporary Files
All temporary/scratch files MUST go in `tmp/` inside the project root.

### 2. Issues & GitHub
- **Orice modificare de cod trebuie să aibă un issue în GitHub Issues** (vezi [ai/ISSUES.md](ai/ISSUES.md))
- Excepții: typo-uri, whitespace, documentație minoră
- Create a GitHub issue before implementing any change
- Commit messages must reference the issue they close
- Never commit credentials (`.env.local`, `*.pem`, etc.)

### 3. Environment Variables
No credentials required for scraping — the peviitor API is public.

### 4. Testing
```bash
# All tests
npm test

# Unit tests (no env vars needed)
npm run test:unit

# Integration tests (ANAF + peviitor API, conditional skip)
npm run test:integration

# E2E tests (farmec.ro/eJobs pages, conditional skip)
npm run test:e2e

# Consistency tests (GitHub repo config)
npm run test:consistency
```

### 5. ESM + Jest
- Use `jest.unstable_mockModule` (NOT `jest.mock`) for mocking ESM modules
- Run with `--experimental-vm-modules` flag

### 6. Verification
- După orice modificare, urmează [ai/VERIFY.md](ai/VERIFY.md) pas cu pas
- Toate workflow-urile din `.github/workflows/` trebuie să treacă înainte de merge

### 7. Module Structure
- `scraper/config/company.json` + `scraper/config/company.js` — single source of truth for company identity
- `scraper/anaf.js` — core ANAF library (demoanaf.ro → cuiscan.ro fallback)
- `scraper/api.js` — peviitor API module (query/upsert/delete jobs + company)
- `scraper/company.js` — company validation (ANAF + Peviitor API, cache in `company.json`/`tmp/company.json`)
- `scraper/job-validator.js` — shared validateByHead + validateByContent + validateByBrowser
- `scraper/markdown-generator.js` — generates `docs/jobs.md` after each scrape
- `scraper/validate-jobs.js` — manual deep validator
- `scraper/index.js` — main scraper orchestrator (farmec.ro + eJobs scraping)
- `tests/validate-farmec-jobs.js` — CI validator (--head/--content/--browser)
