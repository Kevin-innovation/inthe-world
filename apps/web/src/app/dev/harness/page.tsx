import { HqHarness } from "@/components/hq/HqHarness";
import { readRunCookie } from "@/lib/guest-cookie";
import { createHarnessSession } from "@/lib/harness-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HarnessPage() {
  const run = await readRunCookie();
  const { state, world } = createHarnessSession(run);
  return <HqHarness initialState={state} world={world} />;
}
