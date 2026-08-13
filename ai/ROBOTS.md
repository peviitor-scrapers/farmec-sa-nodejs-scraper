# Robots.txt Analysis — FARMEC SA

## Situație

FARMEC SA (CIF: 199150) publică job-urile pe [farmec.ro](https://www.farmec.ro/compania/cariere/) și pe [eJobs](https://www.ejobs.ro/company/farmec/176855).

Sursele datelor:
- `https://www.farmec.ro/compania/cariere/` — pagină publică de cariere (HTML)
- `https://www.ejobs.ro/company/farmec/176855` — pagina companiei pe eJobs (Nuxt `__NUXT_DATA__`)

## Reguli

farmec.ro este site-ul oficial al companiei FARMEC SA. Pagina de cariere este publică și destinată candidaților.

eJobs este o platformă publică de recrutare; pagina companiei este publică.

## Interpretare

| Cale | Accesibil? | Ce conține |
|---|---|---|
| `/compania/cariere/` (farmec.ro) | ✅ Da (public) | Lista job-urilor curente — sursa scraperului |
| `/compania/joburi/<slug>/` (farmec.ro) | ✅ Da (public) | Detalii fiecare job |
| `ejobs.ro/company/farmec/176855` | ✅ Da (public) | Job-uri suplimentare ale companiei pe eJobs |

## Recomandare

- Paginile sunt publice și nu necesită autentificare.
- Scraperul face o singură cerere GET per sursă per rulare (farmec.ro + eJobs).
- Se folosește un User-Agent de browser pentru a respecta cerințele platformelor.
- Comportamentul este rezonabil — o singură cerere per sursă, fără paginare agresivă.

**Concluzie**: Risc minim. Sursele sunt publice, fără restricții, o singură cerere per sursă per rulare.
