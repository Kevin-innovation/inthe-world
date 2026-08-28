import { describe, expect, it } from "vitest";
import {
  makeTwoNationState,
  resolveEnding,
  type GameState,
  type NationState,
  type RegionState,
} from "../src/index";

function nation(state: GameState, id: string): NationState {
  const row = state.nations[id];
  if (!row) throw new Error(`missing ${id}`);
  return row;
}

function paintOwned(
  state: GameState,
  owner: string,
  count: number,
  capitalOwned: boolean,
): void {
  const cap = nation(state, owner).capitalRegion;
  if (capitalOwned) {
    state.regions[cap] = {
      id: cap,
      owner,
      controller: owner,
      terrain: "plains",
      coastal: false,
      factoryDamage: 0,
    };
  }
  const extra = capitalOwned ? count - 1 : count;
  for (let i = 0; i < extra; i++) {
    const id = `${owner}_land_${i}`;
    const region: RegionState = {
      id,
      owner,
      controller: owner,
      terrain: "plains",
      coastal: false,
      factoryDamage: 0,
    };
    state.regions[id] = region;
  }
}

describe("resolveEnding predicates", () => {
  it("annexed when the nation is dead without an H3/H4 cause", () => {
    const state = makeTwoNationState(1);
    const usa = nation(state, "USA");
    usa.alive = false;
    expect(resolveEnding(state, "USA").id).toBe("annexed");
  });

  it("collapse when failed-state economic spiral still registers as alive", () => {
    const state = makeTwoNationState(1);
    const usa = nation(state, "USA");
    usa.alive = true;
    usa.flags.failedState = 1;
    usa.stocks.stability = 5;
    usa.stocks.inflation = 40;
    usa.stocks.gdp = 100;
    usa.runStats.peakGdp = 1000;
    expect(resolveEnding(state, "USA").id).toBe("collapse");
  });

  it("revolution beats phoenix when hadRevolution and stability holds", () => {
    const state = makeTwoNationState(1);
    const usa = nation(state, "USA");
    usa.runStats.hadRevolution = true;
    usa.flags.hadRevolution = 1;
    usa.alive = true;
    usa.independent = true;
    usa.stocks.stability = 40;
    usa.runStats.troughStability = 8;
    expect(resolveEnding(state, "USA").id).toBe("revolution");
  });

  it("client_state when alive under an overlord", () => {
    const state = makeTwoNationState(1);
    const eth = nation(state, "ETH");
    eth.alive = true;
    eth.independent = false;
    eth.overlord = "ITA";
    expect(resolveEnding(state, "ETH").id).toBe("client_state");
  });

  it("rump_state when independent but below 40% of start regions", () => {
    const state = makeTwoNationState(1);
    const usa = nation(state, "USA");
    usa.alive = true;
    usa.independent = true;
    usa.runStats.startRegions = 10;
    paintOwned(state, "USA", 3, true);
    expect(resolveEnding(state, "USA").id).toBe("rump_state");
  });

  it("phoenix after a trough without a revolution flag", () => {
    const state = makeTwoNationState(1);
    const eth = nation(state, "ETH");
    eth.alive = true;
    eth.independent = true;
    eth.stocks.stability = 50;
    eth.runStats.troughStability = 10;
    eth.runStats.startRegions = 5;
    paintOwned(state, "ETH", 4, true);
    expect(resolveEnding(state, "ETH").id).toBe("phoenix");
  });

  it("hegemon for an intact great power ranked on force and gdp", () => {
    const state = makeTwoNationState(1);
    const usa = nation(state, "USA");
    const eth = nation(state, "ETH");
    usa.alive = true;
    usa.independent = true;
    usa.derived.forceProjection = 40;
    usa.stocks.gdp = 1600;
    usa.runStats.hadCapitulated = false;
    eth.alive = true;
    eth.derived.forceProjection = 4;
    eth.stocks.gdp = 40;
    expect(resolveEnding(state, "USA").id).toBe("hegemon");
  });

  it("survivor is the independent alive fallback", () => {
    const state = makeTwoNationState(1);
    const eth = nation(state, "ETH");
    eth.alive = true;
    eth.independent = true;
    eth.stocks.stability = 40;
    eth.runStats.troughStability = 40;
    eth.derived.forceProjection = 1;
    expect(resolveEnding(state, "ETH").id).toBe("survivor");
  });
});
