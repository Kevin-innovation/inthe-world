export type CountryId = string; // "USA", "GER", ...
export type RegionId = string;
export type SeasonId = "the_coming_storm";
export type Doctrine = "defense" | "offense" | "deterrence";
export type FactionId =
  | "status_quo"
  | "revisionist"
  | "revolutionary"
  | "nonaligned";
export type Terrain =
  | "plains"
  | "forest"
  | "hills"
  | "mountains"
  | "urban"
  | "desert"
  | "jungle"
  | "coastal";

export interface PolicySliders {
  taxRate: number; // 0..100  economy
  industrialFocus: number; // 0 civilian investment ... 100 munitions
  tradeOpenness: number; // 0 autarky ... 100 open
  conscription: number; // 0..100  military
  doctrine: Doctrine;
  milSpending: number; // 0..100
  liberty: number; // 0 repression ... 100 liberty
  propaganda: number; // 0..100
  intervention: number; // 0 isolation ... 100 intervention
  alignmentLean: number; // -100 revisionist ... 0 nonaligned ... 100 status quo
  welfare: number; // 0 extraction ... 100 education/welfare
  researchMil: number; // three values sum to 100
  researchInd: number;
  researchSoc: number;
}

export interface NationStocks {
  civFactories: number;
  milFactories: number;
  infra: number; // 0..100 national average
  population: number; // millions
  manpowerPool: number; // thousands
  armySize: number; // thousands
  gdp: number; // abstract units, USA 1936 = 1000
  treasury: number;
  debt: number;
  inflation: number; // % annual-equivalent weekly stock
  politicalPower: number;
  stability: number; // 0..100
  warSupport: number; // 0..100
  researchMil: number; // 0..100 tech index
  researchInd: number;
  researchSoc: number;
  food: number;
  steel: number;
  oil: number;
  rares: number;
  munitions: number;
  consumerGoods: number;
}

export interface ResourceStocks {
  food: number;
  steel: number;
  oil: number;
  rares: number;
}

export interface DerivedStats {
  laborFactor: number;
  resSuff: { food: number; steel: number; oil: number; rares: number };
  logistics: number;
  utilCiv: number;
  utilMil: number;
  paperStrength: number;
  forceProjection: number;
  taxFlow: number;
  gdpWeekly: number;
  faction: FactionId;
}

export interface RunStats {
  peakStability: number;
  troughStability: number;
  peakGdp: number;
  troughGdp: number;
  peakComposite: number;
  troughComposite: number;
  peakRegions: number;
  troughRegions: number;
  startRegions: number;
  weeksIndependent: number;
  weeksAtWar: number;
  weeksAlive: number;
  hadRevolution: boolean;
  hadCapitulated: boolean;
  recoveredFromCollapse: boolean;
  collapseWeek?: number;
  achievements: string[];
}

export interface NationState {
  id: CountryId;
  isPlayer: boolean;
  alive: boolean;
  independent: boolean;
  overlord?: CountryId;
  capitalRegion: RegionId;
  stocks: NationStocks;
  derived: DerivedStats;
  policies: PolicySliders;
  spirits: string[];
  focus: { id: string; weeksRemaining: number; weeksTotal: number } | null;
  faction: FactionId;
  atWarWith: CountryId[];
  flags: Record<string, boolean | number>;
  runStats: RunStats;
}

export interface RegionState {
  id: RegionId;
  owner: CountryId;
  controller: CountryId;
  terrain: Terrain;
  coastal: boolean;
  contestedBy?: CountryId;
  factoryDamage: number; // 0..1
}

export interface War {
  id: string;
  a: CountryId[];
  b: CountryId[];
  intensity: 1 | 2 | 3;
  startTick: number;
}

export interface ChronicleEntry {
  tick: number;
  date: string; // ISO game date
  kind:
    | "battle"
    | "event"
    | "economy"
    | "diplomacy"
    | "focus"
    | "ending"
    | "regency";
  titleKey: string;
  bodyKey: string;
  args: Record<string, string | number>;
}

export interface PendingEvent {
  eventId: string;
  countryId: CountryId;
  rolledChoiceIds?: string[];
}

export type EndingId =
  | "hegemon"
  | "survivor"
  | "client_state"
  | "rump_state"
  | "revolution"
  | "annexed"
  | "collapse"
  | "phoenix";

export interface EndingResolution {
  id: EndingId;
  tick: number;
  titleKey: string;
  bodyKey: string;
  args: Record<string, string | number>;
  score: number;
}

export interface GameState {
  saveId: string;
  seasonId: SeasonId;
  seed: number;
  rngCursor: number;
  tickIndex: number;
  date: { year: number; month: number; day: number };
  worldTension: number;
  nations: Record<CountryId, NationState>;
  regions: Record<RegionId, RegionState>;
  wars: War[];
  chronicle: ChronicleEntry[]; // ring buffer max 250
  pendingEvent?: PendingEvent;
  playerCountryId: CountryId;
  fateSpent: number;
  lastTickAt: string; // wall-clock ISO; ignored by pure tick
  status: "active" | "ended";
  ending?: EndingResolution;
  ranked: boolean;
}

export interface TickResult {
  state: GameState;
  newspapers: ChronicleEntry[];
  interrupted: boolean;
  interruptReason?: "event" | "war_decision" | "revolution" | "peace_offer";
  dtWeeks: number;
}

export type EventTrigger =
  | { kind: "date"; from: string; to?: string }
  | { kind: "condition"; expr: string }
  | { kind: "and" | "or"; of: EventTrigger[] };

export interface EventChoice {
  id: string;
  titleKey: string;
  ppCost: number;
  tags: Partial<Record<"doctrine" | "intervention" | "liberty" | "risk", number>>;
  effects: Effect[];
}

export interface EventDefinition {
  id: string;
  titleKey: string;
  blurbKey: string;
  season: SeasonId | "*";
  trigger: EventTrigger;
  choices: EventChoice[];
  historicalDate?: string;
  tags: string[];
  playerOnly?: boolean;
  cooldownWeeks?: number;
}

export interface Effect {
  op:
    | "add_stock"
    | "mul_stock"
    | "add_stability"
    | "add_ws"
    | "add_tension"
    | "declare_war"
    | "white_peace"
    | "transfer_region"
    | "add_spirit"
    | "remove_spirit"
    | "add_flag"
    | "join_faction"
    | "puppet"
    | "start_focus";
  target?: CountryId | "player" | "this";
  key?: string;
  value?: number;
  region?: RegionId;
  other?: CountryId;
}

export interface EndingContext {
  state: GameState;
  player: NationState;
  season: SeasonDefinition;
}

export interface EndingArchetype {
  id: EndingId;
  priority: number;
  multiplier: number;
  titleKey: string;
  templateKey: string;
}

export interface SeasonDefinition {
  id: SeasonId;
  titleKey: string;
  blurbKey: string;
  start: string; // "1936-03-01"
  end: string; // "1948-12-31"
  tensionSchedule: { at: string; value: number }[];
  countrySetup: string;
  regionSetup: string;
  eventPack: string[];
}

export interface Rng {
  next(): number;
}

export interface WorldView {
  resourceBase: Record<CountryId, ResourceStocks>;
}

export interface GameDate {
  year: number;
  month: number;
  day: number;
}
