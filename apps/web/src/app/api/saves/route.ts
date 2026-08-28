import { NextResponse } from "next/server";
import {
  createTwoNationSave,
  ensureGuest,
  getDefaultDb,
} from "@simul/db";
import { readGuestCookie, readJsonBody, setGuestCookie } from "@/lib/guest-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const body =
    typeof parsed.body === "object" && parsed.body !== null
      ? (parsed.body as Record<string, unknown>)
      : {};
  const seed =
    typeof body.seed === "number" && Number.isFinite(body.seed)
      ? body.seed
      : undefined;
  const ranked = body.ranked === false ? false : true;
  const handle = getDefaultDb();
  const nowMs = Date.now();
  const { guestId } = ensureGuest(handle.db, await readGuestCookie(), nowMs);
  const save = createTwoNationSave(handle.db, {
    guestId,
    seed,
    ranked,
    nowMs,
  });
  const res = NextResponse.json({
    id: save.id,
    guestId: save.guestId,
    seasonId: save.seasonId,
    countryId: save.countryId,
    seed: save.seed,
    tickIndex: save.tickIndex,
    lastTickAt: new Date(save.lastTickAt).toISOString(),
    status: save.status,
    ranked: save.ranked,
  });
  setGuestCookie(res, guestId);
  return res;
}
