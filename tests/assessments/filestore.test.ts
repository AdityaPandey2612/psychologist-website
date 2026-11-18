import assert from "node:assert/strict";
import { mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { FileStore } from "../../lib/assessments/server/store";

// The local development store must notice changes made by another process (for example
// `npm run assessments:seed`) and must not overwrite them with a stale in-memory copy.
describe("file store and outside changes", () => {
  it("sees data written by another instance and keeps it when it writes itself", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assess-fs-"));
    const file = path.join(dir, "db.json");
    try {
      const server = new FileStore(file); // plays the running dev server
      await server.set("things", "a", { id: "a" });

      const seed = new FileStore(file); // plays the seed script, a separate process
      await seed.set("things", "b", { id: "b" });
      // Make sure the modification time differs even on file systems with coarse timestamps.
      const later = new Date(Date.now() + 5_000);
      utimesSync(file, later, later);

      assert.deepEqual((await server.get<{ id: string }>("things", "b"))?.id, "b");
      await server.set("things", "c", { id: "c" });
      const reopened = new FileStore(file);
      assert.equal(await reopened.count("things"), 3); // a, b and c: the seed's data was not lost
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
