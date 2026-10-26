// Adds the built-in assessments (Mood Self-Assessment, Listening Self-Reflection) to the
// assessment store, so you don't have to click through the admin screens.
//
//   npm run assessments:seed                       # Mood Self-Assessment, as a draft
//   npm run assessments:seed -- --publish          # ...and make it public right away
//   npm run assessments:seed -- mood listening     # choose templates
//   npm run assessments:seed -- --force            # add another copy even if one exists
//
// It uses the same storage as the site: Firestore when Firebase Admin credentials are set
// (FIREBASE_SERVICE_ACCOUNT_JSON in .env.local or the environment), otherwise the local
// development file (.data/assessments-dev.json). Running it twice does nothing the second
// time unless you pass --force. The scoring ranges are starter settings; review them in
// the admin builder before publishing to the live site.

import { existsSync } from "node:fs";
import { createAssessment, listAssessments, publishAssessment } from "../../lib/assessments/server/service";
import { FileStore, getStore } from "../../lib/assessments/server/store";
import { TEMPLATES } from "../../lib/assessments/templates";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      console.warn(`Could not read ${file}; continuing without it.`);
    }
  }
}

const ALIASES: Record<string, string> = { mood: "mood-self-assessment", listening: "listening-self-reflection" };

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const force = args.includes("--force");
  const wanted = args.filter((a) => !a.startsWith("--")).map((a) => ALIASES[a] ?? a);
  const ids = wanted.length ? wanted : ["mood-self-assessment"];

  const unknown = ids.filter((id) => !TEMPLATES.some((t) => t.id === id && id !== "blank"));
  if (unknown.length) {
    console.error(`Unknown template: ${unknown.join(", ")}. Available: mood, listening.`);
    process.exit(1);
  }

  const store = await getStore();
  console.log(`Storage: ${store.kind === "file" ? "local development file (.data/assessments-dev.json)" : store.kind}`);

  const user = { uid: "seed-script", email: "seed-script" };
  for (const id of ids) {
    const existing = (await listAssessments(store)).find((a) => a.templateId === id);
    if (existing && !force) {
      console.log(`- ${id}: already there as "${existing.slug}" (${existing.status}). Skipped (use --force for another copy).`);
      continue;
    }
    const { assessment, report } = await createAssessment(store, { templateId: id }, user);
    let line = `- ${id}: added "${assessment.title}" as a draft (${assessment.slug})`;
    if (publish) {
      if (report.errors.length) {
        console.error(`${line}\n  Not published: ${report.errors.map((e) => e.message).join(" | ")}`);
        process.exitCode = 1;
        continue;
      }
      const published = await publishAssessment(store, assessment.id, user);
      line = `- ${id}: added and published "${published.assessment.title}" (version ${published.assessment.version})`;
    }
    console.log(line);
    console.log(`  Public page:  /assessments/${assessment.slug}`);
    console.log(`  Admin editor: /admin/assessments/${assessment.id}/edit`);
  }

  if (store instanceof FileStore) {
    console.log("\nThe local dev server re-reads the file automatically; just refresh the page.");
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
