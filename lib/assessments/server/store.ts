import fs from "node:fs";
import path from "node:path";
import { embeddedServiceAccount } from "./serviceAccount";

// Persistence boundary for the assessment system. Application code talks to the
// small DocStore interface; there are three implementations:
//   * Firestore (firebase-admin)   — production
//   * File                         — local development only, when no credentials are set
//   * Memory                       — tests
// Collections are plain documents addressed by id. Queries are deliberately
// limited to equality filters (sorting is done by callers) so no composite
// Firestore indexes are required.

export type Where = Array<[field: string, value: string | number | boolean]>;

export interface DocStore {
  readonly kind: "firestore" | "file" | "memory";
  get<T>(collection: string, id: string): Promise<T | null>;
  /** Creates the document; resolves false (and writes nothing) if the id already exists. */
  create(collection: string, id: string, data: object): Promise<boolean>;
  set(collection: string, id: string, data: object): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  query<T>(collection: string, opts?: { where?: Where; limit?: number }): Promise<T[]>;
  count(collection: string, where?: Where): Promise<number>;
  /**
   * Atomic read-modify-write. `fn` receives the current document (or null) and
   * returns the document to store, or `undefined` to leave it untouched.
   */
  transact<T extends object>(collection: string, id: string, fn: (current: T | null) => T | undefined): Promise<T | null>;
}

export class StoreNotConfiguredError extends Error {
  constructor(message = "Assessment storage is not configured.") {
    super(message);
    this.name = "StoreNotConfiguredError";
  }
}

/** Firestore drops `undefined`; mirror that so every backend stores the same shape. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function getPath(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

type Tables = Record<string, Record<string, unknown>>;

export class MemoryStore implements DocStore {
  readonly kind: "memory" | "file" = "memory";
  protected tables: Tables = {};

  protected persist(): void {}

  /** Called before every read or write; the file store uses it to notice outside changes. */
  protected beforeAccess(): void {}

  protected table(collection: string): Record<string, unknown> {
    this.beforeAccess();
    return (this.tables[collection] ??= {});
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const doc = this.table(collection)[id];
    return doc === undefined ? null : clone(doc as T);
  }

  async create(collection: string, id: string, data: object): Promise<boolean> {
    const table = this.table(collection);
    if (id in table) return false;
    table[id] = clone(data);
    this.persist();
    return true;
  }

  async set(collection: string, id: string, data: object): Promise<void> {
    this.table(collection)[id] = clone(data);
    this.persist();
  }

  async delete(collection: string, id: string): Promise<void> {
    delete this.table(collection)[id];
    this.persist();
  }

  async query<T>(collection: string, opts: { where?: Where; limit?: number } = {}): Promise<T[]> {
    const rows = Object.values(this.table(collection)).filter((doc) =>
      (opts.where ?? []).every(([field, value]) => getPath(doc, field) === value),
    );
    return clone(opts.limit ? rows.slice(0, opts.limit) : rows) as T[];
  }

  async count(collection: string, where?: Where): Promise<number> {
    return (await this.query(collection, { where })).length;
  }

  /**
   * Read, decide, write, with nothing in between: two transactions on the same document can never both see the old
   * value (Firestore's transactions give the same guarantee), so a "first one wins" claim really has one winner.
   */
  async transact<T extends object>(collection: string, id: string, fn: (current: T | null) => T | undefined): Promise<T | null> {
    const table = this.table(collection);
    const stored = table[id];
    const current = stored === undefined ? null : clone(stored as T);
    const next = fn(current);
    if (next === undefined) return current;
    table[id] = clone(next);
    this.persist();
    return clone(next);
  }
}

/**
 * Development fallback: one JSON file, rewritten on change. It re-reads the file when
 * something else changed it (for example the seed script, `npm run assessments:seed`),
 * so a running dev server picks the new data up and never overwrites it with a stale copy.
 */
export class FileStore extends MemoryStore {
  readonly kind = "file" as const;
  private mtime = 0;

  constructor(private readonly file: string) {
    super();
    this.load();
  }

  private stamp(): number {
    try {
      return fs.statSync(this.file).mtimeMs;
    } catch {
      return 0;
    }
  }

  private load(): void {
    try {
      this.tables = JSON.parse(fs.readFileSync(this.file, "utf8")) as Tables;
    } catch {
      this.tables = {};
    }
    this.mtime = this.stamp();
  }

  protected beforeAccess(): void {
    if (this.stamp() !== this.mtime) this.load();
  }

  protected persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.tables, null, 2));
    fs.renameSync(tmp, this.file);
    this.mtime = this.stamp();
  }
}

// ---------------------------------------------------------------- selection

const globalForStore = globalThis as typeof globalThis & { __assessmentStore?: DocStore };

export function hasFirestoreCredentials(): boolean {
  return Boolean(
    embeddedServiceAccount() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

export async function getStore(): Promise<DocStore> {
  if (globalForStore.__assessmentStore) return globalForStore.__assessmentStore;

  let store: DocStore;
  if (process.env.ASSESSMENT_STORE === "file" || (!hasFirestoreCredentials() && process.env.NODE_ENV !== "production")) {
    if (process.env.NODE_ENV === "production") throw new StoreNotConfiguredError();
    const file = process.env.ASSESSMENT_FILE_STORE_PATH || path.join(process.cwd(), ".data", "assessments-dev.json");
    console.warn(`[assessments] No Firebase Admin credentials found; using a local development file store at ${file}.`);
    store = new FileStore(file);
  } else if (hasFirestoreCredentials()) {
    const { createFirestoreStore } = await import("./firestoreStore");
    store = await createFirestoreStore();
  } else {
    throw new StoreNotConfiguredError(
      "Assessment storage is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY).",
    );
  }
  globalForStore.__assessmentStore = store;
  return store;
}

/** Test hook. */
export function setStoreForTests(store: DocStore | undefined): void {
  globalForStore.__assessmentStore = store;
}
