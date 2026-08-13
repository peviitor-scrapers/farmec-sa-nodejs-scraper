# Instructions

## Project Purpose

This scraper extracts job listings from FARMEC SA via the public careers page on farmec.ro and the eJobs company page, then imports them to peviitor.ro.

Targets:
- `https://www.farmec.ro/compania/cariere/` (careers page HTML, parsed with regex)
- `https://www.ejobs.ro/company/farmec/176855` (eJobs page, Nuxt `__NUXT_DATA__` JSON parsed with `resolveNuxtRef`)

## Model Schemas

The job and company models are defined in:
- `job-model.md` - Job model schema
- `company-model.md` - Company model schema

## Important

These models are **dynamic** and can change over time. They are based on the official Peviitor Core schemas which may be updated.

## How to Keep Models Updated

When working on this scraper:

1. **Check for updates** in the Peviitor Core repository:
   - Repository: https://github.com/peviitor-ro/peviitor_core
   - Main file: README.md (contains Job and Company model schemas)

2. **When to update**:
   - Before starting new development work
   - If field requirements or validations have changed
   - If new fields have been added

3. **How to update**:
   - Fetch the latest README.md from peviitor_core main branch
   - Compare with current job-model.md and company-model.md
   - Update local files if there are differences
   - Update scraper/index.js mapping logic if field requirements changed

## Technologies

- **Node.js & JavaScript** - For scraping and data extraction
- **Apache SOLR** - For data storage and indexing (via peviitor API)
- **opencode** - For development

## Workflow Steps

1. **Start with brand** - We know the brand (e.g., "FARMEC")
2. **Search in DemoANAF** - Find company by brand, get CIF from search results
3. **Get company details from ANAF** - Using CIF, fetch full company data from ANAF
4. **Validate with Peviitor** - Verify company exists in Peviitor, get group/brand info
5. **Check existing jobs** - Query the peviitor API by CIF to see what jobs already exist
6. **Check company status** - If ANAF status = "inactive" → DELETE existing jobs and STOP
7. **Save company.json** - Save all ANAF + Peviitor data for backup
8. **Scrape new jobs** - Fetch farmec.ro careers page (HTML regex) + eJobs page (Nuxt data)
9. **Transform for SOLR** - Validate and fix job data:
   - location: ["Cluj-Napoca"], country: ["România"] (hardcoded defaults)
   - company: uppercase
10. **Upsert to peviitor API** - Import/update jobs
11. **Verify URLs** - Check existing job URLs still work, delete 404s

## Running the Scraper

```bash
# Run the full scraper workflow (single command)
npm run scrape

# This runs: node --no-deprecation scraper/index.js
```

> **Important**: Scraper does NOT delete jobs from other sources. It only upserts FARMEC SA jobs from farmec.ro + eJobs. Existing jobs are preserved.

## Full Workflow (automatic)

When running `npm run scrape`, the following steps happen automatically:

1. **Check existing jobs count** - Query peviitor API by CIF (read-only)
2. **Validate company via ANAF** - Check company exists and is active (cache in `tmp/company.json`, 7-day TTL)
3. **Scrape jobs** - Fetch farmec.ro careers page + eJobs company page
4. **Transform for SOLR** - Normalize fields (location Cluj-Napoca/România), dedupe by title
5. **Upsert to peviitor API** - Add/update jobs (API handles duplicates by URL)
6. **Delete stale jobs** - Remove jobs that are no longer published
7. **Show Summary** - Log job counts

**Important**: We do NOT delete jobs from other sources! Only FARMEC jobs that disappeared from both sources are removed.

## Workflow Flowchart

```
scraper/config/company.json (single source of truth: CIF, brand, URLs)
    │
    ▼
scraper/index.js (npm run scrape)
    │
    ▼
querySOLR(CIF) via api.js - just count, don't delete
    │
    ▼
company.js (validate company)
    ├── load cache (tmp/company.json → company.json)
    │   └── if fresh (<7 days), skip ANAF entirely
    ├── ANAF API ──► get company name + CIF (only if cache stale/missing)
    └── Peviitor API ──► validate company model
    │
    ▼ (if active)
scrapeJobs()
    ├── fetchCareersPage() ──► extractJobs() (farmec.ro regex)
    └── fetchEJobsPage() ────► extractEJobs() (eJobs Nuxt data)
    │
    ▼
dedupeJobs() → mapToJobModel() → transformJobsForSOLR()
    ├── location: ["Cluj-Napoca"], country: ["România"]
    └── company: uppercase
    │
    ▼
upsertJobs() via api.js - API handles duplicate by URL
    │
    ▼
generateJobsMarkdown() → docs/jobs.md
    └── committed to repo by CI → available on GitHub Pages
```

## File Responsibilities

| File | Role |
|------|------|
| `scraper/config/company.json` | **Single source of truth** for company identity (CIF, brand, URLs, scraperFile) |
| `scraper/config/company.js` | ESM wrapper that loads `scraper/config/company.json` for Node code |
| `scraper/index.js` | Main entry point - full workflow: validate company → scrape farmec.ro + eJobs → transform → upsert → generate docs/jobs.md |
| `scraper/company.js` | Validates company via ANAF + Peviitor; caches in root `company.json` (7-day TTL) and `tmp/company.json` |
| `scraper/api.js` | Peviitor API module (api.peviitor.ro/v1) - querySOLR, upsertJobs, deleteJobByUrl, getCompanyByCif + standalone commands |
| `scraper/validate-jobs.js` | Manual deep validator (content-aware); thin CLI wrapper over `scraper/job-validator.js` |
| `scraper/anaf.js` | ANAF API core module - searchCompany(brand) and getCompanyFromANAF(cif) with fallback + 3-retry/2s-backoff |
| `scraper/markdown-generator.js` | Generates `docs/jobs.md` with company info and all scraped jobs |
| `scraper/job-validator.js` | Shared validation primitives: `validateByHead`, `validateByContent`, `DEFAULT_EXPIRED_KEYWORDS` |
| `scraper/demoanaf.js` | CLI entry point for ANAF module (thin wrapper around scraper/anaf.js) |
| `tests/validate-farmec-jobs.js` | CI fast validator (HEAD only); thin CLI over `scraper/job-validator.js` + `api.js` |
| `tests/unit/index.test.js` | Unit tests for extractJobs, extractEJobs, mapToJobModel, transformJobsForSOLR |
| `tests/unit/company.test.js` | Unit tests for validateAndGetCompany and fallback caching |
| `tests/unit/api.test.js` | Unit tests for peviitor API query, upsert, delete operations |
| `tests/unit/demoanaf.test.js` | Unit tests for ANAF search and company retrieval |
| `tests/integration/workflow.test.js` | Live integration tests - ANAF + peviitor API |
| `tests/e2e/scraper.test.js` | End-to-end tests with real farmec.ro/eJobs pages, ANAF, and peviitor API |
| `tests/consistency/public.test.js` | Verifies repo is public on GitHub |
| `tests/consistency/repo.test.js` | Verifies branch, Pages, secrets, workflow files |
| `tests/consistency/topics.test.js` | Verifies required repo topics |
| `tests/consistency/workflow-naming.test.js` | Validates workflow naming conventions |

## API Endpoints

- **Farmec careers**: `https://www.farmec.ro/compania/cariere/` - HTML page parsed with regex
- **eJobs company page**: `https://www.ejobs.ro/company/farmec/176855` - Nuxt `__NUXT_DATA__` JSON
- **DemoANAF Search**: `https://demoanaf.ro/api/search?q=BRAND` - Search companies by name/brand
- **DemoANAF Company**: `https://demoanaf.ro/api/company/:cui` - Get company details by CIF
- **Peviitor API**: `https://api.peviitor.ro/v1` - query `/scraper/jobs/?cif=...`, upsert `/scraper/jobs/upsert`, delete `/scraper/jobs/delete`, company `/firme/company/`

## Rate Limiting & Politeness

The scraper is intentionally slow to be a good citizen:

| Setting | Value | Where |
|---------|-------|-------|
| Requests per source | 1 per run (farmec.ro + eJobs) | `scraper/index.js` |
| Request timeout | 10000 ms | `scraper/index.js` — `AbortSignal.timeout(10000)` |
| ANAF retries | 3 attempts, 2s exponential backoff | `scraper/anaf.js` |
| User-Agent | Browser Chrome UA | `scraper/index.js` |
| Cache | 7-day TTL for ANAF data | `scraper/company.js` |

Derived scrapers should keep these defaults unless the target site explicitly permits otherwise.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_REPOSITORY` | Used by consistency tests — format: `owner/repo` |
| `GITHUB_TOKEN` | GitHub API token for consistency tests |

No SOLR credentials are needed — all write operations go through the public peviitor API (`api.peviitor.ro/v1`).

`dotenv` loads `.env.local` automatically at startup — set variables there for local runs. Never commit `.env.local`.

## Standalone Commands

```bash
# Verify jobs by CIF
node --no-deprecation scraper/api.js <CIF>

# Extract existing jobs by CIF
node --no-deprecation scraper/api.js extract <CIF>

# Query company
node --no-deprecation scraper/api.js company <search_term>

# Get company details from ANAF by CIF
node --no-deprecation scraper/demoanaf.js <CIF>

# Search companies in ANAF by brand
node --no-deprecation scraper/demoanaf.js search <brand>

# Validate job URLs by CIF (check active/expired)
node --no-deprecation scraper/validate-jobs.js <CIF>

# Validate a single job URL
node --no-deprecation scraper/validate-jobs.js url <url>

# Delete expired jobs by CIF
node --no-deprecation scraper/validate-jobs.js <CIF> --delete
```

## Testing

This project requires multiple levels of testing:

1. **Unit Tests** - Test individual modules (api.js, company.js, index.js) in isolation
2. **Integration Tests** - Test API interactions (ANAF, Peviitor) in `/tests/integration` folder
3. **E2E Tests** - Test full workflow in `/tests/e2e` folder

Run tests:
```bash
npm test
```

## Temporary Files

All temporary/scratch files must be placed in `tmp/` inside the project root (never outside the project). The `tmp/` directory is in `.gitignore` and will not be committed.

## Technical Debt / Completed

- [x] Extract demoanaf.js to separate module (#2)
- [x] Write Unit Tests for all modules (#3)
- [x] Write Integration Tests in separate folder (#4)
- [x] Write E2E automated tests in separate folder (#5)
- [x] Migrate to peviitor API (no SOLR_AUTH)
- [x] Migrate to modern scraper/ layout (template EPAM)
