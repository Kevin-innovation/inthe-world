import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { loadComingStormPack } from "@simul/content/load";
import { applyFateSpends, countryWeights, loadSeason } from "@simul/sim";
import { api, tryGetConvex } from "@/lib/convex-server";
import {
  clearDraftCookie,
  readDraftCookie,
  readGuestCookie,
  readJsonBody,
  setGuestCookie,
  setRunCookie,
} from "@/lib/guest-cookie";

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

  const convex = tryGetConvex();
  if (!convex) {
    const draft = await readDraftCookie();
    if (!draft || draft.assignmentId !== assignmentId) {
      return NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
    }
    const guestId = (await readGuestCookie()) ?? randomUUID();
    const pack = loadComingStormPack();
    const loaded = loadSeason(pack, {
      saveId: assignmentId,
      seed: draft.seed,
      playerCountryId: draft.countryId,
    });
    loaded.state.ranked = false;
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
    const res = NextResponse.json({
      id: assignmentId,
      guestId,
      seasonId: pack.id,
      countryId: draft.countryId,
      seed: draft.seed,
      tickIndex: fate.state.tickIndex,
      status: "active",
      ranked: false,
      fateRemaining: fate.fateRemaining,
      demo: true,
    });
    setGuestCookie(res, guestId);
    setRunCookie(res, {
      saveId: assignmentId,
      countryId: draft.countryId,
      seed: draft.seed,
      civDelta,
      milDelta,
      spiritId,
    });
    clearDraftCookie(res);
    return res;
  }

  const { guestId } = await convex.mutation(api.guests.ensure, {
    cookieId: await readGuestCookie(),
  });
  const pack = loadComingStormPack();
  const draft = await convex.query(api.assignments.get, {
    assignmentId,
    guestId,
  });
  if (!draft || draft.consumed) {
    const res = NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
    setGuestCookie(res, guestId);
    return res;
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
    const res = NextResponse.json({ error: fate.error }, { status: 400 });
    setGuestCookie(res, guestId);
    return res;
  }

  const confirmed = await convex.mutation(api.saves.confirm, {
    guestId,
    assignmentId,
    stateJson: JSON.stringify(fate.state),
  });
  if (!confirmed.ok) {
    const res = NextResponse.json(
      confirmed.error === "active_run"
        ? {
            error: "active_run",
            saveId: confirmed.saveId,
            countryId: confirmed.countryId,
          }
        : { error: confirmed.error },
      { status: confirmed.httpStatus },
    );
    setGuestCookie(res, guestId);
    return res;
  }

  const save = confirmed.save;
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
