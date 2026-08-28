import type {
  CountryId,
  EndingArchetype,
  EndingId,
  EndingResolution,
  GameState,
  NationState,
} from "./types";

export const GREAT_POWERS: ReadonlySet<string> = new Set([
  "USA",
  "GER",
  "SOV",
  "ENG",
  "FRA",
  "JAP",
  "ITA",
]);

export const ENDING_ARCHETYPES: readonly EndingArchetype[] = [
  {
    id: "annexed",
    priority: 10,
    multiplier: 0.32,
    titleKey: "ending.annexed.title",
    templateKey: "ending.annexed.body",
  },
  {
    id: "collapse",
    priority: 20,
    multiplier: 0.22,
    titleKey: "ending.collapse.title",
    templateKey: "ending.collapse.body",
  },
  {
    id: "revolution",
    priority: 30,
    multiplier: 0.92,
    titleKey: "ending.revolution.title",
    templateKey: "ending.revolution.body",
  },
  {
    id: "client_state",
    priority: 40,
    multiplier: 0.80,
    titleKey: "ending.client_state.title",
    templateKey: "ending.client_state.body",
  },
  {
    id: "rump_state",
    priority: 50,
    multiplier: 0.68,
    titleKey: "ending.rump_state.title",
    templateKey: "ending.rump_state.body",
  },
  {
    id: "phoenix",
    priority: 60,
    multiplier: 1.18,
    titleKey: "ending.phoenix.title",
    templateKey: "ending.phoenix.body",
  },
  {
    id: "hegemon",
    priority: 70,
    multiplier: 1.20,
    titleKey: "ending.hegemon.title",
    templateKey: "ending.hegemon.body",
  },
  {
    id: "survivor",
    priority: 80,
    multiplier: 1.00,
    titleKey: "ending.survivor.title",
    templateKey: "ending.survivor.body",
  },
];

const ENDING_BY_ID: ReadonlyMap<EndingId, EndingArchetype> = new Map(
  ENDING_ARCHETYPES.map((row) => [row.id, row]),
);

const ORDERED_ARCHETYPES: readonly EndingArchetype[] = [...ENDING_ARCHETYPES].sort(
  (a, b) => a.priority - b.priority,
);

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

function flagNumber(
  flags: Record<string, boolean | number>,
  key: string,
): number {
  const value = flags[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function ownedRegionCount(state: GameState, id: CountryId): number {
  let n = 0;
  for (const region of Object.values(state.regions)) {
    if (region.owner === id) n += 1;
  }
  return n;
}

function hasRegionMap(state: GameState): boolean {
  return Object.keys(state.regions).length > 0;
}

export function startRegionsOf(
  nation: NationState,
  state: GameState,
): number {
  if (nation.runStats.startRegions > 0) return nation.runStats.startRegions;
  return ownedRegionCount(state, nation.id);
}

export function intactFactorOf(
  nation: NationState,
  state: GameState,
): number {
  const start = startRegionsOf(nation, state);
  const owned = ownedRegionCount(state, nation.id);
  // Two-nation fixtures have no region map; do not treat 0/0 as a rump.
  if (start <= 0) return 1;
  return clamp(owned / start, 0.15, 1.2);
}

export function compositeOf(nation: NationState, state: GameState): number {
  const gdp = Math.max(0, nation.stocks.gdp);
  const factories = Math.max(
    0,
    nation.stocks.civFactories + 0.8 * nation.stocks.milFactories,
  );
  const fp = Math.max(0, nation.derived.forceProjection);
  const stab = clamp(nation.stocks.stability / 100, 0, 1.5);
  const independenceFactor = !nation.alive
    ? 0
    : nation.independent
      ? 1.0
      : 0.45;
  const intactFactor = intactFactorOf(nation, state);
  return (
    gdp ** 0.35 *
    factories ** 0.3 *
    (1 + fp) ** 0.2 *
    stab ** 0.1 *
    independenceFactor *
    intactFactor
  );
}

function capitalController(
  state: GameState,
  nation: NationState,
): CountryId | undefined {
  return state.regions[nation.capitalRegion]?.controller;
}

function hadRevolution(nation: NationState): boolean {
  return nation.runStats.hadRevolution || flagOn(nation.flags, "hadRevolution");
}

function hadCapitulated(nation: NationState): boolean {
  return (
    nation.runStats.hadCapitulated || flagOn(nation.flags, "hadCapitulated")
  );
}

function isFailedState(nation: NationState): boolean {
  return (
    flagOn(nation.flags, "failedState") ||
    flagOn(nation.flags, "failed_state") ||
    nation.spirits.includes("failed_state")
  );
}

function h3Fired(nation: NationState): boolean {
  return (
    flagOn(nation.flags, "h3Fired") ||
    flagNumber(nation.flags, "h3CollapseWeeks") >= 4
  );
}

function h4Fired(nation: NationState): boolean {
  return (
    flagOn(nation.flags, "h4Fired") || flagNumber(nation.flags, "h4Weeks") >= 8
  );
}

function h1Collapsed(nation: NationState): boolean {
  // Revolution resets h1Weeks and stays alive; army-collapse leaves the flag.
  return (
    flagOn(nation.flags, "h1Fired") ||
    (!nation.alive && flagNumber(nation.flags, "h1Weeks") >= 4)
  );
}

function isCollapseCause(nation: NationState): boolean {
  const peakGdp = Math.max(nation.runStats.peakGdp, nation.stocks.gdp, 1e-6);
  const economic =
    nation.stocks.stability <= 5 &&
    nation.stocks.inflation >= 40 &&
    nation.stocks.gdp < 0.4 * peakGdp;
  return h1Collapsed(nation) || h3Fired(nation) || h4Fired(nation) || economic;
}

function isWipedOffMap(state: GameState, nation: NationState): boolean {
  if (!hasRegionMap(state)) return false;
  const owned = ownedRegionCount(state, nation.id);
  const controller = capitalController(state, nation);
  return controller !== nation.id && owned === 0;
}

function isGreatPower(nation: NationState): boolean {
  return GREAT_POWERS.has(nation.id) || flagOn(nation.flags, "great_power");
}

function wonMajorWar(state: GameState, player: NationState): boolean {
  if (flagOn(player.flags, "wonMajorWar")) return true;
  const opponents = new Set<CountryId>();
  for (const id of player.atWarWith) opponents.add(id);
  for (const war of state.wars) {
    if (war.a.includes(player.id)) {
      for (const id of war.b) opponents.add(id);
    } else if (war.b.includes(player.id)) {
      for (const id of war.a) opponents.add(id);
    }
  }
  for (const oppId of opponents) {
    const opp = state.nations[oppId];
    if (!opp || !isGreatPower(opp)) continue;
    if (opp.runStats.hadCapitulated) return true;
    const cap = state.regions[opp.capitalRegion];
    if (cap?.controller === player.id) return true;
  }
  return false;
}

function aliveNations(state: GameState): NationState[] {
  const rows: NationState[] = [];
  for (const id of Object.keys(state.nations).sort()) {
    const nation = state.nations[id];
    if (nation?.alive) rows.push(nation);
  }
  return rows;
}

function rankDesc(
  rows: NationState[],
  valueOf: (nation: NationState) => number,
  id: CountryId,
): number {
  const self = rows.find((row) => row.id === id);
  if (!self) return rows.length + 1;
  const value = valueOf(self);
  let better = 0;
  for (const row of rows) {
    if (valueOf(row) > value) better += 1;
  }
  return better + 1;
}

function regionRatio(nation: NationState, state: GameState): number {
  const start = startRegionsOf(nation, state);
  if (start <= 0) return 1;
  return ownedRegionCount(state, nation.id) / start;
}

function troughRegionRatio(nation: NationState, state: GameState): number {
  const start = startRegionsOf(nation, state);
  // No start map: 0/0 must not count as a phoenix trough.
  if (start <= 0) return 1;
  return nation.runStats.troughRegions / start;
}

function matchesAnnexed(state: GameState, player: NationState): boolean {
  if (isWipedOffMap(state, player)) return true;
  // Internal hard-fails set alive=false; without this carve-out H1/H3/H4
  // would first-match annexed (0.32) instead of collapse (0.22).
  return !player.alive && !isCollapseCause(player);
}

function matchesCollapse(player: NationState): boolean {
  if (!isCollapseCause(player)) return false;
  return !player.alive || isFailedState(player);
}

function matchesRevolution(player: NationState): boolean {
  return (
    hadRevolution(player) &&
    player.alive &&
    player.independent &&
    player.stocks.stability >= 20
  );
}

function matchesClient(player: NationState): boolean {
  return (
    player.alive && !player.independent && Boolean(player.overlord)
  );
}

function matchesRump(state: GameState, player: NationState): boolean {
  const start = startRegionsOf(player, state);
  if (start <= 0) return false;
  return (
    player.alive &&
    player.independent &&
    ownedRegionCount(state, player.id) / start < 0.4
  );
}

function matchesPhoenix(state: GameState, player: NationState): boolean {
  if (!player.alive || !player.independent) return false;
  if (player.stocks.stability < 40) return false;
  if (regionRatio(player, state) < 0.7) return false;
  return (
    hadRevolution(player) ||
    hadCapitulated(player) ||
    player.runStats.troughStability < 15 ||
    troughRegionRatio(player, state) < 0.5
  );
}

function matchesHegemon(state: GameState, player: NationState): boolean {
  if (!player.alive || !player.independent) return false;
  if (intactFactorOf(player, state) < 0.9) return false;
  const alive = aliveNations(state);
  const fpRank = rankDesc(alive, (n) => n.derived.forceProjection, player.id);
  const gdpRank = rankDesc(alive, (n) => n.stocks.gdp, player.id);
  if (fpRank > 2 || gdpRank > 3) return false;
  return (
    wonMajorWar(state, player) ||
    (isGreatPower(player) && !hadCapitulated(player))
  );
}

function matchesSurvivor(player: NationState): boolean {
  return player.alive && player.independent;
}

const PREDICATES: Record<
  EndingId,
  (state: GameState, player: NationState) => boolean
> = {
  annexed: (state, player) => matchesAnnexed(state, player),
  collapse: (_state, player) => matchesCollapse(player),
  revolution: (_state, player) => matchesRevolution(player),
  client_state: (_state, player) => matchesClient(player),
  rump_state: (state, player) => matchesRump(state, player),
  phoenix: (state, player) => matchesPhoenix(state, player),
  hegemon: (state, player) => matchesHegemon(state, player),
  survivor: (_state, player) => matchesSurvivor(player),
};

export function endingMultiplier(id: EndingId): number {
  return ENDING_BY_ID.get(id)?.multiplier ?? 1;
}

function resolutionOf(
  arch: EndingArchetype,
  state: GameState,
  player: NationState,
): EndingResolution {
  return {
    id: arch.id,
    tick: state.tickIndex,
    titleKey: arch.titleKey,
    bodyKey: arch.templateKey,
    args: {
      country: player.id,
      era: state.date.year,
      gdp: Math.round(player.stocks.gdp),
      multiplier: arch.multiplier,
    },
    score: 0,
  };
}

export function resolveEnding(
  state: GameState,
  playerId: CountryId,
): EndingResolution {
  const player = state.nations[playerId];
  if (!player) {
    throw new Error(`error_ending_unknown_country: ${playerId}`);
  }
  for (const arch of ORDERED_ARCHETYPES) {
    const pred = PREDICATES[arch.id];
    if (pred(state, player)) return resolutionOf(arch, state, player);
  }
  // Alive-but-unlisted (e.g. living puppet with no overlord): still close.
  const fallback = player.alive
    ? ENDING_BY_ID.get("survivor")
    : ENDING_BY_ID.get("annexed");
  if (!fallback) {
    throw new Error("error_ending_missing_fallback");
  }
  return resolutionOf(fallback, state, player);
}
