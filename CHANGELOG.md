# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.2] - 2026-08-13

### Changed
- Migrated from direct Solr access to the peviitor API (`scraper/api.js` — `https://api.peviitor.ro/v1`)
- Restructured repo to the EPAM template layout: scraping code moved under `scraper/`
- Modernized `scraper/config/company.json` schema (`id`, `company`, `brand`, `status`, `location[]`, `website[]`, `career[]`, `scraperFile`)
- Replaced legacy docs with the template `ai/` documentation layout
- Added `CODE_OF_CONDUCT.md`
- Bumped version to match the EPAM template (1.5.2)

### Added
- `job-deep-validate.yml` workflow (Playwright browser validation of job URLs)
- `automation-template-sync-check.yml` workflow (tracks template version)
- Playwright dev dependency for deep URL validation

### Fixed
- E2E tests no longer fail on intermittent source timeouts — tests now skip cleanly when the sources are unavailable (`itIfCareers`/`itIfApi`)
- Request timeouts now use `AbortSignal.timeout` instead of the deprecated `timeout` fetch option
- `tests/validate-farmec-jobs.js` now supports `--head`/`--content`/`--browser`/`--timeout` modes

## [1.0.0] — 2026-06-21

### Added

- Scraper initial pentru FARMEC SA
- Extragere job-uri de pe farmec.ro/compania/cariere/
- Extragere job-uri de pe ejobs.ro
- Validare companie via API-ul ANAF
- Indexare în SOLR peviitor.ro
- Teste unitare, integrare, e2e
- Pagină GitHub Pages cu statistici

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE
Licensed under MIT License
