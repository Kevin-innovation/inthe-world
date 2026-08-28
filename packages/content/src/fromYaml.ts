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
