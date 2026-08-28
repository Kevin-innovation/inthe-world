import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { loadComingStormPack } from "@simul/content/load";
import {
  createAssignment,
  ensureGuest,
  findActiveSave,
  findOpenAssignment,
  getDefaultDb,
  withGuestLock,
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
  const pack = loadComingStormPack();
  const payload = await withGuestLock(guestId, () => {
    const lockedActive = findActiveSave(handle.db, guestId);
    if (lockedActive) {
      return {
        conflict: true as const,
        saveId: lockedActive.id,
        countryId: lockedActive.countryId,
      };
    }
    const existing = findOpenAssignment(guestId, pack.id);
    if (existing) {
      return assignmentPayload({
        assignmentId: existing.id,
        countryId: existing.countryId,
        seed: existing.seed,
      });
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
    return assignmentPayload({ assignmentId, countryId, seed });
  });

  if ("conflict" in payload && payload.conflict) {
    const res = NextResponse.json(
      { error: "active_run", saveId: payload.saveId, countryId: payload.countryId },
      { status: 409 },
    );
    setGuestCookie(res, guestId);
    return res;
  }

  const res = NextResponse.json(payload);
  setGuestCookie(res, guestId);
  return res;
}
