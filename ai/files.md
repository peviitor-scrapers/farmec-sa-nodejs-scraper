# Project Files

## JavaScript Files — scraper/

| File | Description |
|------|-------------|
| `scraper/index.js` | Main scraper - full workflow: validate company → scrape farmec.ro + eJobs → transform → upsert via peviitor API → generate docs/jobs.md |
| `scraper/company.js` | Validates company via ANAF + Peviitor APIs, checks if company is active/inactive, caches ANAF data in company.json / tmp/company.json |
| `scraper/api.js` | Peviitor API module (api.peviitor.ro/v1) - exports querySOLR, deleteJobByUrl, upsertJobs, getCompanyByCif + standalone verify/extract/company commands |
| `scraper/anaf.js` | ANAF API core module - exports getCompanyFromANAF(cif), getCompanyFromANAFWithFallback(cif, cached), searchCompany(brandName) |
| `scraper/demoanaf.js` | CLI entry point for ANAF module (thin wrapper around scraper/anaf.js) |
| `scraper/markdown-generator.js` | Generates docs/jobs.md - exports generateJobsMarkdown(companyData, jobs) |
| `scraper/job-validator.js` | Shared validation primitives - exports validateByHead(url), validateByContent(url, opts), DEFAULT_EXPIRED_KEYWORDS. Used by both `scraper/validate-jobs.js` and `tests/validate-farmec-jobs.js`. |
| `scraper/validate-jobs.js` | **Generic deep validator (manual use).** Full GET requests, parses page body for "no longer available" keywords. Works with any CIF, single URL, or file. Slower but catches soft-404s. Not used by CI. |

## Config — scraper/config/

| File | Description |
|------|-------------|
| `scraper/config/company.json` | **Single source of truth for company identity.** All scraper code, CI workflows, and the static HTML read from this file. |
| `scraper/config/company.js` | ESM wrapper that imports and exposes `scraper/config/company.json` to Node code |

## Test Files — tests/

| File | Description |
|------|-------------|
| `package.json` (root) | Jest config + test scripts (unit/integration/e2e/consistency) via `--testPathPattern` |
| `tests/company.json` | Mock ANAF company data for FARMEC SA used in unit tests |
| `tests/validate-farmec-jobs.js` | **FARMEC SA fast validator (used by CI).** HEAD requests only, CIF from config. Called nightly by `automation-testing.yml`. Supports `--dry-run` and `--delete`. |
| `tests/unit/index.test.js` | Unit tests for scraper/index.js - extractJobs, extractEJobs, mapToJobModel, dedupeJobs, transformJobsForSOLR |
| `tests/unit/company.test.js` | Unit tests for scraper/company.js - getCompanyData, validateAndGetCompany, fallback caching |
| `tests/unit/api.test.js` | Unit tests for scraper/api.js - query, upsert, delete, HTTP error handling |
| `tests/unit/demoanaf.test.js` | Unit tests for ANAF search and company retrieval with mocked responses |
| `tests/integration/workflow.test.js` | Integration tests - ANAF live API, Peviitor API, company/jobs cores |
| `tests/e2e/scraper.test.js` | E2E tests - full pipeline with real farmec.ro/eJobs pages, ANAF, and peviitor API |
| `tests/consistency/public.test.js` | Verifies repository is public on GitHub |
| `tests/consistency/repo.test.js` | Verifies default branch, GitHub Pages, (no credentials needed — peviitor API) secret, workflow files |
| `tests/consistency/topics.test.js` | Verifies repository has required topics: job-seeker-ro-spider, peviitor-ro |
| `tests/consistency/workflow-naming.test.js` | Validates workflow file naming conventions |

## Markdown Files

| File | Description |
|------|-------------|
| `INSTRUCTIONS.md` | Project documentation - workflow, technologies, API endpoints, how to update models |
| `job-model.md` | Job schema definition (Peviitor Core) - fields, types, validation rules |
| `company-model.md` | Company schema definition (Peviitor Core) - fields, types, validation rules |
| `files.md` | This file - documents role of each project file |
| `AGENTS.md` | Rules for AI agents working on this project |
| `BRANCH.md` | Branch strategy and naming conventions |
| `CHANGELOG.md` | Version history and notable changes |
| `CONTRIBUTING.md` | Contribution guidelines |
| `ISSUES.md` | Issue tracking conventions |
| `PUBLIC.md` | Notes on public visibility and data policies |
| `ROBOTS.md` | farmec.ro/eJobs scraping policy for FARMEC SA |
| `SECURITY.md` | Security policy and vulnerability reporting |
| `TOPICS.md` | Repository topics documentation |
| `UPDATE-REPO-ABOUT.md` | Instructions for updating repo description/about |
| `VERIFY.md` | Step-by-step verification checklist after changes |

## Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Node.js project config - dependencies (node-fetch), scripts |
| `package-lock.json` | Locked dependency versions |
| `.npmrc` | npm configuration |
| `.gitignore` | Ignores node_modules/, tmp/, .env.local |
| `.env.local` | Local environment variables ((no credentials needed — peviitor API)) - NOT committed |
| `.github/CODEOWNERS` | Code ownership rules for PR reviews |
| `.github/workflows/job-seeker-ro-spider.yml` | Daily scraping workflow (6 AM UTC) |
| `.github/workflows/automation-testing.yml` | Automated tests on every push/PR |

## Data Files

| File | Description |
|------|-------------|
| `company.json` | **ANAF cache (committed).** Survives between CI runs so the scraper does not hit demoANAF on every scrape. Refreshed when older than 7 days (configurable via `CACHE_MAX_AGE_DAYS` in scraper/company.js). Also written to `tmp/company.json` on first scrape. |
| `docs/company.json` | Static copy of `scraper/config/company.json` regenerated on each scrape. Served by GitHub Pages so the live page can read company identity without hardcoding it in HTML. |
| `docs/jobs.md` | Scraped jobs in markdown format - company info + all current jobs (generated by CI after each scrape) |

## Notes

- All `.md` schema files (job-model.md, company-model.md) are dynamic — check peviitor_core README.md for updates
- `tmp/` directory holds runtime artifacts (jobs.json, jobs_existing.json) — not committed
- Full workflow: validate company (ANAF+Peviitor) → scrape farmec.ro + eJobs → transform → upsert via peviitor API → generate docs/jobs.md
