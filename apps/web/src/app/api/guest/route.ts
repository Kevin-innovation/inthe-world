import { NextResponse } from "next/server";
import { api, getConvex } from "@/lib/convex-server";
import { readGuestCookie, setGuestCookie } from "@/lib/guest-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const convex = getConvex();
  const { guestId } = await convex.mutation(api.guests.ensure, {
    cookieId: await readGuestCookie(),
  });
  const res = NextResponse.json({ guestId });
  setGuestCookie(res, guestId);
  return res;
}
