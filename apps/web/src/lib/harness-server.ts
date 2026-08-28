import { loadComingStormPack } from "@simul/content/load";
import {
  loadSeason,
  seedFrom,
  type GameState,
  type WorldView,
} from "@simul/sim";

const HARNESS_SEED = seedFrom("dev-harness", "the_coming_storm");

export function createHarnessSession(): { state: GameState; world: WorldView } {
  const pack = loadComingStormPack();
  const loaded = loadSeason(pack, {
    saveId: "dev-harness",
    seed: HARNESS_SEED,
    playerCountryId: "GER",
  });
  return {
    state: loaded.state,
    world: { ...loaded.world, regencyPause: true },
  };
}
