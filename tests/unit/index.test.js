import { jest } from "@jest/globals";
import { extractJobs, extractEJobs, mapToJobModel } from "../../scraper/index.js";

const COMPANY_CIF = "199150";
const COMPANY_NAME = "FARMEC SA";

function createMockFarmecHtml(jobs) {
  let html = `<!DOCTYPE html><html><body>`;

  for (const job of jobs) {
    html += `<div class="listbox"><a href="https://www.farmec.ro/compania/joburi/${job.slug}/">${job.title}</a></div><div class="listbox-next">`;
  }

  html += `</body></html>`;
  return html;
}

describe("extractJobs", () => {
  test("extracts multiple jobs from Farmec careers page", () => {
    const html = createMockFarmecHtml([
      { slug: "trade-marketing-magazine-cluj-1", title: "Retail Marketing Specialist -Rețele magazine Farmec" },
      { slug: "primitor-distribuitor-cluj-2-3-2-2-2-2-2-2-2", title: "Primitor-distribuitor, Cluj-Napoca" },
      { slug: "analist-servicii-clienti-cluj-1-2-2", title: "Analist servicii clienți-Cluj-Napoca" },
      { slug: "gestionar-depozit-cluj-2-3-2-2-2-2-2-2-2-2", title: "Gestionar depozit, Cluj-Napoca" }
    ]);

    const jobs = extractJobs(html);
    expect(jobs).toHaveLength(4);
    expect(jobs[0].title).toBe("Retail Marketing Specialist -Rețele magazine Farmec");
    expect(jobs[0].slug).toBe("trade-marketing-magazine-cluj-1");
    expect(jobs[0].url).toBe("https://www.farmec.ro/compania/joburi/trade-marketing-magazine-cluj-1/");
    expect(jobs[1].title).toBe("Primitor-distribuitor, Cluj-Napoca");
    expect(jobs[2].title).toBe("Analist servicii clienți-Cluj-Napoca");
    expect(jobs[3].title).toBe("Gestionar depozit, Cluj-Napoca");
  });

  test("returns empty array when no jobs found", () => {
    const html = "<html><body>no jobs</body></html>";
    const jobs = extractJobs(html);
    expect(jobs).toEqual([]);
  });

  test("handles single job", () => {
    const html = createMockFarmecHtml([
      { slug: "test-job-slug", title: "Test Job Title" }
    ]);

    const jobs = extractJobs(html);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Test Job Title");
    expect(jobs[0].url).toBe("https://www.farmec.ro/compania/joburi/test-job-slug/");
  });
});

describe("extractEJobs", () => {
  function createMockNuxtData(jobs) {
    const data = [null];
    let idx = 1;

    for (const job of jobs) {
      const titleIdx = idx++;
      const slugIdx = idx++;
      const idIdx = idx++;
      const cityIdIdx = idx++;
      const addressIdx = idx++;
      const locReactiveIdx = idx++;
      const locArrayIdx = idx++;
      const jobIdx = idx++;

      data[titleIdx] = job.title;
      data[slugIdx] = job.slug;
      data[idIdx] = job.id;
      data[cityIdIdx] = job.cityId || 1;
      data[addressIdx] = job.address || "Cluj-Napoca, România";
      data[locReactiveIdx] = ["Reactive", locArrayIdx];
      data[locArrayIdx] = { cityId: cityIdIdx, address: addressIdx };
      data[jobIdx] = { id: idIdx, title: titleIdx, slug: slugIdx, locations: locReactiveIdx };
    }

    return `<script>window.__NUXT_DATA__">${JSON.stringify(data)}</script>`;
  }

  test("extracts jobs from Nuxt data", () => {
    const html = createMockNuxtData([
      { id: 1960293, title: "Gestionar Depozit", slug: "gestionar-depozit", address: "Cluj-Napoca, România" },
      { id: 1959869, title: "Analist servicii clienți", slug: "analist-servicii-clienti", address: "Cluj-Napoca, România" }
    ]);

    const jobs = extractEJobs(html);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toBe("Gestionar Depozit");
    expect(jobs[0].url).toBe("https://www.ejobs.ro/user/locuri-de-munca/gestionar-depozit/1960293");
    expect(jobs[0].department).toBe("eJobs");
    expect(jobs[1].title).toBe("Analist servicii clienți");
    expect(jobs[1].url).toBe("https://www.ejobs.ro/user/locuri-de-munca/analist-servicii-clienti/1959869");
  });

  test("returns empty array when no Nuxt data found", () => {
    const jobs = extractEJobs("<html><body>no data</body></html>");
    expect(jobs).toEqual([]);
  });

  test("returns empty array when Nuxt data has no job objects", () => {
    const html = `<script>window.__NUXT_DATA__">${JSON.stringify([null, "foo", "bar"])}</script>`;
    const jobs = extractEJobs(html);
    expect(jobs).toEqual([]);
  });

  test("handles single job", () => {
    const html = createMockNuxtData([
      { id: 1001, title: "Test Job", slug: "test-job", address: "Cluj-Napoca, România" }
    ]);

    const jobs = extractEJobs(html);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Test Job");
  });
});

describe("mapToJobModel", () => {
  test("maps raw job to correct model with Cluj-Napoca location", () => {
    const rawJob = {
      title: "Gestionar Depozit",
      url: "https://www.farmec.ro/compania/joburi/gestionar-depozit-cluj-2-3-2-2-2-2-2-2-2-2/"
    };

    const result = mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

    expect(result).toEqual({
      url: "https://www.farmec.ro/compania/joburi/gestionar-depozit-cluj-2-3-2-2-2-2-2-2-2-2/",
      title: "Gestionar Depozit",
      company: COMPANY_NAME,
      cif: COMPANY_CIF,
      location: ["Cluj-Napoca"],
      country: ["România"],
      date: expect.any(String),
      status: "scraped"
    });
  });

  test("creates unique URLs for each job", () => {
    const jobs = [
      { title: "Job 1", url: "https://www.farmec.ro/compania/joburi/job-1/" },
      { title: "Job 2", url: "https://www.farmec.ro/compania/joburi/job-2/" }
    ];

    const results = jobs.map(j => mapToJobModel(j, COMPANY_CIF, COMPANY_NAME));
    expect(results[0].url).not.toBe(results[1].url);
  });
});
