import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadSeasonPackFromFiles, seasonPackFromYaml } from "../src/load";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("YAML string loader", () => {
  it("parses the_coming_storm from strings and files", () => {
    const seasonPath = join(root, "seasons", "the_coming_storm.yaml");
    const countriesPath = join(root, "countries", "1936.yaml");
    const regionsPath = join(root, "regions", "1936.yaml");
    const fromFiles = loadSeasonPackFromFiles({
      seasonPath,
      countriesPath,
      regionsPath,
      contentRoot: root,
    });
    const histYaml = readFileSync(join(root, "events", "1936_hist.yaml"), "utf8");
    const procYaml = readFileSync(join(root, "events", "procedural.yaml"), "utf8");
    const fromStrings = seasonPackFromYaml({
      seasonYaml: readFileSync(seasonPath, "utf8"),
      countriesYaml: readFileSync(countriesPath, "utf8"),
      regionsYaml: readFileSync(regionsPath, "utf8"),
      eventsYamls: [histYaml, procYaml],
    });
    expect(fromFiles).toEqual(fromStrings);
    expect(fromFiles.countries.length).toBeGreaterThanOrEqual(4);
    expect(fromFiles.events.length).toBeGreaterThanOrEqual(13);
  });
});
