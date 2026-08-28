import { NextResponse } from "next/server";
import { loadComingStormPack } from "@simul/content/load";
import {
  consumeAssignment,
  ensureGuest,
  getAssignment,
  getDefaultDb,
  insertGameSave,
} from "@simul/db";
import {
  applyFateSpends,
  countryWeights,
  loadSeason,
} from "@simul/sim";
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
  const assignmentId =
    typeof body.assignmentId === "string" ? body.assignmentId.trim() : "";
  if (!assignmentId) {
    return NextResponse.json({ error: "missing_assignment" }, { status: 400 });
  }

  const fateBody =
    typeof body.fate === "object" && body.fate !== null
      ? (body.fate as Record<string, unknown>)
      : {};
  const civDelta =
    typeof fateBody.civDelta === "number" ? fateBody.civDelta : 0;
  const milDelta =
    typeof fateBody.milDelta === "number" ? fateBody.milDelta : 0;
  const spiritId =
    typeof fateBody.spiritId === "string" ? fateBody.spiritId : undefined;
  const spiritTags = Array.isArray(fateBody.spiritTags)
    ? fateBody.spiritTags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
  const ranked = body.ranked === false ? false : true;

  const handle = getDefaultDb();
  const nowMs = Date.now();
  const { guestId } = ensureGuest(handle.db, await readGuestCookie(), nowMs);
  const draft = getAssignment(assignmentId);
  if (!draft || draft.guestId !== guestId || draft.consumed) {
    return NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
  }

  const pack = loadComingStormPack();
  const loaded = loadSeason(pack, {
    saveId: assignmentId,
    seed: draft.seed,
    playerCountryId: draft.countryId,
  });
  loaded.state.ranked = ranked;
  const fate = applyFateSpends(
    loaded.state,
    draft.countryId,
    countryWeights(pack.countries),
    { civDelta, milDelta, spiritId, spiritTags },
  );
  if (fate.error) {
    const res = NextResponse.json({ error: fate.error }, { status: 400 });
    setGuestCookie(res, guestId);
    return res;
  }

  const consumed = consumeAssignment(assignmentId, guestId);
  if (!consumed) {
    return NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
  }

  const save = insertGameSave(handle.db, {
    guestId,
    state: fate.state,
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
    fateRemaining: fate.fateRemaining,
  });
  setGuestCookie(res, guestId);
  return res;
}
