import { loadComingStormPack } from "@simul/content/load";
import {
  applyFateSpends,
  countryWeights,
  loadSeason,
  seedFrom,
  type GameState,
  type WorldView,
} from "@simul/sim";
import type { LocalRun } from "./guest-cookie";

const HARNESS_SEED = seedFrom("dev-harness", "the_coming_storm");

export function createHarnessSession(run?: LocalRun | null): {
  state: GameState;
  world: WorldView;
} {
  const pack = loadComingStormPack();
  const countryId = run?.countryId ?? "GER";
  const loaded = loadSeason(pack, {
    saveId: run?.saveId ?? "dev-harness",
    seed: run?.seed ?? HARNESS_SEED,
    playerCountryId: countryId,
  });
  if (run) {
    const fate = applyFateSpends(
      loaded.state,
      countryId,
      countryWeights(pack.countries),
      {
        civDelta: run.civDelta,
        milDelta: run.milDelta,
        spiritId: run.spiritId,
      },
    );
    if (!fate.error) loaded.state = fate.state;
  }
  return {
    state: loaded.state,
    world: { ...loaded.world, regencyPause: true },
  };
}
