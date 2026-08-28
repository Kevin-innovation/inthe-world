import { cookies } from "next/headers";
import { GUEST_COOKIE } from "@simul/db";
import type { NextResponse } from "next/server";

export { GUEST_COOKIE };

const GUEST_COOKIE_ATTRS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 180,
};

export async function readGuestCookie(): Promise<string | undefined> {
  return (await cookies()).get(GUEST_COOKIE)?.value;
}

export function setGuestCookie(res: NextResponse, guestId: string): void {
  res.cookies.set(GUEST_COOKIE, guestId, GUEST_COOKIE_ATTRS);
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
