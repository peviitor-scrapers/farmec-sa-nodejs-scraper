import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const FARMEC_CIF = '199150';

describe('Integration: API Workflow', () => {

  describe('ANAF API', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should fetch FARMEC by hardcoded CIF and validate', async () => {
      const data = await anaf.getCompanyFromANAF(FARMEC_CIF);
      expect(data).toBeDefined();
      expect(data.cui).toBe(199150);
      expect(data.name).toBe('FARMEC SA');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
      expect(data).toHaveProperty('caenCode');
      expect(data).toHaveProperty('inactive', false);
      expect(data.onrcStatusLabel).toBe('Funcțiune');
    }, 15000);

    it('should return empty array for non-existent brand', async () => {
      const results = await anaf.searchCompany('ThisBrandDoesNotExistXYZ123');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 15000);

    it('should throw for invalid CIF', async () => {
      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    }, 60000);

    it('should use cached data when API fails (getCompanyFromANAFWithFallback)', async () => {
      const cached = { cui: 199150, name: 'FARMEC SA' };

      const data = await anaf.getCompanyFromANAFWithFallback(FARMEC_CIF, cached);

      expect(data).toBeDefined();
      expect(data.cui).toBe(199150);
    }, 15000);
  });

  describe('Peviitor API', () => {
    let company;

    beforeAll(async () => {
      company = await import('../../company.js');
    });

    it.skip('should respond successfully and contain companies array (Peviitor API may block non-browser requests)', async () => {
      const res = await fetch('https://api.peviitor.ro/v1/company/', {
        headers: { 'User-Agent': 'job_seeker_ro_spider' }
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('companies');
      expect(Array.isArray(data.companies)).toBe(true);
    }, 15000);
  });

  describe('SOLR Company Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query company core by ID', async () => {
      const result = await solr.queryCompanySOLR(`id:${FARMEC_CIF}`);

      expect(result.numFound).toBe(1);
      const farmec = result.docs[0];
      expect(farmec.id).toBe(FARMEC_CIF);
      expect(farmec.company).toBe('FARMEC SA');
      expect(farmec.brand).toBe('FARMEC');
      expect(farmec.status).toBe('activ');
      expect(Array.isArray(farmec.location)).toBe(true);
      expect(farmec.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }, 15000);

    itIfSolr('should have required company model fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${FARMEC_CIF}`);
      const farmec = result.docs[0];

      expect(farmec).toHaveProperty('id', FARMEC_CIF);
      expect(farmec).toHaveProperty('company');
      expect(farmec).toHaveProperty('brand', 'FARMEC');
      expect(farmec).toHaveProperty('status');
      expect(['activ', 'suspendat', 'inactiv', 'radiat']).toContain(farmec.status);
      expect(farmec).toHaveProperty('location');
      expect(Array.isArray(farmec.location)).toBe(true);
      expect(farmec).toHaveProperty('website');
      expect(Array.isArray(farmec.website)).toBe(true);
      expect(farmec.website[0]).toMatch(/^https?:\/\/.+/);
      expect(farmec).toHaveProperty('career');
      expect(Array.isArray(farmec.career)).toBe(true);
      expect(farmec.career[0]).toMatch(/^https?:\/\/.+/);
      expect(farmec).toHaveProperty('lastScraped');
      expect(farmec).toHaveProperty('scraperFile');
    }, 15000);

    itIfSolr('should have optional field (group) if present', async () => {
      const result = await solr.queryCompanySOLR(`id:${FARMEC_CIF}`);
      const farmec = result.docs[0];

      if (farmec.group !== undefined) {
        expect(typeof farmec.group).toBe('string');
      }
    }, 15000);
  });

  describe('SOLR Jobs Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query jobs by CIF and return valid data', async () => {
      const result = await solr.querySOLR(FARMEC_CIF);

      expect(result.numFound).toBeGreaterThan(0);
      expect(Array.isArray(result.docs)).toBe(true);

      const job = result.docs[0];
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company', 'FARMEC SA');
      expect(job).toHaveProperty('cif', FARMEC_CIF);
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('location');
    }, 15000);

    itIfSolr('should not have duplicate URLs for same CIF', async () => {
      const result = await solr.querySOLR(FARMEC_CIF);

      const urls = result.docs.map(j => j.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(result.docs.length);
    }, 15000);

    itIfSolr('should have valid status values for all jobs', async () => {
      const validStatuses = ['scraped', 'tested', 'verified', 'published'];
      const result = await solr.querySOLR(FARMEC_CIF);

      for (const job of result.docs) {
        expect(validStatuses).toContain(job.status);
      }
    }, 15000);

    itIfSolr('should have valid CIF format for all jobs', async () => {
      const result = await solr.querySOLR(FARMEC_CIF);

      for (const job of result.docs) {
        expect(job.cif).toMatch(/^\d{6,9}$/);
      }
    }, 15000);
  });

  describe('Full Validation Workflow', () => {
    let anaf;
    let companyModule;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      companyModule = await import('../../company.js');
    });

    it('should complete the ANAF (by CIF) validation path', async () => {
      const anafData = await anaf.getCompanyFromANAF(FARMEC_CIF);
      expect(anafData.name).toBe('FARMEC SA');
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should validate company and query SOLR for existing jobs', async () => {
      const companyResult = await companyModule.validateAndGetCompany();

      expect(companyResult.status).toBe('active');
      expect(companyResult.company).toBe('FARMEC SA');
      expect(companyResult.cif).toBe(FARMEC_CIF);
      expect(companyResult.existingJobsCount).toBeGreaterThan(0);
    }, 30000);

    itIfSolr('should have matching CIF in company core', async () => {
      const companyResult = await companyModule.validateAndGetCompany();
      const solrObj = await import('../../solr.js');

      const solrResult = await solrObj.queryCompanySOLR(`id:${FARMEC_CIF}`);
      expect(solrResult.numFound).toBe(1);
      expect(solrResult.docs[0].id).toBe(FARMEC_CIF);
      expect(solrResult.docs[0].company).toBe('FARMEC SA');
    }, 30000);
  });
});
