"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FATE_BUDGET,
  FATE_FACTORY_COST,
  FATE_SPIRIT_COST,
} from "@simul/sim";
import { t } from "@/lib/i18n";

const REVEAL_MS = 1600;
const FATE_CAP = 2;

type ReelCountry = { id: string; titleKey: string; weight: number };

type AssignPayload = {
  assignmentId: string;
  countryId: string;
  lore: string;
  fateRemaining: number;
  tier: "great" | "regional" | "minor";
  stats?: {
    civFactories: number;
    milFactories: number;
    gdp: number;
    stability: number;
  };
  reel: ReelCountry[];
};

type AssignError = {
  error?: string;
  saveId?: string;
};

function countryTitle(id: string, titleKey?: string): string {
  if (titleKey) {
    const named = t(titleKey);
    if (named !== titleKey) return named;
  }
  return t(`country.${id.toLowerCase()}.title`);
}

export function AssignCinematic() {
  const router = useRouter();
  const [payload, setPayload] = useState<AssignPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [civDelta, setCivDelta] = useState(0);
  const [milDelta, setMilDelta] = useState(0);
  const [spiritId, setSpiritId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/saves/assign", {
          method: "POST",
          credentials: "include",
        });
        const body = (await res.json()) as AssignPayload & AssignError;
        if (cancelled) return;
        if (res.status === 409) {
          setError(t("assign.activeRun"));
          return;
        }
        if (!res.ok || !body.countryId || !body.assignmentId) {
          setError(
            body.error === "missing_convex"
              ? t("assign.missingConvex")
              : t("assign.failed"),
          );
          return;
        }
        setPayload(body);
      } catch {
        if (!cancelled) setError(t("assign.failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!payload || revealed) return;
    if (payload.reel.length === 0) {
      setRevealed(true);
      return;
    }
    const last = payload.reel.length - 1;
    if (cursor >= last) {
      const done = window.setTimeout(() => setRevealed(true), REVEAL_MS);
      return () => window.clearTimeout(done);
    }
    const timer = window.setTimeout(() => setCursor(cursor + 1), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [payload, revealed, cursor]);

  const fateCost =
    (civDelta + milDelta) * FATE_FACTORY_COST +
    (spiritId ? FATE_SPIRIT_COST : 0);
  const fateRemaining = FATE_BUDGET - fateCost;
  const shown = revealed
    ? payload?.countryId
    : payload?.reel[cursor]?.id ?? payload?.countryId;

  async function onConfirm() {
    if (!payload || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId: payload.assignmentId,
          fate: {
            civDelta,
            milDelta,
            spiritId: spiritId || undefined,
          },
        }),
      });
      const body = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setError(
          body.error === "great_power_spirit"
            ? t("assign.greatPowerSpirit")
            : t("assign.confirmFailed"),
        );
        setBusy(false);
        return;
      }
      router.push("/dev/harness");
    } catch {
      setError(t("assign.confirmFailed"));
      setBusy(false);
    }
  }

  if (error && !payload) {
    return (
      <main className="landing">
        <div className="landing-card assign-card">
          <p className="hq-error">{error}</p>
          <a className="landing-play" href="/dev/harness">
            {t("assign.toHarness")}
          </a>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="landing">
        <div className="landing-card assign-card">
          <p className="landing-kicker">{t("assign.kicker")}</p>
          <p>{t("assign.loading")}</p>
        </div>
      </main>
    );
  }

  const title = countryTitle(
    shown ?? payload.countryId,
    payload.reel.find((row) => row.id === shown)?.titleKey,
  );

  return (
    <main className="landing">
      <div className="landing-card assign-card">
        <p className="landing-kicker">{t("assign.kicker")}</p>
        <h1>{t("season.comingStorm.title")}</h1>
        <p className="landing-ethics">{t("season.comingStorm.blurb")}</p>
        <p className="assign-country" aria-live="polite">
          {title}
        </p>
        {!revealed ? (
          <button
            className="hq-btn"
            type="button"
            onClick={() => setRevealed(true)}
          >
            {t("assign.skip")}
          </button>
        ) : (
          <>
            <p className="assign-lore">{payload.lore}</p>
            {payload.stats ? (
              <ul className="assign-stats">
                <li>
                  {t("hq.civFactories")} {payload.stats.civFactories + civDelta}
                </li>
                <li>
                  {t("hq.milFactories")} {payload.stats.milFactories + milDelta}
                </li>
                <li>
                  {t("hq.gdp")} {payload.stats.gdp}
                </li>
                <li>
                  {t("hq.stability")} {payload.stats.stability}
                </li>
              </ul>
            ) : null}
            <p className="assign-fate">
              {t("assign.fateRemaining")} {fateRemaining}
            </p>
            <div className="assign-spends">
              <button
                className="hq-btn"
                type="button"
                disabled={civDelta >= FATE_CAP || fateRemaining < FATE_FACTORY_COST}
                onClick={() => setCivDelta((n) => n + 1)}
              >
                {t("assign.civPlus")}
              </button>
              <button
                className="hq-btn"
                type="button"
                disabled={milDelta >= FATE_CAP || fateRemaining < FATE_FACTORY_COST}
                onClick={() => setMilDelta((n) => n + 1)}
              >
                {t("assign.milPlus")}
              </button>
            </div>
            <p className="assign-hint">{t("assign.civCost")}</p>
            <label className="assign-spirit">
              {t("assign.spirit")}
              <select
                value={spiritId}
                onChange={(event) => setSpiritId(event.target.value)}
              >
                <option value="">{t("assign.spiritNone")}</option>
                <option
                  value="industrial_planning"
                  disabled={
                    spiritId !== "industrial_planning" &&
                    fateRemaining < FATE_SPIRIT_COST
                  }
                >
                  {t("assign.spiritGeneric")}
                </option>
                <option
                  value="defensive_ethos"
                  disabled={
                    spiritId !== "defensive_ethos" &&
                    fateRemaining < FATE_SPIRIT_COST
                  }
                >
                  {t("assign.spiritDefense")}
                </option>
                {payload.tier !== "minor" ? (
                  <option
                    value="USA"
                    disabled={
                      spiritId !== "USA" && fateRemaining < FATE_SPIRIT_COST
                    }
                  >
                    {t("assign.spiritUsa")}
                  </option>
                ) : null}
              </select>
            </label>
            <button
              className="landing-play assign-confirm"
              type="button"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {t("assign.confirm")}
            </button>
            {error ? <p className="hq-error">{error}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}
