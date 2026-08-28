import {
  applyEventChoice,
  autoResolve,
  createRng,
  findEvent,
  tick,
  type GameState,
  type WorldView,
} from "@simul/sim";

export function applyCatchupTicks(
  state: GameState,
  weeks: number,
  world: WorldView,
): { state: GameState; interrupted: boolean } {
  let current = state;
  let interrupted = false;
  for (let i = 0; i < weeks; i++) {
    const rng = createRng(current.seed, current.rngCursor);
    let result = tick(current, 1, world, rng);
    if (result.interrupted && result.state.pendingEvent) {
      const pending = result.state.pendingEvent;
      const def = findEvent(world.events, pending.eventId);
      const nation = result.state.nations[pending.countryId];
      if (def && nation) {
        const choice = autoResolve(
          def,
          nation.policies,
          nation.stocks.politicalPower,
        );
        result = {
          ...result,
          ...applyEventChoice(result.state, def, pending.countryId, choice.id, {
            autoForPlayer: nation.isPlayer,
          }),
          interrupted: false,
          interruptReason: undefined,
        };
      } else {
        interrupted = true;
        current = result.state;
        break;
      }
    }
    current = result.state;
    if (result.interrupted) {
      interrupted = true;
      break;
    }
    if (current.status === "ended") break;
  }
  return { state: current, interrupted };
}
