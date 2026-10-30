// Runs work after the response has been sent, so the participant never waits for the mail server.
//
// On Vercel the platform keeps the function alive until the work finishes (it is handed the promise through the
// request context, the same hook `waitUntil` from @vercel/functions uses). Anywhere else the promise simply
// carries on in the background of the running server.

const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

type WaitUntil = (promise: Promise<unknown>) => void;

function platformWaitUntil(): WaitUntil | undefined {
  const holder = (globalThis as Record<symbol, { get?: () => { waitUntil?: WaitUntil } | undefined } | undefined>)[REQUEST_CONTEXT];
  return holder?.get?.()?.waitUntil;
}

let inline = false;

/** Test hook: wait for the work instead of leaving it in the background. */
export function setInlineBackgroundForTests(on: boolean): void {
  inline = on;
}

export function isInlineBackground(): boolean {
  return inline;
}

/**
 * Starts the task and returns straight away. Errors are logged, never thrown: whatever the task was doing
 * (sending an email) keeps its own record of success or failure.
 */
export function runInBackground(label: string, task: () => Promise<void>): Promise<void> {
  const running = task().catch((error: unknown) => {
    console.error(`[assessments] Background task "${label}" failed:`, error instanceof Error ? error.message : "unknown error");
  });
  platformWaitUntil()?.(running);
  return running;
}
