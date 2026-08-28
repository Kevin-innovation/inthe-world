"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  ChronicleEntry,
  EventDefinition,
  GameState,
  NationStocks,
  PolicySliders,
  WorldView,
} from "@simul/sim";
import { findEvent } from "@simul/sim";
import {
  applyDraftPolicies,
  playerPolicies,
  previewPolicyCost,
  resolveHarnessEvent,
  tickWeek,
} from "@/lib/harness";
import {
  DOCTRINES,
  HQ_STAT_KEYS,
  POLICY_GROUPS,
  doctrineMessageKey,
  formatGameDate,
  formatStat,
  isDoctrine,
  type HqStatKey,
} from "@/lib/hq-model";
import { t } from "@/lib/i18n";

function MapPlaceholder({ collapsed }: { collapsed: boolean }) {
  const label = t("hq.map");
  const body = <div className="map-placeholder">{label}</div>;
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

function StatCells({
  stocks,
  asChips,
}: {
  stocks: NationStocks;
  asChips: boolean;
}) {
  const items = HQ_STAT_KEYS.map((key: HqStatKey) => (
    <div key={key} className={asChips ? "hq-chip" : "hq-stat-cell"}>
      <span>{t(`hq.${key}`)}</span>
      <strong>{formatStat(key, stocks[key])}</strong>
    </div>
  ));
  if (asChips) return <div className="hq-chips">{items}</div>;
  return <div className="hq-stat-grid">{items}</div>;
}

function PolicyDetails({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  // Native <details open> is a controlled attr in React and resets on parent re-render.
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen((current) => (current === next ? current : next));
      }}
    >
      {children}
    </details>
  );
}

function NewspaperList({ entries }: { entries: ChronicleEntry[] }) {
  return (
    <section className="hq-panel">
      <h2>{t("hq.newspaper")}</h2>
      {entries.length === 0 ? (
        <p className="newspaper-empty">{t("hq.newspaperEmpty")}</p>
      ) : (
        <ul className="newspaper-list">
          {entries.map((entry, index) => (
            <li key={`${entry.tick}-${entry.titleKey}-${index}`}>
              <h3>{t(entry.titleKey, entry.args)}</h3>
              <p>{t(entry.bodyKey, entry.args)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventModal({
  event,
  onChoose,
}: {
  event: EventDefinition;
  onChoose: (choiceId: string) => void;
}) {
  const buttons = event.choices.slice(0, 3);
  return (
    <div className="event-modal" role="dialog" aria-modal="true">
      <div className="event-modal-card">
        <p className="event-kicker">{t("hq.event")}</p>
        <h2>{t(event.titleKey)}</h2>
        <p>{t(event.blurbKey)}</p>
        <div className="event-choices">
          {buttons.map((choice) => (
            <button
              key={choice.id}
              className="hq-btn hq-btn-primary"
              type="button"
              onClick={() => onChoose(choice.id)}
            >
              {t(choice.titleKey)} · {choice.ppCost} {t("hq.pp")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HqHarness({
  initialState,
  world,
}: {
  initialState: GameState;
  world: WorldView;
}) {
  const [state, setState] = useState<GameState>(initialState);
  // Copy policies so range handlers cannot mutate the committed GameState object.
  const [draft, setDraft] = useState<PolicySliders>(() => playerPolicies(state));
  const [papers, setPapers] = useState<ChronicleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const player = state.nations[state.playerCountryId];
  const cost = useMemo(() => previewPolicyCost(state, draft), [state, draft]);
  const pp = player?.stocks.politicalPower ?? 0;
  const canApply = cost > 0 && cost <= pp;

  function onNextWeek() {
    if (state.pendingEvent) return;
    try {
      const result = tickWeek(state, world);
      setState(result.state);
      if (result.newspapers.length > 0) {
        setPapers((prev) => [...result.newspapers, ...prev].slice(0, 24));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("hq.tickFailed"));
    }
  }

  function onEventChoice(choiceId: string) {
    const result = resolveHarnessEvent(state, world, choiceId);
    if (result.error) {
      setError(t("hq.eventResolveFailed"));
      return;
    }
    setState(result.state);
    if (result.newspapers.length > 0) {
      setPapers((prev) => [...result.newspapers, ...prev].slice(0, 24));
    }
    setError(null);
  }

  function onApply() {
    if (!canApply) return;
    const result = applyDraftPolicies(state, draft);
    if (result.error) {
      setError(
        result.error === "insufficient_pp"
          ? t("hq.insufficientPp")
          : t("hq.missingPlayer"),
      );
      return;
    }
    const nextPolicies = playerPolicies(result.state);
    setState(result.state);
    setDraft(nextPolicies);
    setError(null);
  }

  if (!player) {
    return <p className="hq-error">{t("hq.missingPlayer")}</p>;
  }

  const feed =
    papers.length > 0
      ? papers.slice(0, 16)
      : [...state.chronicle].reverse().slice(0, 16);
  const pendingEvent = state.pendingEvent
    ? findEvent(world.events, state.pendingEvent.eventId)
    : undefined;

  return (
    <div className="hq">
      {pendingEvent ? (
        <EventModal event={pendingEvent} onChoose={onEventChoice} />
      ) : null}
      <header className="hq-bar">
        <div className="hq-meter">
          <span>{t("hq.date")}</span>
          <strong>{formatGameDate(state.date)}</strong>
        </div>
        <div className="hq-meter">
          <span>{t("hq.pp")}</span>
          <strong>{formatStat("politicalPower", player.stocks.politicalPower)}</strong>
        </div>
        <div className="hq-meter">
          <span>{t("hq.worldTension")}</span>
          <strong>{state.worldTension.toFixed(1)}</strong>
        </div>
        <div className="hq-meter">
          <span>{t("hq.tick")}</span>
          <strong>{state.tickIndex}</strong>
        </div>
        <div className="hq-bar-actions">
          <button className="hq-btn hq-btn-primary" type="button" onClick={onNextWeek}>
            {t("hq.nextWeek")}
          </button>
        </div>
      </header>

      <MapPlaceholder collapsed={false} />
      <StatCells stocks={player.stocks} asChips />
      <MapPlaceholder collapsed />

      <div className="hq-col">
        <section className="hq-panel hq-desktop-stats">
          <StatCells stocks={player.stocks} asChips={false} />
        </section>

        <section className="hq-panel">
          <div className="hq-apply-row">
            <span className={canApply || cost === 0 ? "hq-cost" : "hq-cost is-blocked"}>
              {t("hq.previewCost")}: {cost.toFixed(1)} {t("hq.pp")}
              {cost > pp ? ` — ${t("hq.insufficientPp")}` : ""}
            </span>
            <button
              className="hq-btn hq-btn-primary"
              type="button"
              disabled={!canApply}
              onClick={onApply}
            >
              {t("hq.apply")}
            </button>
          </div>
          {error ? <p className="hq-error">{error}</p> : null}
          <div className="hq-accordion">
            {POLICY_GROUPS.map((group) => (
              <PolicyDetails key={group.id} defaultOpen={group.id === "economy"}>
                <summary>{t(`policy.group.${group.id}`)}</summary>
                {group.fields.map((field) => {
                  if (field.kind === "doctrine") {
                    return (
                      <div className="slider-row slider-row-doctrine" key={field.key}>
                        <label htmlFor="policy-doctrine">{t("policy.doctrine")}</label>
                        <select
                          id="policy-doctrine"
                          value={draft.doctrine}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (!isDoctrine(value)) return;
                            setDraft((current) => ({ ...current, doctrine: value }));
                          }}
                        >
                          {DOCTRINES.map((doctrine) => (
                            <option key={doctrine} value={doctrine}>
                              {t(doctrineMessageKey(doctrine))}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  const id = `policy-${field.key}`;
                  return (
                    <div className="slider-row" key={field.key}>
                      <label htmlFor={id}>{t(`policy.${field.key}`)}</label>
                      <input
                        id={id}
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={1}
                        value={draft[field.key]}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (!Number.isFinite(next)) return;
                          setDraft((current) => ({ ...current, [field.key]: next }));
                        }}
                      />
                      <output htmlFor={id}>{draft[field.key]}</output>
                    </div>
                  );
                })}
              </PolicyDetails>
            ))}
          </div>
        </section>

        <NewspaperList entries={feed} />
      </div>
    </div>
  );
}
