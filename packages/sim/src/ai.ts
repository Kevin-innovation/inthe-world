import type {
  CountryId,
  GameDate,
  GameState,
  NationState,
} from "./types";

const TENSION_STEP = 0.15;
const SLIDER_STEP = 3;
const GER_REARM_DATE = "1936-06-01";
const GER_FOCUS_FLOOR = 55;
const GER_CONSCRIPTION_FLOOR = 40;
const USA_ISOLATION_INTERVENTION = 15;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function flagOn(
  flags: Record<string, boolean | number>,
  key: string,
): boolean {
  const value = flags[key];
  return value === true || value === 1;
}

export function formatIsoDate(date: GameDate): string {
  const y = String(date.year).padStart(4, "0");
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function tensionTargetAt(
  schedule: readonly { at: string; value: number }[] | undefined,
  isoDate: string,
): number | undefined {
  if (!schedule || schedule.length === 0) return undefined;
  let at = "";
  let value: number | undefined;
  for (const point of schedule) {
    if (typeof point.at !== "string" || !Number.isFinite(point.value)) continue;
    if (point.at <= isoDate && point.at >= at) {
      at = point.at;
      value = point.value;
    }
  }
  return value;
}

export function stepWorldTension(
  current: number,
  date: GameDate,
  schedule: readonly { at: string; value: number }[] | undefined,
): number {
  const target = tensionTargetAt(schedule, formatIsoDate(date));
  if (target === undefined) return current;
  const next = current + clamp(target - current, -TENSION_STEP, TENSION_STEP);
  return clamp(next, 0, 100);
}

function paperOf(nation: NationState): number {
  const paper = nation.derived.paperStrength;
  if (paper > 0) return paper;
  return nation.stocks.milFactories + nation.stocks.armySize * 0.01;
}

function maxThreat(
  self: NationState,
  nations: Record<CountryId, NationState>,
): number {
  const selfPaper = Math.max(0, paperOf(self));
  let threat = 0;
  for (const id of Object.keys(nations).sort()) {
    const other = nations[id];
    if (!other || other.id === self.id || !other.alive) continue;
    if (!other.atWarWith.includes(self.id)) continue;
    threat = Math.max(threat, paperOf(other) / (selfPaper + 1));
  }
  for (const enemyId of self.atWarWith) {
    if (nations[enemyId] === undefined) {
      // Declared wars against ids not in the nation table still count as threat 1.
      threat = Math.max(threat, 1);
    }
  }
  return threat;
}

function stepToward(current: number, target: number, maxStep: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current;
  return current + clamp(target - current, -maxStep, maxStep);
}

export function stepAiPolicies(state: GameState): void {
  const iso = formatIsoDate(state.date);
  const tension = state.worldTension;
  const ids = Object.keys(state.nations).sort();

  for (const id of ids) {
    const nation = state.nations[id];
    if (!nation || !nation.alive) continue;
    if (nation.isPlayer || nation.id === state.playerCountryId) continue;

    const threat = maxThreat(nation, state.nations);
    const atWar = nation.atWarWith.length > 0;
    const s = nation.policies;

    let targetMilFocus = clamp(
      30 + 40 * threat + 20 * (tension / 100),
      10,
      90,
    );
    let targetConscription = clamp(
      15 + 50 * (atWar ? 1 : 0) + 20 * threat,
      0,
      90,
    );
    let targetIntervention: number | undefined;
    let targetTrade: number | undefined;

    const rearmist =
      nation.id === "GER" || nation.faction === "revisionist";
    if (rearmist) {
      // Floor is a target (55); +3/week inertia is the only ramp from 30.
      targetMilFocus = Math.max(targetMilFocus, GER_FOCUS_FLOOR);
      if (iso >= GER_REARM_DATE) {
        targetConscription = Math.max(
          targetConscription,
          GER_CONSCRIPTION_FLOOR,
        );
      }
    }

    if (
      nation.faction === "status_quo" ||
      nation.id === "ENG" ||
      nation.id === "FRA"
    ) {
      targetIntervention = tension > 40 ? 60 : 25;
    }

    if (nation.faction === "nonaligned") {
      targetIntervention = 10;
      targetTrade = 70;
    }

    const usaIsolated =
      nation.id === "USA" && !flagOn(nation.flags, "pearlHarbor");
    if (usaIsolated) {
      targetIntervention = Math.min(
        targetIntervention ?? s.intervention,
        USA_ISOLATION_INTERVENTION,
      );
    }

    s.industrialFocus = stepToward(s.industrialFocus, targetMilFocus, SLIDER_STEP);
    s.milSpending = stepToward(s.milSpending, targetMilFocus, SLIDER_STEP);
    s.conscription = stepToward(s.conscription, targetConscription, SLIDER_STEP);
    if (targetIntervention !== undefined) {
      s.intervention = stepToward(
        s.intervention,
        targetIntervention,
        SLIDER_STEP,
      );
    }
    if (targetTrade !== undefined) {
      s.tradeOpenness = stepToward(s.tradeOpenness, targetTrade, SLIDER_STEP);
    }
    if (usaIsolated) {
      // Isolation is a ceiling: intervention must not exceed 15 even for one week.
      s.intervention = Math.min(s.intervention, USA_ISOLATION_INTERVENTION);
    }
  }
}
