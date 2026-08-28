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

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
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
  if (base) return base;
  const { food, steel, oil, rares } = nation.stocks;
  return { food, steel, oil, rares };
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

function stepNation(
  nation: NationState,
  state: GameState,
  world: WorldView,
  _roll: () => number,
): void {
  const s = nation.policies;
  const stocks = nation.stocks;
  const atWar = nation.atWarWith.length > 0;

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

  // 5. Utilization + production inflow
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

  const stabF = 0.85 + 0.15 * (stocks.stability / 100);
  const wsF = 0.8 + 0.2 * (stocks.warSupport / 100);
  const utilCiv = clamp(laborFactor * resSuff * stabF, 0.05, 1.25);
  const utilMil = clamp(laborFactor * resSuff * wsF, 0.05, 1.3);
  nation.derived.utilCiv = utilCiv;
  nation.derived.utilMil = utilMil;

  const civEff = 1.0 + 0.55 * (stocks.researchInd / 100);
  const milEff = 1.0 + 0.5 * (stocks.researchMil / 100);
  const civOut = stocks.civFactories * utilCiv * civEff;
  const milOut = stocks.milFactories * utilMil * milEff;

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

  // 6. Trade: no-op (openness unused this slice)

  // 7. Fiscal: tax, welfare, mil spend, interest, treasury, debt, GDP smoothing
  const extractValue =
    0.8 * extract.food +
    1.2 * extract.steel +
    1.6 * extract.oil +
    2.0 * extract.rares;
  const gdpWeekly = civOut * 4.0 + milOut * 3.2 + extractValue;
  stocks.gdp += 0.12 * (gdpWeekly * 52 - stocks.gdp);

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
  stocks.treasury += tax - welfareSpend - milSpend - interest;
  if (stocks.treasury < 0) {
    stocks.debt += -stocks.treasury;
    stocks.treasury = 0;
  } else {
    const repay = Math.min(stocks.debt, stocks.treasury * 0.08);
    stocks.debt -= repay;
    stocks.treasury -= repay;
  }

  nation.derived.gdpWeekly = gdpWeekly;
  nation.derived.taxFlow = tax;
  nation.derived.logistics =
    clamp(stocks.infra / 100, 0.3, 1.2) *
    (0.55 + 0.45 * resSuff) *
    (atWar ? 0.92 : 1.0) *
    (0.85 + 0.15 * (stocks.researchInd / 100));
}

export function tick(
  state: GameState,
  dt: number,
  world: WorldView,
  rng: Rng,
): TickResult {
  // 0. Ranked ended runs do not advance.
  if (state.ranked && state.status === "ended") {
    return { state, newspapers: [], interrupted: false, dtWeeks: 0 };
  }

  const next = cloneState(state);
  let cursor = next.rngCursor;
  // Combat/event jitter consumes RNG later; production formulas do not.
  const roll = (): number => {
    cursor += 1;
    return rng.next();
  };

  // 1. Date +1 week, tickIndex++
  next.tickIndex += 1;
  next.date = addDaysUtc(next.date, 7);

  const ids = Object.keys(next.nations).sort();
  for (const id of ids) {
    const nation = next.nations[id];
    if (!nation || !nation.alive) continue;
    stepNation(nation, next, world, roll);
  }

  // 8–16. research / PP / combat / events / endings: no-op this slice
  next.rngCursor = cursor;
  return {
    state: next,
    newspapers: [],
    interrupted: false,
    dtWeeks: dt,
  };
}
