import fetch from "node-fetch";

const SOLR_URL = "https://solr.peviitor.ro/solr/job/update";
const SOLR_AUTH = process.env.SOLR_AUTH || "your-solr-credentials";
const COMPANY_NAME = "FARMEC SA";

async function getJobs() {
  const jobs = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.peviitor.ro/v1/search/?company=${encodeURIComponent(COMPANY_NAME)}&page=${page}`,
      {
        headers: {
          origin: "https://peviitor.ro",
          referer: "https://peviitor.ro/",
        },
      }
    );
    const data = await res.json();
    if (data.response.docs.length === 0) break;

    jobs.push(...data.response.docs);
    page++;
  }
  return jobs;
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });
    return { status: res.status, ok: res.status === 200 };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

async function deleteJobFromSolr(url) {
  const AUTH = process.env.SOLR_AUTH || "your-solr-credentials";
  const params = new URLSearchParams({ commit: "true" });

  const deleteQuery = JSON.stringify({
    delete: { query: `url:"${url}"` }
  });

  const res = await fetch(`${SOLR_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: deleteQuery
  });

  console.log(`Delete response status: ${res.status}`);
  return res.ok;
}

async function main(args) {
  const dryRun = args.includes("--dry-run") || !args.includes("--delete");

  console.log("=".repeat(50));
  console.log("Farmec Job Validator");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will delete expired)"}\n`);

  const jobs = await getJobs();
  console.log(`Total jobs found in API: ${jobs.length}\n`);

  let active = 0;
  let expired = 0;
  let errors = 0;
  const expiredJobs = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const result = await checkUrl(job.url);

    const title = job.job_title || job.title || "(no title)";
    if (result.ok) {
      console.log(`✅ ${title.substring(0, 50)}`);
      active++;
    } else if (result.status === 404 || result.status === 0) {
      console.log(`❌ EXPIRED (${result.status}) - ${title.substring(0, 40)}`);
      console.log(`   URL: ${job.url}`);
      expiredJobs.push(job);
      expired++;
    } else {
      console.log(`⚠️ STATUS ${result.status} - ${title.substring(0, 40)}`);
      errors++;
    }

    if ((i + 1) % 20 === 0) {
      console.log(`\n--- Progress: ${i + 1}/${jobs.length} ---\n`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\n" + "=".repeat(50));
  console.log("RESULTS");
  console.log("=".repeat(50));
  console.log(`Active (200): ${active}`);
  console.log(`Expired (404): ${expired}`);
  console.log(`Other errors: ${errors}`);
  console.log(`Total: ${jobs.length}`);

  if (expired > 0) {
    console.log("\n" + "=".repeat(50));
    console.log("EXPIRED JOBS TO DELETE:");
    console.log("=".repeat(50));

    for (const job of expiredJobs) {
      console.log(`- ${job.job_title}`);
      console.log(`  ${job.url}`);
    }

    if (!dryRun) {
      console.log("\n" + "=".repeat(50));
      console.log("DELETING EXPIRED JOBS FROM SOLR...");
      console.log("=".repeat(50));

      let deleted = 0;
      for (const job of expiredJobs) {
        const ok = await deleteJobFromSolr(job.url);
        if (ok) {
          console.log(`🗑️ Deleted: ${job.job_title}`);
          deleted++;
        } else {
          console.log(`❌ Failed to delete: ${job.job_title}`);
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      console.log(`\n✅ Deleted ${deleted}/${expiredJobs.length} expired jobs`);
    } else {
      console.log(`\n⚠️ Dry run - no jobs deleted. Run with --delete to actually remove.`);
    }
  }

  process.exit(0);
}

const args = process.argv.slice(2);
main(args).catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
