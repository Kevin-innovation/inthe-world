import type {
  CountryId,
  DerivedStats,
  FactionId,
  GameState,
  NationState,
  NationStocks,
  PolicySliders,
  ResourceStocks,
  RunStats,
  WorldView,
} from "./types";

export const DEFAULT_POLICIES: PolicySliders = {
  taxRate: 20,
  industrialFocus: 30,
  tradeOpenness: 40,
  conscription: 15,
  doctrine: "defense",
  milSpending: 20,
  liberty: 50,
  propaganda: 20,
  intervention: 20,
  alignmentLean: 0,
  welfare: 40,
  researchMil: 30,
  researchInd: 40,
  researchSoc: 30,
};

export const USA_1936_PEACE_BALANCED: PolicySliders = {
  taxRate: 24,
  industrialFocus: 28,
  tradeOpenness: 50,
  conscription: 18,
  doctrine: "defense",
  milSpending: 18,
  liberty: 55,
  propaganda: 20,
  intervention: 20,
  alignmentLean: 0,
  welfare: 50,
  researchMil: 25,
  researchInd: 45,
  researchSoc: 30,
};

export const MINI_WAR_OVERMOBILIZE: PolicySliders = {
  taxRate: 36,
  industrialFocus: 80,
  tradeOpenness: 0,
  conscription: 90,
  doctrine: "offense",
  milSpending: 80,
  liberty: 25,
  propaganda: 10,
  intervention: 70,
  alignmentLean: 0,
  welfare: 15,
  researchMil: 70,
  researchInd: 15,
  researchSoc: 15,
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function laborFromStocks(stocks: NationStocks): {
  laborFactor: number;
  manpowerPool: number;
} {
  const workAge = stocks.population * 0.38 * 1000;
  const civilianLabor = Math.max(0, workAge - stocks.armySize);
  const laborFactor = clamp(
    civilianLabor / Math.max(workAge * 0.82, 1),
    0.2,
    1.05,
  );
  const manpowerPool = Math.max(0, workAge * 0.55 - stocks.armySize);
  return { laborFactor, manpowerPool };
}

function runStatsFrom(stocks: NationStocks): RunStats {
  return {
    peakStability: stocks.stability,
    troughStability: stocks.stability,
    peakGdp: stocks.gdp,
    troughGdp: stocks.gdp,
    peakArmy: stocks.armySize,
    startArmy: stocks.armySize,
    startRegions: 0,
    weeksIndependent: 0,
    weeksAtWar: 0,
    weeksAlive: 0,
    hadRevolution: false,
    hadCapitulated: false,
    recoveredFromCollapse: false,
    achievements: [],
  };
}

function derivedFrom(
  stocks: NationStocks,
  faction: FactionId,
): DerivedStats {
  const { laborFactor } = laborFromStocks(stocks);
  return {
    laborFactor,
    resSuff: { food: 1, steel: 1, oil: 1, rares: 1 },
    logistics: clamp(stocks.infra / 100, 0.3, 1.2),
    utilCiv: 1,
    utilMil: 1,
    paperStrength: 0,
    forceProjection: 0,
    taxFlow: 0,
    gdpWeekly: 0,
    faction,
  };
}

function makeNation(args: {
  id: CountryId;
  isPlayer: boolean;
  capitalRegion: string;
  faction: FactionId;
  stocks: Omit<NationStocks, "manpowerPool"> & { manpowerPool?: number };
}): NationState {
  const { manpowerPool } = laborFromStocks({
    ...args.stocks,
    manpowerPool: args.stocks.manpowerPool ?? 0,
  });
  const stocks: NationStocks = {
    ...args.stocks,
    manpowerPool,
  };
  return {
    id: args.id,
    isPlayer: args.isPlayer,
    alive: true,
    independent: true,
    capitalRegion: args.capitalRegion,
    stocks,
    derived: derivedFrom(stocks, args.faction),
    policies: { ...DEFAULT_POLICIES },
    civBuildPts: 0,
    milBuildPts: 0,
    infraBuildPts: 0,
    spirits: [],
    focus: null,
    faction: args.faction,
    atWarWith: [],
    flags: {},
    runStats: runStatsFrom(stocks),
  };
}

const USA_BASE: ResourceStocks = {
  food: 90,
  steel: 80,
  oil: 95,
  rares: 55,
};

const ETH_BASE: ResourceStocks = {
  food: 12,
  steel: 0.5,
  oil: 1,
  rares: 1,
};

export function twoNationWorld(): WorldView {
  return {
    resourceBase: {
      USA: { ...USA_BASE },
      ETH: { ...ETH_BASE },
    },
  };
}

export function makeTwoNationState(seed: number): GameState {
  const usa = makeNation({
    id: "USA",
    isPlayer: true,
    capitalRegion: "us_east",
    faction: "status_quo",
    stocks: {
      civFactories: 110,
      milFactories: 10,
      infra: 62,
      population: 128,
      armySize: 180,
      gdp: 1000,
      treasury: 220,
      debt: 80,
      inflation: 1,
      politicalPower: 40,
      stability: 72,
      warSupport: 18,
      researchMil: 30,
      researchInd: 40,
      researchSoc: 30,
      food: USA_BASE.food,
      steel: USA_BASE.steel,
      oil: USA_BASE.oil,
      rares: USA_BASE.rares,
      munitions: 0,
      consumerGoods: 0,
    },
  });

  const eth = makeNation({
    id: "ETH",
    isPlayer: false,
    capitalRegion: "horn_africa",
    faction: "nonaligned",
    stocks: {
      civFactories: 2,
      milFactories: 1,
      infra: 12,
      population: 8,
      armySize: 80,
      gdp: 6,
      treasury: 0.72,
      debt: 1.5,
      inflation: 4,
      politicalPower: 20,
      stability: 40,
      warSupport: 25,
      researchMil: 10,
      researchInd: 12,
      researchSoc: 10,
      food: ETH_BASE.food,
      steel: ETH_BASE.steel,
      oil: ETH_BASE.oil,
      rares: ETH_BASE.rares,
      munitions: 0,
      consumerGoods: 0,
    },
  });

  return {
    saveId: "test-two-nations",
    seasonId: "the_coming_storm",
    contentHash: "00000000",
    seed,
    rngCursor: 0,
    tickIndex: 0,
    date: { year: 1936, month: 3, day: 1 },
    worldTension: 16,
    nations: { USA: usa, ETH: eth },
    regions: {},
    wars: [],
    chronicle: [],
    playerCountryId: "USA",
    fateSpent: 0,
    lastTickAt: "1970-01-01T00:00:00.000Z",
    status: "active",
    ranked: false,
  };
}

export function makePeaceBalancedState(seed: number): GameState {
  const state = makeTwoNationState(seed);
  const usa = state.nations.USA;
  if (usa) {
    usa.policies = { ...USA_1936_PEACE_BALANCED };
    usa.atWarWith = [];
  }
  return state;
}

export function miniWarWorld(): WorldView {
  return {
    resourceBase: {
      USA: { ...USA_BASE },
      ETH: { food: 3, steel: 0.2, oil: 0.2, rares: 0.2 },
    },
  };
}

export function makeMiniWarOvermobilize(seed: number): GameState {
  const state = makeTwoNationState(seed);
  const eth = state.nations.ETH;
  if (!eth) return state;
  eth.stocks.civFactories = 4;
  eth.stocks.milFactories = 2;
  eth.stocks.treasury = 0.4;
  eth.stocks.food = 3;
  eth.stocks.steel = 0.2;
  eth.stocks.oil = 0.2;
  eth.stocks.rares = 0.2;
  eth.atWarWith = ["INVADER"];
  eth.policies = { ...MINI_WAR_OVERMOBILIZE };
  return state;
}
