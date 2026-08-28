import { NextResponse } from "next/server";
import { loadComingStormPack } from "@simul/content/load";
import {
  confirmAssignment,
  ensureGuest,
  getAssignment,
  getDefaultDb,
  withGuestLock,
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
  const pack = loadComingStormPack();
  const outcome = await withGuestLock(guestId, () => {
    const draft = getAssignment(assignmentId);
    if (!draft || draft.guestId !== guestId || draft.consumed) {
      return { type: "missing" as const };
    }
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
      return { type: "fate" as const, error: fate.error };
    }
    const confirmed = confirmAssignment(handle.db, {
      guestId,
      assignmentId,
      state: fate.state,
      nowMs,
    });
    if (!confirmed.ok) {
      return { type: "denied" as const, confirmed };
    }
    return {
      type: "ok" as const,
      save: confirmed.save,
      fateRemaining: fate.fateRemaining,
    };
  });

  if (outcome.type === "missing") {
    const res = NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
    setGuestCookie(res, guestId);
    return res;
  }
  if (outcome.type === "fate") {
    const res = NextResponse.json({ error: outcome.error }, { status: 400 });
    setGuestCookie(res, guestId);
    return res;
  }
  if (outcome.type === "denied") {
    const res = NextResponse.json(
      outcome.confirmed.error === "active_run"
        ? {
            error: "active_run",
            saveId: outcome.confirmed.saveId,
            countryId: outcome.confirmed.countryId,
          }
        : { error: outcome.confirmed.error },
      { status: outcome.confirmed.httpStatus },
    );
    setGuestCookie(res, guestId);
    return res;
  }

  const save = outcome.save;
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
    fateRemaining: outcome.fateRemaining,
  });
  setGuestCookie(res, guestId);
  return res;
}
