// ============================================================================
// FARMEC SA SCRAPER — peviitor.ro
// Scrapes job listings from:
//   1. https://www.farmec.ro/compania/cariere/ (HTML)
//   2. https://www.ejobs.ro/company/farmec/176855 (Nuxt __NUXT_DATA__ JSON)
// Publishes via the peviitor API (api.peviitor.ro/v1) — no direct Solr access.
// ============================================================================

import fs from "fs";
import { fileURLToPath } from "url";
import { validateAndGetCompany } from "./company.js";
import { querySOLR, upsertJobs, upsertCompany, deleteJobByUrl } from "./api.js";
import { generateJobsMarkdown } from "./markdown-generator.js";
import companyConfig from "./config/company.js";

// ============================================================================
// CONFIGURATION CONSTANTS — derived from scraper/config/company.json
// ============================================================================

const COMPANY_CIF = companyConfig.id;
const CAREERS_URL = "https://www.farmec.ro/compania/cariere/";
const EJOBS_URL = "https://www.ejobs.ro/company/farmec/176855";

// Request timeout in milliseconds (10 seconds, per INSTRUCTIONS.md)
const TIMEOUT = 10000;

// Browser-like User-Agent for the Farmec/eJobs pages
const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

// Global variable to store company name after validation
let COMPANY_NAME = companyConfig.company;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Promise-based sleep function to introduce delays between requests
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// API FUNCTIONS - Fetching data from Farmec website
// ============================================================================

/**
 * Extracts job listings from the Farmec careers page HTML.
 * Uses a regex over the listbox markup on farmec.ro/compania/cariere/.
 * @param {string} html - Raw HTML of the careers page
 * @returns {Array} - Array of jobs { title, slug, url }
 */
function extractJobs(html) {
  const jobRegex = /<a href="https:\/\/www\.farmec\.ro\/compania\/joburi\/([^"]+)\/">([\s\S]*?)<\/a><\/div><div class="listbox-next"/g;
  const jobs = [];
  let match;

  while ((match = jobRegex.exec(html)) !== null) {
    const slug = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    jobs.push({
      title,
      slug,
      url: `https://www.farmec.ro/compania/joburi/${slug}/`
    });
  }

  return jobs;
}

/**
 * Fetches the Farmec careers page.
 * @returns {Promise<string>} - Page HTML
 */
async function fetchCareersPage() {
  const res = await fetch(CAREERS_URL, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} for careers page`);
  }

  return await res.text();
}

/**
 * Resolves Nuxt serialization references (Ref/Reactive arrays) into plain values.
 * @param {*} val - Raw value from __NUXT_DATA__
 * @param {Array} data - Full Nuxt data array
 * @returns {*} - Resolved value
 */
function resolveNuxtRef(val, data) {
  if (val === null || val === undefined) return val;
  if (typeof val === "number") {
    const target = data[val];
    if (target === null || target === undefined) return val;
    if (typeof target === "string" || typeof target === "number" || typeof target === "boolean") return target;
    if (Array.isArray(target)) {
      if (target.length === 2 && typeof target[1] === "number") {
        const type = target[0];
        if (type === "Ref" || type === "Reactive" || type === "ShallowReactive") return resolveNuxtRef(target[1], data);
        if (type === "EmptyRef") return null;
      }
      return target.map(v => resolveNuxtRef(v, data)).filter(v => v !== null);
    }
    if (typeof target === "object") {
      const result = {};
      for (const [k, v] of Object.entries(target)) result[k] = resolveNuxtRef(v, data);
      return result;
    }
    return target;
  }
  if (Array.isArray(val)) {
    if (val.length === 2 && typeof val[1] === "number") {
      const type = val[0];
      if (type === "Ref" || type === "Reactive" || type === "ShallowReactive") return resolveNuxtRef(val[1], data);
      if (type === "EmptyRef") return null;
    }
    return val.map(v => resolveNuxtRef(v, data));
  }
  if (typeof val === "object") {
    const result = {};
    for (const [k, v] of Object.entries(val)) result[k] = resolveNuxtRef(v, data);
    return result;
  }
  return val;
}

/**
 * Extracts job listings from the eJobs company page (Nuxt __NUXT_DATA__ JSON).
 * @param {string} html - Raw HTML of the eJobs page
 * @returns {Array} - Array of jobs { title, department, url }
 */
function extractEJobs(html) {
  const match = html.match(/__NUXT_DATA__">(.*?)<\/script>/);
  if (!match) return [];

  const data = JSON.parse(match[1]);
  const jobs = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (typeof d === "object" && !Array.isArray(d) && d !== null && d.title !== undefined) {
      const resolved = resolveNuxtRef(d, data);
      if (resolved.id && resolved.title) {
        const slug = resolved.slug || "";
        jobs.push({
          title: resolved.title,
          department: "eJobs",
          url: slug ? `https://www.ejobs.ro/user/locuri-de-munca/${slug}/${resolved.id}` : ""
        });
      }
    }
  }

  return jobs;
}

/**
 * Fetches the eJobs company page.
 * @returns {Promise<string>} - Page HTML
 */
async function fetchEJobsPage() {
  const res = await fetch(EJOBS_URL, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} for eJobs page`);
  }

  return await res.text();
}

/**
 * Fetches jobs from both sources (Farmec website + eJobs).
 * @returns {Promise<{farmecJobs: Array, ejobsJobs: Array}>}
 */
async function scrapeJobs() {
  const farmecHtml = await fetchCareersPage();
  const farmecJobs = extractJobs(farmecHtml);
  console.log(`Found ${farmecJobs.length} jobs from Farmec website`);
  farmecJobs.forEach((j, i) => console.log(`  ${i + 1}. ${j.title}`));

  console.log("\nScraping jobs from eJobs...");
  let ejobsJobs = [];
  try {
    const ejobsHtml = await fetchEJobsPage();
    ejobsJobs = extractEJobs(ejobsHtml);
    console.log(`Found ${ejobsJobs.length} jobs from eJobs`);
    ejobsJobs.forEach((j, i) => console.log(`  ${i + 1}. ${j.title}`));
  } catch (err) {
    console.log(`Note: Could not scrape eJobs: ${err.message}`);
  }

  return { farmecJobs, ejobsJobs };
}

// ============================================================================
// DATA TRANSFORMATION - Preparing jobs for the peviitor API
// ============================================================================

/**
 * Maps raw job data to the Solr-compatible job model with timestamps and status
 * @param {Object} rawJob - Job object from scraper
 * @param {string} cif - Company identifier
 * @param {string} companyName - Company name
 * @returns {Object} - Job object ready for the peviitor API
 */
function mapToJobModel(rawJob, cif, companyName = COMPANY_NAME) {
  const now = new Date().toISOString();

  const job = {
    url: rawJob.url,
    title: rawJob.title,
    company: companyName,
    cif: cif,
    location: ["Cluj-Napoca"],
    country: ["România"],
    date: now,
    status: "scraped"
  };

  // Remove undefined fields to keep payload clean
  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);

  return job;
}

/**
 * Transforms jobs to match the Solr schema and normalizes fields.
 * FARMEC jobs always carry Cluj-Napoca / România locations.
 * @param {Object} payload - Job payload with jobs array
 * @returns {Object} - Transformed payload ready for the peviitor API
 */
function transformJobsForSOLR(payload) {
  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes('remote')) return 'remote';
    if (lower.includes('office') || lower.includes('on-site') || lower.includes('site')) return 'on-site';
    return 'hybrid';
  };

  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(),
    jobs: payload.jobs.map(job => {
      const validLocations = (job.location || []).map(loc => loc.toLowerCase() === 'romania' ? 'România' : loc);

      return {
        ...job,
        location: validLocations.length > 0 ? validLocations : ['România'],
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };

  return transformed;
}

/**
 * Merges Farmec + eJobs listings and deduplicates by normalized title.
 * @param {Array} farmecJobs - Jobs from farmec.ro
 * @param {Array} ejobsJobs - Jobs from eJobs
 * @returns {Array} - Deduplicated job list
 */
function dedupeJobs(farmecJobs, ejobsJobs) {
  const seenTitles = new Set();
  const allJobs = [];

  for (const job of [...farmecJobs, ...ejobsJobs]) {
    const key = job.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      allJobs.push(job);
    }
  }

  return allJobs;
}

// ============================================================================
// MAIN ORCHESTRATION - Coordinates the entire scraping workflow
// ============================================================================

/**
 * Main function that orchestrates the complete scraping workflow:
 * 1. Check existing jobs via the peviitor API
 * 2. Validate company via ANAF
 * 3. Scrape jobs from farmec.ro + eJobs
 * 4. Transform data
 * 5. Upsert jobs via the peviitor API
 * 6. Delete stale jobs no longer published
 * 7. Report summary
 */
async function main() {
  try {
    fs.mkdirSync("scraper", { recursive: true });

    // Step 1: Get count of existing jobs
    console.log("=== Step 1: Get existing jobs count ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    const existingCount = existingResult.numFound;
    const existingUrls = new Set(existingResult.docs.map(doc => doc.url).filter(Boolean));
    console.log(`Found ${existingCount} existing jobs`);

    // Step 2: Validate company data via ANAF
    console.log("=== Step 2: Validate company via ANAF ===");
    const { status, company, cif } = await validateAndGetCompany();
    COMPANY_NAME = company;
    const localCif = cif;

    // If company is inactive, jobs were already deleted by company.js — STOP
    if (status === "inactive") {
      console.log("\n⛔ Company is INACTIVE in ANAF — scraper stopping (no jobs to scrape)");
      return;
    }

    // Upsert company to the company core via the peviitor API
    try {
      await upsertCompany({
        id: cif,
        company,
        brand: companyConfig.brand,
        status: "activ",
        location: companyConfig.location,
        website: companyConfig.website,
        career: companyConfig.career,
        scraperFile: companyConfig.scraperFile,
        lastScraped: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.log(`Note: Could not upsert company: ${err.message}`);
    }

    // Step 3: Scrape jobs from Farmec website + eJobs
    console.log("\n=== Step 3: Scrape jobs ===");
    const { farmecJobs, ejobsJobs } = await scrapeJobs();

    // Step 4: Merge and deduplicate
    console.log("\n=== Step 4: Merge and deduplicate jobs ===");
    const allJobs = dedupeJobs(farmecJobs, ejobsJobs);
    console.log(`Total after dedup: ${allJobs.length} jobs`);
    allJobs.forEach((j, i) => console.log(`  ${i + 1}. ${j.title}`));

    if (allJobs.length === 0) {
      console.log("⚠️ No jobs found — stopping (no changes made)");
      return;
    }

    // Step 5: Map raw jobs to the job model
    const jobs = allJobs.map(job => mapToJobModel(job, localCif));

    const payload = {
      source: "www.farmec.ro, ejobs.ro",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: localCif,
      jobs
    };

    // Step 6: Transform jobs
    console.log("\nTransforming jobs...");
    const transformedPayload = transformJobsForSOLR(payload);
    console.log(`📊 Jobs with valid locations: ${transformedPayload.jobs.length}`);

    // Save transformed jobs to file
    fs.writeFileSync("scraper/jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved scraper/jobs.json");

    // Generate and save docs/jobs.md
    const companyData = {
      id: localCif,
      company: transformedPayload.company,
      brand: companyConfig.brand,
      status: "activ",
      location: companyConfig.location,
      website: companyConfig.website,
      career: companyConfig.career,
      lastScraped: new Date().toISOString().split('T')[0]
    };
    const markdown = generateJobsMarkdown(companyData, transformedPayload.jobs);
    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync("docs/jobs.md", markdown, "utf-8");
    console.log("Saved docs/jobs.md");

    // Publish company config for GitHub Pages
    fs.copyFileSync("scraper/config/company.json", "docs/company.json");
    console.log("Copied scraper/config/company.json → docs/company.json");

    // Step 7: Upsert all jobs via the peviitor API
    console.log("\n=== Step 7: Upsert jobs ===");
    await upsertJobs(transformedPayload.jobs);

    // Step 8: Delete stale jobs no longer published
    const scrapedUrls = new Set(transformedPayload.jobs.map(job => job.url));
    const staleUrls = [...existingUrls].filter(url => !scrapedUrls.has(url));

    if (staleUrls.length > 0) {
      console.log(`\n=== Step 8: Delete ${staleUrls.length} stale job(s) ===`);
      let deletedCount = 0;
      for (const url of staleUrls) {
        try {
          console.log(`  Deleting: ${url}`);
          await deleteJobByUrl(url);
          deletedCount++;
        } catch (delErr) {
          console.warn(`  ⚠️ Failed to delete: ${url} — ${delErr.message}`);
        }
      }
      console.log(`✅ Deleted ${deletedCount}/${staleUrls.length} stale job(s)`);
    } else {
      console.log("\n✅ No stale jobs to delete");
    }

    // Step 9: Verify final count
    await sleep(2000);
    const finalResult = await querySOLR(COMPANY_CIF);
    console.log(`\n📊 === SUMMARY ===`);
    console.log(`📊 Jobs existing before scrape: ${existingCount}`);
    console.log(`📊 Jobs scraped total: ${allJobs.length} (${farmecJobs.length} from website, ${ejobsJobs.length} from eJobs)`);
    console.log(`📊 Stale jobs attempted: ${staleUrls.length}`);
    console.log(`📊 Jobs after scrape: ${finalResult.numFound}`);
    console.log(`====================`);

    console.log("\n=== DONE ===");
    console.log("Scraper completed successfully!");

  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

// Export functions for testing
export { extractJobs, extractEJobs, resolveNuxtRef, mapToJobModel, transformJobsForSOLR, dedupeJobs, scrapeJobs, fetchCareersPage, fetchEJobsPage };

// Run main function when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
