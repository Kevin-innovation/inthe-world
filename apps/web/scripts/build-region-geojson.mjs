/**
 * Maps Natural Earth 110m countries onto Coming Storm region ids and
 * writes a compact MultiPolygon FeatureCollection.
 *
 * Usage: node apps/web/scripts/build-region-geojson.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = path.join(root, "scripts", "ne_110m_admin_0_countries.geojson");
const outPath = path.join(root, "src", "lib", "coming-storm.geo.json");
const NE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const REGION_IDS = [
  "britain",
  "ireland",
  "france_north",
  "france_south",
  "low_countries",
  "rhineland",
  "germany_north",
  "germany_south",
  "austria",
  "czechoslovakia",
  "poland",
  "hungary",
  "romania",
  "yugoslavia",
  "greece",
  "italy_north",
  "italy_south",
  "iberia",
  "scandinavia",
  "finland",
  "baltics",
  "european_russia",
  "ukraine",
  "belarus",
  "anatolia",
  "caucasus",
  "levant",
  "arabia",
  "persia",
  "egypt_suez",
  "maghreb",
  "libya",
  "siberia",
  "central_asia",
  "manchuria",
  "korea",
  "japan_home",
  "north_china",
  "south_china",
  "indochina",
  "siam",
  "india_north",
  "india_south",
  "indonesia",
  "philippines",
  "malaya",
  "burma",
  "mongolia",
  "west_africa",
  "horn_africa",
  "central_africa",
  "southern_africa",
  "east_africa",
  "madagascar",
  "us_east",
  "us_west",
  "canada",
  "mexico",
  "caribbean_central",
  "brazil",
  "southern_cone",
  "andes",
  "australia",
  "pacific_islands",
];

/** Whole-country ADM0_A3 → region. Split countries are handled separately. */
const WHOLE = {
  GBR: "britain",
  IRL: "ireland",
  NLD: "low_countries",
  BEL: "low_countries",
  LUX: "low_countries",
  AUT: "austria",
  CZE: "czechoslovakia",
  SVK: "czechoslovakia",
  POL: "poland",
  HUN: "hungary",
  ROU: "romania",
  BGR: "romania",
  SVN: "yugoslavia",
  HRV: "yugoslavia",
  BIH: "yugoslavia",
  SRB: "yugoslavia",
  MNE: "yugoslavia",
  MKD: "yugoslavia",
  KOS: "yugoslavia",
  GRC: "greece",
  ALB: "greece",
  ESP: "iberia",
  PRT: "iberia",
  SWE: "scandinavia",
  NOR: "scandinavia",
  DNK: "scandinavia",
  ISL: "scandinavia",
  FIN: "finland",
  EST: "baltics",
  LVA: "baltics",
  LTU: "baltics",
  UKR: "ukraine",
  MDA: "ukraine",
  BLR: "belarus",
  TUR: "anatolia",
  CYP: "anatolia",
  CYN: "anatolia",
  GEO: "caucasus",
  ARM: "caucasus",
  AZE: "caucasus",
  SYR: "levant",
  LBN: "levant",
  ISR: "levant",
  PSX: "levant",
  JOR: "levant",
  IRQ: "levant",
  SAU: "arabia",
  YEM: "arabia",
  OMN: "arabia",
  ARE: "arabia",
  QAT: "arabia",
  KWT: "arabia",
  IRN: "persia",
  AFG: "persia",
  EGY: "egypt_suez",
  SDN: "egypt_suez",
  SDS: "egypt_suez",
  MAR: "maghreb",
  DZA: "maghreb",
  TUN: "maghreb",
  SAH: "maghreb",
  LBY: "libya",
  KAZ: "central_asia",
  UZB: "central_asia",
  TKM: "central_asia",
  KGZ: "central_asia",
  TJK: "central_asia",
  MNG: "mongolia",
  PRK: "korea",
  KOR: "korea",
  JPN: "japan_home",
  VNM: "indochina",
  LAO: "indochina",
  KHM: "indochina",
  THA: "siam",
  IDN: "indonesia",
  TLS: "indonesia",
  BRN: "indonesia",
  PHL: "philippines",
  MYS: "malaya",
  MMR: "burma",
  CAN: "canada",
  MEX: "mexico",
  BRA: "brazil",
  GUY: "brazil",
  SUR: "brazil",
  ARG: "southern_cone",
  CHL: "southern_cone",
  URY: "southern_cone",
  PRY: "southern_cone",
  PER: "andes",
  BOL: "andes",
  ECU: "andes",
  COL: "andes",
  VEN: "andes",
  AUS: "australia",
  NZL: "australia",
  MDG: "madagascar",
  ETH: "horn_africa",
  ERI: "horn_africa",
  DJI: "horn_africa",
  SOM: "horn_africa",
  SOL: "horn_africa",
  CHE: "austria",
  TWN: "south_china",
  LKA: "india_south",
  PAK: "india_north",
  BGD: "india_north",
  NPL: "india_north",
  BTN: "india_north",
  SEN: "west_africa",
  GMB: "west_africa",
  GNB: "west_africa",
  GIN: "west_africa",
  SLE: "west_africa",
  LBR: "west_africa",
  CIV: "west_africa",
  GHA: "west_africa",
  TGO: "west_africa",
  BEN: "west_africa",
  NGA: "west_africa",
  NER: "west_africa",
  MLI: "west_africa",
  BFA: "west_africa",
  MRT: "west_africa",
  COD: "central_africa",
  COG: "central_africa",
  CAF: "central_africa",
  CMR: "central_africa",
  GAB: "central_africa",
  GNQ: "central_africa",
  TCD: "central_africa",
  ZAF: "southern_africa",
  NAM: "southern_africa",
  BWA: "southern_africa",
  ZWE: "southern_africa",
  MOZ: "southern_africa",
  AGO: "southern_africa",
  ZMB: "southern_africa",
  MWI: "southern_africa",
  LSO: "southern_africa",
  SWZ: "southern_africa",
  KEN: "east_africa",
  TZA: "east_africa",
  UGA: "east_africa",
  RWA: "east_africa",
  BDI: "east_africa",
  GTM: "caribbean_central",
  BLZ: "caribbean_central",
  HND: "caribbean_central",
  SLV: "caribbean_central",
  NIC: "caribbean_central",
  CRI: "caribbean_central",
  PAN: "caribbean_central",
  CUB: "caribbean_central",
  JAM: "caribbean_central",
  HTI: "caribbean_central",
  DOM: "caribbean_central",
  PRI: "caribbean_central",
  BHS: "caribbean_central",
  TTO: "caribbean_central",
  PNG: "pacific_islands",
  FJI: "pacific_islands",
  SLB: "pacific_islands",
  VUT: "pacific_islands",
  NCL: "pacific_islands",
};

const FALLBACK_BOXES = {
  britain: [-8.2, 49.9, 1.8, 58.7],
  ireland: [-10.5, 51.4, -5.9, 55.4],
  france_north: [-5.0, 46.5, 8.2, 51.2],
  france_south: [-1.8, 42.3, 9.6, 46.5],
  low_countries: [2.5, 49.5, 7.2, 53.7],
  rhineland: [5.9, 48.9, 8.0, 52.2],
  germany_north: [8.0, 51.0, 15.0, 55.0],
  germany_south: [7.5, 47.3, 13.9, 51.0],
  austria: [9.5, 46.4, 17.2, 49.0],
  czechoslovakia: [12.1, 47.7, 22.6, 51.1],
  poland: [14.1, 49.0, 24.1, 54.8],
  hungary: [16.1, 45.7, 22.9, 48.6],
  romania: [20.3, 43.6, 29.7, 48.3],
  yugoslavia: [13.4, 40.8, 23.0, 46.9],
  greece: [19.4, 34.8, 28.3, 42.1],
  italy_north: [6.6, 43.2, 13.9, 47.1],
  italy_south: [8.1, 36.6, 18.5, 43.2],
  iberia: [-9.5, 36.0, 3.3, 43.8],
  scandinavia: [4.9, 54.8, 31.3, 71.2],
  finland: [20.5, 59.8, 31.6, 70.1],
  baltics: [21.0, 53.9, 28.2, 59.7],
  european_russia: [27.3, 44.0, 60.0, 70.0],
  ukraine: [22.1, 44.4, 40.2, 52.4],
  belarus: [23.2, 51.3, 32.8, 56.2],
  anatolia: [26.0, 35.8, 44.8, 42.3],
  caucasus: [40.0, 38.4, 50.4, 43.6],
  levant: [34.2, 29.2, 48.6, 37.4],
  arabia: [34.5, 12.3, 60.0, 32.2],
  persia: [44.0, 25.0, 75.0, 39.8],
  egypt_suez: [24.7, 21.7, 36.9, 31.7],
  maghreb: [-17.1, 19.0, 11.6, 37.3],
  libya: [9.3, 19.5, 25.2, 33.2],
  siberia: [60.0, 50.0, 180.0, 77.7],
  central_asia: [46.5, 35.1, 87.4, 55.4],
  manchuria: [118.0, 40.0, 135.1, 53.5],
  korea: [124.5, 33.1, 130.9, 43.0],
  japan_home: [129.4, 31.0, 145.8, 45.6],
  north_china: [73.7, 31.0, 122.5, 42.5],
  south_china: [97.5, 18.1, 122.7, 31.0],
  indochina: [102.1, 8.4, 109.5, 23.4],
  siam: [97.3, 5.6, 105.6, 20.5],
  india_north: [60.9, 21.5, 97.4, 37.1],
  india_south: [72.6, 6.7, 88.9, 21.5],
  indonesia: [95.0, -11.0, 141.0, 6.0],
  philippines: [117.2, 4.6, 126.6, 19.4],
  malaya: [99.6, 1.0, 119.3, 7.4],
  burma: [92.2, 9.9, 101.2, 28.5],
  mongolia: [87.7, 41.6, 119.9, 52.1],
  west_africa: [-17.5, 4.3, 16.0, 25.0],
  horn_africa: [33.0, -1.7, 51.4, 18.0],
  central_africa: [8.5, -13.5, 31.3, 23.5],
  southern_africa: [11.2, -34.8, 41.0, -8.0],
  east_africa: [29.3, -11.7, 41.9, 4.2],
  madagascar: [43.2, -25.6, 50.5, -11.9],
  us_east: [-100.0, 24.5, -66.9, 49.4],
  us_west: [-168.2, 31.3, -100.0, 71.4],
  canada: [-141.0, 41.7, -52.6, 83.1],
  mexico: [-117.1, 14.5, -86.7, 32.7],
  caribbean_central: [-92.5, 7.2, -59.4, 27.3],
  brazil: [-74.0, -33.8, -34.7, 5.3],
  southern_cone: [-75.6, -55.9, -53.4, -21.2],
  andes: [-81.3, -22.9, -59.8, 12.4],
  australia: [112.9, -47.3, 179.0, -10.0],
  pacific_islands: [141.0, -22.4, 180.0, 0.0],
};

function ensureNaturalEarth() {
  if (existsSync(cachePath) && readFileSync(cachePath, "utf8").length > 10000) {
    return;
  }
  mkdirSync(path.dirname(cachePath), { recursive: true });
  execFileSync("curl.exe", ["-L", "--retry", "3", "-o", cachePath, NE_URL], {
    stdio: "inherit",
  });
}

function polygonsOf(feature) {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

function ringBbox(ring) {
  let minX = 180;
  let minY = 90;
  let maxX = -180;
  let maxY = -90;
  for (const p of ring) {
    const x = p[0];
    const y = p[1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function clipRing(ring, inside, intersect) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const aIn = inside(a);
    const bIn = inside(b);
    if (aIn && bIn) {
      out.push(b);
    } else if (aIn && !bIn) {
      out.push(intersect(a, b));
    } else if (!aIn && bIn) {
      out.push(intersect(a, b));
      out.push(b);
    }
  }
  if (out.length < 3) return null;
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]]);
  }
  return out;
}

function lerpEdge(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clipPolygons(polys, inside, intersect) {
  const next = [];
  for (const poly of polys) {
    const rings = [];
    for (let r = 0; r < poly.length; r++) {
      const clipped = clipRing(poly[r], inside, intersect);
      if (r === 0) {
        if (!clipped) {
          rings.length = 0;
          break;
        }
        rings.push(clipped);
      } else if (clipped) {
        rings.push(clipped);
      }
    }
    if (rings.length > 0) next.push(rings);
  }
  return next;
}

function clipLngLe(polys, maxLng) {
  return clipPolygons(
    polys,
    (p) => p[0] <= maxLng,
    (a, b) => lerpEdge(a, b, (maxLng - a[0]) / (b[0] - a[0])),
  );
}

function clipLngGe(polys, minLng) {
  return clipPolygons(
    polys,
    (p) => p[0] >= minLng,
    (a, b) => lerpEdge(a, b, (minLng - a[0]) / (b[0] - a[0])),
  );
}

function clipLatLe(polys, maxLat) {
  return clipPolygons(
    polys,
    (p) => p[1] <= maxLat,
    (a, b) => lerpEdge(a, b, (maxLat - a[1]) / (b[1] - a[1])),
  );
}

function clipLatGe(polys, minLat) {
  return clipPolygons(
    polys,
    (p) => p[1] >= minLat,
    (a, b) => lerpEdge(a, b, (minLat - a[1]) / (b[1] - a[1])),
  );
}

function roundRing(ring) {
  return ring.map((p) => [
    Math.round(p[0] * 10000) / 10000,
    Math.round(p[1] * 10000) / 10000,
  ]);
}

function pushPolys(bucket, regionId, polys) {
  if (!polys.length) return;
  const list = bucket.get(regionId);
  for (const poly of polys) {
    const rounded = poly.map(roundRing).filter((ring) => ring.length >= 4);
    if (rounded.length === 0) continue;
    list.push(rounded);
  }
}

function boxPolygon(west, south, east, north) {
  return [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ];
}

function featureByAdm(features, adm) {
  return features.find((f) => f.properties.ADM0_A3 === adm);
}

ensureNaturalEarth();
const collection = JSON.parse(readFileSync(cachePath, "utf8"));
const features = collection.features;
const bucket = new Map(REGION_IDS.map((id) => [id, []]));

for (const feature of features) {
  const adm = feature.properties.ADM0_A3;
  const regionId = WHOLE[adm];
  if (!regionId) continue;
  pushPolys(bucket, regionId, polygonsOf(feature));
}

{
  const fra = featureByAdm(features, "FRA");
  if (fra) {
    for (const poly of polygonsOf(fra)) {
      const [minX, minY, maxX, maxY] = ringBbox(poly[0]);
      if (maxX < -20) continue;
      if (minY > 40 && maxY < 44 && minX > 8) {
        pushPolys(bucket, "france_south", [poly]);
        continue;
      }
      pushPolys(bucket, "france_north", clipLatGe([poly], 46.5));
      pushPolys(bucket, "france_south", clipLatLe([poly], 46.5));
    }
  }
}

{
  const deu = featureByAdm(features, "DEU");
  if (deu) {
    const polys = polygonsOf(deu);
    pushPolys(bucket, "rhineland", clipLngLe(polys, 8.0));
    const east = clipLngGe(polys, 8.0);
    pushPolys(bucket, "germany_north", clipLatGe(east, 51.0));
    pushPolys(bucket, "germany_south", clipLatLe(east, 51.0));
  }
}

{
  const ita = featureByAdm(features, "ITA");
  if (ita) {
    for (const poly of polygonsOf(ita)) {
      const [, , , maxY] = ringBbox(poly[0]);
      if (maxY < 43.2) {
        pushPolys(bucket, "italy_south", [poly]);
        continue;
      }
      pushPolys(bucket, "italy_north", clipLatGe([poly], 43.2));
      pushPolys(bucket, "italy_south", clipLatLe([poly], 43.2));
    }
  }
}

{
  const usa = featureByAdm(features, "USA");
  if (usa) {
    for (const poly of polygonsOf(usa)) {
      const [minX, minY, maxX, maxY] = ringBbox(poly[0]);
      if (maxY < 24 && minX < -140) {
        pushPolys(bucket, "pacific_islands", [poly]);
        continue;
      }
      if (minY > 50 && maxX < -125) {
        pushPolys(bucket, "us_west", [poly]);
        continue;
      }
      pushPolys(bucket, "us_west", clipLngLe([poly], -100));
      pushPolys(bucket, "us_east", clipLngGe([poly], -100));
    }
  }
}

{
  const rus = featureByAdm(features, "RUS");
  if (rus) {
    for (const poly of polygonsOf(rus)) {
      const [minX, minY, maxX, maxY] = ringBbox(poly[0]);
      if (minX > 18 && maxX < 24 && minY > 53 && maxY < 56) {
        pushPolys(bucket, "european_russia", [poly]);
        continue;
      }
      if (minX > 31 && maxX < 37 && minY > 43 && maxY < 47) {
        pushPolys(bucket, "ukraine", [poly]);
        continue;
      }
      if (maxX < 0 || minX < -20) {
        pushPolys(bucket, "siberia", [poly]);
        continue;
      }
      if (minX >= 60) {
        pushPolys(bucket, "siberia", [poly]);
        continue;
      }
      if (maxX <= 60) {
        pushPolys(bucket, "european_russia", [poly]);
        continue;
      }
      pushPolys(bucket, "european_russia", clipLngLe([poly], 60));
      pushPolys(bucket, "siberia", clipLngGe([poly], 60));
    }
  }
}

{
  const chn = featureByAdm(features, "CHN");
  if (chn) {
    for (const poly of polygonsOf(chn)) {
      const [, minY, , maxY] = ringBbox(poly[0]);
      if (maxY < 22) {
        pushPolys(bucket, "south_china", [poly]);
        continue;
      }
      const manchuria = clipLatGe(clipLngGe([poly], 118), 40);
      pushPolys(bucket, "manchuria", manchuria);
      const south = clipLatLe([poly], 31);
      pushPolys(bucket, "south_china", south);
      const northBand = clipLatGe(clipLatLe([poly], 40), 31);
      pushPolys(bucket, "north_china", northBand);
      const northWest = clipLatGe(clipLngLe([poly], 118), 40);
      pushPolys(bucket, "north_china", northWest);
    }
  }
}

{
  const ind = featureByAdm(features, "IND");
  if (ind) {
    const polys = polygonsOf(ind);
    pushPolys(bucket, "india_north", clipLatGe(polys, 21.5));
    pushPolys(bucket, "india_south", clipLatLe(polys, 21.5));
  }
}

for (const id of REGION_IDS) {
  if (bucket.get(id).length === 0) {
    const box = FALLBACK_BOXES[id];
    if (!box) throw new Error(`No geometry for ${id}`);
    console.warn(`fallback bbox for ${id}`);
    pushPolys(bucket, id, [boxPolygon(...box)]);
  }
}

const out = {
  type: "FeatureCollection",
  features: REGION_IDS.map((id) => ({
    type: "Feature",
    id,
    properties: { id },
    geometry: { type: "MultiPolygon", coordinates: bucket.get(id) },
  })),
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));
const bytes = readFileSync(outPath).length;
console.log(
  `wrote ${outPath} (${bytes} bytes, ${out.features.length} regions)`,
);
for (const id of REGION_IDS) {
  console.log(`  ${id}: ${bucket.get(id).length} polygons`);
}
