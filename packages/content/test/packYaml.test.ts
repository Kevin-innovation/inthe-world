import { describe, expect, it } from "vitest";
import {
  countriesYaml,
  eventsYamls,
  regionsYaml,
  seasonYaml,
} from "../../../convex/packYaml";
import { seasonPackFromYaml } from "../src/fromYaml";
import { loadComingStormPack } from "../src/load";

describe("Convex embedded YAML", () => {
  it("matches the coming-storm pack on disk", () => {
    expect(
      seasonPackFromYaml({
        seasonYaml,
        countriesYaml,
        regionsYaml,
        eventsYamls,
      }),
    ).toEqual(loadComingStormPack());
  });
});
