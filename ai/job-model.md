# Job Model Schema

Source: [peviitor_core](https://github.com/peviitor-ro/peviitor_core)

## Required Fields

| Field  | Type   | Description |
|--------|--------|-------------|
| url    | string | Full URL to the job detail page. Unique. Must be valid HTTP/HTTPS URL, canonical job detail page |
| title  | string | Exact position title. Max 200 chars, no HTML, trimmed whitespace. DIACRITICS ACCEPTED (ăâîșțĂÂÎȘȚ) |

## Optional Fields

| Field          | Type     | Description |
|----------------|----------|-------------|
| company        | string   | Name of the hiring company. Real name, full name, uppercase always — not just a brand or code. Legal name. Must match Company.name (case insensitive). DIACRITICS ACCEPTED |
| cif            | string   | CIF/CUI (8 digits, no RO prefix) |
| location       | string[] | Location or detailed address. Romanian cities/addresses. DIACRITICS ACCEPTED (ex: "București", "Cluj-Napoca"). Multi-valued, stored as array |
| tags           | string[] | Skills/education/experience. Lowercase, max 20 entries, standardized values only. NO DIACRITICS |
| workmode       | string   | "remote", "on-site", "hybrid" — only these three values |
| date           | date     | Scrape date. UTC ISO8601 timestamp (ex: "2026-01-18T10:00:00Z") |
| status         | string   | "scraped", "tested", "published", or "verified". Starts as "scraped" |
| vdate          | date     | Verified date (ISO8601). Set only when status="verified" |
| expirationdate | date     | Estimated job expiration. ISO8601. vdate + 30 days max, or extracted from job page |
| salary         | string   | Salary range + currency. Format: "MIN-MAX CURRENCY" (ex: "5000-8000 RON", "4000 EUR"). Must be a string, not an array |

## Status Flow

`scraped` → (`tested` OR `verified`) → `published`

| Status    | Meaning                                    | When to Use |
|-----------|--------------------------------------------|-------------|
| scraped   | Newly scraped, not validated yet           | Default after scraping |
| tested    | URL works, job exists but incomplete details | Page blocked by CAPTCHA, didn't load properly, missing salary/tags/workmode |
| verified  | Fully scraped with all details             | All fields extracted: company, cif, salary, tags, workmode |
| published | Imported from jobs core                    | Old validator flow — jobs imported to main job index |

## Notes

- Fields marked `string[]` are multi-valued arrays stored as arrays in SOLR/OpenSearch
- tags must be lowercase with NO diacritics, standardized values only
- location accepts diacritics (București, Cluj-Napoca)
- title accepts diacritics
- company must be uppercase, must match Company.name exactly
- salary must be a string, not an array
- tested jobs can be re-validated later when more data becomes available
