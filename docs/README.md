# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile SOBIS SOLUTIONS din România.

Extrage anunțurile de pe [ANOFM](https://anofm.ro) (API public filtrat pe CIF 12018818) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul peviitor (`api.peviitor.ro/v1`).

## Identificare

Toate request-urile HTTP folosesc User-Agent-ul:

```
job_seeker_ro_spider
```

## Ce face

1. **Validează compania** — interoghează API-ul public ANAF ([demoanaf.ro](https://demoanaf.ro)) după CIF-ul SOBIS SOLUTIONS (12018818) și verifică:
   - Denumirea oficială: SOBIS SOLUTIONS S.R.L.
   - Status: activ/inactiv/radiat
   - Adresa completă din registrul comerțului
2. **Cross-validează cu Peviitor** — verifică existența companiei în API-ul Peviitor
3. **Scrape-uiește job-urile** — interoghează API-ul public ANOFM filtrat pe CIF
4. **Transformă datele** — normalizează locațiile (doar orașe românești), tag-urile (lowercase), workmode-ul (remote/on-site/hybrid)
5. **Publică în peviitor** — upsert via `api.peviitor.ro/v1` (job-uri) + upsert companie cu adresa completă
6. **Generează docs/jobs.md** — fișier markdown cu informații companie + toate job-urile curente, publicat pe [GitHub Pages](https://peviitor-scrapers.github.io/sobis-solutions-srl-nodejs-scraper/jobs.md)

## Structură proiect

```
├── scraper/config/company.json # Sursa unică de adevăr (id, brand, URL-uri)
├── scraper/config/company.js   # Loader ESM pentru scraper/config/company.json
├── scraper/index.js            # Orchestrator principal
├── scraper/company.js          # Validare companie (ANAF + Peviitor API) cu cache 7 zile
├── scraper/anaf.js             # Modul ANAF API (search + company details)
├── scraper/api.js              # Modul peviitor API (query, upsert, delete, company)
├── scraper/demoanaf.js         # CLI wrapper pentru anaf.js
├── scraper/markdown-generator.js # Generează docs/jobs.md după scrape
├── scraper/job-validator.js    # Primitivă comună: validateByHead, validateByContent
├── company.json                # Cache ANAF (committed, TTL 7 zile, fallback la stale)
├── ai/ROBOTS.md                # Politică ANOFM API
├── tests/
│   ├── unit/          # Teste unitare (API-uri mock-uite)
│   ├── integration/   # Teste de integrare (ANAF + peviitor API live)
│   ├── e2e/           # Teste end-to-end (pipelin complet)
│   └── consistency/   # Teste de consistență GitHub (root files, version, topics)
└── .github/workflows/
    ├── job-seeker-ro-spider.yml     # Rulează zilnic la 6 AM UTC
    ├── automation-testing.yml       # Teste automate la fiecare push/PR
    ├── job-deep-validate.yml        # Validare profundă manuală (Playwright)
    ├── job-recovery-from-disaster.yml # Restore company core
    └── automation-template-sync-check.yml # Track versiune template
```

## API-uri folosite

| API | URL | Autentificare |
|---|---|---|
| ANOFM | `https://mediere.anofm.ro/api/entity/vw_public_job_posting` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| Peviitor | `https://api.peviitor.ro/v1/company/` | Public |

## Robots.txt

SOBIS SOLUTIONS nu are o pagină publică de cariere. Scraperul folosește API-ul public ANOFM — un serviciu guvernamental, fără restricții.

Pentru analiza completă, vezi [ROBOTS.md](../ai/ROBOTS.md).

## Testare

```bash
# Toate testele
npm test

# Doar unitare
npm run test:unit

# Doar integrare (necesită ANAF live, peviitor API conditional)
npm run test:integration

# Doar E2E (ANOFM API real + ANAF + peviitor API)
npm run test:e2e

# Doar consistență
npm run test:consistency
```

Testele live folosesc `itIfApi`/`itIfAnaf`/`itIfAnofm` — se auto-skip dacă API-ul respectiv nu răspunde.
