"use client";

import type { KeyboardEvent } from "react";
import type { RegionState } from "@simul/sim";
import {
  MAP_VIEWBOX,
  ownerFill,
  REGION_DRAW_ORDER,
  regionPath,
} from "@/lib/region-geometry";
import { t } from "@/lib/i18n";

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

function Choropleth({
  instanceId,
  regions,
  selectedId,
  onSelect,
}: {
  instanceId: string;
  regions: Record<string, RegionState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hatchId = `region-hatch-${instanceId}`;
  const selected = selectedId ? regions[selectedId] : undefined;

  function onRegionKey(event: KeyboardEvent<SVGPathElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(id);
  }

  return (
    <div className="choropleth">
      <svg
        viewBox={MAP_VIEWBOX}
        role="img"
        aria-label={t("hq.map")}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id={hatchId}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path
              d="M 0 0 L 0 7"
              stroke="rgba(18, 14, 10, 0.62)"
              strokeWidth="2.2"
            />
            <path
              d="M 3.5 0 L 3.5 7"
              stroke="rgba(255, 248, 230, 0.28)"
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
        {REGION_DRAW_ORDER.map((id) => {
          const region = regions[id];
          const d = regionPath(id);
          const selectedHere = selectedId === id;
          const contested = Boolean(region?.contestedBy);
          return (
            <g key={id}>
              <path
                className={
                  selectedHere ? "region-path is-selected" : "region-path"
                }
                d={d}
                fill={region ? ownerFill(region.owner) : "var(--map)"}
                tabIndex={0}
                role="button"
                aria-pressed={selectedHere}
                aria-label={id}
                onClick={() => onSelect(id)}
                onKeyDown={(event) => onRegionKey(event, id)}
              >
                <title>{id}</title>
              </path>
              {contested ? (
                <path
                  className="region-hatch"
                  d={d}
                  fill={`url(#${hatchId})`}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <RegionInspector region={selected} />
    </div>
  );
}

export function RegionMap({
  collapsed,
  regions,
  selectedId,
  onSelect,
}: {
  collapsed: boolean;
  regions: Record<string, RegionState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const label = t("hq.map");
  const body = (
    <Choropleth
      instanceId={collapsed ? "mobile" : "desktop"}
      regions={regions}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
  if (!collapsed) {
    return (
      <section className="hq-map-desktop" aria-label={label}>
        {body}
      </section>
    );
  }
  return (
    <details className="hq-map-mobile">
      <summary>{label}</summary>
      {body}
    </details>
  );
}
