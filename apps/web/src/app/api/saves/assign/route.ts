import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { loadComingStormPack } from "@simul/content/load";
import {
  FATE_BUDGET,
  assignCountry,
  countryWeights,
  createRng,
  seedFrom,
  weightTier,
} from "@simul/sim";
import { api, tryGetConvex } from "@/lib/convex-server";
import {
  readGuestCookie,
  setDraftCookie,
  setGuestCookie,
} from "@/lib/guest-cookie";
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

function convexErrorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "";
  if (
    message.includes("CONVEX_URL") ||
    message.includes("NEXT_PUBLIC_CONVEX") ||
    message.includes("Could not find public function") ||
    /convex/i.test(message)
  ) {
    return NextResponse.json({ error: "missing_convex" }, { status: 503 });
  }
  return NextResponse.json({ error: "assign_failed" }, { status: 502 });
}

export async function POST() {
  try {
    const pack = loadComingStormPack();
    const assignmentId = randomUUID();
    const seed = seedFrom(assignmentId, pack.id);
    const countryId = assignCountry(
      countryWeights(pack.countries),
      createRng(seed, 0),
    );

    const convex = tryGetConvex();
    if (convex) {
      try {
        const { guestId } = await convex.mutation(api.guests.ensure, {
          cookieId: await readGuestCookie(),
        });
        const started = await convex.mutation(api.assignments.start, {
          guestId,
          seasonId: pack.id,
          id: assignmentId,
          countryId,
          seed,
          lore: loreFor(countryId),
        });

        if (started.type === "active_run") {
          const res = NextResponse.json(
            {
              error: "active_run",
              saveId: started.saveId,
              countryId: started.countryId,
            },
            { status: 409 },
          );
          setGuestCookie(res, guestId);
          return res;
        }

        const res = NextResponse.json(
          assignmentPayload({
            assignmentId: started.assignment.id,
            countryId: started.assignment.countryId,
            seed: started.assignment.seed,
          }),
        );
        setGuestCookie(res, guestId);
        return res;
      } catch (err) {
        console.warn("convex assign unavailable, using guest draft", err);
      }
    }

    const guestId = (await readGuestCookie()) ?? randomUUID();
    const res = NextResponse.json(
      assignmentPayload({ assignmentId, countryId, seed }),
    );
    setGuestCookie(res, guestId);
    setDraftCookie(res, { assignmentId, countryId, seed });
    return res;
  } catch (err) {
    return convexErrorResponse(err);
  }
}
