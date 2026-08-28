export const GUEST_COOKIE = "simul_guest";

export const WEEK_MS = 20 * 60 * 1000;
export const MAX_CATCHUP_REAL_HOURS = 72;
export const WEEKS_PER_REAL_HOUR = (60 * 60 * 1000) / WEEK_MS;
export const MAX_CATCHUP_WEEKS = MAX_CATCHUP_REAL_HOURS * WEEKS_PER_REAL_HOUR;

export function catchupWeeks(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(Math.floor(elapsedMs / WEEK_MS), MAX_CATCHUP_WEEKS);
}

export type CatchupPlan =
  | { ok: true; weeks: number }
  | { ok: false; status: 400; error: "client_clock" };

export function planCatchupWeeks(args: {
  elapsedMs: number;
  ranked: boolean;
  body: unknown;
}): CatchupPlan {
  if (hasClientNow(args.body)) {
    return { ok: false, status: 400, error: "client_clock" };
  }
  const harness = harnessWeeks(args.ranked, args.body);
  if (harness !== undefined) {
    return { ok: true, weeks: harness };
  }
  return { ok: true, weeks: catchupWeeks(args.elapsedMs) };
}

function hasClientNow(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    Object.prototype.hasOwnProperty.call(body, "clientNow")
  );
}

function harnessWeeks(ranked: boolean, body: unknown): number | undefined {
  if (ranked !== false) return undefined;
  if (typeof body !== "object" || body === null) return undefined;
  const rec = body as Record<string, unknown>;
  if (rec.ranked !== false) return undefined;
  if (typeof rec.weeks !== "number" || !Number.isFinite(rec.weeks)) {
    return undefined;
  }
  return Math.max(0, Math.floor(rec.weeks));
}
