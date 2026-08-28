import {
  compositeOf,
  endingMultiplier,
  resolveEnding,
} from "./endings";
import type {
  CountryId,
  EndingResolution,
  GameState,
  NationState,
} from "./types";

export const SEASON_WEEKS_THE_COMING_STORM = 671;

const MAX_ACHIEVEMENT_WEIGHT = 10;

const ACHIEVEMENT_WEIGHT: Readonly<Record<string, number>> = {
  intact_borders: 1,
  no_capitulation: 1,
  balanced_books: 1,
  bread_not_guns: 1,
  underdog: 1,
  focus_done: 1,
  stable_hand: 1,
  war_winner: 1,
  peacemaker: 1,
  industrial_miracle: 1,
};

export interface ScoreRunOpts {
  baselineComposite: number;
  seasonWeeks?: number;
  ending?: EndingResolution;
}

export interface ScoreBreakdown {
  ending: EndingResolution;
  composite: number;
  rel: number;
  logRel: number;
  survival: number;
  stabTerm: number;
  achIndex: number;
  dramaBonus: number;
  scoreRaw: number;
  endingMult: number;
  performance: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function achIndexOf(nation: NationState): number {
  const ids = nation.runStats.achievements;
  if (ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) {
    sum += ACHIEVEMENT_WEIGHT[id] ?? 0;
  }
  return sum / MAX_ACHIEVEMENT_WEIGHT;
}

function dramaBonusOf(
  nation: NationState,
  composite: number,
  endingId: EndingResolution["id"],
): number {
  if (endingId === "phoenix") return 0.6;
  if (nation.runStats.hadCapitulated && nation.alive) return 0.4;
  const storedPeak = nation.runStats.peakComposite;
  const storedTrough = nation.runStats.troughComposite;
  const peak =
    storedPeak === undefined ? composite : Math.max(storedPeak, composite);
  const trough =
    storedTrough === undefined
      ? composite
      : Math.min(storedTrough, composite);
  const swing = clamp((peak - trough) / Math.max(peak, 1), 0, 1);
  return 0.2 * swing;
}

export function scoreRun(
  state: GameState,
  playerId: CountryId,
  opts: ScoreRunOpts,
): ScoreBreakdown {
  const player = state.nations[playerId];
  if (!player) {
    throw new Error(`error_score_unknown_country: ${playerId}`);
  }
  const ending = opts.ending ?? resolveEnding(state, playerId);
  const composite = compositeOf(player, state);
  const baseline = Math.max(opts.baselineComposite, 1e-6);
  const rel = composite / baseline;
  const logRel = Math.log2(1 + rel);
  const seasonWeeks = Math.max(
    opts.seasonWeeks ?? SEASON_WEEKS_THE_COMING_STORM,
    1,
  );
  const survival = clamp(player.runStats.weeksAlive / seasonWeeks, 0, 1);
  const stabTerm = clamp(player.runStats.peakStability / 100, 0, 1.5);
  const achIndex = achIndexOf(player);
  const dramaBonus = dramaBonusOf(player, composite, ending.id);
  const scoreRaw =
    0.42 * logRel +
    0.22 * survival +
    0.14 * stabTerm +
    0.12 * achIndex +
    0.1 * dramaBonus;
  const endingMult = endingMultiplier(ending.id);
  const performance = Math.round(1000 * scoreRaw * endingMult);
  return {
    ending: { ...ending, score: performance },
    composite,
    rel,
    logRel,
    survival,
    stabTerm,
    achIndex,
    dramaBonus,
    scoreRaw,
    endingMult,
    performance,
  };
}
