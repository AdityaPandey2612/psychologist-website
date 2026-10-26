import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { embeddedServiceAccount } from "./serviceAccount";
import type { DocStore, Where } from "./store";

// Firestore implementation of DocStore using the Admin SDK. The Admin SDK
// bypasses Firestore security rules, which is intended: browsers never touch
// these collections directly (see docs/ASSESSMENTS.md for the matching rules).

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(text) as { project_id?: string; client_email?: string; private_key?: string };
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key?.replace(/\\n/g, "\n") };
  }
  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  // Last resort: the key kept in source (see serviceAccount.ts). Environment variables win over it.
  return embeddedServiceAccount();
}

const APP_NAME = "assessments-admin";

/** The Firebase Admin app the assessment system uses (created once). Also used for Storage uploads. */
export function getAssessmentsAdminApp() {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  const account = readServiceAccount();
  return initializeApp(
    {
      credential: account ? cert(account) : applicationDefault(),
      projectId: account?.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    },
    APP_NAME,
  );
}

function getFirestoreInstance(): Firestore {
  const existing = getApps().some((a) => a.name === APP_NAME);
  const db = getFirestore(getAssessmentsAdminApp());
  if (!existing) db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export async function createFirestoreStore(): Promise<DocStore> {
  const db = getFirestoreInstance();

  const applyWhere = (collection: string, where?: Where) => {
    let q: FirebaseFirestore.Query = db.collection(collection);
    for (const [field, value] of where ?? []) q = q.where(field, "==", value);
    return q;
  };

  const store: DocStore = {
    kind: "firestore",

    async get<T>(collection: string, id: string) {
      const snap = await db.collection(collection).doc(id).get();
      return snap.exists ? (snap.data() as T) : null;
    },

    async create(collection, id, data) {
      try {
        await db.collection(collection).doc(id).create(data as FirebaseFirestore.DocumentData);
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === 6) return false; // ALREADY_EXISTS
        throw error;
      }
    },

    async set(collection, id, data) {
      await db.collection(collection).doc(id).set(data as FirebaseFirestore.DocumentData);
    },

    async delete(collection, id) {
      await db.collection(collection).doc(id).delete();
    },

    async query<T>(collection: string, opts: { where?: Where; limit?: number } = {}) {
      let q = applyWhere(collection, opts.where);
      if (opts.limit) q = q.limit(opts.limit);
      const snap = await q.get();
      return snap.docs.map((d) => d.data() as T);
    },

    async count(collection, where) {
      const snap = await applyWhere(collection, where).count().get();
      return snap.data().count;
    },

    async transact<T extends object>(collection: string, id: string, fn: (current: T | null) => T | undefined) {
      return db.runTransaction(async (tx) => {
        const ref = db.collection(collection).doc(id);
        const snap = await tx.get(ref);
        const current = snap.exists ? (snap.data() as T) : null;
        const next = fn(current);
        if (next === undefined) return current;
        tx.set(ref, next as FirebaseFirestore.DocumentData);
        return next;
      });
    },
  };
  return store;
}
