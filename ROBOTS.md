# ROBOTS.md — Reguli pentru roboți

## User-Agent

Toate request-urile HTTP făcute de acest scraper folosesc:

```
job_seeker_ro_spider
```

## Politica de acces

1. Respectăm `robots.txt` al site-urilor pe care le scraper-uim.
2. Nu suprasolicităm serverele — există delay-uri implicite între request-uri.
3. Nu scraper-uim date personale sau informații protejate.
4. Identificăm întotdeauna scraperul prin User-Agent-ul de mai sus.

## Robots.txt Analysis

### `www.farmec.ro/robots.txt`

The careers page is not blocked. Disallowed paths are product/catalog related:
- `/index.php/`, `/catalog/*`, `/checkout/`, `/customer/`, `/wishlist/`
- Careers path `/compania/cariere/` is allowed — no scraping restrictions.

### `www.ejobs.ro/robots.txt`

eJobs is a third-party job board. We scrape their Nuxt.js __NUXT_DATA__ payload.

## Domenii accesate

| Domeniu | Scop |
|---------|------|
| `www.farmec.ro` | Pagina de cariere |
| `www.ejobs.ro` | Anunțuri eJobs |
| `api.peviitor.ro` | Validare companie |
| `solr.peviitor.ro` | Indexare job-uri |
