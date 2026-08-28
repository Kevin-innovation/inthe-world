import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { loadComingStormPack } from "@simul/content/load";
import {
  createAssignment,
  ensureGuest,
  findActiveSave,
  findOpenAssignment,
  getDefaultDb,
} from "@simul/db";
import {
  FATE_BUDGET,
  assignCountry,
  countryWeights,
  createRng,
  seedFrom,
  weightTier,
} from "@simul/sim";
import { readGuestCookie, setGuestCookie } from "@/lib/guest-cookie";
import { t } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loreFor(countryId: string): string {
  return t(`country.${countryId.toLowerCase()}.lore`);
}

function assignmentPayload(input: {
  assignmentId: string;
  countryId: string;
  seed: number;
}) {
  const pack = loadComingStormPack();
  const country = pack.countries.find((row) => row.id === input.countryId);
  return {
    assignmentId: input.assignmentId,
    countryId: input.countryId,
    lore: loreFor(input.countryId),
    fateRemaining: FATE_BUDGET,
    seed: input.seed,
    tier: country ? weightTier(country.weight) : "minor",
    stats: country
      ? {
          civFactories: country.stocks.civFactories,
          milFactories: country.stocks.milFactories,
          gdp: country.stocks.gdp,
          stability: country.stocks.stability,
        }
      : undefined,
    reel: pack.countries.map((row) => ({
      id: row.id,
      titleKey: row.titleKey,
      weight: row.weight,
    })),
  };
}

export async function POST() {
  const handle = getDefaultDb();
  const nowMs = Date.now();
  const { guestId } = ensureGuest(handle.db, await readGuestCookie(), nowMs);

  const active = findActiveSave(handle.db, guestId);
  if (active) {
    const res = NextResponse.json(
      { error: "active_run", saveId: active.id, countryId: active.countryId },
      { status: 409 },
    );
    setGuestCookie(res, guestId);
    return res;
  }

  const pack = loadComingStormPack();
  const existing = findOpenAssignment(guestId, pack.id);
  if (existing) {
    const res = NextResponse.json(
      assignmentPayload({
        assignmentId: existing.id,
        countryId: existing.countryId,
        seed: existing.seed,
      }),
    );
    setGuestCookie(res, guestId);
    return res;
  }

  const assignmentId = randomUUID();
  const seed = seedFrom(assignmentId, pack.id);
  const countryId = assignCountry(
    countryWeights(pack.countries),
    createRng(seed, 0),
  );
  createAssignment({
    id: assignmentId,
    guestId,
    seasonId: pack.id,
    countryId,
    seed,
    createdAt: nowMs,
  });
  const res = NextResponse.json(
    assignmentPayload({ assignmentId, countryId, seed }),
  );
  setGuestCookie(res, guestId);
  return res;
}
