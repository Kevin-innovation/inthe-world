import {
  COMING_STORM_REGION_ROWS,
  type ComingStormRegionId,
} from "./coming-storm-regions";

export const MAP_VIEWBOX = "0 0 1120 560";

/** Schematic board blobs (enlarged Europe for hit targets), not Natural Earth. */
export const REGION_BOXES: Record<
  ComingStormRegionId,
  readonly [x: number, y: number, w: number, h: number]
> = {
  canada: [28, 22, 300, 82],
  us_west: [32, 108, 140, 86],
  us_east: [176, 110, 140, 88],
  mexico: [56, 198, 148, 48],
  caribbean_central: [168, 250, 136, 36],
  andes: [148, 290, 60, 160],
  brazil: [212, 290, 120, 140],
  southern_cone: [160, 454, 116, 80],

  ireland: [362, 76, 30, 34],
  britain: [396, 62, 42, 50],
  scandinavia: [444, 16, 54, 72],
  finland: [502, 20, 46, 64],
  baltics: [552, 50, 42, 34],
  european_russia: [598, 16, 122, 70],
  low_countries: [444, 92, 30, 28],
  germany_north: [478, 90, 46, 36],
  poland: [528, 88, 50, 40],
  belarus: [582, 88, 44, 36],
  france_north: [384, 116, 56, 34],
  rhineland: [444, 122, 30, 34],
  germany_south: [478, 128, 44, 32],
  czechoslovakia: [526, 130, 48, 30],
  ukraine: [578, 126, 50, 40],
  iberia: [354, 154, 48, 56],
  france_south: [406, 154, 36, 32],
  italy_north: [444, 158, 32, 30],
  austria: [480, 162, 40, 24],
  hungary: [524, 162, 42, 26],
  romania: [570, 168, 48, 34],
  italy_south: [448, 190, 28, 40],
  yugoslavia: [484, 190, 44, 32],
  greece: [492, 226, 40, 30],

  anatolia: [536, 210, 72, 44],
  caucasus: [632, 122, 60, 48],
  levant: [576, 258, 48, 36],
  arabia: [548, 296, 80, 34],
  persia: [636, 174, 80, 72],
  egypt_suez: [500, 256, 72, 32],
  maghreb: [352, 218, 96, 46],
  libya: [452, 236, 38, 50],

  west_africa: [344, 268, 104, 84],
  central_africa: [452, 290, 70, 90],
  horn_africa: [588, 334, 72, 60],
  east_africa: [528, 348, 56, 70],
  southern_africa: [448, 384, 76, 100],
  madagascar: [608, 404, 32, 64],

  siberia: [724, 16, 320, 100],
  central_asia: [720, 120, 108, 72],
  mongolia: [832, 118, 100, 52],
  manchuria: [936, 118, 80, 48],
  korea: [1020, 132, 28, 44],
  japan_home: [1052, 112, 42, 70],
  north_china: [872, 174, 88, 48],
  south_china: [872, 226, 80, 52],
  india_north: [724, 196, 96, 64],
  india_south: [728, 264, 84, 68],
  burma: [824, 196, 44, 80],
  siam: [828, 280, 48, 48],
  indochina: [880, 280, 52, 52],
  malaya: [848, 332, 44, 36],
  indonesia: [816, 372, 176, 52],
  philippines: [956, 244, 52, 72],
  pacific_islands: [1020, 220, 72, 120],
  australia: [860, 432, 160, 92],
};

export function boxToPath(x: number, y: number, w: number, h: number): string {
  const rx = Math.min(w * 0.14, 14);
  const ry = Math.min(h * 0.16, 12);
  return `M ${x + rx} ${y} L ${x + w - rx} ${y} L ${x + w} ${y + ry} L ${x + w} ${y + h - ry} L ${x + w - rx} ${y + h} L ${x + rx} ${y + h} L ${x} ${y + h - ry} L ${x} ${y + ry} Z`;
}

export function regionPath(id: ComingStormRegionId): string {
  const [x, y, w, h] = REGION_BOXES[id];
  return boxToPath(x, y, w, h);
}

/** Large land first so small European blobs stay on top for clicks. */
export const REGION_DRAW_ORDER: readonly ComingStormRegionId[] =
  COMING_STORM_REGION_ROWS.map((row) => row[0]).sort((a, b) => {
    const boxA = REGION_BOXES[a];
    const boxB = REGION_BOXES[b];
    return boxB[2] * boxB[3] - boxA[2] * boxA[3];
  });

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable owner → HSL so the same country keeps its color across ticks. */
export function ownerFill(countryId: string): string {
  const hash = fnv1a32(countryId);
  const hue = hash % 360;
  const sat = 40 + (hash % 26);
  const light = 36 + ((hash >>> 10) % 16);
  return `hsl(${hue} ${sat}% ${light}%)`;
}
