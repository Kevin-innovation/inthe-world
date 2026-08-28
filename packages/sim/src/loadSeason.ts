import { contentHash, type SeasonPack } from "@simul/content";
import { DEFAULT_POLICIES } from "./fixtures";
import type {
  CountryId,
  DerivedStats,
  FactionId,
  GameDate,
  GameState,
  NationState,
  NationStocks,
  RegionState,
  ResourceStocks,
  RunStats,
  WorldView,
} from "./types";

export type { SeasonPack };

export interface LoadSeasonOpts {
  saveId: string;
  seed: number;
  playerCountryId: CountryId;
}

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
    peakComposite: 0,
    troughComposite: 0,
    peakRegions: 0,
    troughRegions: 0,
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

function derivedFrom(stocks: NationStocks, faction: FactionId): DerivedStats {
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

function parseGameDate(iso: string): GameDate {
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    parts.length !== 3 ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`error_load_invalid_date: ${iso}`);
  }
  return { year, month, day };
}

function tensionAtStart(
  schedule: SeasonPack["tensionSchedule"],
  start: string,
): number {
  let at = "";
  let value = 0;
  for (const point of schedule) {
    if (point.at <= start && point.at >= at) {
      at = point.at;
      value = point.value;
    }
  }
  return value;
}

function copyBase(base: ResourceStocks): ResourceStocks {
  // WorldView must not share identity with pack.base tables.
  return {
    food: base.food,
    steel: base.steel,
    oil: base.oil,
    rares: base.rares,
  };
}

export function worldFromPack(pack: SeasonPack): WorldView {
  const resourceBase: Record<CountryId, ResourceStocks> = {};
  for (const row of pack.countries) {
    resourceBase[row.id] = copyBase(row.base);
  }
  return { resourceBase };
}

function makeNation(args: {
  id: CountryId;
  isPlayer: boolean;
  capitalRegion: string;
  faction: FactionId;
  stocks: Omit<NationStocks, "manpowerPool">;
}): NationState {
  const { manpowerPool } = laborFromStocks({
    ...args.stocks,
    manpowerPool: 0,
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

export function loadSeason(
  pack: SeasonPack,
  opts: LoadSeasonOpts,
): { state: GameState; world: WorldView } {
  const player = pack.countries.find((row) => row.id === opts.playerCountryId);
  if (!player) {
    throw new Error(`error_load_unknown_country: ${opts.playerCountryId}`);
  }

  const nations: Record<CountryId, NationState> = {};
  for (const row of pack.countries) {
    const stocks = row.stocks;
    nations[row.id] = makeNation({
      id: row.id,
      isPlayer: row.id === opts.playerCountryId,
      capitalRegion: row.capitalRegion,
      faction: row.faction,
      stocks: {
        civFactories: stocks.civFactories,
        milFactories: stocks.milFactories,
        infra: stocks.infra,
        population: stocks.population,
        armySize: stocks.armySize,
        gdp: stocks.gdp,
        treasury: stocks.treasury,
        debt: stocks.debt,
        inflation: stocks.inflation,
        politicalPower: stocks.politicalPower,
        stability: stocks.stability,
        warSupport: stocks.warSupport,
        researchMil: stocks.researchMil,
        researchInd: stocks.researchInd,
        researchSoc: stocks.researchSoc,
        food: stocks.food,
        steel: stocks.steel,
        oil: stocks.oil,
        rares: stocks.rares,
        munitions: stocks.munitions,
        consumerGoods: stocks.consumerGoods,
      },
    });
  }

  const regions: Record<string, RegionState> = {};
  for (const row of pack.regions) {
    regions[row.id] = {
      id: row.id,
      owner: row.owner,
      controller: row.controller ?? row.owner,
      terrain: row.terrain,
      coastal: row.coastal,
      factoryDamage: 0,
    };
  }

  const state: GameState = {
    saveId: opts.saveId,
    seasonId: pack.id,
    contentHash: contentHash(pack),
    seed: opts.seed,
    rngCursor: 0,
    tickIndex: 0,
    date: parseGameDate(pack.start),
    worldTension: tensionAtStart(pack.tensionSchedule, pack.start),
    nations,
    regions,
    wars: [],
    chronicle: [],
    playerCountryId: opts.playerCountryId,
    fateSpent: 0,
    lastTickAt: "1970-01-01T00:00:00.000Z",
    status: "active",
    ranked: false,
  };

  return { state, world: worldFromPack(pack) };
}
