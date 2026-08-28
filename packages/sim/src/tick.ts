import { stepAiPolicies, stepWorldTension } from "./ai";
import { assertFiniteStocks, cloneGameState } from "./clone";
import { runCampaignPulses, writePaperStrength } from "./combat";
import { compositeOf, ownedRegionCount, resolveEnding } from "./endings";
import { runEventPhase } from "./events";
import { trackRng } from "./rng";
import type {
  CountryId,
  Doctrine,
  GameDate,
  GameState,
  NationState,
  NationStocks,
  PolicySliders,
  ResourceStocks,
  Rng,
  TickResult,
  WorldView,
} from "./types";

export { assertFiniteStocks, cloneGameState };

const COMING_STORM_END: GameDate = { year: 1948, month: 12, day: 31 };

const RESOURCE_KEYS = ["food", "steel", "oil", "rares"] as const;
const RESOURCE_PRICE: Record<(typeof RESOURCE_KEYS)[number], number> = {
  food: 0.8,
  steel: 1.2,
  oil: 1.6,
  rares: 2.0,
};

const CIV_FACTORY_PTS = 90;
const MIL_FACTORY_PTS = 110;
const INFRA_PTS = 70;
const CIV_INFRA_SHARE = 0.25;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function flagNumber(
  flags: Record<string, boolean | number>,
  key: string,
): number {
  const value = flags[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function flagOn(
  flags: Record<string, boolean | number>,
  key: string,
): boolean {
  const value = flags[key];
  return value === true || value === 1;
}

export function addDaysUtc(date: GameDate, days: number): GameDate {
  const utc = Date.UTC(date.year, date.month - 1, date.day + days);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function dateGte(a: GameDate, b: GameDate): boolean {
  if (a.year !== b.year) return a.year > b.year;
  if (a.month !== b.month) return a.month > b.month;
  return a.day >= b.day;
}

function oilDoctrineMul(doctrine: Doctrine): number {
  if (doctrine === "offense") return 1.25;
  if (doctrine === "deterrence") return 0.9;
  return 1.0;
}

function factoryDamageAvg(state: GameState, countryId: CountryId): number {
  let n = 0;
  let sum = 0;
  for (const region of Object.values(state.regions)) {
    if (region.owner !== countryId) continue;
    n += 1;
    sum += region.factoryDamage;
  }
  return n === 0 ? 0 : sum / n;
}

function resourceBaseFor(
  nation: NationState,
  world: WorldView,
): ResourceStocks {
  const base = world.resourceBase[nation.id];
  if (!base) {
    throw new Error(`error_tick_missing_base: ${nation.id}`);
  }
  return base;
}

function resourceNeed(stocks: NationStocks, s: PolicySliders): ResourceStocks {
  return {
    steel: stocks.civFactories * 0.45 + stocks.milFactories * 1.1,
    oil:
      stocks.milFactories * 0.35 +
      stocks.armySize * 0.003 * oilDoctrineMul(s.doctrine),
    food: stocks.population * 1.05 * (1 + 0.15 * (s.welfare / 100)),
    rares: stocks.milFactories * 0.18 + stocks.researchMil * 0.02,
  };
}

function sufficiency(stock: number, need: number): number {
  return clamp(stock / Math.max(need, 0.001), 0, 1.6);
}

function stepLabor(stocks: NationStocks, s: PolicySliders): number {
  const workAge = stocks.population * 0.38 * 1000;
  const targetArmy = workAge * (0.015 + 0.42 * (s.conscription / 100));
  stocks.armySize += 0.1 * (targetArmy - stocks.armySize);
  stocks.armySize = clamp(stocks.armySize, 0, workAge * 0.55);
  const civilianLabor = Math.max(0, workAge - stocks.armySize);
  const laborFactor = clamp(
    civilianLabor / Math.max(workAge * 0.82, 1),
    0.2,
    1.05,
  );
  stocks.manpowerPool = Math.max(0, workAge * 0.55 - stocks.armySize);
  return laborFactor;
}

function spendBuildPts(nation: NationState): void {
  const stocks = nation.stocks;
  while (nation.milBuildPts >= MIL_FACTORY_PTS) {
    nation.milBuildPts -= MIL_FACTORY_PTS;
    stocks.milFactories += 1;
  }
  while (nation.civBuildPts >= CIV_FACTORY_PTS) {
    nation.civBuildPts -= CIV_FACTORY_PTS;
    stocks.civFactories += 1;
  }
  while (stocks.infra < 100 && nation.infraBuildPts >= INFRA_PTS) {
    nation.infraBuildPts -= INFRA_PTS;
    stocks.infra += 1;
  }
}

function stepTrade(
  stocks: NationStocks,
  need: ResourceStocks,
  suff: ResourceStocks,
  s: PolicySliders,
  worldTension: number,
  atWar: boolean,
): number {
  const open = Math.max(
    0,
    (s.tradeOpenness / 100) *
      (1 - 0.5 * (worldTension / 100)) *
      (atWar ? 0.6 : 1),
  );
  let exportValue = 0;
  let importCost = 0;
  for (const r of RESOURCE_KEYS) {
    const sf = suff[r];
    if (sf > 1.15) {
      const qty = Math.max(0, stocks[r]) * 0.25 * open;
      exportValue += qty * RESOURCE_PRICE[r];
      stocks[r] = Math.max(0, stocks[r] - qty);
    } else if (sf < 0.85) {
      const qty =
        Math.min(need[r] * (0.85 - sf), stocks.treasury * 0.1) * open;
      if (qty > 0) {
        importCost += qty * RESOURCE_PRICE[r];
        stocks[r] += qty;
      }
    }
  }
  return exportValue - importCost;
}

function collapseNation(
  state: GameState,
  nation: NationState,
  reason: "h1" | "h3" | "h4",
): void {
  nation.alive = false;
  nation.runStats.collapseWeek = state.tickIndex;
  nation.flags.failedState = 1;
  if (reason === "h1") nation.flags.h1Fired = 1;
  if (reason === "h3") nation.flags.h3Fired = 1;
  if (reason === "h4") nation.flags.h4Fired = 1;
  if (nation.isPlayer) {
    state.status = "ended";
  }
}

function addSpirit(nation: NationState, id: string): void {
  if (!nation.spirits.includes(id)) {
    nation.spirits.push(id);
  }
}

function updateRegionExtrema(nation: NationState, state: GameState): void {
  const rs = nation.runStats;
  const owned = ownedRegionCount(state, nation.id);
  const start = rs.startRegions;
  // Empty two-nation maps have no territory; 0/0 is not a phoenix trough.
  if (start <= 0 && owned <= 0) return;
  rs.peakRegions = Math.max(rs.peakRegions ?? owned, owned);
  if (start > 0) {
    // 0 is a real wipe trough; only undefined means "not yet seen".
    rs.troughRegions =
      rs.troughRegions === undefined
        ? Math.min(start, owned)
        : Math.min(rs.troughRegions, owned);
  }
}

function updateCompositeExtrema(nation: NationState, state: GameState): void {
  // Dead composite is 0 via independenceFactor; do not clobber the living trough.
  if (!nation.alive) return;
  const c = compositeOf(nation, state);
  const rs = nation.runStats;
  if (rs.peakComposite === undefined) {
    rs.peakComposite = c;
    rs.troughComposite = c;
    return;
  }
  rs.peakComposite = Math.max(rs.peakComposite, c);
  rs.troughComposite = Math.min(rs.troughComposite ?? c, c);
}

function updateRunStats(nation: NationState, state: GameState): void {
  const rs = nation.runStats;
  const st = nation.stocks;
  rs.peakStability = Math.max(rs.peakStability, st.stability);
  rs.troughStability = Math.min(rs.troughStability, st.stability);
  rs.peakGdp = Math.max(rs.peakGdp, st.gdp);
  rs.troughGdp = Math.min(rs.troughGdp, st.gdp);
  rs.peakArmy = Math.max(rs.peakArmy, st.armySize);
  rs.weeksAlive += 1;
  if (nation.independent) rs.weeksIndependent += 1;
  if (nation.atWarWith.length > 0) rs.weeksAtWar += 1;
  updateRegionExtrema(nation, state);
  updateCompositeExtrema(nation, state);
}

function stepHardFails(
  nation: NationState,
  state: GameState,
  foodHarvest: number,
): void {
  const stocks = nation.stocks;
  const flags = nation.flags;

  if (stocks.stability <= 0) {
    flags.h1Weeks = flagNumber(flags, "h1Weeks") + 1;
  } else {
    flags.h1Weeks = 0;
  }

  const gdp = stocks.gdp;
  const debtRatio = gdp <= 0 ? Infinity : stocks.debt / gdp;
  if (stocks.treasury <= 0 && debtRatio > 2.5 && stocks.inflation > 50) {
    flags.h3Weeks = flagNumber(flags, "h3Weeks") + 1;
  } else if (!flagOn(flags, "default") && !nation.spirits.includes("default")) {
    flags.h3Weeks = 0;
  }

  // Empty post-consume granary is famine only when this week's harvest was also 0.
  if (stocks.food <= 0 && foodHarvest <= 0) {
    flags.h4Weeks = flagNumber(flags, "h4Weeks") + 1;
  } else {
    flags.h4Weeks = 0;
  }

  if (flagNumber(flags, "h4Weeks") >= 8) {
    collapseNation(state, nation, "h4");
    return;
  }

  if (
    flagNumber(flags, "h3Weeks") >= 12 &&
    !flagOn(flags, "default") &&
    !nation.spirits.includes("default")
  ) {
    flags.default = 1;
    stocks.stability = clamp(stocks.stability - 20, 0, 100);
    addSpirit(nation, "default");
  }

  if (flagOn(flags, "default") || nation.spirits.includes("default")) {
    if (stocks.stability <= 10) {
      flags.h3CollapseWeeks = flagNumber(flags, "h3CollapseWeeks") + 1;
    } else {
      flags.h3CollapseWeeks = 0;
    }
    if (flagNumber(flags, "h3CollapseWeeks") >= 4) {
      collapseNation(state, nation, "h3");
      return;
    }
  }

  if (flagNumber(flags, "h1Weeks") >= 4) {
    const startArmy =
      nation.runStats.startArmy > 0
        ? nation.runStats.startArmy
        : stocks.armySize;
    if (stocks.warSupport < 30 && stocks.armySize < 0.4 * startArmy) {
      collapseNation(state, nation, "h1");
      return;
    }
    nation.runStats.hadRevolution = true;
    flags.hadRevolution = 1;
    stocks.stability = 25;
    stocks.civFactories *= 0.85;
    stocks.milFactories *= 0.85;
    addSpirit(nation, "new_regime");
    flags.h1Weeks = 0;
  }
}

function stepNation(
  nation: NationState,
  state: GameState,
  world: WorldView,
  rng: Rng,
): void {
  void rng;
  const s = nation.policies;
  const stocks = nation.stocks;
  const atWar = nation.atWarWith.length > 0;
  const losing = flagOn(nation.flags, "losing");
  const winning = flagOn(nation.flags, "winning");

  // 2. Resource extraction → stock inflow (uses prior-week laborFactor)
  const base = resourceBaseFor(nation, world);
  const extractMul =
    (0.45 + 0.55 * (stocks.infra / 100)) *
    nation.derived.laborFactor *
    (0.85 + 0.35 * (stocks.researchInd / 100)) *
    (1 - 0.35 * factoryDamageAvg(state, nation.id));
  const extract: ResourceStocks = {
    food: base.food * extractMul,
    steel: base.steel * extractMul,
    oil: base.oil * extractMul,
    rares: base.rares * extractMul,
  };
  stocks.food += extract.food;
  stocks.steel += extract.steel;
  stocks.oil += extract.oil;
  stocks.rares += extract.rares;

  // 3. Labor / conscription (armySize inertia)
  const laborFactor = stepLabor(stocks, s);
  nation.derived.laborFactor = laborFactor;

  // 4. Demand (civilian / munitions)
  const consumerDemand =
    stocks.population *
    (2.2 + 2.0 * (s.welfare / 100)) *
    (1 - 0.28 * (s.conscription / 100)) *
    (0.85 + 0.15 * (stocks.stability / 100));
  const munitionsDemand =
    stocks.armySize *
    (0.06 + 0.16 * (atWar ? 1 : 0) + 0.1 * (s.milSpending / 100)) *
    (s.doctrine === "offense" ? 1.2 : 1.0);

  // 5. Three feedbacks + utilization + production inflow
  const need = resourceNeed(stocks, s);
  const suff: ResourceStocks = {
    food: sufficiency(stocks.food, need.food),
    steel: sufficiency(stocks.steel, need.steel),
    oil: sufficiency(stocks.oil, need.oil),
    rares: sufficiency(stocks.rares, need.rares),
  };
  const resSuff = Math.pow(
    Math.min(1, suff.food) *
      Math.min(1, suff.steel) *
      Math.min(1, suff.oil) *
      Math.min(1, suff.rares),
    0.25,
  );
  nation.derived.resSuff = {
    food: suff.food,
    steel: suff.steel,
    oil: suff.oil,
    rares: suff.rares,
  };

  const civInvRatio = stocks.consumerGoods / Math.max(consumerDemand, 1);
  const milInvRatio = stocks.munitions / Math.max(munitionsDemand, 1);
  const invFCiv = clamp(1.2 - 0.55 * civInvRatio, 0.4, 1.2);
  const invFMil = clamp(1.2 - 0.55 * milInvRatio, 0.4, 1.3);

  const payroll =
    (stocks.civFactories + stocks.milFactories) * 2.4 + stocks.armySize * 0.05;
  const cashRatio = stocks.treasury / Math.max(payroll * 4, 1);
  const cashF =
    stocks.treasury <= 0
      ? 0.25
      : clamp(0.3 + 0.7 * Math.tanh(cashRatio), 0.25, 1.15);

  const demFCiv = clamp(
    0.7 + 0.5 * (consumerDemand / Math.max(stocks.consumerGoods, 1) - 1),
    0.5,
    1.25,
  );
  const demFMil = clamp(
    0.7 + 0.5 * (munitionsDemand / Math.max(stocks.munitions, 1) - 1),
    0.5,
    1.35,
  );

  const stabF = 0.85 + 0.15 * (stocks.stability / 100);
  const wsF = 0.8 + 0.2 * (stocks.warSupport / 100);
  const bankruptF =
    flagOn(nation.flags, "default") || nation.spirits.includes("default")
      ? 0.5
      : 1;
  const utilCiv = clamp(
    laborFactor * resSuff * cashF * invFCiv * demFCiv * stabF * bankruptF,
    0.05,
    1.25,
  );
  const utilMil = clamp(
    laborFactor * resSuff * cashF * invFMil * demFMil * wsF * bankruptF,
    0.05,
    1.3,
  );
  nation.derived.utilCiv = utilCiv;
  nation.derived.utilMil = utilMil;

  const civEff = 1.0 + 0.55 * (stocks.researchInd / 100);
  const milEff = 1.0 + 0.5 * (stocks.researchMil / 100);
  const regionDamage = clamp(factoryDamageAvg(state, nation.id), 0, 1);
  const civOut = stocks.civFactories * (1 - regionDamage) * utilCiv * civEff;
  const milOut = stocks.milFactories * (1 - regionDamage) * utilMil * milEff;

  stocks.consumerGoods += civOut * 0.62;
  stocks.munitions += milOut;
  stocks.consumerGoods = Math.max(0, stocks.consumerGoods - consumerDemand);
  stocks.munitions = Math.max(
    0,
    stocks.munitions - munitionsDemand * (atWar ? 1 : 0.35),
  );

  stocks.food = Math.max(0, stocks.food - need.food * Math.min(1, suff.food));
  stocks.steel = Math.max(
    0,
    stocks.steel - need.steel * Math.min(1, suff.steel),
  );
  stocks.oil = Math.max(0, stocks.oil - need.oil * Math.min(1, suff.oil));
  stocks.rares = Math.max(
    0,
    stocks.rares - need.rares * Math.min(1, suff.rares),
  );

  const extractValue =
    RESOURCE_PRICE.food * extract.food +
    RESOURCE_PRICE.steel * extract.steel +
    RESOURCE_PRICE.oil * extract.oil +
    RESOURCE_PRICE.rares * extract.rares;
  const gdpWeekly = civOut * 4.0 + milOut * 3.2 + extractValue;
  stocks.gdp += 0.12 * (gdpWeekly * 52 - stocks.gdp);

  // 6. Trade (surplus export / deficit import)
  const tradeBalance = stepTrade(
    stocks,
    need,
    suff,
    s,
    state.worldTension,
    atWar,
  );

  // 7. Fiscal: tax, spend, invest, debt, inflation
  const collect =
    0.5 + 0.3 * (stocks.stability / 100) + 0.15 * (1 - s.liberty / 100);
  const tax = gdpWeekly * (s.taxRate / 100) * collect;
  const welfareSpend = gdpWeekly * (s.welfare / 100) * 0.16;
  const milSpend =
    gdpWeekly * (s.milSpending / 100) * 0.2 + stocks.armySize * 0.09;
  const weeklyInterestRate =
    0.0006 +
    0.0004 * (stocks.inflation / 10) +
    0.0008 * clamp(stocks.debt / Math.max(stocks.gdp, 1), 0, 4);
  const interest = stocks.debt * weeklyInterestRate;

  const investPool = Math.max(0, tax * 0.18 * cashF);
  const civShare = 1 - s.industrialFocus / 100;
  nation.civBuildPts += investPool * civShare * (1 - CIV_INFRA_SHARE);
  nation.infraBuildPts += investPool * civShare * CIV_INFRA_SHARE;
  nation.milBuildPts += investPool * (s.industrialFocus / 100);
  spendBuildPts(nation);

  stocks.treasury += tax + tradeBalance - welfareSpend - milSpend - interest;
  if (stocks.treasury < 0) {
    const deficit = -stocks.treasury;
    stocks.debt += deficit;
    stocks.treasury = 0;
    stocks.inflation += (deficit / Math.max(gdpWeekly, 1)) * 0.9;
  } else {
    const repay = Math.min(stocks.debt, stocks.treasury * 0.08);
    stocks.debt -= repay;
    stocks.treasury -= repay;
    stocks.inflation += -0.08 * (stocks.inflation > 2 ? 1 : 0.3);
  }
  stocks.inflation += Math.max(0, 0.15 - suff.food) * 1.4;
  stocks.inflation = clamp(stocks.inflation, -2, 120);
  stocks.gdp *= 1 - (0.003 * Math.max(0, stocks.inflation - 8)) / 10;

  nation.derived.gdpWeekly = gdpWeekly;
  nation.derived.taxFlow = tax;
  nation.derived.logistics =
    clamp(stocks.infra / 100, 0.3, 1.2) *
    (0.55 + 0.45 * resSuff) *
    (atWar ? 0.92 : 1.0) *
    (0.85 + 0.15 * (stocks.researchInd / 100));

  // 8. Research tracks
  const spareCiv = Math.max(
    0.15,
    0.4 * (s.welfare / 100) + 0.2 * (stocks.researchSoc / 100),
  );
  const trackScale = (0.35 + 0.65 * spareCiv) * (0.7 + 0.3 * laborFactor);
  stocks.researchMil = clamp(
    stocks.researchMil + (s.researchMil / 100) * trackScale * 0.07,
    0,
    100,
  );
  stocks.researchInd = clamp(
    stocks.researchInd + (s.researchInd / 100) * trackScale * 0.07,
    0,
    100,
  );
  stocks.researchSoc = clamp(
    stocks.researchSoc + (s.researchSoc / 100) * trackScale * 0.07,
    0,
    100,
  );

  // 9. PP, stability, war support
  stocks.politicalPower +=
    1.45 *
    (0.4 + 0.6 * (stocks.stability / 100)) *
    (atWar && losing ? 0.8 : 1.0);
  stocks.politicalPower = Math.min(stocks.politicalPower, 500);

  let stabDelta =
    0.06 * (s.welfare / 50 - 1) +
    0.05 * (s.liberty / 50 - 1) * (atWar ? 0.35 : 1.0) -
    (0.1 * Math.max(0, stocks.inflation - 8)) / 12 -
    (0.14 * Math.max(0, s.conscription - 35) * (1 - stocks.warSupport / 100)) /
      50 -
    0.22 * Math.max(0, 0.75 - suff.food) -
    0.18 * (losing ? 1 : 0) -
    (0.05 * Math.max(0, s.taxRate - 28)) / 30 +
    0.02 * (s.propaganda / 100);
  if (nation.spirits.includes("fractured_politics")) {
    stabDelta -= 0.08;
  }
  stocks.stability = clamp(stocks.stability + stabDelta, 0, 100);

  const wsDelta =
    0.08 * (s.propaganda / 100) +
    0.1 * (winning ? 1 : 0) -
    0.12 * (losing ? 1 : 0) -
    (0.07 * Math.max(0, s.conscription - 50)) / 50 +
    (s.doctrine === "defense" && atWar ? 0.04 : 0);
  stocks.warSupport = clamp(stocks.warSupport + wsDelta, 0, 100);

  // 15. Hard fails + runStats
  updateRunStats(nation, state);
  stepHardFails(nation, state, extract.food);
}

export function tick(
  state: GameState,
  dt: number,
  world: WorldView,
  rng: Rng,
): TickResult {
  // 0. Ranked ended runs do not advance.
  if (state.ranked && state.status === "ended") {
    const frozen = cloneGameState(state);
    return { state: frozen, newspapers: [], interrupted: false, dtWeeks: 0 };
  }

  if (state.pendingEvent && world.regencyPause) {
    const frozen = cloneGameState(state);
    return {
      state: frozen,
      newspapers: [],
      interrupted: true,
      interruptReason: "event",
      dtWeeks: 0,
    };
  }

  const next = cloneGameState(state);
  // Production is deterministic; only rng.next() through this wrap advances rngCursor.
  const tracked = trackRng(rng, next.rngCursor);

  // 1. Date +1 week, tickIndex++. Tension tracks last schedule point at <= date, 0.15/week.
  void dt;
  next.tickIndex += 1;
  next.date = addDaysUtc(next.date, 7);
  next.worldTension = stepWorldTension(
    next.worldTension,
    next.date,
    world.tensionSchedule,
  );

  const ids = Object.keys(next.nations).sort();
  for (const id of ids) {
    const nation = next.nations[id];
    if (!nation || !nation.alive) continue;
    stepNation(nation, next, world, tracked);
  }

  // 11. Non-player slider writes; AI is not billed PP.
  stepAiPolicies(next);

  // Pulses read this week's paper; losing/winning flags land in time for next week's stab/ws.
  writePaperStrength(next);
  const newspapers = runCampaignPulses(next, tracked);
  // 14. Event triggers after pulses; AFK auto-resolves, pause sets pendingEvent.
  const eventResult = runEventPhase(next, world);
  newspapers.push(...eventResult.newspapers);

  // Combat can flip owners after stepNation; region troughs must see this week's map.
  for (const id of ids) {
    const nation = next.nations[id];
    if (!nation) continue;
    updateRegionExtrema(nation, next);
    updateCompositeExtrema(nation, next);
  }

  next.rngCursor = tracked.cursor();
  assertFiniteStocks(next);

  // Season calendar and hard-fail both freeze here so catch-up cannot overshoot.
  if (dateGte(next.date, COMING_STORM_END)) {
    next.status = "ended";
  }
  if (next.status === "ended" && next.ending === undefined) {
    next.ending = resolveEnding(next, next.playerCountryId);
  }

  return {
    state: next,
    newspapers,
    interrupted: eventResult.interrupted,
    interruptReason: eventResult.interruptReason,
    dtWeeks: 1,
  };
}
