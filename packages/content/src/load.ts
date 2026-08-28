import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  baselinesFileSchema,
  seasonDefinitionSchema,
  type BaselinesFile,
  type SeasonPack,
} from "./schema";
import { parseYaml, seasonPackFromYaml } from "./fromYaml";

export { parseYaml, seasonPackFromYaml } from "./fromYaml";

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

function looksLikeContentRoot(dir: string): boolean {
  return existsSync(join(dir, "seasons", "the_coming_storm.yaml"));
}

export function contentRoot(): string {
  const fromMeta = join(dirname(fileURLToPath(import.meta.url)), "..");
  if (looksLikeContentRoot(fromMeta)) return fromMeta;
  // Next may bundle this file away from packages/content; walk from cwd.
  const cwd = process.cwd();
  const candidates = [
    join(cwd, "packages", "content"),
    join(cwd, "..", "packages", "content"),
    join(cwd, "..", "..", "packages", "content"),
  ];
  for (const dir of candidates) {
    if (looksLikeContentRoot(dir)) return dir;
  }
  return fromMeta;
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
