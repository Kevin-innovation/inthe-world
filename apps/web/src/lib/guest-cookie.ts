import { cookies } from "next/headers";
import { GUEST_COOKIE } from "@simul/db";
import type { NextResponse } from "next/server";

export { GUEST_COOKIE };

export const DRAFT_COOKIE = "inthe_world_draft";
export const RUN_COOKIE = "inthe_world_run";

const GUEST_COOKIE_ATTRS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 180,
};

export type LocalDraft = {
  assignmentId: string;
  countryId: string;
  seed: number;
};

export type LocalRun = {
  saveId: string;
  countryId: string;
  seed: number;
  civDelta: number;
  milDelta: number;
  spiritId?: string;
};

export async function readGuestCookie(): Promise<string | undefined> {
  return (await cookies()).get(GUEST_COOKIE)?.value;
}

export function setGuestCookie(res: NextResponse, guestId: string): void {
  res.cookies.set(GUEST_COOKIE, guestId, GUEST_COOKIE_ATTRS);
}

export async function readDraftCookie(): Promise<LocalDraft | null> {
  return parseDraft((await cookies()).get(DRAFT_COOKIE)?.value);
}

export function setDraftCookie(res: NextResponse, draft: LocalDraft): void {
  res.cookies.set(DRAFT_COOKIE, JSON.stringify(draft), {
    ...GUEST_COOKIE_ATTRS,
    maxAge: 60 * 60 * 24,
  });
}

export function clearDraftCookie(res: NextResponse): void {
  res.cookies.set(DRAFT_COOKIE, "", { ...GUEST_COOKIE_ATTRS, maxAge: 0 });
}

export async function readRunCookie(): Promise<LocalRun | null> {
  return parseRun((await cookies()).get(RUN_COOKIE)?.value);
}

export function setRunCookie(res: NextResponse, run: LocalRun): void {
  res.cookies.set(RUN_COOKIE, JSON.stringify(run), {
    ...GUEST_COOKIE_ATTRS,
  });
}

function parseDraft(raw: string | undefined): LocalDraft | null {
  const value = parseJsonCookie(raw);
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.assignmentId !== "string" ||
    typeof row.countryId !== "string" ||
    typeof row.seed !== "number" ||
    !Number.isFinite(row.seed)
  ) {
    return null;
  }
  return {
    assignmentId: row.assignmentId,
    countryId: row.countryId,
    seed: row.seed,
  };
}

function parseRun(raw: string | undefined): LocalRun | null {
  const value = parseJsonCookie(raw);
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.saveId !== "string" ||
    typeof row.countryId !== "string" ||
    typeof row.seed !== "number" ||
    !Number.isFinite(row.seed)
  ) {
    return null;
  }
  return {
    saveId: row.saveId,
    countryId: row.countryId,
    seed: row.seed,
    civDelta: typeof row.civDelta === "number" ? row.civDelta : 0,
    milDelta: typeof row.milDelta === "number" ? row.milDelta : 0,
    spiritId: typeof row.spiritId === "string" ? row.spiritId : undefined,
  };
}

function parseJsonCookie(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(raw)) as unknown;
    } catch {
      return null;
    }
  }
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const text = await request.text();
  if (!text.trim()) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}
