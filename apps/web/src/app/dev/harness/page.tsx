import { HqHarness } from "@/components/hq/HqHarness";
import { createHarnessSession } from "@/lib/harness-server";

export const runtime = "nodejs";

export default function HarnessPage() {
  const { state, world } = createHarnessSession();
  return <HqHarness initialState={state} world={world} />;
}
