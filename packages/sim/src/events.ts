import type {
  ChronicleEntry,
  CountryId,
  Doctrine,
  Effect,
  EventChoice,
  EventDefinition,
  EventTrigger,
  FactionId,
  GameDate,
  GameState,
  NationState,
  NationStocks,
  PolicySliders,
  TickResult,
  WorldView,
} from "./types";

const CHRONICLE_CAP = 250;
const AFK_RISK = 0.15;
const HIGH_RISK = 0.8;
const FACTIONS: ReadonlySet<FactionId> = new Set([
  "status_quo",
  "revisionist",
  "revolutionary",
  "nonaligned",
]);

export const FIRED_FLAG_PREFIX = "evt_";

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

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

function flagSet(
  flags: Record<string, boolean | number>,
  key: string,
): boolean {
  const value = flags[key];
  if (value === true) return true;
  return typeof value === "number" && value !== 0;
}

export function isoDate(date: GameDate): string {
  const month = date.month < 10 ? `0${date.month}` : `${date.month}`;
  const day = date.day < 10 ? `0${date.day}` : `${date.day}`;
  return `${date.year}-${month}-${day}`;
}

function firedFlag(eventId: string): string {
  return `${FIRED_FLAG_PREFIX}${eventId}`;
}

function pushChronicle(state: GameState, entry: ChronicleEntry): void {
  state.chronicle.push(entry);
  if (state.chronicle.length > CHRONICLE_CAP) {
    state.chronicle.splice(0, state.chronicle.length - CHRONICLE_CAP);
  }
}

function doctrineScalar(doctrine: Doctrine): number {
  if (doctrine === "defense") return 0;
  if (doctrine === "deterrence") return 0.5;
  return 1;
}

function tagVector(
  doctrine: number,
  intervention: number,
  liberty: number,
  risk: number,
): number[] {
  const d = clamp(doctrine, 0, 1);
  const def = d <= 0.25 ? 1 : 0;
  const off = d >= 0.75 ? 1 : 0;
  const det = def === 0 && off === 0 ? 1 : 0;
  return [def, off, det, intervention, liberty, risk];
}

function playerTagVector(policies: PolicySliders): number[] {
  return tagVector(
    doctrineScalar(policies.doctrine),
    policies.intervention / 100,
    policies.liberty / 100,
    AFK_RISK,
  );
}

function choiceTagVector(choice: EventChoice): number[] {
  const tags = choice.tags;
  return tagVector(
    tags.doctrine ?? 0.5,
    tags.intervention ?? 0,
    tags.liberty ?? 0.5,
    tags.risk ?? 0,
  );
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}

function choiceScore(
  choice: EventChoice,
  policies: PolicySliders,
  politicalPower: number,
): number {
  const risk = choice.tags.risk ?? 0;
  const ppPenalty = choice.ppCost > politicalPower ? 10 : 0;
  return cosine(choiceTagVector(choice), playerTagVector(policies)) - 0.35 * risk - ppPenalty;
}

function isHighRisk(choice: EventChoice): boolean {
  return (choice.tags.risk ?? 0) >= HIGH_RISK;
}

export function autoResolve(
  event: EventDefinition,
  policies: PolicySliders,
  politicalPower: number,
): EventChoice {
  const choices = event.choices;
  const first = choices[0];
  if (!first) {
    throw new Error(`error_event_no_choices: ${event.id}`);
  }
  // Never pick risk>=0.8 unless every option is that high; then choices[0] is the fallback.
  const allHigh = choices.every(isHighRisk);
  const pool = allHigh ? [first] : choices.filter((choice) => !isHighRisk(choice));
  const candidates = pool.length > 0 ? pool : [first];
  let best = candidates[0] ?? first;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const choice of candidates) {
    const score = choiceScore(choice, policies, politicalPower);
    if (score > bestScore) {
      best = choice;
      bestScore = score;
    }
  }
  return best;
}

function numericAtom(
  atom: string,
  state: GameState,
  nation: NationState,
): number | undefined {
  if (atom === "stability") return nation.stocks.stability;
  if (atom === "warSupport") return nation.stocks.warSupport;
  if (atom === "politicalPower") return nation.stocks.politicalPower;
  if (atom === "worldTension") return state.worldTension;
  if (atom === "month") return state.date.month;
  if (atom === "debt_ratio") {
    return nation.stocks.debt / Math.max(nation.stocks.gdp, 1);
  }
  if (atom.startsWith("stock.")) {
    const key = atom.slice("stock.".length) as keyof NationStocks;
    const value = nation.stocks[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

function evalCondition(
  expr: string,
  state: GameState,
  nation: NationState,
): boolean {
  const trimmed = expr.trim();
  if (trimmed === "at_war") return nation.atWarWith.length > 0;
  if (trimmed === "!at_war") return nation.atWarWith.length === 0;
  if (trimmed === "alive") return nation.alive;

  let m = /^country==([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (m?.[1]) return nation.id === m[1];
  m = /^country!=([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (m?.[1]) return nation.id !== m[1];

  m = /^!flag\.([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (m?.[1]) return !flagSet(nation.flags, m[1]);
  m = /^flag\.([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (m?.[1]) return flagSet(nation.flags, m[1]);

  m = /^alive\(([A-Za-z][A-Za-z0-9_]*)\)$/.exec(trimmed);
  if (m?.[1]) return Boolean(state.nations[m[1]]?.alive);

  m = /^at_war_with\(([A-Za-z][A-Za-z0-9_]*)\)$/.exec(trimmed);
  if (m?.[1]) return nation.atWarWith.includes(m[1]);

  m = /^owner\(([a-z][a-z0-9_]*)\)==([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (m?.[1] && m[2]) return state.regions[m[1]]?.owner === m[2];
  m = /^owner\(([a-z][a-z0-9_]*)\)!=([A-Za-z][A-Za-z0-9_]*)$/.exec(trimmed);
  if (m?.[1] && m[2]) return state.regions[m[1]]?.owner !== m[2];

  m =
    /^(stability|warSupport|politicalPower|worldTension|month|debt_ratio|stock\.[A-Za-z][A-Za-z0-9]*)(<=|>=|==|<|>)(-?\d+(?:\.\d+)?)$/.exec(
      trimmed,
    );
  if (m?.[1] && m[2] && m[3] !== undefined) {
    const left = numericAtom(m[1], state, nation);
    if (left === undefined) return false;
    const right = Number(m[3]);
    switch (m[2]) {
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      default:
        return left === right;
    }
  }
  return false;
}

function inDateWindow(from: string, to: string | undefined, iso: string): boolean {
  if (iso < from) return false;
  if (to !== undefined && iso > to) return false;
  return true;
}

export function evalTrigger(
  trigger: EventTrigger,
  state: GameState,
  nation: NationState,
): boolean {
  if (trigger.kind === "date") {
    return inDateWindow(trigger.from, trigger.to, isoDate(state.date));
  }
  if (trigger.kind === "condition") {
    return evalCondition(trigger.expr, state, nation);
  }
  if (trigger.kind === "and") {
    return trigger.of.every((child) => evalTrigger(child, state, nation));
  }
  return trigger.of.some((child) => evalTrigger(child, state, nation));
}

function onCooldown(
  nation: NationState,
  event: EventDefinition,
  tickIndex: number,
): boolean {
  const last = flagNumber(nation.flags, firedFlag(event.id));
  if (last === 0 && !flagSet(nation.flags, firedFlag(event.id))) return false;
  if (event.cooldownWeeks === undefined) return true;
  return tickIndex - last < event.cooldownWeeks;
}

export function eventMatches(
  event: EventDefinition,
  state: GameState,
  nation: NationState,
): boolean {
  if (!nation.alive) return false;
  if (event.playerOnly && !nation.isPlayer) return false;
  if (event.season !== "*" && event.season !== state.seasonId) return false;
  if (onCooldown(nation, event, state.tickIndex)) return false;
  return evalTrigger(event.trigger, state, nation);
}

function resolveTarget(
  effect: Effect,
  actingId: CountryId,
  playerId: CountryId,
): CountryId {
  if (!effect.target || effect.target === "this") return actingId;
  if (effect.target === "player") return playerId;
  return effect.target;
}

function addToStock(stocks: NationStocks, key: string, delta: number): void {
  if (!Object.prototype.hasOwnProperty.call(stocks, key)) return;
  const typed = key as keyof NationStocks;
  const cur = stocks[typed];
  if (typeof cur !== "number" || !Number.isFinite(delta)) return;
  stocks[typed] = cur + delta;
}

function mulStock(stocks: NationStocks, key: string, factor: number): void {
  if (!Object.prototype.hasOwnProperty.call(stocks, key)) return;
  const typed = key as keyof NationStocks;
  const cur = stocks[typed];
  if (typeof cur !== "number" || !Number.isFinite(factor)) return;
  stocks[typed] = cur * factor;
}

function declareWar(state: GameState, a: CountryId, b: CountryId): void {
  if (a === b) return;
  const na = state.nations[a];
  const nb = state.nations[b];
  if (!na || !nb || !na.alive || !nb.alive) return;
  if (!na.atWarWith.includes(b)) na.atWarWith.push(b);
  if (!nb.atWarWith.includes(a)) nb.atWarWith.push(a);
  const exists = state.wars.some(
    (war) =>
      (war.a.includes(a) && war.b.includes(b)) ||
      (war.a.includes(b) && war.b.includes(a)),
  );
  if (exists) return;
  state.wars.push({
    id: `w-${a}-${b}-${state.tickIndex}`,
    a: [a],
    b: [b],
    intensity: 1,
    startTick: state.tickIndex,
  });
}

function whitePeace(state: GameState, a: CountryId, b: CountryId): void {
  const na = state.nations[a];
  const nb = state.nations[b];
  if (na) na.atWarWith = na.atWarWith.filter((id) => id !== b);
  if (nb) nb.atWarWith = nb.atWarWith.filter((id) => id !== a);
  state.wars = state.wars.filter(
    (war) =>
      !(
        (war.a.includes(a) && war.b.includes(b)) ||
        (war.a.includes(b) && war.b.includes(a))
      ),
  );
}

function applyEffect(
  state: GameState,
  actingId: CountryId,
  effect: Effect,
): void {
  const targetId = resolveTarget(effect, actingId, state.playerCountryId);
  const nation = state.nations[targetId];
  switch (effect.op) {
    case "add_stock":
      if (nation && effect.key) addToStock(nation.stocks, effect.key, effect.value ?? 0);
      return;
    case "mul_stock":
      if (nation && effect.key) mulStock(nation.stocks, effect.key, effect.value ?? 1);
      return;
    case "add_stability":
      if (nation) {
        nation.stocks.stability = clamp(
          nation.stocks.stability + (effect.value ?? 0),
          0,
          100,
        );
      }
      return;
    case "add_ws":
      if (nation) {
        nation.stocks.warSupport = clamp(
          nation.stocks.warSupport + (effect.value ?? 0),
          0,
          100,
        );
      }
      return;
    case "add_tension":
      state.worldTension = clamp(state.worldTension + (effect.value ?? 0), 0, 100);
      return;
    case "declare_war":
      if (effect.other) declareWar(state, targetId, effect.other);
      return;
    case "white_peace":
      if (effect.other) whitePeace(state, targetId, effect.other);
      return;
    case "transfer_region": {
      if (!effect.region) return;
      const region = state.regions[effect.region];
      if (!region) return;
      region.owner = targetId;
      region.controller = targetId;
      delete region.contestedBy;
      return;
    }
    case "add_spirit":
      if (nation && effect.key && !nation.spirits.includes(effect.key)) {
        nation.spirits.push(effect.key);
      }
      return;
    case "remove_spirit":
      if (nation && effect.key) {
        nation.spirits = nation.spirits.filter((id) => id !== effect.key);
      }
      return;
    case "add_flag":
      if (nation && effect.key) {
        nation.flags[effect.key] = effect.value ?? 1;
      }
      return;
    case "join_faction":
      if (nation && effect.key && FACTIONS.has(effect.key as FactionId)) {
        nation.faction = effect.key as FactionId;
        nation.derived.faction = nation.faction;
      }
      return;
    case "puppet":
      if (nation && effect.other) {
        nation.independent = false;
        nation.overlord = effect.other;
      }
      return;
    case "start_focus":
      if (nation && effect.key) {
        const weeks = Math.max(1, Math.round(effect.value ?? 24));
        nation.focus = { id: effect.key, weeksRemaining: weeks, weeksTotal: weeks };
      }
      return;
  }
}

function eventNewspaper(
  state: GameState,
  event: EventDefinition,
  choice: EventChoice,
  countryId: CountryId,
  kind: "event" | "regency",
): ChronicleEntry {
  if (kind === "regency") {
    return {
      tick: state.tickIndex,
      date: isoDate(state.date),
      kind: "regency",
      titleKey: "chronicle.regency.title",
      bodyKey: "chronicle.regency.body",
      args: {
        eventId: event.id,
        choiceId: choice.id,
        country: countryId,
      },
    };
  }
  return {
    tick: state.tickIndex,
    date: isoDate(state.date),
    kind: "event",
    titleKey: event.titleKey,
    bodyKey: choice.titleKey,
    args: {
      eventId: event.id,
      choiceId: choice.id,
      country: countryId,
      ppCost: choice.ppCost,
    },
  };
}

export function applyEventChoiceInPlace(
  state: GameState,
  event: EventDefinition,
  countryId: CountryId,
  choiceId: string,
  opts?: { autoForPlayer?: boolean },
): ChronicleEntry[] {
  const nation = state.nations[countryId];
  const choice = event.choices.find((row) => row.id === choiceId);
  const papers: ChronicleEntry[] = [];
  if (!nation || !choice) {
    if (state.pendingEvent?.eventId === event.id) delete state.pendingEvent;
    return papers;
  }

  nation.stocks.politicalPower = Math.max(
    0,
    nation.stocks.politicalPower - choice.ppCost,
  );
  for (const effect of choice.effects) {
    applyEffect(state, countryId, effect);
  }
  nation.flags[firedFlag(event.id)] = state.tickIndex;
  if (state.pendingEvent?.eventId === event.id && state.pendingEvent.countryId === countryId) {
    delete state.pendingEvent;
  }

  const entry = eventNewspaper(state, event, choice, countryId, "event");
  papers.push(entry);
  pushChronicle(state, entry);
  if (opts?.autoForPlayer && nation.isPlayer) {
    const regency = eventNewspaper(state, event, choice, countryId, "regency");
    papers.push(regency);
    pushChronicle(state, regency);
  }
  return papers;
}

export function applyEventChoice(
  state: GameState,
  event: EventDefinition,
  countryId: CountryId,
  choiceId: string,
): { state: GameState; newspapers: ChronicleEntry[] } {
  const next = cloneState(state);
  const newspapers = applyEventChoiceInPlace(next, event, countryId, choiceId);
  return { state: next, newspapers };
}

export function findEvent(
  events: readonly EventDefinition[] | undefined,
  eventId: string,
): EventDefinition | undefined {
  return events?.find((row) => row.id === eventId);
}

export function applyPendingChoice(
  state: GameState,
  world: WorldView,
  choiceId: string,
): { state: GameState; newspapers: ChronicleEntry[]; error?: string } {
  const pending = state.pendingEvent;
  if (!pending) {
    return { state: cloneState(state), newspapers: [], error: "no_pending" };
  }
  const event = findEvent(world.events, pending.eventId);
  if (!event) {
    return { state: cloneState(state), newspapers: [], error: "unknown_event" };
  }
  if (!event.choices.some((row) => row.id === choiceId)) {
    return { state: cloneState(state), newspapers: [], error: "unknown_choice" };
  }
  return applyEventChoice(state, event, pending.countryId, choiceId);
}

function resolvePendingAfk(state: GameState, world: WorldView): ChronicleEntry[] {
  const pending = state.pendingEvent;
  if (!pending) return [];
  const event = findEvent(world.events, pending.eventId);
  const nation = state.nations[pending.countryId];
  if (!event || !nation) {
    delete state.pendingEvent;
    return [];
  }
  const choice = autoResolve(event, nation.policies, nation.stocks.politicalPower);
  return applyEventChoiceInPlace(state, event, pending.countryId, choice.id, {
    autoForPlayer: nation.isPlayer,
  });
}

function nationIdsForEvents(state: GameState): CountryId[] {
  const ids = Object.keys(state.nations).sort();
  const ai: CountryId[] = [];
  const players: CountryId[] = [];
  for (const id of ids) {
    const nation = state.nations[id];
    if (!nation) continue;
    if (nation.isPlayer) players.push(id);
    else ai.push(id);
  }
  return [...ai, ...players];
}

export function runEventPhase(
  state: GameState,
  world: WorldView,
): {
  newspapers: ChronicleEntry[];
  interrupted: boolean;
  interruptReason?: TickResult["interruptReason"];
} {
  const newspapers: ChronicleEntry[] = [];
  const events = world.events ?? [];
  if (events.length === 0) {
    return { newspapers, interrupted: false };
  }

  const pause = world.regencyPause === true;
  if (state.pendingEvent && pause) {
    return { newspapers, interrupted: true, interruptReason: "event" };
  }
  if (state.pendingEvent && !pause) {
    newspapers.push(...resolvePendingAfk(state, world));
  }

  for (const countryId of nationIdsForEvents(state)) {
    const nation = state.nations[countryId];
    if (!nation || !nation.alive) continue;
    for (const event of events) {
      if (!eventMatches(event, state, nation)) continue;
      if (nation.isPlayer && pause) {
        nation.flags[firedFlag(event.id)] = state.tickIndex;
        state.pendingEvent = { eventId: event.id, countryId };
        return { newspapers, interrupted: true, interruptReason: "event" };
      }
      const choice = autoResolve(
        event,
        nation.policies,
        nation.stocks.politicalPower,
      );
      newspapers.push(
        ...applyEventChoiceInPlace(state, event, countryId, choice.id, {
          autoForPlayer: nation.isPlayer,
        }),
      );
      break;
    }
  }

  return { newspapers, interrupted: false };
}
