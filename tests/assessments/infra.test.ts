import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { adminAllowlist, isAllowed, requireAdmin, setAdminVerifierForTests, verifyFirebaseIdToken } from "../../lib/assessments/server/adminAuth";
import { ApiError } from "../../lib/assessments/server/http";
import { classifyMailError, createSmtpProvider } from "../../lib/assessments/server/mail";
import { checkRateLimit } from "../../lib/assessments/server/rateLimit";
import { FileStore } from "../../lib/assessments/server/store";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ------------------------------------------------------------ Firebase token

const PROJECT = "demo-project";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

function mintToken(claims: Record<string, unknown> = {}, opts: { key?: KeyObject; kid?: string; alg?: string } = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1", typ: "JWT" };
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: "user-1",
    iat: now - 10,
    exp: now + 3000,
    email: "Admin@Example.com",
    ...claims,
  };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${enc(header)}.${enc(payload)}`;
  const sig = sign("RSA-SHA256", Buffer.from(body), opts.key ?? privateKey).toString("base64url");
  return `${body}.${sig}`;
}

const getKey = async (kid: string) => (kid === "k1" ? publicKey : null);
const verify = (token: string) => verifyFirebaseIdToken(token, { projectId: PROJECT, getKey });
const rejects401 = (p: Promise<unknown>) => assert.rejects(p, (e: unknown) => e instanceof ApiError && e.status === 401);

describe("Firebase ID token verification", () => {
  it("accepts a correctly signed, unexpired token for this project", async () => {
    const v = await verify(mintToken());
    assert.equal(v.uid, "user-1");
    assert.equal(v.email, "admin@example.com");
  });

  it("rejects tampered, expired, foreign and unsigned tokens", async () => {
    await rejects401(verify(mintToken({}, { key: other.privateKey }))); // signed by a different key
    await rejects401(verify(mintToken({ exp: Math.floor(Date.now() / 1000) - 3600 })));
    await rejects401(verify(mintToken({ aud: "someone-else" })));
    await rejects401(verify(mintToken({ iss: "https://securetoken.google.com/someone-else" })));
    await rejects401(verify(mintToken({ sub: "" })));
    await rejects401(verify(mintToken({}, { kid: "unknown" })));
    await rejects401(verify(mintToken({}, { alg: "none" })));
    await rejects401(verify("not.a.jwt"));
    const good = mintToken();
    const [h, p, s] = good.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), sub: "attacker" })).toString("base64url");
    await rejects401(verify(`${h}.${forged}.${s}`));
  });

  it("applies the optional email allowlist", () => {
    assert.deepEqual(adminAllowlist({ ASSESSMENT_ADMIN_EMAILS: " A@x.com, b@y.com ," }), ["a@x.com", "b@y.com"]);
    assert.equal(isAllowed({ uid: "1", email: "a@x.com" }, ["a@x.com"]), true);
    assert.equal(isAllowed({ uid: "1", email: "c@x.com" }, ["a@x.com"]), false);
    assert.equal(isAllowed({ uid: "1" }, ["a@x.com"]), false);
    assert.equal(isAllowed({ uid: "1", email: "anyone@x.com" }, []), true);
  });
});

describe("requireAdmin", () => {
  const original = process.env.ASSESSMENT_ADMIN_EMAILS;
  afterEach(() => {
    setAdminVerifierForTests(undefined);
    if (original === undefined) delete process.env.ASSESSMENT_ADMIN_EMAILS;
    else process.env.ASSESSMENT_ADMIN_EMAILS = original;
  });

  it("requires a bearer token", async () => {
    await rejects401(requireAdmin(new Request("http://x/api")));
    await rejects401(requireAdmin(new Request("http://x/api", { headers: { authorization: "Basic abc" } })));
  });

  it("returns the identity, honouring the allowlist", async () => {
    setAdminVerifierForTests(async () => ({ uid: "u", email: "owner@x.com" }));
    delete process.env.ASSESSMENT_ADMIN_EMAILS;
    const req = () => new Request("http://x/api", { headers: { authorization: "Bearer abc" } });
    assert.equal((await requireAdmin(req())).access, "any-signed-in");
    process.env.ASSESSMENT_ADMIN_EMAILS = "owner@x.com";
    assert.equal((await requireAdmin(req())).access, "allowlist");
    process.env.ASSESSMENT_ADMIN_EMAILS = "someone-else@x.com";
    await assert.rejects(requireAdmin(req()), (e: unknown) => e instanceof ApiError && e.status === 403);
  });
});

// ------------------------------------------------------------------- SMTP

interface Sink {
  server: Server;
  port: number;
  messages: string[];
  close(): Promise<void>;
}

/** A minimal SMTP server so the nodemailer adapter is exercised over the real protocol. */
async function smtpSink(rcptReply: (address: string) => string = () => "250 OK"): Promise<Sink> {
  const messages: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    let buffer = "";
    let inData = false;
    let data = "";
    socket.write("220 sink ESMTP ready\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          data += buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          messages.push(data);
          data = "";
          socket.write("250 OK queued\r\n");
          continue;
        }
        const nl = buffer.indexOf("\r\n");
        if (nl < 0) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) socket.write("250-sink\r\n250 8BITMIME\r\n");
        else if (cmd.startsWith("MAIL FROM")) socket.write("250 OK\r\n");
        else if (cmd.startsWith("RCPT TO")) socket.write(`${rcptReply(/<([^>]+)>/.exec(line)?.[1] ?? "")}\r\n`);
        else if (cmd === "DATA") {
          inData = true;
          socket.write("354 go ahead\r\n");
        } else if (cmd === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    server,
    port,
    messages,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

const env = (port: number): Record<string, string> => ({ SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), MAIL_FROM: "Test <no-reply@test.local>" });
const message = { to: "person@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" };

describe("SMTP provider", () => {
  it("is null until host and sender are configured", () => {
    assert.equal(createSmtpProvider({}), null);
    assert.equal(createSmtpProvider({ SMTP_HOST: "x" }), null);
  });

  it("delivers a multipart message to a real SMTP server and reports the accepted send", async () => {
    const sink = await smtpSink();
    try {
      const outcome = await createSmtpProvider(env(sink.port))!.send(message);
      assert.equal(outcome.ok, true);
      assert.equal(sink.messages.length, 1);
      assert.match(sink.messages[0], /Subject: Hello/);
      assert.match(sink.messages[0], /multipart\/alternative/);
      assert.match(sink.messages[0], /To: person@example.com/);
    } finally {
      await sink.close();
    }
  });

  it("does not report success when the server rejects the recipient (permanent)", async () => {
    const sink = await smtpSink(() => "550 5.1.1 No such mailbox");
    try {
      const outcome = await createSmtpProvider(env(sink.port))!.send(message);
      assert.equal(outcome.ok, false);
      if (!outcome.ok) assert.equal(outcome.retryable, false);
      assert.equal(sink.messages.length, 0);
    } finally {
      await sink.close();
    }
  });

  it("treats a temporary server refusal and an unreachable server as retryable", async () => {
    const busy = await smtpSink(() => "451 4.3.0 Try again later");
    try {
      const outcome = await createSmtpProvider(env(busy.port))!.send(message);
      assert.equal(outcome.ok, false);
      if (!outcome.ok) assert.equal(outcome.retryable, true);
    } finally {
      await busy.close();
    }
    const closed = await smtpSink();
    const port = closed.port;
    await closed.close();
    const outcome = await createSmtpProvider(env(port))!.send(message);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.retryable, true);
      assert.equal(outcome.error.includes("127.0.0.1"), false); // no connection details in user-facing errors
    }
  });

  it("classifies errors without leaking credentials", () => {
    assert.equal(classifyMailError({ code: "EAUTH", message: "Invalid login: pass=secret" }).retryable, false);
    assert.equal(classifyMailError({ code: "EAUTH", message: "pass=secret" }).error.includes("secret"), false);
    assert.equal(classifyMailError({ responseCode: 550 }).retryable, false);
    assert.equal(classifyMailError({ responseCode: 421 }).retryable, true);
    assert.equal(classifyMailError({ code: "ETIMEDOUT" }).retryable, true);
  });
});

// ------------------------------------------------------------ rate limit, file store

describe("rate limiting", () => {
  it("allows up to the limit within the window, then blocks with a retry hint", () => {
    const limit = { name: "t", max: 3, windowMs: 1000 };
    const key = `k${Math.random()}`;
    const t = 1_000_000;
    assert.equal(checkRateLimit(key, limit, t).allowed, true);
    assert.equal(checkRateLimit(key, limit, t + 10).allowed, true);
    assert.equal(checkRateLimit(key, limit, t + 20).allowed, true);
    const blocked = checkRateLimit(key, limit, t + 30);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter >= 1);
    assert.equal(checkRateLimit(key, limit, t + 1500).allowed, true);
  });
});

describe("file store (development fallback)", () => {
  it("persists documents across instances and supports create/query/transact", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assess-"));
    const file = path.join(dir, "db.json");
    try {
      const a = new FileStore(file);
      assert.equal(await a.create("things", "1", { id: "1", status: "x", nested: { token: "t" } }), true);
      assert.equal(await a.create("things", "1", { id: "1" }), false);
      await a.transact<{ id: string; n?: number }>("things", "2", () => ({ id: "2", n: 1 }));
      const b = new FileStore(file);
      assert.equal((await b.get<{ status: string }>("things", "1"))?.status, "x");
      assert.equal((await b.query("things", { where: [["nested.token", "t"]] })).length, 1);
      assert.equal(await b.count("things"), 2);
      await b.delete("things", "1");
      assert.equal(await new FileStore(file).count("things"), 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
