import { describe, expect, it } from "vitest";
import { loadComingStormBaselines } from "@simul/content/load";
import {
  makeTwoNationState,
  resolveEnding,
  scoreRun,
  SEASON_WEEKS_THE_COMING_STORM,
  type GameState,
  type NationState,
} from "../src/index";

function nation(state: GameState, id: string): NationState {
  const row = state.nations[id];
  if (!row) throw new Error(`missing ${id}`);
  return row;
}

function makeUsaHistoricalAfk(): GameState {
  const state = makeTwoNationState(7);
  state.playerCountryId = "USA";
  const usa = nation(state, "USA");
  const eth = nation(state, "ETH");
  usa.alive = true;
  usa.independent = true;
  usa.stocks.gdp = 1600;
  usa.stocks.civFactories = 160;
  usa.stocks.milFactories = 35;
  usa.stocks.stability = 80;
  usa.derived.forceProjection = 40;
  usa.runStats.weeksAlive = SEASON_WEEKS_THE_COMING_STORM;
  usa.runStats.peakStability = 80;
  usa.runStats.troughStability = 72;
  usa.runStats.hadCapitulated = false;
  usa.runStats.hadRevolution = false;
  usa.runStats.achievements = [];
  eth.alive = true;
  eth.derived.forceProjection = 4;
  eth.stocks.gdp = 40;
  state.tickIndex = SEASON_WEEKS_THE_COMING_STORM;
  state.date = { year: 1948, month: 12, day: 31 };
  return state;
}

function makeEthMiracle(): GameState {
  const state = makeTwoNationState(7);
  state.playerCountryId = "ETH";
  const usa = nation(state, "USA");
  const eth = nation(state, "ETH");
  usa.isPlayer = false;
  eth.isPlayer = true;
  eth.alive = true;
  eth.independent = true;
  eth.stocks.gdp = 40;
  eth.stocks.civFactories = 12;
  eth.stocks.milFactories = 4;
  eth.stocks.stability = 55;
  eth.derived.forceProjection = 5;
  eth.runStats.weeksAlive = SEASON_WEEKS_THE_COMING_STORM;
  eth.runStats.peakStability = 55;
  eth.runStats.troughStability = 10;
  eth.runStats.hadCapitulated = false;
  eth.runStats.hadRevolution = false;
  eth.runStats.achievements = [];
  usa.alive = true;
  usa.independent = true;
  usa.stocks.gdp = 1600;
  usa.derived.forceProjection = 40;
  state.tickIndex = SEASON_WEEKS_THE_COMING_STORM;
  state.date = { year: 1948, month: 12, day: 31 };
  return state;
}

describe("baseline-relative score", () => {
  it("ETH miracle survivor/phoenix beats USA historical AFK hegemon", () => {
    const baselines = loadComingStormBaselines();
    const usaState = makeUsaHistoricalAfk();
    const ethState = makeEthMiracle();

    expect(resolveEnding(usaState, "USA").id).toBe("hegemon");
    expect(["survivor", "phoenix"]).toContain(resolveEnding(ethState, "ETH").id);

    const usa = scoreRun(usaState, "USA", {
      baselineComposite: baselines.USA ?? 0,
      seasonWeeks: SEASON_WEEKS_THE_COMING_STORM,
    });
    const eth = scoreRun(ethState, "ETH", {
      baselineComposite: baselines.ETH ?? 0,
      seasonWeeks: SEASON_WEEKS_THE_COMING_STORM,
    });

    expect(usa.rel).toBeCloseTo(1, 1);
    expect(eth.rel).toBeGreaterThan(1);
    expect(usa.achIndex).toBe(0);
    expect(eth.achIndex).toBe(0);
    expect(eth.performance).toBeGreaterThan(usa.performance);
  });
});
