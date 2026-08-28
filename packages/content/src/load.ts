import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  countriesFileSchema,
  eventsFileSchema,
  regionsFileSchema,
  seasonDefinitionSchema,
  seasonPackSchema,
  type SeasonPack,
} from "./schema";

export function parseYaml(text: string): unknown {
  return parse(text) as unknown;
}

export function seasonPackFromYaml(args: {
  seasonYaml: string;
  countriesYaml: string;
  regionsYaml?: string;
  eventsYamls?: string[];
}): SeasonPack {
  const season = seasonDefinitionSchema.parse(parseYaml(args.seasonYaml));
  const countries = countriesFileSchema.parse(parseYaml(args.countriesYaml));
  const regions =
    args.regionsYaml === undefined
      ? []
      : regionsFileSchema.parse(parseYaml(args.regionsYaml));
  const events = (args.eventsYamls ?? []).flatMap((text) =>
    eventsFileSchema.parse(parseYaml(text)),
  );
  return seasonPackSchema.parse({ ...season, countries, regions, events });
}

function readEventYamls(root: string, eventPack: string[]): string[] {
  return eventPack.map((rel) => readFileSync(join(root, ...rel.split("/")), "utf8"));
}

export function loadSeasonPackFromFiles(paths: {
  seasonPath: string;
  countriesPath: string;
  regionsPath?: string;
  contentRoot?: string;
}): SeasonPack {
  const seasonYaml = readFileSync(paths.seasonPath, "utf8");
  const season = seasonDefinitionSchema.parse(parseYaml(seasonYaml));
  const countriesYaml = readFileSync(paths.countriesPath, "utf8");
  const regionsYaml = paths.regionsPath
    ? readFileSync(paths.regionsPath, "utf8")
    : undefined;
  const root = paths.contentRoot ?? contentRoot();
  return seasonPackFromYaml({
    seasonYaml,
    countriesYaml,
    regionsYaml,
    eventsYamls: readEventYamls(root, season.eventPack),
  });
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
    contentRoot: root,
  });
}
