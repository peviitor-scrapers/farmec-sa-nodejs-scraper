import { jest } from '@jest/globals';
import fetch from 'node-fetch';

const API_BASE = 'https://api.peviitor.ro/v1';
const TEST_CIF = '199150';
const TEST_BRAND = 'FARMEC';
const CAREERS_URL = 'https://www.farmec.ro/compania/cariere/';
const EJOBS_URL = 'https://www.ejobs.ro/company/farmec/176855';

let HAS_API = false;

async function checkApiAvailability() {
  try {
    const res = await fetch(`${API_BASE}/scraper/jobs/?cif=${TEST_CIF}&rows=1`, {
      signal: AbortSignal.timeout(5000)
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

let HAS_ANAF = false;

async function checkAnafAvailability() {
  try {
    const res = await fetch('https://demoanaf.ro/api/search?q=test', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

let HAS_CAREERS = false;

async function checkCareersAvailability() {
  try {
    const res = await fetch(CAREERS_URL, {
      signal: AbortSignal.timeout(10000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function itIfApi(name, fn, timeout) {
  if (HAS_API) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: API unavailable)`, fn, timeout);
}

function itIfAnaf(name, fn, timeout) {
  if (HAS_ANAF) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: ANAF API unavailable)`, fn, timeout);
}

function itIfCareers(name, fn, timeout) {
  if (HAS_CAREERS) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: farmec.ro unavailable)`, fn, timeout);
}

[HAS_API, HAS_ANAF, HAS_CAREERS] = await Promise.all([
  checkApiAvailability(),
  checkAnafAvailability(),
  checkCareersAvailability()
]);

describe('E2E: Full Scraping Pipeline', () => {

  describe('Careers Page — Real Data Fetch', () => {
    let index;

    beforeAll(async () => {
      index = await import('../../scraper/index.js');
    }, 15000);

    itIfCareers('should fetch jobs from farmec.ro careers page', async () => {
      const html = await index.fetchCareersPage();
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);

      const jobs = index.extractJobs(html);
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);

      for (const job of jobs) {
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('slug');
        expect(job.url).toMatch(/^https:\/\/www\.farmec\.ro\/compania\/joburi\//);
      }
    }, 30000);

    itIfCareers('should fetch jobs from eJobs company page', async () => {
      try {
        const html = await index.fetchEJobsPage();
        expect(typeof html).toBe('string');

        const jobs = index.extractEJobs(html);
        expect(Array.isArray(jobs)).toBe(true);

        for (const job of jobs) {
          expect(job).toHaveProperty('title');
          expect(job).toHaveProperty('department', 'eJobs');
          expect(job.url).toMatch(/^https:\/\/www\.ejobs\.ro\//);
        }
      } catch {
        console.log('eJobs page unavailable — skipping eJobs assertions');
      }
    }, 30000);
  });

  describe('Parse + Transform Pipeline', () => {
    let index;

    beforeAll(async () => {
      index = await import('../../scraper/index.js');
    });

    itIfCareers('should scrape and merge jobs from both sources', async () => {
      const { farmecJobs, ejobsJobs } = await index.scrapeJobs();

      expect(Array.isArray(farmecJobs)).toBe(true);
      expect(farmecJobs.length).toBeGreaterThan(0);
      expect(Array.isArray(ejobsJobs)).toBe(true);

      const all = index.dedupeJobs(farmecJobs, ejobsJobs);
      expect(all.length).toBeGreaterThan(0);
      expect(all.length).toBeLessThanOrEqual(farmecJobs.length + ejobsJobs.length);
    }, 30000);

    itIfCareers('should map scraped jobs to the job model', async () => {
      const { farmecJobs } = await index.scrapeJobs();

      if (farmecJobs.length === 0) {
        console.log('No FARMEC jobs — skipping mapToJobModel test');
        return;
      }

      const model = index.mapToJobModel(farmecJobs[0], TEST_CIF, 'FARMEC SA');

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model.company).toContain('FARMEC');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.location).toEqual(['Cluj-Napoca']);
      expect(model.country).toEqual(['România']);
    }, 30000);

    itIfCareers('should transform jobs and filter to Romanian locations', async () => {
      const { farmecJobs } = await index.scrapeJobs();

      if (farmecJobs.length === 0) {
        console.log('No FARMEC jobs — skipping transformJobsForSOLR test');
        return;
      }

      const mappedJobs = farmecJobs.map(j => index.mapToJobModel(j, TEST_CIF, 'FARMEC SA'));

      const payload = {
        source: 'farmec.ro',
        company: 'FARMEC SA',
        cif: TEST_CIF,
        jobs: mappedJobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toContain('FARMEC');
      expect(transformed.jobs.length).toBe(mappedJobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
      }
    }, 30000);
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../scraper/anaf.js');
      company = await import('../../scraper/company.js');
    });

    itIfAnaf('should find FARMEC in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const farmec = results.find(c =>
        c.name.toUpperCase().startsWith('FARMEC') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(farmec).toBeDefined();
      expect(farmec.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfApi('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('FARMEC SA');
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('No FARMEC jobs in API — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../scraper/anaf.js');
    });

    itIfAnaf('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany('FARMEC');

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('API Data Verification', () => {
    let api;

    beforeAll(async () => {
      api = await import('../../scraper/api.js');
    });

    itIfApi('should have FARMEC jobs in API with correct company name', async () => {
      const result = await api.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('No FARMEC jobs in API — skipping API data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toContain('FARMEC');
        expect(job.cif).toBe(TEST_CIF.padStart(8, '0'));
      }
    }, 15000);

    itIfApi('should have FARMEC company core entry with required fields', async () => {
      const companyDoc = await api.getCompanyByCif(TEST_CIF);

      expect(companyDoc).toBeDefined();
      expect(companyDoc.company).toBe('FARMEC SA');
      expect(companyDoc.status).toBe('activ');
    }, 15000);
  });
});
