import type { RegionState } from "@simul/sim";
import outlines from "./coming-storm.geo.json";
import { ownerFill } from "./region-geometry";

type OutlineCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    properties: { id: string };
    geometry: {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };
  }>;
};

export type PaintedRegionCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    properties: { id: string; fill: string; contested: boolean };
    geometry: {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };
  }>;
};

const OUTLINES = outlines as OutlineCollection;

export function regionCenter(id: string): [number, number] | null {
  const feature = OUTLINES.features.find((entry) => entry.id === id);
  const ring = feature?.geometry.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  let n = 0;
  for (const point of ring) {
    const x = point[0];
    const y = point[1];
    if (x === undefined || y === undefined) continue;
    lng += x;
    lat += y;
    n += 1;
  }
  if (n === 0) return null;
  return [lng / n, lat / n];
}

export function paintedRegionCollection(
  regions: Record<string, RegionState>,
): PaintedRegionCollection {
  return {
    type: "FeatureCollection",
    features: OUTLINES.features.map((feature) => {
      const region = regions[feature.id];
      return {
        type: "Feature",
        id: feature.id,
        properties: {
          id: feature.id,
          fill: region ? ownerFill(region.owner) : "#6b727a",
          contested: Boolean(region?.contestedBy),
        },
        geometry: feature.geometry,
      };
    }),
  };
}
