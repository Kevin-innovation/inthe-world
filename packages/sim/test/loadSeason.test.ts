import { describe, expect, it } from "vitest";
import { contentHash } from "@simul/content";
import { loadComingStormPack } from "@simul/content/load";
import type { SeasonPack } from "@simul/content";
import {
  createRng,
  loadSeason,
  makeTwoNationState,
  tick,
  twoNationWorld,
} from "../src/index";

function clonePack(pack: SeasonPack): SeasonPack {
  return JSON.parse(JSON.stringify(pack)) as SeasonPack;
}

describe("loadSeason", () => {
  it("loads at least four countries and records a stable contentHash", () => {
    const pack = loadComingStormPack();
    const opts = { saveId: "s1", seed: 1, playerCountryId: "USA" as const };
    const a = loadSeason(pack, opts);
    const b = loadSeason(clonePack(pack), opts);

    expect(Object.keys(a.state.nations).length).toBeGreaterThanOrEqual(4);
    expect(a.state.nations.USA).toBeDefined();
    expect(a.state.nations.ETH).toBeDefined();
    expect(a.state.nations.GER).toBeDefined();
    expect(a.state.nations.ENG).toBeDefined();
    expect(a.state.contentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(a.state.contentHash).toBe(b.state.contentHash);
    expect(a.state.contentHash).toBe(contentHash(pack));
    expect(a.state.tickIndex).toBe(0);
    expect(a.state.rngCursor).toBe(0);
    expect(a.state.date).toEqual({ year: 1936, month: 3, day: 1 });
    expect(a.state.seasonId).toBe("the_coming_storm");
    expect(a.world.resourceBase.USA).toEqual(twoNationWorld().resourceBase.USA);
    expect(a.world.resourceBase.ETH).toEqual(twoNationWorld().resourceBase.ETH);
  });

  it("changes contentHash when a civFactories value changes", () => {
    const pack = loadComingStormPack();
    const opts = { saveId: "s1", seed: 1, playerCountryId: "USA" as const };
    const mutated = clonePack(pack);
    const usa = mutated.countries.find((row) => row.id === "USA");
    if (!usa) throw new Error("missing USA");
    usa.stocks.civFactories += 1;

    const originalHash = loadSeason(pack, opts).state.contentHash;
    const mutatedHash = loadSeason(mutated, opts).state.contentHash;
    expect(mutatedHash).not.toBe(originalHash);
    expect(loadSeason(pack, opts).state.contentHash).toBe(originalHash);
  });

  it("matches PR1 USA/ETH starting stocks", () => {
    const pack = loadComingStormPack();
    const loaded = loadSeason(pack, {
      saveId: "test-two-nations",
      seed: 1,
      playerCountryId: "USA",
    });
    const fixture = makeTwoNationState(1);
    const loadedUsa = loaded.state.nations.USA;
    const loadedEth = loaded.state.nations.ETH;
    const fixtureUsa = fixture.nations.USA;
    const fixtureEth = fixture.nations.ETH;
    if (!loadedUsa || !loadedEth || !fixtureUsa || !fixtureEth) {
      throw new Error("missing nations");
    }
    expect(loadedUsa.stocks).toEqual(fixtureUsa.stocks);
    expect(loadedEth.stocks).toEqual(fixtureEth.stocks);
    expect(loadedUsa.policies).toEqual(fixtureUsa.policies);
    expect(loadedEth.policies).toEqual(fixtureEth.policies);
  });

  it("ticks one week without throwing and USA gdp stays above ETH", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "s1",
      seed: 1,
      playerCountryId: "USA",
    });
    const after = tick(state, 1, world, createRng(state.seed, state.rngCursor))
      .state;
    const usa = after.nations.USA;
    const eth = after.nations.ETH;
    if (!usa || !eth) throw new Error("missing nations");
    expect(usa.stocks.gdp).toBeGreaterThan(eth.stocks.gdp);
    expect(after.tickIndex).toBe(1);
    expect(after.contentHash).toBe(state.contentHash);
  });

  it("throws when the player country is not in the pack", () => {
    const pack = loadComingStormPack();
    expect(() =>
      loadSeason(pack, {
        saveId: "s1",
        seed: 1,
        playerCountryId: "NOPE",
      }),
    ).toThrow(/error_load_unknown_country: NOPE/);
  });

  it("does not alias WorldView resource bases onto the pack tables", () => {
    const pack = loadComingStormPack();
    const { world } = loadSeason(pack, {
      saveId: "s1",
      seed: 1,
      playerCountryId: "USA",
    });
    const usaRow = pack.countries.find((row) => row.id === "USA");
    const usaBase = world.resourceBase.USA;
    if (!usaRow || !usaBase) throw new Error("missing USA");
    expect(usaBase).not.toBe(usaRow.base);
    usaBase.food += 1;
    expect(usaRow.base.food).toBe(90);
  });
});
