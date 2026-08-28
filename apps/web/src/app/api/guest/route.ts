import { NextResponse } from "next/server";
import { ensureGuest, getDefaultDb } from "@simul/db";
import { readGuestCookie, setGuestCookie } from "@/lib/guest-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const handle = getDefaultDb();
  const nowMs = Date.now();
  const { guestId } = ensureGuest(handle.db, await readGuestCookie(), nowMs);
  const res = NextResponse.json({ guestId });
  setGuestCookie(res, guestId);
  return res;
}
