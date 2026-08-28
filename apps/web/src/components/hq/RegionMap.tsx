"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { RegionState } from "@simul/sim";
import "maplibre-gl/dist/maplibre-gl.css";
import { t } from "@/lib/i18n";
import { paintedRegionCollection, regionCenter } from "@/lib/region-geojson";

const SATELLITE_TILES =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg";

function formatDamage(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function RegionInspector({ region }: { region: RegionState | undefined }) {
  if (!region) {
    return (
      <div className="region-inspector" aria-live="polite">
        <p>{t("hq.inspectorEmpty")}</p>
      </div>
    );
  }

  const contested = region.contestedBy;
  return (
    <div className="region-inspector" aria-live="polite">
      <dl>
        <div>
          <dt>{t("hq.regionId")}</dt>
          <dd>{region.id}</dd>
        </div>
        <div>
          <dt>{t("hq.owner")}</dt>
          <dd>{region.owner}</dd>
        </div>
        <div>
          <dt>{t("hq.controller")}</dt>
          <dd>{region.controller}</dd>
        </div>
        <div>
          <dt>{t("hq.terrain")}</dt>
          <dd>{t(`terrain.${region.terrain}`)}</dd>
        </div>
        <div>
          <dt>{t("hq.coastal")}</dt>
          <dd>{region.coastal ? t("hq.yes") : t("hq.no")}</dd>
        </div>
        <div>
          <dt>{t("hq.contestedBy")}</dt>
          <dd>{contested ?? t("hq.none")}</dd>
        </div>
        <div>
          <dt>{t("hq.factoryDamage")}</dt>
          <dd>{formatDamage(region.factoryDamage)}</dd>
        </div>
      </dl>
    </div>
  );
}

function applySelection(
  map: MapLibreMap,
  previousId: string | null,
  selectedId: string | null,
): void {
  if (previousId && previousId !== selectedId) {
    map.setFeatureState(
      { source: "regions", id: previousId },
      { selected: false },
    );
  }
  if (selectedId) {
    map.setFeatureState(
      { source: "regions", id: selectedId },
      { selected: true },
    );
  }
}

export function RegionMap({
  regions,
  selectedId,
  onSelect,
}: {
  regions: Record<string, RegionState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const regionsRef = useRef(regions);
  const selectedRef = useRef(selectedId);
  const hoverIdRef = useRef<string | number | null>(null);
  const appliedSelectedRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  onSelectRef.current = onSelect;
  regionsRef.current = regions;
  selectedRef.current = selectedId;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let resize: ResizeObserver | undefined;
    let readyTimer: number | undefined;

    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !rootRef.current) return;
        const maplibregl = maplibre.default ?? maplibre;
        map = new maplibregl.Map({
          container: rootRef.current,
          style: {
            version: 8,
            projection: { type: "globe" },
            sources: {
              satellite: {
                type: "raster",
                tiles: [SATELLITE_TILES],
                tileSize: 256,
                maxzoom: 13,
                attribution:
                  '<a href="https://s2maps.eu/" target="_blank" rel="noreferrer">Sentinel-2 cloudless</a> © <a href="https://eox.at/" target="_blank" rel="noreferrer">EOX</a>',
              },
            },
            layers: [
              { id: "satellite", type: "raster", source: "satellite" },
            ],
            light: {
              anchor: "viewport",
              color: "#ffffff",
              intensity: 0.45,
              position: [1.5, 90, 80],
            },
            sky: {
              "atmosphere-blend": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                0.85,
                5,
                0.5,
                7,
                0,
              ],
            },
          },
          center: [20, 18],
          zoom: 1.15,
          minZoom: 0.6,
          maxZoom: 7.5,
          logoPosition: "bottom-right",
          attributionControl: { compact: true },
          canvasContextAttributes: { antialias: true },
        });
        map.addControl(
          new maplibregl.NavigationControl({ visualizePitch: true }),
          "top-right",
        );

        map.on("error", (event) => {
          if (event.error) {
            console.warn("globe map error", event.error);
            const message = event.error.message ?? String(event.error);
            rootRef.current?.setAttribute("data-globe-error", message);
          }
        });

        readyTimer = window.setTimeout(() => {
          if (!cancelled) {
            setStatus((current) => (current === "loading" ? "ready" : current));
          }
        }, 8000);

        map.on("load", () => {
          if (!map || cancelled) return;
          window.clearTimeout(readyTimer);
          map.setProjection({ type: "globe" });
          map.setLight({
            anchor: "viewport",
            color: "#ffffff",
            intensity: 0.45,
            position: [1.5, 90, 80],
          });
          if (!map.getSource("regions")) {
            map.addSource("regions", {
              type: "geojson",
              data: paintedRegionCollection(regionsRef.current),
              promoteId: "id",
            });
          }
          if (!map.getLayer("regions-fill")) {
            map.addLayer({
              id: "regions-fill",
              type: "fill-extrusion",
              source: "regions",
              paint: {
                "fill-extrusion-color": ["get", "fill"],
                "fill-extrusion-opacity": 0.62,
                "fill-extrusion-height": 12000,
                "fill-extrusion-base": 0,
              },
            });
            map.addLayer({
              id: "regions-line",
              type: "line",
              source: "regions",
              paint: {
                "line-color": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  "#e8e2d4",
                  "rgba(10, 14, 18, 0.75)",
                ],
                "line-width": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  2.2,
                  0.6,
                ],
              },
            });
            map.addLayer({
              id: "regions-contested",
              type: "line",
              source: "regions",
              filter: ["==", ["get", "contested"], true],
              paint: {
                "line-color": "#1a120c",
                "line-width": 1.8,
                "line-dasharray": [1.2, 1.2],
              },
            });
          }
          applySelection(map, null, selectedRef.current);
          appliedSelectedRef.current = selectedRef.current;
          map.resize();
          setStatus("ready");
        });

        map.on("click", "regions-fill", (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id;
          if (typeof id === "string") onSelectRef.current(id);
        });

        map.on("mousemove", "regions-fill", (event) => {
          if (!map) return;
          map.getCanvas().style.cursor = "pointer";
          const next = event.features?.[0]?.id;
          if (next === undefined || next === hoverIdRef.current) return;
          if (hoverIdRef.current !== null) {
            map.setFeatureState(
              { source: "regions", id: hoverIdRef.current },
              { hover: false },
            );
          }
          hoverIdRef.current = next;
          map.setFeatureState({ source: "regions", id: next }, { hover: true });
        });

        map.on("mouseleave", "regions-fill", () => {
          if (!map) return;
          map.getCanvas().style.cursor = "";
          if (hoverIdRef.current !== null) {
            map.setFeatureState(
              { source: "regions", id: hoverIdRef.current },
              { hover: false },
            );
            hoverIdRef.current = null;
          }
        });

        mapRef.current = map;
        resize = new ResizeObserver(() => map?.resize());
        resize.observe(root);
      } catch (error) {
        console.warn("globe map failed to start", error);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (readyTimer !== undefined) window.clearTimeout(readyTimer);
      resize?.disconnect();
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("regions")) return;
    (map.getSource("regions") as GeoJSONSource).setData(
      paintedRegionCollection(regions),
    );
    applySelection(map, appliedSelectedRef.current, selectedId);
    appliedSelectedRef.current = selectedId;
  }, [regions, selectedId]);

  const regionIds = Object.keys(regions);
  const selected = selectedId ? regions[selectedId] : undefined;

  return (
    <section className="hq-map" aria-label={t("hq.map")}>
      <div className="hq-globe">
        <div
          ref={rootRef}
          className="globe-root"
          role="application"
          aria-label={t("hq.map")}
        />
        {status !== "ready" ? (
          <p className="globe-status">
            {status === "error" ? t("hq.mapFailed") : t("hq.mapLoading")}
          </p>
        ) : null}
        <div className="globe-hud">
          <label className="globe-region-select">
            <span>{t("hq.regionId")}</span>
            <select
              value={selectedId ?? ""}
              aria-label={t("hq.regionId")}
              onChange={(event) => {
                const id = event.target.value;
                if (!id) return;
                onSelect(id);
                const center = regionCenter(id);
                const map = mapRef.current;
                if (center && map) {
                  map.flyTo({ center, zoom: Math.max(map.getZoom(), 2.6) });
                }
              }}
            >
              <option value="">{t("hq.inspectorEmpty")}</option>
              {regionIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <RegionInspector region={selected} />
        </div>
      </div>
    </section>
  );
}
