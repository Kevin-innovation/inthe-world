import type {
  CountryId,
  Doctrine,
  GameState,
  NationState,
  RegionId,
  RegionState,
  Rng,
  Terrain,
  War,
  ChronicleEntry,
} from "./types";

const TERRAIN_MOD: Record<Terrain, number> = Object.freeze({
  plains: 1.1,
  forest: 0.92,
  hills: 0.88,
  mountains: 0.78,
  urban: 0.85,
  desert: 0.9,
  jungle: 0.8,
  coastal: 0.82,
});

const EMPTY_NEIGHBORS: readonly RegionId[] = Object.freeze([]);
const CHRONICLE_CAP = 250;
const WAR_RING = 8;

const REGION_IDS = [
  "britain",
  "ireland",
  "france_north",
  "france_south",
  "low_countries",
  "rhineland",
  "germany_north",
  "germany_south",
  "austria",
  "czechoslovakia",
  "poland",
  "hungary",
  "romania",
  "yugoslavia",
  "greece",
  "italy_north",
  "italy_south",
  "iberia",
  "scandinavia",
  "finland",
  "baltics",
  "european_russia",
  "ukraine",
  "belarus",
  "anatolia",
  "caucasus",
  "levant",
  "arabia",
  "persia",
  "egypt_suez",
  "maghreb",
  "libya",
  "siberia",
  "central_asia",
  "manchuria",
  "korea",
  "japan_home",
  "north_china",
  "south_china",
  "indochina",
  "siam",
  "india_north",
  "india_south",
  "indonesia",
  "philippines",
  "malaya",
  "burma",
  "mongolia",
  "west_africa",
  "horn_africa",
  "central_africa",
  "southern_africa",
  "east_africa",
  "madagascar",
  "us_east",
  "us_west",
  "canada",
  "mexico",
  "caribbean_central",
  "brazil",
  "southern_cone",
  "andes",
  "australia",
  "pacific_islands",
] as const;

const NEIGHBOR_PAIRS: readonly (readonly [string, string])[] = [
  ["britain", "ireland"],
  ["britain", "france_north"],
  ["britain", "low_countries"],
  ["britain", "scandinavia"],
  ["france_north", "france_south"],
  ["france_north", "low_countries"],
  ["france_north", "rhineland"],
  ["france_north", "iberia"],
  ["france_south", "iberia"],
  ["france_south", "italy_north"],
  ["low_countries", "rhineland"],
  ["low_countries", "germany_north"],
  ["rhineland", "germany_north"],
  ["rhineland", "germany_south"],
  ["germany_north", "germany_south"],
  ["germany_north", "poland"],
  ["germany_north", "czechoslovakia"],
  ["germany_north", "scandinavia"],
  ["germany_north", "baltics"],
  ["germany_south", "austria"],
  ["germany_south", "czechoslovakia"],
  ["austria", "czechoslovakia"],
  ["austria", "hungary"],
  ["austria", "yugoslavia"],
  ["austria", "italy_north"],
  ["czechoslovakia", "poland"],
  ["czechoslovakia", "hungary"],
  ["poland", "hungary"],
  ["poland", "romania"],
  ["poland", "ukraine"],
  ["poland", "belarus"],
  ["poland", "baltics"],
  ["hungary", "romania"],
  ["hungary", "yugoslavia"],
  ["romania", "yugoslavia"],
  ["romania", "ukraine"],
  ["yugoslavia", "greece"],
  ["yugoslavia", "italy_north"],
  ["yugoslavia", "italy_south"],
  ["greece", "italy_south"],
  ["greece", "anatolia"],
  ["italy_north", "italy_south"],
  ["italy_south", "libya"],
  ["iberia", "maghreb"],
  ["scandinavia", "finland"],
  ["scandinavia", "baltics"],
  ["finland", "baltics"],
  ["finland", "european_russia"],
  ["baltics", "belarus"],
  ["baltics", "european_russia"],
  ["european_russia", "belarus"],
  ["european_russia", "ukraine"],
  ["european_russia", "caucasus"],
  ["european_russia", "siberia"],
  ["european_russia", "central_asia"],
  ["ukraine", "belarus"],
  ["ukraine", "caucasus"],
  ["anatolia", "caucasus"],
  ["anatolia", "levant"],
  ["anatolia", "persia"],
  ["caucasus", "persia"],
  ["caucasus", "central_asia"],
  ["levant", "arabia"],
  ["levant", "egypt_suez"],
  ["levant", "persia"],
  ["arabia", "persia"],
  ["arabia", "egypt_suez"],
  ["arabia", "horn_africa"],
  ["persia", "central_asia"],
  ["persia", "india_north"],
  ["egypt_suez", "libya"],
  ["egypt_suez", "maghreb"],
  ["egypt_suez", "horn_africa"],
  ["egypt_suez", "east_africa"],
  ["maghreb", "libya"],
  ["maghreb", "west_africa"],
  ["libya", "west_africa"],
  ["libya", "central_africa"],
  ["siberia", "central_asia"],
  ["siberia", "mongolia"],
  ["siberia", "manchuria"],
  ["central_asia", "mongolia"],
  ["central_asia", "india_north"],
  ["manchuria", "mongolia"],
  ["manchuria", "korea"],
  ["manchuria", "north_china"],
  ["korea", "japan_home"],
  ["korea", "north_china"],
  ["japan_home", "philippines"],
  ["japan_home", "pacific_islands"],
  ["north_china", "mongolia"],
  ["north_china", "south_china"],
  ["south_china", "indochina"],
  ["south_china", "burma"],
  ["indochina", "siam"],
  ["indochina", "malaya"],
  ["siam", "burma"],
  ["siam", "malaya"],
  ["india_north", "india_south"],
  ["india_north", "burma"],
  ["indonesia", "malaya"],
  ["indonesia", "philippines"],
  ["indonesia", "australia"],
  ["philippines", "pacific_islands"],
  ["malaya", "burma"],
  ["pacific_islands", "australia"],
  ["pacific_islands", "us_west"],
  ["west_africa", "central_africa"],
  ["horn_africa", "east_africa"],
  ["horn_africa", "central_africa"],
  ["central_africa", "southern_africa"],
  ["central_africa", "east_africa"],
  ["southern_africa", "east_africa"],
  ["southern_africa", "madagascar"],
  ["east_africa", "madagascar"],
  ["us_east", "us_west"],
  ["us_east", "canada"],
  ["us_east", "mexico"],
  ["us_east", "caribbean_central"],
  ["us_west", "canada"],
  ["us_west", "mexico"],
  ["mexico", "caribbean_central"],
  ["caribbean_central", "brazil"],
  ["caribbean_central", "andes"],
  ["brazil", "southern_cone"],
  ["brazil", "andes"],
  ["southern_cone", "andes"],
];

const DEFAULT_NEIGHBORS: Readonly<Record<string, readonly string[]>> =
  buildNeighbors(REGION_IDS, NEIGHBOR_PAIRS);

export type PulseOutcome = "decisive" | "win" | "stalemate" | "loss";

export interface PaperInput {
  milFactories: number;
  milEff: number;
  regionDamage: number;
  armySize: number;
  munitions: number;
  oilSuff: number;
  doctrine: Doctrine;
  logistics: number;
}

export interface PulseInput {
  paperAtt: number;
  paperDef: number;
  terrain: Terrain;
  doctrineAtt: Doctrine;
  doctrineDef: Doctrine;
  logisticsAtt: number;
  logisticsDef: number;
  rng: Rng;
}

export interface PulseResult {
  outcome: PulseOutcome;
  effective: number;
  attCasRate: number;
  defCasRate: number;
  flipChance: number;
  defFactoryDamage: number;
  attFactoryDamage: number;
  flipped: boolean;
  contestCleared: boolean;
  doctrineMod: number;
  terrainMod: number;
  logiMod: number;
  rngJ: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function flagNumber(
  flags: Record<string, boolean | number>,
  key: string,
): number {
  const value = flags[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isoDate(date: GameState["date"]): string {
  const month = date.month < 10 ? `0${date.month}` : `${date.month}`;
  const day = date.day < 10 ? `0${date.day}` : `${date.day}`;
  return `${date.year}-${month}-${day}`;
}

function buildNeighbors(
  ids: readonly string[],
  pairs: readonly (readonly [string, string])[],
): Readonly<Record<string, readonly string[]>> {
  const sets = new Map<string, Set<string>>();
  for (const id of ids) {
    sets.set(id, new Set());
  }
  for (const [a, b] of pairs) {
    let setA = sets.get(a);
    if (!setA) {
      setA = new Set();
      sets.set(a, setA);
    }
    let setB = sets.get(b);
    if (!setB) {
      setB = new Set();
      sets.set(b, setB);
    }
    setA.add(b);
    setB.add(a);
  }
  const out: Record<string, readonly string[]> = {};
  const keys = [...sets.keys()].sort();
  for (const id of keys) {
    const set = sets.get(id);
    out[id] = Object.freeze(set ? [...set].sort() : []);
  }
  return Object.freeze(out);
}

function neighborsOf(region: RegionState): readonly string[] {
  if (region.neighbors !== undefined) return region.neighbors;
  return DEFAULT_NEIGHBORS[region.id] ?? EMPTY_NEIGHBORS;
}

function milEffOf(nation: NationState): number {
  return 1.0 + 0.5 * (nation.stocks.researchMil / 100);
}

function ownedRegionStats(
  state: GameState,
  countryId: CountryId,
): { count: number; damageAvg: number; coastalShare: number } {
  let count = 0;
  let coastal = 0;
  let damage = 0;
  for (const id of Object.keys(state.regions).sort()) {
    const region = state.regions[id];
    if (!region || region.owner !== countryId) continue;
    count += 1;
    damage += region.factoryDamage;
    if (region.coastal) coastal += 1;
  }
  return {
    count,
    damageAvg: count === 0 ? 0 : damage / count,
    coastalShare: coastal / Math.max(count, 1),
  };
}

export function doctrineMod(att: Doctrine, def: Doctrine): number {
  if (att === "offense" && def === "defense") return 0.92;
  if (att === "offense" && def === "offense") return 1.05;
  if (att === "deterrence" && def === "offense") return 0.88;
  if (att === "deterrence" && def === "defense") return 1.0;
  if (att === "defense" && def === "offense") return 1.08;
  return 1.0;
}

export function terrainMod(terrain: Terrain): number {
  return TERRAIN_MOD[terrain];
}

export function paperStrength(input: PaperInput): number {
  const milFactories = Math.max(0, finiteOrZero(input.milFactories));
  const milEff = Math.max(0, finiteOrZero(input.milEff));
  const regionDamage = clamp(finiteOrZero(input.regionDamage), 0, 1);
  const armySize = Math.max(0, finiteOrZero(input.armySize));
  const munitions = Math.max(0, finiteOrZero(input.munitions));
  const oil = clamp(finiteOrZero(input.oilSuff), 0, 1.5);
  const logistics = finiteOrZero(input.logistics);
  const doctrineMul =
    input.doctrine === "offense"
      ? 1.08
      : input.doctrine === "defense"
        ? 0.98
        : 1.0;
  return (
    Math.exp(
      0.42 * Math.log(1 + milFactories * milEff * (1 - regionDamage)) +
        0.26 * Math.log(1 + armySize) +
        0.2 * Math.log(1 + munitions) +
        0.12 * Math.log(1 + oil * 10),
    ) *
    doctrineMul *
    (0.7 + 0.3 * logistics)
  );
}

export function forceProjection(
  paper: number,
  logistics: number,
  oilSuff: number,
  coastalRegionShare: number,
): number {
  const oil = clamp(finiteOrZero(oilSuff), 0, 1);
  const coastal = clamp(finiteOrZero(coastalRegionShare), 0, 1);
  return (
    finiteOrZero(paper) *
    finiteOrZero(logistics) *
    (0.5 + 0.5 * oil) *
    (0.75 + 0.25 * coastal)
  );
}

function pulsePeriod(intensity: War["intensity"]): number {
  if (intensity === 3) return 1;
  if (intensity === 2) return 2;
  return 4;
}

export function resolvePulse(input: PulseInput): PulseResult {
  const ratio = input.paperAtt / Math.max(input.paperDef, 0.01);
  const tMod = terrainMod(input.terrain);
  const dMod = doctrineMod(input.doctrineAtt, input.doctrineDef);
  const logiMod =
    0.75 +
    0.25 * (input.logisticsAtt / Math.max(input.logisticsDef, 0.3));
  const rngJ = 0.88 + 0.24 * input.rng.next();
  const effective = ratio * tMod * dMod * logiMod * rngJ;

  let outcome: PulseOutcome;
  let attCasRate: number;
  let defCasRate: number;
  let flipChance: number;
  let defFactoryDamage: number;
  let attFactoryDamage: number;
  if (effective >= 2.2) {
    outcome = "decisive";
    attCasRate = 0.015;
    defCasRate = 0.11;
    flipChance = 0.7;
    defFactoryDamage = 0.08;
    attFactoryDamage = 0;
  } else if (effective >= 1.35) {
    outcome = "win";
    attCasRate = 0.025;
    defCasRate = 0.07;
    flipChance = 0.35;
    defFactoryDamage = 0.05;
    attFactoryDamage = 0;
  } else if (effective > 0.8) {
    outcome = "stalemate";
    attCasRate = 0.04;
    defCasRate = 0.04;
    flipChance = 0;
    defFactoryDamage = 0.03;
    attFactoryDamage = 0.03;
  } else {
    outcome = "loss";
    attCasRate = 0.08;
    defCasRate = 0.025;
    flipChance = 0;
    defFactoryDamage = 0;
    attFactoryDamage = 0.04;
  }

  // Same second draw for flip or contest-clear so every front consumes 2 rng.
  const roll = input.rng.next();
  const flipped =
    (outcome === "decisive" || outcome === "win") && roll < flipChance;
  const contestCleared = outcome === "loss" && roll < 0.15;

  return {
    outcome,
    effective,
    attCasRate,
    defCasRate,
    flipChance,
    defFactoryDamage,
    attFactoryDamage,
    flipped,
    contestCleared,
    doctrineMod: dMod,
    terrainMod: tMod,
    logiMod,
    rngJ,
  };
}

export function writePaperStrength(state: GameState): void {
  const ids = Object.keys(state.nations).sort();
  for (const id of ids) {
    const nation = state.nations[id];
    if (!nation) continue;
    const owned = ownedRegionStats(state, id);
    const paper = paperStrength({
      milFactories: nation.stocks.milFactories,
      milEff: milEffOf(nation),
      regionDamage: owned.damageAvg,
      armySize: nation.stocks.armySize,
      munitions: nation.stocks.munitions,
      oilSuff: nation.derived.resSuff.oil,
      doctrine: nation.policies.doctrine,
      logistics: nation.derived.logistics,
    });
    nation.derived.paperStrength = paper;
    nation.derived.forceProjection = forceProjection(
      paper,
      nation.derived.logistics,
      nation.derived.resSuff.oil,
      owned.coastalShare,
    );
  }
}

function sideOf(war: War, id: CountryId): 0 | 1 | null {
  if (war.a.includes(id)) return 0;
  if (war.b.includes(id)) return 1;
  return null;
}

function pickAttacker(
  war: War,
  region: RegionState,
  state: GameState,
): CountryId | undefined {
  const ownerSide = sideOf(war, region.owner);
  if (ownerSide === null) return undefined;
  const enemies = ownerSide === 0 ? war.b : war.a;
  const enemySet = new Set(enemies);

  if (region.contestedBy && enemySet.has(region.contestedBy)) {
    return region.contestedBy;
  }

  const bordering = new Set<CountryId>();
  for (const nid of neighborsOf(region)) {
    const neighbor = state.regions[nid];
    if (neighbor && enemySet.has(neighbor.owner)) {
      bordering.add(neighbor.owner);
    }
  }
  const sorted = [...bordering].sort();
  return sorted[0];
}

function applyCasualties(nation: NationState, rate: number): number {
  const loss = Math.max(0, nation.stocks.armySize) * rate;
  nation.stocks.armySize = Math.max(0, nation.stocks.armySize - loss);
  // Labor overwrites the pool next week; same-tick 30% is the stand-in for the 8-week wounded queue.
  nation.stocks.manpowerPool += loss * 0.3;
  return loss;
}

function stagingRegion(
  state: GameState,
  attackerId: CountryId,
  defended: RegionState,
): RegionState | undefined {
  const ownedNeighbors: string[] = [];
  for (const nid of neighborsOf(defended)) {
    const neighbor = state.regions[nid];
    if (neighbor && neighbor.owner === attackerId) ownedNeighbors.push(nid);
  }
  ownedNeighbors.sort();
  const firstN = ownedNeighbors[0];
  if (firstN) return state.regions[firstN];

  const owned: string[] = [];
  for (const id of Object.keys(state.regions).sort()) {
    const region = state.regions[id];
    if (region && region.owner === attackerId) owned.push(id);
  }
  const first = owned[0];
  return first ? state.regions[first] : undefined;
}

function pushChronicle(state: GameState, entry: ChronicleEntry): void {
  state.chronicle.push(entry);
  if (state.chronicle.length > CHRONICLE_CAP) {
    state.chronicle.splice(0, state.chronicle.length - CHRONICLE_CAP);
  }
}

function recordRegionDeltas(
  state: GameState,
  deltas: Record<string, number>,
): void {
  const hasWars = state.wars.length > 0;
  const ids = Object.keys(state.nations).sort();
  for (const id of ids) {
    const nation = state.nations[id];
    if (!nation || !nation.alive) continue;
    const hasRing = typeof nation.flags.rdHead === "number";
    const delta = deltas[id] ?? 0;
    if (!hasWars && !hasRing && delta === 0) continue;

    const head = flagNumber(nation.flags, "rdHead");
    nation.flags[`rd${head}`] = delta;
    nation.flags.rdHead = (head + 1) % WAR_RING;
    let net = 0;
    for (let i = 0; i < WAR_RING; i++) {
      net += flagNumber(nation.flags, `rd${i}`);
    }
    nation.flags.losing = net < 0 ? 1 : 0;
    nation.flags.winning = net > 0 ? 1 : 0;
  }
}

function applyH2Annex(state: GameState): void {
  const ids = Object.keys(state.nations).sort();
  for (const id of ids) {
    const nation = state.nations[id];
    if (!nation || !nation.alive) continue;
    const capital = state.regions[nation.capitalRegion];
    if (!capital) {
      nation.flags.h2Weeks = 0;
      continue;
    }
    if (capital.controller !== nation.id) {
      nation.flags.h2Weeks = flagNumber(nation.flags, "h2Weeks") + 1;
    } else {
      nation.flags.h2Weeks = 0;
    }
    const owned = ownedRegionStats(state, id).count;
    const peak = Math.max(nation.runStats.peakArmy, 0);
    if (
      flagNumber(nation.flags, "h2Weeks") >= 8 &&
      nation.stocks.armySize < 0.15 * peak &&
      owned === 0
    ) {
      nation.alive = false;
      nation.independent = false;
      nation.runStats.hadCapitulated = true;
      nation.runStats.collapseWeek = state.tickIndex;
      nation.flags.annexed = 1;
      if (nation.isPlayer) {
        state.status = "ended";
      }
    }
  }
}

export function runCampaignPulses(
  state: GameState,
  rng: Rng,
): ChronicleEntry[] {
  const newspapers: ChronicleEntry[] = [];
  const deltas: Record<string, number> = {};
  const bump = (id: CountryId, d: number): void => {
    deltas[id] = (deltas[id] ?? 0) + d;
  };

  const wars = [...state.wars].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const regionIds = Object.keys(state.regions).sort();

  for (const war of wars) {
    if (state.tickIndex % pulsePeriod(war.intensity) !== 0) continue;

    for (const regionId of regionIds) {
      const region = state.regions[regionId];
      if (!region) continue;
      const attId = pickAttacker(war, region, state);
      if (!attId) continue;
      const attacker = state.nations[attId];
      const defender = state.nations[region.owner];
      if (!attacker?.alive || !defender?.alive) continue;
      if (attacker.id === defender.id) continue;

      const pulse = resolvePulse({
        paperAtt: attacker.derived.paperStrength,
        paperDef: defender.derived.paperStrength,
        terrain: region.terrain,
        doctrineAtt: attacker.policies.doctrine,
        doctrineDef: defender.policies.doctrine,
        logisticsAtt: attacker.derived.logistics,
        logisticsDef: defender.derived.logistics,
        rng,
      });

      const attCas = applyCasualties(attacker, pulse.attCasRate);
      const defCas = applyCasualties(defender, pulse.defCasRate);

      region.factoryDamage = clamp(
        region.factoryDamage + pulse.defFactoryDamage,
        0,
        1,
      );
      if (pulse.attFactoryDamage > 0) {
        const staging = stagingRegion(state, attacker.id, region);
        if (staging) {
          staging.factoryDamage = clamp(
            staging.factoryDamage + pulse.attFactoryDamage,
            0,
            1,
          );
        }
      }

      if (pulse.flipped) {
        const prev = region.owner;
        region.owner = attacker.id;
        region.controller = attacker.id;
        delete region.contestedBy;
        bump(prev, -1);
        bump(attacker.id, 1);
      } else if (pulse.contestCleared) {
        delete region.contestedBy;
      } else if (pulse.outcome === "win" || pulse.outcome === "stalemate") {
        region.contestedBy = attacker.id;
      }

      const entry: ChronicleEntry = {
        tick: state.tickIndex,
        date: isoDate(state.date),
        kind: "battle",
        titleKey: `chronicle.battle.${pulse.outcome}`,
        bodyKey: "chronicle.battle.body",
        args: {
          war: war.id,
          region: region.id,
          attacker: attacker.id,
          defender: defender.id,
          effective: pulse.effective,
          attCas,
          defCas,
          flipped: pulse.flipped ? 1 : 0,
        },
      };
      newspapers.push(entry);
      pushChronicle(state, entry);
    }
  }

  recordRegionDeltas(state, deltas);
  applyH2Annex(state);
  return newspapers;
}
