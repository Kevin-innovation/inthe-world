import { NextResponse } from "next/server";
import { getDefaultDb, runCatchup } from "@simul/db";
import {
  readGuestCookie,
  readJsonBody,
  setGuestCookie,
} from "@/lib/guest-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { id } = await context.params;
  const guestId = await readGuestCookie();
  const result = runCatchup(getDefaultDb(), {
    saveId: id,
    guestId,
    body: parsed.body,
    nowMs: Date.now(),
  });
  const res = NextResponse.json(result.body, { status: result.httpStatus });
  if (result.httpStatus === 200 && guestId) {
    setGuestCookie(res, guestId);
  }
  return res;
}
