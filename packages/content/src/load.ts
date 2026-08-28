import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  baselinesFileSchema,
  countriesFileSchema,
  regionsFileSchema,
  seasonDefinitionSchema,
  seasonPackSchema,
  type BaselinesFile,
  type SeasonPack,
} from "./schema";

export function parseYaml(text: string): unknown {
  return parse(text) as unknown;
}

export function seasonPackFromYaml(args: {
  seasonYaml: string;
  countriesYaml: string;
  regionsYaml?: string;
}): SeasonPack {
  const season = seasonDefinitionSchema.parse(parseYaml(args.seasonYaml));
  const countries = countriesFileSchema.parse(parseYaml(args.countriesYaml));
  const regions =
    args.regionsYaml === undefined
      ? []
      : regionsFileSchema.parse(parseYaml(args.regionsYaml));
  return seasonPackSchema.parse({ ...season, countries, regions });
}

export function loadSeasonPackFromFiles(paths: {
  seasonPath: string;
  countriesPath: string;
  regionsPath?: string;
}): SeasonPack {
  const seasonYaml = readFileSync(paths.seasonPath, "utf8");
  const countriesYaml = readFileSync(paths.countriesPath, "utf8");
  const regionsYaml = paths.regionsPath
    ? readFileSync(paths.regionsPath, "utf8")
    : undefined;
  return seasonPackFromYaml({ seasonYaml, countriesYaml, regionsYaml });
}

export function contentRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export function loadComingStormPack(): SeasonPack {
  const root = contentRoot();
  const seasonPath = join(root, "seasons", "the_coming_storm.yaml");
  const seasonYaml = readFileSync(seasonPath, "utf8");
  const season = seasonDefinitionSchema.parse(parseYaml(seasonYaml));
  return loadSeasonPackFromFiles({
    seasonPath,
    countriesPath: join(root, ...season.countrySetup.split("/")),
    regionsPath: join(root, ...season.regionSetup.split("/")),
  });
}

export function loadComingStormBaselines(): Record<string, number> {
  const root = contentRoot();
  const raw = parseYaml(
    readFileSync(join(root, "baselines", "the_coming_storm.yaml"), "utf8"),
  );
  const parsed: BaselinesFile = baselinesFileSchema.parse(raw);
  const out: Record<string, number> = {};
  for (const [id, row] of Object.entries(parsed)) {
    out[id] = row.baselineComposite;
  }
  return out;
}
