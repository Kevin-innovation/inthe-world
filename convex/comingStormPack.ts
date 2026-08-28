import { seasonPackFromYaml } from "../packages/content/src/fromYaml";
import type { SeasonPack } from "../packages/content/src/schema";
import {
  countriesYaml,
  eventsYamls,
  regionsYaml,
  seasonYaml,
} from "./packYaml";

export function loadComingStormPack(): SeasonPack {
  return seasonPackFromYaml({
    seasonYaml,
    countriesYaml,
    regionsYaml,
    eventsYamls,
  });
}
